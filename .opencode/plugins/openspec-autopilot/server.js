// Parte de servidor del plugin openspec-autopilot para OpenCode 2
// (openspec-autopilot, design D3 a D15 de add-openspec-autopilot): automatiza
// el ciclo de un change en la TUI, con una sesión nueva por paso.
//
// - Dónde actúa: solo con la TUI presentada (D13), en una rama temporal con
//   un change o sin ninguno (.agents/openspec/branch-change.mjs, D1). Con
//   varios changes avisa y no hace nada.
// - El estado vive en la clave `openspec` de la metadata de las sesiones
//   (lib/state.mjs, D4): una sola dueña por rama.
// - Al abrir el usuario una sesión, el hook `context` de su primera petición
//   decide si toma el control (D5) y le inyecta la instrucción del paso.
// - Cada paso termina con la tool `openspec_handoff` (D7); las revisiones y el
//   verify con problemas críticos del modo auto piden antes la confirmación
//   del usuario en la TUI (D8). Después, `experimental.idle` crea la sesión
//   del paso siguiente (lib/next-step.mjs, D6), la arranca si el árbol está
//   limpio (D11), navega a ella y archiva la anterior desde la TUI.
// - `openspec_session` da a update-change el contenido de una sesión del
//   índice del change (D9); las lecciones candidatas quedan en la metadata y
//   llegan a la resincronización del wiki (D10).
// - Nunca lanza una excepción hacia OpenCode ni bloquea una petición: un
//   fallo se avisa en la TUI y deja la sesión libre (D12). Todas las esperas
//   tienen límite.
//
// Sin dependencias: objetos literales { id, setup } y solo módulos node:,
// como session-bootstrap.

import { RPC, TIMEOUT_MS } from './lib/rpc.mjs';
import { describe, needsConfirmation, next, zoneOf } from './lib/next-step.mjs';
import { HANDOFF_TOOL, SESSION_TOOL, WORKFLOW, commitPrompt, resumeCommand, reviewPrompt, stepPrompt } from './lib/prompts.mjs';
import { branchSessions, changeSessions, isArchived, isWorking, meta, nextSeq, owners, winner, writeMeta } from './lib/state.mjs';
import { branchChange, changeState, treeClean } from './lib/project.mjs';

const ID = RPC.id;
const REGISTRY = Symbol.for('openspec-autopilot.registry');
const log = (...args) => console.error(`[${ID}]`, ...args);

const VERB = {
  new: 'creando el change',
  artifact: 'creando un artefacto de',
  task: 'aplicando',
  verify: 'verificando',
  archive: 'archivando',
  wiki: 'resincronizando el wiki de',
  update: 'actualizando el plan de',
  review: 'revisando',
};

const textOf = (content) =>
  typeof content === 'string' ? content : (Array.isArray(content) ? content : []).filter((p) => p?.type === 'text').map((p) => p.text).join('\n');

// --- Puente con la TUI ------------------------------------------------------

function tuiBridge(ctx, gen) {
  const pending = new Map();
  let target = null;
  let seq = 0;
  let registration = null;

  const ready = () => target !== null;

  const request = (op, args) =>
    new Promise((resolve, reject) => {
      if (!target || !registration) {
        reject(new Error('no hay ninguna TUI'));
        return;
      }
      const id = `${gen}:${++seq}`;
      const instance = target;
      const timer = setTimeout(() => {
        pending.delete(id);
        reject(new Error(`la TUI no ha respondido a '${op}'`));
      }, TIMEOUT_MS[op] ?? 10000);
      timer.unref?.();
      pending.set(id, { instance, resolve, reject, timer });
      Promise.resolve(registration.events.emit('request', { id, instance, op, args })).catch((error) => {
        clearTimeout(timer);
        pending.delete(id);
        reject(error);
      });
    });

  const toast = (message, variant = 'warning') => {
    log(message);
    request('toast', { message, variant }).catch((error) => log('toast:', error?.message ?? error));
  };

  const handlers = {
    hello: async (input) => {
      if (input && typeof input.instance === 'string') target = input.instance;
      return { ok: true };
    },
    reply: async (input) => {
      const waiting = pending.get(input?.id);
      // Una sola respuesta por petición, la de la instancia destinataria
      if (!waiting || waiting.instance !== input.instance) return { ok: false };
      pending.delete(input.id);
      clearTimeout(waiting.timer);
      if (input.error) waiting.reject(new Error(input.error));
      else waiting.resolve(input.value ?? null);
      return { ok: true };
    },
  };

  const start = async () => {
    try {
      registration = await ctx.rpc.register(RPC, handlers);
      // Tras una recarga del servidor, la TUI ya cargada se vuelve a presentar
      Promise.resolve(registration.events.emit('hello-request', { gen })).catch((error) => log('hello-request:', error));
    } catch (error) {
      log('rpc:', error);
    }
  };

  return { ready, request, toast, start };
}

// --- El plugin -------------------------------------------------------------

async function start(ctx) {
  const registry = (globalThis[REGISTRY] ??= { gen: 0 });
  const gen = ++registry.gen;
  const alive = () => registry.gen === gen;
  const directory = ctx.location.directory;
  const mode = ctx.options?.auto === true ? 'auto' : 'normal';
  const api = ctx.session;
  const tui = tuiBridge(ctx, gen);
  await tui.start();

  // Instrucciones que se repiten en las peticiones del mismo turno (tras una
  // tool), porque el hook context no guarda lo que añade
  const injecting = new Map(); // sessionID -> { users, text }
  const deciding = new Set();
  const chaining = new Set();

  const guard = (name, fn) => async (...args) => {
    if (!alive()) return undefined;
    try {
      return await fn(...args);
    } catch (error) {
      log(`${name}:`, error);
      return undefined;
    }
  };

  // Un fallo de una operación: aviso y la sesión, libre (design D12)
  const failed = async (what, error, sessionID) => {
    tui.toast(`openspec-autopilot: ${what} (${error?.message ?? error}). La sesión queda libre; abre una sesión nueva para seguir con el change.`);
    if (!sessionID) return;
    try {
      await writeMeta(api, sessionID, { role: 'free', phase: 'failed' });
    } catch (e) {
      log('free:', e);
    }
  };

  const indexOf = async (m) => {
    const sessions = changeSessions(await branchSessions(api, m), m.change);
    return sessions;
  };

  const indexText = (sessions) =>
    sessions
      .map((s) => {
        const m = meta(s);
        const review = m.review ? ` — ${m.review.result}${m.review.conclusions ? `: ${m.review.conclusions}` : ''}` : '';
        return `- #${m.seq} ${s.id}: ${describe(m.step, null)}${review}`;
      })
      .join('\n');

  const promptFor = async (m) => {
    const base = { step: m.step, change: m.change, description: m.description ?? '' };
    if (m.step.kind === 'update') return stepPrompt({ ...base, conclusions: m.conclusions ?? '', index: indexText(await indexOf(m)) });
    if (m.step.kind === 'wiki') {
      const lessons = (await indexOf(m)).flatMap((s) => (Array.isArray(meta(s).lessons) ? meta(s).lessons : []));
      return stepPrompt({ ...base, lessons });
    }
    return stepPrompt(base);
  };

  // --- Al abrir una sesión (design D5) ---

  const takeControl = async (session, branch, { change, step, description = '', zone = null }) => {
    const clean = await treeClean(directory);
    const sessions = await branchSessions(api, { worktree: directory, branch });
    const m = {
      worktree: directory,
      branch,
      change,
      role: 'owner',
      step,
      seq: nextSeq(sessions.filter((s) => s.id !== session.id)),
      phase: clean ? 'running' : 'waiting-commit',
      zone,
      injected: clean,
      description,
    };
    await writeMeta(api, session.id, m);
    // Escribir y comprobar: si otra sesión ha tomado el control a la vez, gana la más antigua
    const contenders = owners(await branchSessions(api, { worktree: directory, branch }));
    const first = winner(contenders);
    if (first && first.id !== session.id) {
      await writeMeta(api, session.id, { role: 'free', phase: 'lost' });
      tui.toast(`openspec-autopilot: la sesión «${first.title}» tiene el control de ${change ?? 'esta rama'}; esta queda libre.`);
      return null;
    }
    for (const other of contenders) {
      if (other.id !== session.id) await writeMeta(api, other.id, { role: 'free', phase: 'lost' });
    }
    if (!clean) {
      tui.toast(`openspec-autopilot: haz el commit de los cambios pendientes; ${describe(step, change)} empezará en cuanto escribas en esta sesión con el árbol limpio.`);
      return commitPrompt({ step, change });
    }
    return promptFor(m);
  };

  const decideOpen = async (session, text) => {
    const bc = await branchChange(directory);
    if (bc.kind === 'permanent') return null;
    if (bc.kind === 'unknown') {
      tui.toast(`openspec-autopilot: no actúa en esta rama: ${bc.warnings.at(-1) ?? 'no se puede leer su change'}.`);
      return null;
    }
    if (bc.kind === 'several') {
      const names = [...new Set(bc.changes.map((c) => c.name))];
      tui.toast(`openspec-autopilot: la rama ${bc.branch} tiene varios changes (${names.join(', ')}); no orquesta nada hasta que quede uno solo.`);
      return null;
    }
    if (bc.kind === 'archived') return null;
    if (bc.kind === 'none') return takeControl(session, bc.branch, { change: null, step: { kind: 'new' }, description: text });

    const change = bc.change;
    const current = owners(await branchSessions(api, { worktree: directory, branch: bc.branch })).filter((s) => s.id !== session.id);
    if (current.length === 0) {
      const { step } = next({ mode, finished: null, state: await changeState(directory, change) });
      return takeControl(session, bc.branch, { change, step });
    }
    const owner = await api.get({ sessionID: winner(current).id });
    if (isWorking(owner)) {
      tui.toast(`openspec-autopilot: la sesión «${owner.title}» tiene el control de ${change} y está trabajando; esta sesión queda libre.`, 'info');
      return null;
    }
    let choice = null;
    try {
      choice = await tui.request('select', {
        title: `La sesión «${owner.title}» tiene el control de ${change} y está parada. ¿Qué quieres hacer?`,
        options: [
          { title: 'Ir a la sesión dueña', value: 'go', description: 'Esta sesión queda libre.' },
          { title: 'Archivarla y seguir aquí', value: 'take', description: 'Esta sesión toma el control del change.' },
        ],
      });
    } catch (error) {
      log('select:', error);
    }
    if (choice === 'go') {
      await tui.request('navigate', { sessionID: owner.id });
      return null;
    }
    if (choice !== 'take') return null;
    await tui.request('archive', { sessionID: owner.id });
    const archived = await api.get({ sessionID: owner.id });
    if (!isArchived(archived)) throw new Error(`la sesión «${owner.title}» no ha quedado archivada`);
    const was = meta(owner);
    await writeMeta(api, owner.id, { role: 'free', phase: 'abandoned' });
    const { step } = was?.step ? { step: was.step } : next({ mode, finished: null, state: await changeState(directory, change) });
    return takeControl(session, bc.branch, { change, step, zone: was?.zone ?? null });
  };

  const inject = (input, text) => {
    const messages = input.messages;
    let at = messages.length;
    for (let i = messages.length - 1; i >= 0; i--) {
      if (messages[i]?.role === 'user') {
        at = i;
        break;
      }
    }
    messages.splice(at, 0, { role: 'user', content: [{ type: 'text', text }] });
  };

  const onContext = guard('context', async (input) => {
    if (!tui.ready()) return;
    const sessionID = input.sessionID;
    const users = input.messages.filter((m) => m?.role === 'user').length;
    const remembered = injecting.get(sessionID);
    if (remembered && remembered.users === users) {
      inject(input, remembered.text);
      return;
    }
    injecting.delete(sessionID);
    const session = await api.get({ sessionID });
    const m = meta(session);
    let text = null;
    if (!m) {
      // Solo la primera petición de una sesión abierta por el usuario
      const answered = input.messages.some((msg) => msg?.role === 'assistant');
      if (users !== 1 || answered || deciding.has(sessionID)) return;
      deciding.add(sessionID);
      try {
        const last = [...input.messages].reverse().find((msg) => msg?.role === 'user');
        text = await decideOpen(session, textOf(last?.content));
      } catch (error) {
        await failed('no se ha podido decidir quién tiene el control del change', error, sessionID);
        return;
      } finally {
        deciding.delete(sessionID);
      }
    } else if (m.role === 'owner' && !isArchived(session) && m.phase === 'waiting-commit') {
      // La sesión espera un commit (design D11): se comprueba en cada mensaje
      if (await treeClean(directory)) {
        await writeMeta(api, sessionID, { phase: 'running', injected: true });
        try {
          await api.update({ sessionID, title: describe(m.step, m.change) });
        } catch (error) {
          log('title:', error);
        }
        text = await promptFor(m);
      } else {
        text = commitPrompt({ step: m.step, change: m.change });
      }
    }
    if (!text) return;
    inject(input, text);
    injecting.set(sessionID, { users, text });
  });

  // --- Cerrar un paso (design D7, D8) ---

  const stepDone = async (m) => {
    const step = m.step;
    if (step.kind === 'new') {
      const bc = await branchChange(directory);
      return bc.kind === 'active' ? null : 'todavía no hay ningún change en curso en la rama';
    }
    if (step.kind === 'artifact') {
      const state = await changeState(directory, m.change);
      const artifact = (state.status?.artifacts ?? []).find((a) => a.id === step.id);
      return artifact?.status === 'done' ? null : `openspec status no da el artefacto ${step.id} como terminado`;
    }
    if (step.kind === 'task') {
      const state = await changeState(directory, m.change);
      const task = state.tasks.find((t) => t.id === String(step.id));
      return task?.done ? null : `la task ${step.id} no está marcada en tasks.md`;
    }
    if (step.kind === 'archive') {
      const bc = await branchChange(directory);
      return bc.kind === 'archived' ? null : `${m.change} no está archivado en la rama`;
    }
    return null;
  };

  const handoff = guard('handoff', async (input, context) => {
    if (!tui.ready()) return { content: 'openspec-autopilot solo orquesta el change en la TUI de OpenCode; aquí no hay nada que traspasar.' };
    const sessionID = context.sessionID;
    const session = await api.get({ sessionID });
    const m = meta(session);
    if (!m || m.role !== 'owner' || isArchived(session)) {
      return { content: 'Esta sesión no tiene el control de ningún change: no hay ningún paso que cerrar.' };
    }
    if (m.phase !== 'running') return { content: 'Este paso ya está cerrado, o todavía no ha empezado.' };
    const result = typeof input?.result === 'string' ? input.result.trim().toLowerCase() : null;
    const conclusions = typeof input?.conclusions === 'string' ? input.conclusions.trim() : '';
    const lessons = Array.isArray(input?.lessons) ? input.lessons.filter((l) => typeof l === 'string' && l.trim() !== '').map((l) => l.trim()) : [];

    const missing = await stepDone(m);
    if (missing) {
      tui.toast(`openspec-autopilot: el modelo ha cerrado ${describe(m.step, m.change)}, pero ${missing}; no se encadena el paso siguiente.`);
      return { content: `El paso no ha terminado: ${missing}. No se traspasa el control: termínalo y vuelve a llamar a la tool.` };
    }
    if (m.step.kind === 'review' && result !== 'ok' && result !== 'no ok') {
      return { content: 'Falta el resultado de la revisión: llama a la tool con result "ok" o "no ok".' };
    }
    if (mode === 'auto' && m.step.kind === 'verify' && result === 'critical') {
      // Se para: la sesión pasa a ser la revisión del verify (design D8)
      const step = { kind: 'review', id: 'verify', of: 'verify' };
      await writeMeta(api, sessionID, { step, review: { result: 'critical', conclusions } });
      tui.toast(`openspec-autopilot: el verify de ${m.change} tiene problemas críticos; revísalos en esta sesión.`);
      return { content: `El verify tiene problemas críticos, así que el ciclo se para aquí. ${reviewPrompt({ step, change: m.change })}` };
    }
    if (needsConfirmation({ mode, step: m.step, result })) {
      let choice = null;
      try {
        choice = await tui.request('select', {
          title: `¿Cerrar la ${describe(m.step, m.change)}? Resultado: ${result}${conclusions ? `. Conclusiones: ${conclusions}` : ''}`,
          options: [
            { title: 'Sí, cerrar la revisión', value: 'confirm', description: `Resultado: ${result}` },
            { title: 'No, seguir con la revisión', value: 'continue' },
          ],
        });
      } catch (error) {
        log('select:', error);
      }
      if (choice !== 'confirm') {
        return { content: 'El usuario no ha dado por terminada la revisión: sigue con ella y no la cierres hasta que el usuario lo diga.' };
      }
    }
    const patch = { phase: 'handed-off', handoff: { result, conclusions }, lessons };
    if (m.step.kind === 'review') patch.review = { result, conclusions };
    await writeMeta(api, sessionID, patch);
    return { content: 'Paso cerrado. Al terminar esta respuesta, el plugin abre la sesión del paso siguiente; no hagas nada más.' };
  });

  // --- Encadenar el paso siguiente (design D7, D11, D12) ---

  const onIdle = guard('idle', async ({ sessionID }) => {
    if (!tui.ready() || chaining.has(sessionID)) return;
    const session = await api.get({ sessionID });
    const m = meta(session);
    if (!m || m.role !== 'owner' || m.phase !== 'handed-off' || isArchived(session)) return;
    chaining.add(sessionID);
    try {
      // Idempotente (design D7): se marca con el seq de la sesión siguiente antes de crearla
      await writeMeta(api, sessionID, { phase: 'chaining', nextSeq: (m.seq ?? 0) + 1 });
      const change = m.change ?? (await branchChange(directory)).change;
      const lastZone = zoneOf(m.step) ?? m.zone ?? null;
      const state = await changeState(directory, change);
      const { step, zoneChange } = next({ mode, finished: m.step, result: m.handoff?.result, state, lastZone });

      if (step.kind === 'end') {
        await writeMeta(api, sessionID, { role: 'free', phase: 'done' });
        tui.toast(`openspec-autopilot: el ciclo de ${change} ha terminado. Haz el commit del wiki, aparte del commit del archive, y fusiona la rama.`, 'info');
        await tui.request('archive', { sessionID });
        return;
      }
      if (step.kind === 'blocked') throw new Error(`openspec status no da ningún artefacto listo para ${change}`);

      const clean = mode === 'normal' || zoneChange ? await treeClean(directory) : true;
      const nm = {
        worktree: m.worktree,
        branch: m.branch,
        change,
        role: 'owner',
        step,
        seq: (m.seq ?? 0) + 1,
        phase: clean ? 'running' : 'waiting-commit',
        zone: lastZone,
        injected: clean,
        ...(step.kind === 'update' ? { conclusions: m.handoff?.conclusions ?? '' } : {}),
      };
      let created;
      try {
        created = await api.create({
          title: `${describe(step, change)}${clean ? '' : ' (esperando commit)'}`,
          agent: WORKFLOW[step.kind]?.agent ?? 'build',
          metadata: { ...{}, openspec: { v: 1, ...nm } },
        });
      } catch (error) {
        await failed(`no se ha podido crear la sesión del paso siguiente (${describe(step, change)})`, error, sessionID);
        return;
      }
      await writeMeta(api, sessionID, { role: 'free', phase: 'done' });
      try {
        await tui.request('navigate', { sessionID: created.id });
        await tui.request('archive', { sessionID });
        if (!isArchived(await api.get({ sessionID }))) throw new Error('la sesión anterior no ha quedado archivada');
      } catch (error) {
        tui.toast(`openspec-autopilot: no se ha podido pasar a la sesión nueva o archivar la anterior (${error?.message ?? error}).`);
      }
      if (!clean) {
        tui.toast(`openspec-autopilot: haz el commit de los cambios pendientes; ${describe(step, change)} empezará en cuanto escribas en su sesión con el árbol limpio.`);
        return;
      }
      const skill = WORKFLOW[step.kind]?.skill;
      try {
        await api.prompt({ sessionID: created.id, text: await promptFor(nm), ...(skill ? { skills: [{ id: skill }] } : {}) });
      } catch (error) {
        await failed(`no se ha podido arrancar ${describe(step, change)}`, error, created.id);
      }
    } catch (error) {
      await failed('no se ha podido encadenar el paso siguiente', error, sessionID);
    } finally {
      chaining.delete(sessionID);
    }
  });

  // --- Índice: el contenido de una sesión del change (design D9) ---

  const readSession = guard('session', async (input, context) => {
    const caller = meta(await api.get({ sessionID: context.sessionID }));
    if (!caller?.change) return { content: 'Esta sesión no tiene el control de ningún change.' };
    const target = typeof input?.sessionID === 'string' ? input.sessionID : '';
    const inChange = (await indexOf(caller)).some((s) => s.id === target);
    if (!inChange) return { content: `La sesión ${target || '(sin identificador)'} no es del change ${caller.change}: solo se leen sesiones de su índice.` };
    const messages = await api.context({ sessionID: target });
    const text = (Array.isArray(messages) ? messages : [])
      .map((msg) => {
        if (msg?.type === 'user') return `Usuario: ${msg.text ?? ''}`;
        if (msg?.type === 'assistant') {
          const parts = (msg.content ?? []).filter((p) => p?.type === 'text').map((p) => p.text);
          return parts.length > 0 ? `Asistente: ${parts.join('\n')}` : null;
        }
        return null;
      })
      .filter(Boolean)
      .join('\n\n');
    return { content: text || '(la sesión no tiene mensajes de texto)' };
  });

  // --- Compactación (design D15) ---

  const onCompaction = guard('compaction', async (input) => {
    const session = await api.get({ sessionID: input.sessionID });
    const m = meta(session);
    if (!m || m.role !== 'owner' || isArchived(session)) return;
    const command = resumeCommand(m.step, m.change);
    tui.toast(
      `openspec-autopilot: la sesión se ha compactado; estaba ${VERB[m.step?.kind] ?? 'trabajando en'} \`${m.change ?? 'el change'}\` (${describe(m.step, m.change)}).` +
        (command ? ` Para retomarlo, escribe ${command}${m.step?.kind === 'task' ? ` (task ${m.step.id})` : ''}.` : ' Para retomarlo, pide al modelo que siga con el paso.')
    );
  });

  // --- Registro ---

  ctx.tool.transform((editor) => {
    editor.add({
      name: HANDOFF_TOOL,
      description:
        'Cierra el paso del ciclo de OpenSpec que hace esta sesión y pasa el control a la sesión del paso siguiente. Llámala una sola vez, al terminar el paso. En una revisión, solo cuando el usuario la dé por terminada.',
      options: { codemode: false },
      input: {
        type: 'object',
        properties: {
          result: { type: 'string', description: 'Revisión: "ok" o "no ok". Verify: "clean" o "critical".' },
          conclusions: { type: 'string', description: 'Conclusiones de la revisión o resumen del verify.' },
          lessons: { type: 'array', items: { type: 'string' }, description: 'Lecciones candidatas, una frase cada una.' },
        },
      },
      execute: async (input, context) => (await handoff(input, context)) ?? { content: 'openspec-autopilot no ha podido cerrar el paso.' },
    });
    editor.add({
      name: SESSION_TOOL,
      description: 'Devuelve el contenido (mensajes de texto) de una sesión del índice del change.',
      options: { codemode: false },
      input: { type: 'object', properties: { sessionID: { type: 'string' } }, required: ['sessionID'] },
      execute: async (input, context) => (await readSession(input, context)) ?? { content: 'openspec-autopilot no ha podido leer la sesión.' },
    });
  });
  await api.hook('context', onContext);
  await api.hook('experimental.idle', onIdle);
  await api.hook('compaction', onCompaction);
}

export default {
  id: ID,
  async setup(ctx) {
    try {
      await start(ctx);
    } catch (error) {
      log('setup:', error);
    }
  },
};
