// Parte de servidor del plugin openspec-autopilot para OpenCode 2
// (ADR-0022; design de add-openspec-autopilot, de autopilot-sesion-operativa y
// de autopilot-rama-por-sesion).
// Toda la lógica del ciclo vive aquí y funciona con cualquier cliente (TUI,
// UI web, OpenCode Desktop, `opencode run`); la TUI solo pone la interfaz
// (tui.js), pedida por el RPC del plugin (D1).
//
// - Una instancia por directorio (D2 de autopilot-rama-por-sesion): OpenCode
//   carga el plugin una vez por directorio (el checkout principal y cada
//   worktree), y cada instancia solo crea, valida y encadena las sesiones de
//   su directorio.
// - Sesión operativa (D2): una sola sesión viva por rama temporal, la dueña del
//   change en la metadata de OpenCode (lib/state.mjs). Ninguna otra toma el
//   control mientras sea válida. En una rama permanente no se crea, arranca,
//   archiva ni encadena nada (D8 de autopilot-rama-por-sesion).
// - Arranque (D3): al presentarse una TUI nueva (otro PID), si la rama
//   temporal no tiene sesión operativa, se crea y se arranca sola.
// - La rama de trabajo de cada sesión (D1 de autopilot-rama-por-sesion): se
//   compara con HEAD en `screen` (al recuperar el foco), en `prompt` y en
//   reposo. Si la sesión ha hecho un checkout, cambia su rama; si era la
//   operativa, deja de serlo, y al volver el directorio a esa rama otra sesión
//   operativa retoma el paso.
// - Pantallas (D3 y D4 de autopilot-rama-por-sesion) y validación (D5): la TUI
//   informa de cada pantalla (`screen`). Entrar en una sesión pone su rama (o
//   vuelve a la ventana anterior si no se puede); la pantalla de inicio o una
//   sesión nueva en una rama temporal con sesión operativa muestran el modal
//   de `/new`; la sesión operativa se valida.
// - Worktrees (D5 y D6 de autopilot-rama-por-sesion): la estrategia de
//   lib/worktree.mjs y la tool openspec_worktree, que crea el worktree con su
//   sesión operativa.
// - Cada paso empieza con un mensaje en su sesión (D6) y se le recuerda en
//   cada petición (hook context).
// - Producto evaluable (D7): al quedar la sesión en reposo, el plugin compara
//   la foto del change según el CLI y, con producto, lo pasa al stage y abre
//   la revisión (modo normal) o sigue (modo auto).
// - Las revisiones las cierra git (D8), en el hook `prompt`: HEAD avanzado y
//   nada en el stage es ok; HEAD igual, nada en el stage y cambios, ko.
// - Sin TUI (D13): aviso en el contexto de las sesiones ajenas, archivado
//   diferido (`archivePending`) y arranque con el mensaje `autopilot`.
// - El agente plan (autopilot-plan-explore, ADR-0019): todas las sesiones
//   nacen con build. Lo que se inyecta en la sesión operativa se decide una vez
//   por turno según el agente (lib/agent-turn.mjs): la clave del turno es el
//   último messageID del hook `prompt` (`turnMessage`), desde la primera
//   petición que lleva ese mensaje. Al pasar a plan, el flujo de
//   openspec-explore; en plan, su recordatorio; al volver a build, el
//   recordatorio del paso.
// - Lo modificado con plan (D4 y D5 de autopilot-plan-explore): el estado de
//   git al empezar un turno en plan (`planTurn`) se compara al quedar en
//   reposo. Si ha cambiado, aviso: en la TUI, un modal (`notice`) que, con
//   producto, retiene la cadena en `plan-notice` hasta el acuse (`ack`, por la
//   sesión) o un prompt del usuario; sin TUI, en el mensaje de arranque de la
//   sesión siguiente o en el contexto de la petición siguiente.
// - Nunca lanza una excepción hacia OpenCode ni bloquea una petición: un
//   fallo se avisa y deja la sesión libre. Todas las esperas tienen límite.
//
// Sin dependencias: objetos literales { id, setup } y solo módulos node:.

import fs from 'node:fs';
import path from 'node:path';
import { GLOBAL, RPC, TIMEOUT_MS } from './lib/rpc.mjs';
import { globalActs } from './lib/place.mjs';
import { describe, discrepancy, next, stepFromState, waitsForCommit, zoneOf } from './lib/next-step.mjs';
import { HANDOFF_TOOL, MARK, SESSION_TOOL, START_WORD, WORKFLOW, WORKTREE_TOOL, closedPrompt, explorePrompt, exploreReminderPrompt, foreignPrompt, planNoticeText, reminderPrompt, resumeCommand, returnPrompt, stepPrompt } from './lib/prompts.mjs';
import { agentTurn, transition, turnKey } from './lib/agent-turn.mjs';
import { allSessions, branchMoved, firstMeta, branchSessions, changeSessions, isArchived, isWorking, leftFrom, meta, nextSeq, owners, sessionDir, winner, writeMeta } from './lib/state.mjs';
import { branchChange, changeState, switchTo, validateErrors, wikiEnabled } from './lib/project.mjs';
import { currentBranch, gitState, stage, treeClean, verdict } from './lib/git.mjs';
import { describeProducts, productOf, reviewQueue, snapshotOf, stagePaths } from './lib/product.mjs';
import { checkedOut, enterSession, newWindow } from './lib/screen.mjs';
import { strategy as worktreeStrategy } from './lib/worktree.mjs';
import { CONFIG_PATH, SYNC_TIMEOUT_MS, syncApplyGuidance, withTimeout } from './lib/apply-guidance.mjs';

const ID = 'openspec-autopilot';
const REGISTRY = Symbol.for('openspec-autopilot.registry');
// Cuánto se juntan las peticiones de control de una rama que llegan a la vez
const CONTEST_MS = 150;
// Los reintentos para leer el primer mensaje de un worktree nuevo (design D10)
const FIRST_MESSAGE_RETRY_MS = [100, 200, 400, 800];
const FIRST_MESSAGE_MAX_AGE_MS = 30000;
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

// --- Puente con los clientes con interfaz (D1) ----------------------------------

function clientBridge(ctx, gen, registry, directory, onFirst) {
  const pending = new Map();
  let target = null;
  let seq = 0;
  let registration = null;

  const ready = () => target !== null;
  // El PID de la TUI presentada: distingue un arranque de una recarga (D5 de autopilot-plan-explore)
  const pid = () => /^tui-(\d+)-/.exec(target ?? '')?.[1] ?? null;

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
      Promise.resolve(registration.events.emit('request', { id, instance, directory, op, args })).catch((error) => {
        clearTimeout(timer);
        pending.delete(id);
        reject(error);
      });
    });

  const toast = (message, variant = 'warning') => {
    log(message);
    if (!ready()) return;
    request('toast', { message, variant }).catch((error) => log('toast:', error?.message ?? error));
  };

  // Un aviso que no se pierde sin TUI: espera a que se presente la primera
  const queued = [];
  const notice = (message, variant = 'warning') => {
    if (ready()) toast(message, variant);
    else {
      log(message);
      queued.push({ message, variant });
    }
  };

  const start = async (handlers) => {
    const all = {
      hello: async (input) => {
        const instance = typeof input?.instance === 'string' ? input.instance : null;
        if (!instance) return { ok: false };
        target = instance;
        for (const { message, variant } of queued.splice(0)) toast(message, variant);
        const pid = String(input?.pid ?? /^tui-(\d+)-/.exec(instance)?.[1] ?? '');
        // Un PID nuevo es un arranque de la TUI; el mismo, una recarga (D3)
        const seen = (registry.pids[directory] ??= []);
        const first = pid !== '' && !seen.includes(pid);
        if (first) seen.push(pid);
        await onFirst({ first, route: input?.route ?? null });
        return { ok: true, first };
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
      ...handlers,
    };
    try {
      registration = await ctx.rpc.register(RPC, all);
      // Tras una recarga del servidor, la TUI ya cargada se vuelve a presentar
      Promise.resolve(registration.events.emit('hello-request', { gen, directory })).catch((error) => log('hello-request:', error));
    } catch (error) {
      log('rpc:', error);
    }
  };

  return { ready, pid, request, toast, notice, start };
}

// --- El plugin --------------------------------------------------------------------

async function start(ctx) {
  // Un mismo proceso (el servicio de OpenCode) carga el plugin una vez por
  // proyecto: la generación, que descarta las cargas anteriores tras una
  // recarga en caliente, y los PID ya presentados van por directorio
  const directory = ctx.location.directory;
  const registry = (globalThis[REGISTRY] ??= { gens: {}, pids: {} });
  registry.gens ??= {};
  registry.pids ??= {};
  registry.claims ??= {};
  registry.contests ??= {};
  const gen = (registry.gens[directory] = (registry.gens[directory] ?? 0) + 1);
  const alive = () => registry.gens[directory] === gen;
  const mode = ctx.options?.auto === true ? 'auto' : 'normal';
  const api = ctx.session;
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

  // --- Utilidades ---

  const failed = async (what, error, sessionID) => {
    ui.toast(`openspec-autopilot: ${what} (${error?.message ?? error}). La sesión queda libre.`);
    if (!sessionID) return;
    try {
      await writeMeta(api, sessionID, { role: 'free', phase: 'failed' });
    } catch (e) {
      log('free:', e);
    }
  };

  // Solo en una rama temporal con un change o sin ninguno (D8 de autopilot-rama-por-sesion)
  const actionable = (bc) => Boolean(bc?.branch) && ['none', 'active', 'archived'].includes(bc.kind);

  // Si una dueña sigue siendo válida en el estado de la rama (D2)
  const validFor = (bc) => (session) => {
    const m = meta(session);
    if (!m) return false;
    // Encadenando, sigue siendo la operativa hasta que pase el control
    if (m.phase === 'chaining') return true;
    if (m.change) return bc.change === m.change && (bc.kind === 'active' || bc.kind === 'archived');
    // El paso new: el change que acaba de crear es su producto
    return bc.kind === 'none' || (m.step?.kind === 'new' && bc.kind === 'active');
  };

  const opOf = async (bc) => {
    const sessions = await branchSessions(api, { worktree: directory, branch: bc.branch });
    const live = owners(sessions);
    const valid = live.filter(validFor(bc));
    const invalid = live.filter((s) => !validFor(bc)(s));
    return { op: winner(valid), invalid, sessions };
  };

  // Escribir y comprobar dos veces: la sesión que acaba de tomar el control
  // puede haber comprobado antes de que otra que lo tomaba a la vez escribiera
  // su metadata; tras una pausa breve, las dos ven a las dos y gana la más
  // antigua. Devuelve la ganadora si no es `sessionID`, o null.
  const CLAIM_RECHECK_MS = 150;
  const lostTo = async (bc, sessionID) => {
    for (const wait of [0, CLAIM_RECHECK_MS]) {
      if (wait) await new Promise((resolve) => setTimeout(resolve, wait).unref?.());
      const { op } = await opOf(bc);
      if (op && op.id !== sessionID) return op;
    }
    return null;
  };

  const archiveOrMark = async (sessionID) => {
    if (ui.ready()) {
      try {
        await ui.request('archive', { sessionID });
        if (isArchived(await api.get({ sessionID }))) return;
      } catch (error) {
        log('archive:', error?.message ?? error);
      }
    }
    // Sin TUI, el servidor no puede archivar: se archiva cuando llegue una (D13)
    await writeMeta(api, sessionID, { archivePending: true });
  };

  const navigate = async (sessionID) => {
    if (!ui.ready()) return;
    try {
      await ui.request('navigate', { sessionID });
    } catch (error) {
      log('navigate:', error?.message ?? error);
    }
  };

  const release = async (session, phase = 'abandoned') => {
    await writeMeta(api, session.id, { role: 'free', phase });
    await archiveOrMark(session.id);
  };

  const indexOf = async (m) => changeSessions(await branchSessions(api, m), m.change);

  const indexText = (sessions) =>
    sessions
      .map((s) => {
        const m = meta(s);
        const review = m.review?.result ? ` — ${m.review.result === 'ko' ? 'no ok' : m.review.result}${m.review.conclusions ? `: ${m.review.conclusions}` : ''}` : '';
        return `- #${m.seq} ${s.id}: ${describe(m.step, null)}${review}`;
      })
      .join('\n');

  const promptFor = async (m) => {
    const base = { step: m.step, change: m.change, description: m.description ?? '', review: m.review ?? null };
    if (m.step.kind === 'update') return stepPrompt({ ...base, conclusions: m.conclusions ?? '', index: indexText(await indexOf(m)) });
    if (m.step.kind === 'wiki') {
      const lessons = (await indexOf(m)).flatMap((s) => (Array.isArray(meta(s).lessons) ? meta(s).lessons : []));
      return stepPrompt({ ...base, lessons });
    }
    return stepPrompt(base);
  };

  const lastAssistantText = async (sessionID) => {
    try {
      const messages = await api.context({ sessionID });
      for (const msg of [...(Array.isArray(messages) ? messages : [])].reverse()) {
        if (msg?.type !== 'assistant') continue;
        const text = (msg.content ?? []).filter((p) => p?.type === 'text').map((p) => p.text).join('\n').trim();
        if (text) return text;
      }
    } catch (error) {
      log('context:', error?.message ?? error);
    }
    return '';
  };

  // --- La rama de trabajo de cada sesión (D1 de autopilot-rama-por-sesion) ---

  // El último checkout que hizo el plugin en este directorio: no es un cambio
  // de rama dentro de una sesión
  registry.checkouts ??= {};
  const pluginCheckout = (from, to) => {
    registry.checkouts[directory] = { from, to };
  };

  // Guarda la rama de trabajo de una sesión que todavía no la tiene, o la
  // actualiza si la sesión ha hecho un checkout. Devuelve la metadata al día.
  const trackBranch = async (session) => {
    if (!session || isArchived(session)) return meta(session);
    const dir = sessionDir(session) ?? directory;
    if (dir !== directory) return meta(session);
    const head = await currentBranch(directory);
    const m = meta(session);
    if (!m) {
      if (!head) return null;
      return firstMeta(api, session, { worktree: directory, branch: head });
    }
    if (!m.worktree) return m;
    const patch = branchMoved({ meta: m, head, pluginCheckout: registry.checkouts[directory] ?? null });
    if (!patch) return m;
    const written = await writeMeta(api, session.id, patch);
    if (patch.leftFrom) {
      ui.toast(`openspec-autopilot: la sesión «${session.title}» ha pasado a la rama ${head}, así que deja de ser la sesión operativa de ${patch.leftFrom}. Al volver a ${patch.leftFrom}, otra sesión operativa retomará el paso.`, 'info');
    }
    return written;
  };

  // --- Empezar un paso (D6, D7) ---

  const takeSnapshot = async (m, dir = directory) => {
    const git = await gitState(dir);
    let state = null;
    if (m.change && ['artifact', 'task', 'archive', 'verify'].includes(m.step.kind)) {
      try {
        state = await changeState(dir, m.change);
      } catch (error) {
        log('snapshot:', error?.message ?? error);
      }
    }
    return { snapshot: { ...snapshotOf(state ?? { change: m.change }, git.signature) }, git };
  };

  // Deja la sesión lista para su paso y devuelve la instrucción; con `send`, la envía
  const startStep = async (sessionID, m, { send = true, dir = directory } = {}) => {
    const { snapshot, git } = await takeSnapshot(m, dir);
    const isReview = m.step.kind === 'review';
    const review = isReview ? { ...(m.review ?? {}), git: { head: git.head, signature: git.signature } } : m.review;
    const patch = { phase: isReview ? 'review' : 'running', snapshot, handoff: null, ...(isReview ? { review } : {}), ...(m.noticeAtStart ? { noticeAtStart: null } : {}) };
    await writeMeta(api, sessionID, patch);
    const instruction = await promptFor({ ...m, review });
    // Lo modificado con plan en el paso anterior, sin TUI que lo avisara (D5)
    const text = m.noticeAtStart ? `${MARK} ${planNoticeText()} Díselo al usuario al empezar.\n\n${instruction}` : instruction;
    if (!send) return text;
    const skill = WORKFLOW[m.step.kind]?.skill;
    await api.prompt({ sessionID, text, ...(skill ? { skills: [{ id: skill }] } : {}) });
    return text;
  };

  const createStep = async ({ branch, change, step, seq, zone, wait, extra = {} }) => {
    const nm = { worktree: directory, branch, change: change ?? null, role: 'owner', step, seq, phase: wait ? 'waiting-commit' : 'starting', zone: zone ?? null, ...extra };
    const created = await api.create({
      title: `${describe(step, change)}${wait ? ' (esperando commit)' : ''}`,
      agent: WORKFLOW[step.kind]?.agent ?? 'build',
      metadata: { openspec: { v: 1, ...nm } },
    });
    if (!wait) await startStep(created.id, nm);
    return created;
  };

  // La sesión operativa de la rama, creándola si no hay ninguna válida (D3)
  // Tomar el control de una rama, de uno en uno en este proceso. Escribir y
  // comprobar no basta entre sesiones del mismo proceso: si la más nueva
  // comprueba antes de que escriba la más antigua, se ve sola y sigue; después
  // la más antigua escribe, gana por antigüedad y también sigue, y la rama
  // queda con dos operativas. En serie, la segunda ve ya escrita a la primera.
  // La cola vive en el registro de globalThis, para que valga entre recargas
  const claim = (branch, fn) => {
    const key = `${directory}\0${branch}`;
    const run = (registry.claims[key] ?? Promise.resolve()).then(fn, fn);
    registry.claims[key] = run.catch(() => {});
    return run;
  };

  // Varias sesiones que piden el control a la vez (el mensaje `autopilot`):
  // se juntan durante CONTEST_MS desde que llega el mensaje, antes de leer
  // nada del proyecto, y se atienden de una en una de la más antigua a la más
  // nueva, así que gana la más antigua (D4) aunque su mensaje llegue después
  // o tarde más en leer la rama. Resuelve con lo que devuelve run
  const contend = (sessionID, run) =>
    new Promise((resolve, reject) => {
      const key = directory;
      let contest = registry.contests[key];
      if (!contest) {
        contest = registry.contests[key] = { entries: [] };
        const timer = setTimeout(async () => {
          delete registry.contests[key];
          const created = async (id) => {
            try {
              return (await api.get({ sessionID: id }))?.time?.created ?? 0;
            } catch {
              return 0;
            }
          };
          const ordered = await Promise.all(contest.entries.map(async (entry) => ({ ...entry, created: await created(entry.sessionID) })));
          ordered.sort((a, b) => a.created - b.created || String(a.sessionID).localeCompare(String(b.sessionID)));
          for (const entry of ordered) {
            try {
              entry.resolve(await entry.run());
            } catch (error) {
              entry.reject(error);
            }
          }
        }, CONTEST_MS);
        timer.unref?.();
      }
      contest.entries.push({ sessionID, run, resolve, reject });
    });

  const ensureOperational = (bc, options) => claim(bc?.branch, () => ensureOperationalNow(bc, options));

  const ensureOperationalNow = async (bc, { go = false, description = '' } = {}) => {
    if (!actionable(bc) || bc.kind === 'archived') return null;
    const { op, invalid, sessions } = await opOf(bc);
    for (const s of invalid) {
      if (isWorking(s)) continue;
      await release(s);
    }
    if (op) return { session: op, created: false };
    const state = bc.kind === 'active' ? await changeState(directory, bc.change) : null;
    const step = bc.kind === 'active' ? stepFromState(state) : { kind: 'new' };
    if (step.kind === 'blocked') throw new Error(`openspec status no da ningún artefacto listo para ${bc.change}`);
    const clean = await treeClean(directory);
    const created = await createStep({ branch: bc.branch, change: bc.change ?? null, step, seq: nextSeq(sessions), zone: null, wait: !clean, extra: step.kind === 'new' && description ? { description } : {} });
    // Escribir y comprobar: si otra TUI ha creado otra a la vez, gana la más antigua
    const first = await lostTo(bc, created.id);
    if (first) {
      await release(await api.get({ sessionID: created.id }), 'lost');
      return { session: first, created: false };
    }
    if (!clean) ui.toast(`openspec-autopilot: haz el commit de los cambios pendientes; ${describe(step, bc.change)} empezará con el árbol limpio.`);
    // La rama retoma el paso de las sesiones que la dejaron al cambiar de rama (D1)
    for (const s of leftFrom(await allSessions(api).catch(() => []), { worktree: directory, branch: bc.branch })) {
      await writeMeta(api, s.id, { resumed: true }).catch((error) => log('resumed:', error?.message ?? error));
    }
    if (go) await navigate(created.id);
    return { session: created, created: true };
  };

  // --- Arranque (D3) ---

  const archivePending = async () => {
    if (!ui.ready()) return;
    const sessions = (await allSessions(api).catch(() => [])).filter((s) => meta(s)?.worktree === directory);
    for (const s of sessions) {
      if (!meta(s)?.archivePending || isArchived(s)) continue;
      try {
        await ui.request('archive', { sessionID: s.id });
        await writeMeta(api, s.id, { archivePending: false });
      } catch (error) {
        log('archivePending:', error?.message ?? error);
      }
    }
  };

  // La sesión con que OpenCode crea un worktree desde la pantalla de inicio:
  // de este directorio, sin paso y con mensajes del usuario (design D10)
  const firstMessage = async (route) => {
    if (route?.type !== 'session' || !route.sessionID) return '';
    let s = null;
    try {
      s = await api.get({ sessionID: route.sessionID });
    } catch {
      return '';
    }
    if (!s || isArchived(s) || (sessionDir(s) ?? directory) !== directory || meta(s)?.step) return '';
    // Solo una sesión recién creada: no la conversación de una sesión anterior
    const created = Number(s.time?.created ?? 0);
    if (!created || Date.now() - created > FIRST_MESSAGE_MAX_AGE_MS) return '';
    // El mensaje puede guardarse un poco después de que la TUI entre en la sesión
    for (const pause of [0, ...FIRST_MESSAGE_RETRY_MS]) {
      if (pause) await new Promise((resolve) => setTimeout(resolve, pause));
      const text = await userText(s.id);
      if (text) return text;
    }
    return '';
  };


  // Los avisos pendientes se vuelven a pedir a una TUI con otro PID; tras una
  // recarga (el mismo PID) el modal anterior sigue en pantalla (D5)
  const pendingNotices = async () => {
    const bc = await branchChange(directory);
    if (!actionable(bc)) return;
    for (const s of await branchSessions(api, { worktree: directory, branch: bc.branch })) {
      const m = meta(s);
      if (isArchived(s) || m?.role !== 'owner' || m.phase !== 'plan-notice' || m.planNotice?.pid === ui.pid()) continue;
      await writeMeta(api, s.id, { planNotice: { ...(m.planNotice ?? {}), pid: ui.pid() } });
      await showPlanNotice(s.id);
    }
  };

  const onFirst = guard('hello', async ({ first, route }) => {
    await archivePending();
    if (!first) return;
    await pendingNotices();
    const bc = await branchChange(directory);
    if (bc.kind === 'several') {
      const names = [...new Set(bc.changes.map((c) => c.name))];
      ui.toast(`openspec-autopilot: la rama ${bc.branch} tiene varios changes (${names.join(', ')}); no orquesta nada hasta que quede uno solo.`);
      return;
    }
    if (bc.kind === 'unknown') {
      ui.toast(`openspec-autopilot: no actúa en esta rama: ${bc.warnings.at(-1) ?? 'no se puede leer su change'}.`);
      return;
    }
    try {
      const description = bc.kind === 'none' ? await firstMessage(route) : '';
      await ensureOperational(bc, { go: true, description });
    } catch (error) {
      await failed('no se ha podido crear la sesión operativa', error, null);
    }
  });

  // --- Pantallas y validación (D4, D5) ---

  const validate = async (op, bc) => {
    const session = await api.get({ sessionID: op.id });
    if (isWorking(session)) return { action: 'none' };
    const m = meta(session);
    if (m.phase === 'waiting-commit') {
      if (await treeClean(directory)) {
        try {
          await api.update({ sessionID: op.id, title: describe(m.step, m.change) });
        } catch (error) {
          log('title:', error);
        }
        await startStep(op.id, m);
      }
      return { action: 'none' };
    }
    if (['new', 'artifact', 'task'].includes(m.step?.kind) && ['running', 'starting'].includes(m.phase)) {
      const state = m.change ? await changeState(directory, m.change) : { change: bc.change ?? null };
      const d = discrepancy(m.step, state);
      if (d) {
        return {
          action: 'notice',
          message: `El paso de la sesión operativa («${describe(m.step, m.change)}») no encaja con openspec status, que da como siguiente «${describe(d.expected, m.change)}». El plugin no lo arregla: revisa el change o sigue a mano en la sesión.`,
          button: 'Entendido',
        };
      }
    }
    return { action: 'none' };
  };

  // Los avisos que acompañan a una directiva
  const withToast = (d, message) => (message ? { ...d, toast: { message, variant: 'info' } } : d);

  // Entrar en una sesión es pasar a su rama (D3 de autopilot-rama-por-sesion)
  const enter = async (session, m, previous) => {
    const head = await currentBranch(directory);
    const others = (await allSessions(api).catch(() => [])).filter((s) => s.id !== session.id && !isArchived(s) && (sessionDir(s) ?? directory) === directory && isWorking(s));
    const { permanent, origin } = await branchChange(directory);
    const d = enterSession({
      target: { id: session.id, dir: directory, branch: m?.branch ?? null, archived: isArchived(session) },
      fromDir: previous?.directory ?? null,
      head,
      clean: await treeClean(directory),
      working: others[0]?.title ?? null,
      permanent,
      origin,
    });
    if (d.action !== 'checkout') return d;
    const result = await switchTo(directory, d.branch, d.via);
    if (!result.ok) return { action: 'back', reason: 'checkout', message: `openspec-autopilot: no se ha podido cambiar a la rama ${d.branch}: ${result.message}` };
    pluginCheckout(head, d.branch);
    return { action: 'toast', message: checkedOut(d.branch, directory) };
  };

  const onScreen = guard('screen', async (input) => {
    const route = input?.route ?? { type: 'home' };
    const previous = input?.previous ?? null;
    let notice = null;
    let routeSession = null;
    if (route.type === 'session' && route.sessionID) {
      let s = null;
      try {
        s = await api.get({ sessionID: route.sessionID });
      } catch {
        s = null;
      }
      // Solo las sesiones de este directorio
      if (s && (sessionDir(s) ?? directory) === directory) {
        // Al recuperar el foco en la misma sesión, un checkout hecho en ella
        // cambia su rama (D1); al entrar en ella, el plugin pone su rama (D3)
        const m = input?.reason === 'focus' ? await trackBranch(s) : meta(s) ?? (await trackBranch(s));
        if (input?.reason !== 'focus' && !isArchived(s)) {
          const d = await enter(s, m, previous);
          if (d.action === 'back') return { action: 'back', message: d.message };
          if (d.action === 'toast') notice = d.message;
        }
        s = await api.get({ sessionID: route.sessionID });
        routeSession = { id: s.id, archived: isArchived(s), meta: meta(s), working: isWorking(s), messages: null };
      }
    }
    const bc = await branchChange(directory);
    if (!actionable(bc)) return withToast({ action: 'none' }, notice);
    const { op, invalid, sessions } = await opOf(bc);
    // Una dueña cuyo change ya no está en la rama, o una rama que vuelve tras
    // quedarse sin sesión operativa al cambiar de rama (D1): como al arrancar
    if (!op && (invalid.some((s) => !isWorking(s)) || leftFrom(await allSessions(api).catch(() => sessions), { worktree: directory, branch: bc.branch }).length > 0)) {
      const ensured = await ensureOperational(bc);
      return withToast(ensured?.created ? { action: 'navigate', sessionID: ensured.session.id } : { action: 'none' }, notice);
    }
    if (op && routeSession?.id === op.id) {
      if (meta(op).branch !== bc.branch) return withToast({ action: 'none' }, notice);
      return withToast(await validate(op, bc), notice);
    }
    // El modal de `/new` (D4): la pantalla de inicio o una sesión sin mensajes
    let isNew = false;
    if (route.type === 'session' && routeSession && !routeSession.archived) {
      try {
        const messages = await api.context({ sessionID: routeSession.id });
        isNew = !Array.isArray(messages) || messages.filter((msg) => msg?.type === 'user' || msg?.type === 'assistant').length === 0;
      } catch {
        isNew = false;
      }
    }
    if (route.type === 'session' && !routeSession) return withToast({ action: 'none' }, notice);
    const clean = await treeClean(directory);
    const d = newWindow({
      route,
      isNew,
      routeIsOperational: routeSession?.id === op?.id,
      operational: op ? { id: op.id, title: op.title, change: meta(op).change, branch: bc.branch } : null,
      temporary: true,
      clean,
    });
    return withToast(d, notice);
  });

  // «Cambiar a la rama de origen» del modal de `/new` (D4, D7)
  const onOrigin = guard('origin', async () => {
    const head = await currentBranch(directory);
    const result = await switchTo(directory, null, 'origin');
    if (result.ok) pluginCheckout(head, (await currentBranch(directory)) ?? null);
    return result;
  });

  const ui = clientBridge(ctx, gen, registry, directory, onFirst);

  // --- Evaluar el producto y encadenar (D7, D9) ---

  const evaluate = async (m) => {
    const bc = await branchChange(directory);
    const change = m.change ?? (bc.kind === 'active' ? bc.change : null);
    let state = null;
    if (['new', 'artifact', 'task'].includes(m.step.kind) && change && bc.kind === 'active') state = await changeState(directory, change);
    const git = ['update', 'wiki'].includes(m.step.kind) ? await gitState(directory) : null;
    const before = { ...(m.snapshot ?? {}), change: m.change ?? m.snapshot?.change ?? null };
    return { products: productOf({ step: m.step, before, branch: bc, state, handoff: m.handoff, git }), bc, state };
  };

  const chainTo = async ({ from, m, step, wait, lastZone, extra = {} }) => {
    await writeMeta(api, from.id, { role: 'free', phase: 'done' });
    if (step.kind === 'end') {
      // Tras la resincronización del wiki queda su commit; con el wiki
      // deshabilitado, el ciclo acaba en el archive (design D5 de add-project-wiki-toggle)
      const pending = m.step?.kind === 'wiki'
        ? 'Haz el commit del wiki, aparte del commit del archive, y fusiona la rama.'
        : (await treeClean(directory))
          ? 'Queda fusionar la rama.'
          : 'Queda fusionar la rama; antes, haz el commit del archive.';
      ui.toast(`openspec-autopilot: el ciclo de ${m.change} ha terminado. ${pending}`, 'info');
      await archiveOrMark(from.id);
      return;
    }
    if (step.kind === 'blocked') throw new Error(`openspec status no da ningún artefacto listo para ${m.change}`);
    // Solo se espera el commit si queda algo por hacer en el árbol (D9)
    if (wait) wait = !(await treeClean(directory));
    let created;
    try {
      created = await createStep({ branch: m.branch, change: m.change, step, seq: (m.seq ?? 0) + 1, zone: lastZone, wait, extra: { ...(m.description ? { description: m.description } : {}), ...(m.planNoticed ? { noticeAtStart: true } : {}), ...extra } });
    } catch (error) {
      await failed(`no se ha podido crear la sesión del paso siguiente (${describe(step, m.change)})`, error, from.id);
      return;
    }
    await navigate(created.id);
    await archiveOrMark(from.id);
    if (wait) ui.toast(`openspec-autopilot: haz el commit de lo que hay en el stage; ${describe(step, m.change)} empezará con el árbol limpio.`);
  };

  const openReview = async ({ from, m, queue, lastZone }) => {
    const [first, ...rest] = queue;
    const changeDir = m.change ? path.join(directory, 'openspec', 'changes', m.change) : null;
    if (first.product.kind !== 'verdict') await stage(directory, stagePaths(first.product, { last: rest.length === 0, changeDir }));
    const hasSpecs = changeDir && fs.existsSync(path.join(changeDir, 'specs'));
    const errors = hasSpecs && ['artifact', 'plan'].includes(first.step.of) ? await validateErrors(directory, m.change) : [];
    const review = { errors, report: first.product.kind === 'verdict' ? m.handoff?.conclusions ?? '' : '', product: first.product };
    await chainTo({ from, m, step: first.step, wait: false, lastZone, extra: { queue: rest, review } });
  };

  // Lo que el usuario escribió en una sesión: la descripción del change en el paso new
  const userText = async (sessionID) => {
    try {
      const messages = await api.context({ sessionID });
      return (Array.isArray(messages) ? messages : [])
        .filter((msg) => msg?.type === 'user' && typeof msg.text === 'string' && !msg.text.startsWith(MARK))
        .map((msg) => msg.text.trim())
        .filter(Boolean)
        .join('\n\n');
    } catch (error) {
      log('context:', error?.message ?? error);
      return '';
    }
  };

  const finishStep = async (session, m, { products, bc }) => {
    let { change, branch, description } = m;
    if (m.step.kind === 'new') {
      change = bc.change;
      branch = bc.branch;
      // La descripción que dio el usuario viaja a los pasos siguientes
      description = [description, await userText(session.id)].filter(Boolean).join('\n\n');
    }
    const mm = { ...m, change, branch, description: description ?? '' };
    await writeMeta(api, session.id, { phase: 'chaining', change, branch });
    const lastZone = zoneOf(m.step) ?? m.zone ?? null;
    if (mode === 'normal') {
      const queue = reviewQueue(products, m.step);
      if (queue.length > 0) return openReview({ from: session, m: mm, queue, lastZone });
    }
    if (m.step.kind === 'verify' && m.handoff?.result === 'critical') {
      // Modo auto: la sesión de verify pasa a ser la revisión del verify (D10)
      const git = await gitState(directory);
      const step = { kind: 'review', id: 'verify', of: 'verify' };
      await writeMeta(api, session.id, { step, phase: 'review', review: { result: null, conclusions: '', report: m.handoff?.conclusions ?? '', git: { head: git.head, signature: git.signature } } });
      ui.toast(`openspec-autopilot: el verify de ${change} tiene problemas críticos; el ciclo se para. Revísalos en esta sesión y ciérrala con git: commit (ok) o cambios fuera del stage (ko).`);
      return;
    }
    if (!products.every((p) => p.kind === 'verdict')) await stage(directory);
    const state = change && (bc.kind === 'active' || m.step.kind === 'new') ? await changeState(directory, change).catch(() => null) : null;
    // El ajuste del wiki se lee al terminar el archive, para que cambiarlo durante el change valga
    const wiki = m.step.kind === 'archive' ? wikiEnabled(directory) : false;
    const { step, zoneChange } = next({ mode, finished: m.step, result: m.handoff?.result, state, lastZone, wikiEnabled: wiki });
    await chainTo({ from: session, m: mm, step, wait: waitsForCommit({ mode, finished: m.step, step, zoneChange }), lastZone });
  };

  // Lo modificado con el agente plan (D4 y D5 de autopilot-plan-explore): si
  // git ha cambiado desde que empezó el turno en plan. Borra planTurn.
  const changedInPlan = async (session, m) => {
    if (!m.planTurn) return false;
    let changed = false;
    try {
      const now = await gitState(directory);
      changed = now.signature !== m.planTurn.git?.signature;
    } catch (error) {
      log('planTurn:', error?.message ?? error);
    }
    await writeMeta(api, session.id, { planTurn: null });
    return changed;
  };

  // Pide a la TUI el modal del aviso; la TUI lo abre, responde enseguida y llama a ack al cerrarlo
  const showPlanNotice = async (sessionID) => {
    try {
      await ui.request('notice', { sessionID, message: `openspec-autopilot: ${planNoticeText().replace(/^C/, 'c')}` });
      return true;
    } catch (error) {
      log('notice:', error?.message ?? error);
      return false;
    }
  };

  // Sigue la cadena retenida por el aviso (acuse de la TUI o prompt del usuario)
  const releaseNotice = async (sessionID, { noticeAtStart = false } = {}) => {
    if (chaining.has(sessionID)) return false;
    const session = await api.get({ sessionID });
    const m = meta(session);
    if (!m || m.role !== 'owner' || isArchived(session) || m.phase !== 'plan-notice') return false;
    chaining.add(sessionID);
    try {
      await writeMeta(api, sessionID, { phase: 'running', planNotice: null });
      const mm = { ...m, phase: 'running', planNotice: null, ...(noticeAtStart ? { planNoticed: true } : {}) };
      const evaluated = await evaluate(mm);
      if (evaluated.products.length > 0) await finishStep(session, mm, evaluated);
      return true;
    } catch (error) {
      await failed('no se ha podido seguir tras el aviso', error, sessionID);
      return false;
    } finally {
      chaining.delete(sessionID);
    }
  };

  const onIdle = guard('idle', async ({ sessionID }) => {
    if (chaining.has(sessionID)) return;
    const session = await api.get({ sessionID });
    // Un checkout dentro de la sesión le cambia la rama (D1)
    let m = await trackBranch(session);
    if (!m || m.role !== 'owner' || isArchived(session) || !m.step) return;
    const noticed = await changedInPlan(session, m);
    m = { ...m, planTurn: null };
    const chains = ['running', 'handed-off'].includes(m.phase);
    if (noticed && !chains) {
      // Sin cadena que retener: el aviso solo (en una revisión, en la espera del commit…)
      if (!(ui.ready() && (await showPlanNotice(sessionID)))) await writeMeta(api, sessionID, { planNotice: { next: true } });
      return;
    }
    if (!chains) return;
    chaining.add(sessionID);
    try {
      const evaluated = await evaluate(m);
      if (noticed) {
        if (evaluated.products.length === 0) {
          if (!(ui.ready() && (await showPlanNotice(sessionID)))) await writeMeta(api, sessionID, { planNotice: { next: true } });
          return;
        }
        if (ui.ready()) {
          // La cadena espera al acuse de la TUI
          await writeMeta(api, sessionID, { phase: 'plan-notice', planNotice: { chain: true, pid: ui.pid() } });
          if (await showPlanNotice(sessionID)) return;
          await writeMeta(api, sessionID, { phase: m.phase, planNotice: null });
        }
        // Sin TUI: se sigue, y el aviso va al principio de la sesión siguiente
        m = { ...m, planNoticed: true };
      }
      if (evaluated.products.length === 0) return;
      await finishStep(session, { ...m, phase: 'running' }, evaluated);
    } catch (error) {
      await failed('no se ha podido encadenar el paso siguiente', error, sessionID);
    } finally {
      chaining.delete(sessionID);
    }
  });

  // --- Cerrar una revisión por git (D8) ---

  const closeReview = async (session, m, result, conclusions) => {
    const lastZone = m.zone ?? null;
    if (result === 'ok' && Array.isArray(m.queue) && m.queue.length > 0) return openReview({ from: session, m, queue: m.queue, lastZone });
    const bc = await branchChange(directory);
    const state = m.change && bc.kind === 'active' ? await changeState(directory, m.change) : null;
    const { step } = next({ mode, finished: m.step, result, state, lastZone });
    await chainTo({ from: session, m, step, wait: false, lastZone, extra: step.kind === 'update' ? { conclusions } : {} });
  };

  const reviewPrompted = async (session, m, input) => {
    const now = await gitState(directory);
    const result = verdict(m.review?.git, now);
    if (result === 'continue') return;
    const userText = String(input.prompt?.text ?? '').trim();
    input.prompt.text = closedPrompt(result);
    let conclusions = '';
    if (result === 'ko') {
      const words = userText.split(/\s+/).filter(Boolean);
      conclusions = words.length > 1 ? userText : m.review?.conclusions || (await lastAssistantText(session.id));
    }
    const review = { ...(m.review ?? {}), result, conclusions };
    await writeMeta(api, session.id, { phase: 'chaining', review });
    try {
      await closeReview(session, { ...m, review }, result, conclusions);
    } catch (error) {
      await failed('no se ha podido cerrar la revisión', error, session.id);
    }
  };

  // --- Cada mensaje que entra en una sesión (hook prompt) ---

  // La clave del turno (D2 de autopilot-plan-explore): el último messageID que
  // entra en la sesión operativa, también el del mensaje con el que el plugin
  // arranca un paso, guardado antes de decidir nada más
  const rememberTurn = async (session, messageID) => {
    if (typeof messageID !== 'string' || messageID === '') return;
    if (isArchived(session) || meta(session)?.role !== 'owner') return;
    try {
      await writeMeta(api, session.id, { turnMessage: messageID });
    } catch (error) {
      log('turnMessage:', error?.message ?? error);
    }
  };

  const onPrompt = guard('prompt', async (input) => {
    const sessionID = input?.sessionID;
    const text = String(input?.prompt?.text ?? '');
    if (!sessionID) return;
    const session = await api.get({ sessionID });
    await rememberTurn(session, input?.messageID);
    if (text.startsWith(MARK) || isArchived(session)) return;
    // La rama de trabajo: se guarda la primera vez y cambia con un checkout (D1)
    const m = await trackBranch(session);
    if (m?.role === 'owner') {
      if (m.phase === 'review') return reviewPrompted(session, m, input);
      // Un prompt con el aviso pendiente cuenta como acuse (D5)
      if (m.phase === 'plan-notice') {
        input.prompt.text = `${MARK} El usuario ha seguido tras el aviso de lo modificado con el agente plan, y el ciclo pasa a la sesión siguiente. No hagas nada más: responde solo «Sigo con el ciclo.».`;
        await releaseNotice(sessionID, { noticeAtStart: true });
        return;
      }
      if (m.phase === 'waiting-commit') {
        if (!(await treeClean(directory))) return;
        try {
          await api.update({ sessionID, title: describe(m.step, m.change) });
        } catch (error) {
          log('title:', error);
        }
        const instruction = await startStep(sessionID, m, { send: false });
        input.prompt.text = `${instruction}\n\nMensaje del usuario: ${text}`;
        return;
      }
      // Validación con cualquier cliente (D5): el change ya no está en la rama
      const bc = await branchChange(directory);
      if (m.change && bc.branch === m.branch && actionable(bc) && !validFor(bc)(session)) {
        await release(session);
        const ensured = await ensureOperational(bc, { go: true });
        input.prompt.text = `${MARK} El change \`${m.change}\` ya no está en la rama, así que esta sesión ha dejado de ser la operativa${ensured ? `; la nueva es «${ensured.session.title}» (${ensured.session.id})` : ''}. No hagas nada: díselo al usuario.`;
      }
      return;
    }
    // Una sesión que no es la operativa: solo pasa a serlo con `autopilot` si la rama no tiene ninguna (D13)
    if (text.trim().toLowerCase() !== START_WORD) return;
    await contend(sessionID, async () => {
      const bc = await branchChange(directory);
      if (!actionable(bc) || bc.kind === 'archived') return;
      await claim(bc.branch, () => takeControl(input, sessionID, bc));
    });
  });

  // La sesión `sessionID` pasa a ser la operativa de la rama si no tiene
  // ninguna (D13); dentro de claim
  const takeControl = async (input, sessionID, bc) => {
    const { op, sessions } = await opOf(bc);
    if (op) return;
    const state = bc.kind === 'active' ? await changeState(directory, bc.change) : null;
    const step = bc.kind === 'active' ? stepFromState(state) : { kind: 'new' };
    if (step.kind === 'blocked') return;
    const nm = { worktree: directory, branch: bc.branch, change: bc.change ?? null, role: 'owner', step, seq: nextSeq(sessions), phase: 'starting', zone: null, ...(typeof input?.messageID === 'string' ? { turnMessage: input.messageID } : {}) };
    await writeMeta(api, sessionID, nm);
    // Escribir y comprobar: si otra sesión ha tomado el control a la vez, gana la más antigua
    const first = await lostTo(bc, sessionID);
    if (first) {
      await writeMeta(api, sessionID, { role: 'free', phase: 'lost' });
      input.prompt.text = foreignPrompt({ change: meta(first).change, title: first.title, sessionID: first.id });
      return;
    }
    try {
      await api.update({ sessionID, title: describe(step, bc.change) });
    } catch (error) {
      log('title:', error);
    }
    if (!(await treeClean(directory))) {
      await writeMeta(api, sessionID, { phase: 'waiting-commit' });
      input.prompt.text = reminderPrompt({ step, change: bc.change, phase: 'waiting-commit' });
      return;
    }
    input.prompt.text = await startStep(sessionID, nm, { send: false });
  };

  // --- Recordatorio y aviso en cada petición (hook context, D6, D13) ---

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

  // Lo que se inyecta en la sesión operativa según el agente del turno (D2 y
  // D3 de autopilot-plan-explore): se decide una vez por turno, se guarda en
  // `agentTurn` y se repite en todas sus peticiones
  const TURN_TEXT = {
    step: reminderPrompt,
    explore: explorePrompt,
    'explore-reminder': exploreReminderPrompt,
    return: returnPrompt,
  };
  const turnText = async (input, m) => {
    const key = turnKey(input.messages, { turnMessage: m.turnMessage, previous: m.agentTurn?.key });
    const { state, fresh } = agentTurn(m.agentTurn, { key, agent: input.agent });
    if (fresh) {
      // El estado de git al empezar un turno en plan (D4): se compara al quedar en reposo
      const patch = { agentTurn: state };
      if (state.agent === 'plan') {
        if (!m.planTurn) {
          try {
            const git = await gitState(directory);
            patch.planTurn = { key: state.key, git: { head: git.head, signature: git.signature } };
          } catch (error) {
            log('planTurn:', error?.message ?? error);
          }
        }
      } else if (m.planTurn) patch.planTurn = null;
      try {
        await writeMeta(api, input.sessionID, patch);
      } catch (error) {
        log('agentTurn:', error?.message ?? error);
      }
    }
    // Sin clave (una sesión de antes de este change), se decide sin guardar, como si el turno anterior fuera build
    const kind = state?.kind ?? transition(undefined, input.agent);
    return TURN_TEXT[kind]({ step: m.step, change: m.change, phase: m.phase });
  };

  const onContext = guard('context', async (input) => {
    const sessionID = input.sessionID;
    const session = await api.get({ sessionID });
    if (isArchived(session)) return;
    const m = meta(session);
    if (m?.role === 'owner') {
      if (m.step) inject(input, await turnText(input, m));
      // Sin TUI y sin producto: el aviso de lo modificado con plan, una vez (D5)
      if (m.planNotice?.next) {
        inject(input, `${MARK} ${planNoticeText()} Díselo al usuario al empezar tu respuesta.`);
        try {
          await writeMeta(api, sessionID, { planNotice: null });
        } catch (error) {
          log('planNotice:', error?.message ?? error);
        }
      }
      return;
    }
    const bc = await branchChange(directory);
    if (!actionable(bc)) return;
    const { op } = await opOf(bc);
    if (!op || op.id === sessionID) return;
    inject(input, foreignPrompt({ change: meta(op).change, title: op.title, sessionID: op.id }));
  });

  // --- La tool del paso (D7) ---

  const handoff = guard('handoff', async (input, context) => {
    const sessionID = context.sessionID;
    const session = await api.get({ sessionID });
    const m = meta(session);
    if (!m || m.role !== 'owner' || isArchived(session)) {
      return { content: 'Esta sesión no es la sesión operativa de ningún change: no hay ningún paso que cerrar.' };
    }
    const result = typeof input?.result === 'string' ? input.result.trim().toLowerCase() : null;
    const conclusions = typeof input?.conclusions === 'string' ? input.conclusions.trim() : '';
    const given = Array.isArray(input?.lessons) ? input.lessons.filter((l) => typeof l === 'string' && l.trim() !== '').map((l) => l.trim()) : [];
    const lessons = [...new Set([...(Array.isArray(m.lessons) ? m.lessons : []), ...given])];
    if (m.phase === 'review') {
      await writeMeta(api, sessionID, { review: { ...(m.review ?? {}), conclusions: conclusions || m.review?.conclusions || '' }, lessons });
      return { content: 'Conclusiones registradas. La revisión no la cierras tú: la cierra el usuario con git (commit si es satisfactoria; todo fuera del stage si no lo es) al enviar su siguiente mensaje.' };
    }
    if (m.phase !== 'running') return { content: 'Este paso todavía no ha empezado (espera el commit del usuario) o ya está cerrado.' };
    if (m.step.kind === 'verify') {
      if (result !== 'clean' && result !== 'critical') {
        return { content: 'Falta el veredicto del verify: llama a la tool con result "clean" si no hay ningún problema CRITICAL, o "critical" si hay alguno.' };
      }
      await writeMeta(api, sessionID, { handoff: { result, conclusions }, lessons });
      return { content: 'Veredicto registrado. Al terminar esta respuesta, el plugin sigue con el ciclo: no hagas nada más.' };
    }
    const { products } = await evaluate(m);
    if (products.length === 0) {
      return { content: `No hay producto evaluable: ${describe(m.step, m.change)} todavía no ha producido nada que el CLI de OpenSpec reconozca. Termina el paso y vuelve a llamar a la tool.` };
    }
    await writeMeta(api, sessionID, { handoff: { result, conclusions }, lessons });
    return { content: `Producto registrado: ${describeProducts(products)}. Al terminar esta respuesta, el plugin lo pasa al stage y sigue con el ciclo: no hagas nada más.` };
  });

  // --- Índice: el contenido de una sesión del change ---

  const readSession = guard('session', async (input, context) => {
    const caller = meta(await api.get({ sessionID: context.sessionID }));
    if (!caller?.change) return { content: 'Esta sesión no es la operativa de ningún change.' };
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

  // --- Un worktree nuevo con su sesión operativa (D6 de autopilot-rama-por-sesion) ---

  // La dirección del servidor para el enlace de la web: la opción serverUrl
  // del plugin; OpenCode 2.3.2 no da al plugin la dirección con que se conectó
  // el navegador (task 4.9)
  const serverUrl = () => {
    const url = typeof ctx.options?.serverUrl === 'string' ? ctx.options.serverUrl.trim().replace(/\/+$/, '') : '';
    return url || null;
  };
  const sessionLink = (sessionID) => {
    const url = serverUrl();
    return url ? `${url}/server/${Buffer.from(url).toString('base64')}/session/${sessionID}` : null;
  };

  // El proyecto: ctx.location.project en OpenCode 2.3.2 (no hay ctx.project), o
  // el de la sesión que llama a la tool
  const projectOf = async (context) => {
    const id = ctx.location?.project?.id ?? ctx.project?.id;
    if (id) return id;
    if (!context?.sessionID) return undefined;
    try {
      return (await api.get({ sessionID: context.sessionID }))?.projectID;
    } catch {
      return undefined;
    }
  };

  const newWorktree = guard('worktree', async (input, context) => {
    if (!ctx.worktree?.create) return { content: 'Este OpenCode no deja al plugin crear worktrees: crea el worktree desde la TUI («Manage workspaces») o con el botón de la web.' };
    const projectID = await projectOf(context);
    const name = typeof input?.name === 'string' && input.name.trim() ? input.name.trim() : undefined;
    let created;
    try {
      created = await ctx.worktree.create({ ...(projectID ? { projectID } : {}), ...(name ? { name } : {}) });
    } catch (error) {
      return { content: `No se ha creado el worktree: ${error?.message ?? error}` };
    }
    const dir = created?.directory;
    if (!dir) return { content: 'OpenCode no ha devuelto el directorio del worktree.' };
    const branch = await currentBranch(dir);
    const step = { kind: 'new' };
    const nm = { worktree: dir, branch, change: null, role: 'owner', step, seq: 1, phase: 'starting', zone: null };
    const session = await api.create({ title: describe(step, null), agent: WORKFLOW.new.agent, location: { directory: dir }, metadata: { openspec: { v: 1, ...nm } } });
    await startStep(session.id, nm, { dir });
    const link = sessionLink(session.id);
    return {
      content:
        `Creado el worktree ${dir} en la rama ${branch ?? '(sin rama)'}, con la sesión operativa «${session.title}» (id ${session.id}), que ya ha arrancado openspec-new-change. ` +
        (link ? `Da al usuario este enlace para abrirla en la web: ${link}` : `Di al usuario que la abra en la web por su título «${session.title}» o su id ${session.id}.`),
    };
  });

  // --- Compactación ---

  const onCompaction = guard('compaction', async (input) => {
    const session = await api.get({ sessionID: input.sessionID });
    const m = meta(session);
    if (!m || m.role !== 'owner' || isArchived(session)) return;
    const command = resumeCommand(m.step, m.change);
    ui.toast(
      `openspec-autopilot: la sesión se ha compactado; estaba ${VERB[m.step?.kind] ?? 'trabajando en'} \`${m.change ?? 'el change'}\` (${describe(m.step, m.change)}).` +
        (command ? ` Para retomarlo, escribe ${command}${m.step?.kind === 'task' ? ` (task ${m.step.label ?? m.step.id})` : ''}.` : ' Para retomarlo, pide al modelo que siga con el paso.')
    );
  });

  // --- Indicaciones de apply según el modo (apply-one-task-per-session-in-normal-mode, D4 y D5) ---

  // Al cargarse, una vez: la recarga de OpenCode al cambiar la opción `auto`
  // vuelve a pasar por aquí. El cambio queda en el árbol, para el commit del usuario.
  // Una revisión abierta de la rama no se cierra por el ajuste (D6): su
  // inicio pasa a ser el estado de git tras escribir. HEAD no cambia, así que
  // un commit posterior la sigue cerrando como satisfactoria.
  const rebaseReviews = async () => {
    const bc = await branchChange(directory);
    if (!bc?.branch) return;
    const sessions = await branchSessions(api, { worktree: directory, branch: bc.branch });
    const open = owners(sessions).filter((s) => meta(s)?.phase === 'review' && meta(s)?.review?.git);
    if (open.length === 0) return;
    const git = await gitState(directory);
    for (const session of open) {
      const m = meta(session);
      await writeMeta(api, session.id, { review: { ...m.review, git: { head: m.review.git.head, signature: git.signature } } });
    }
  };

  const file = CONFIG_PATH.split(path.sep).join('/');
  const adjustGuidance = async () => {
    const result = await syncApplyGuidance(directory, mode);
    if (result.error) ui.notice(`openspec-autopilot: no se ha podido ajustar \`${file}\` al modo ${mode} (${result.error?.message ?? result.error}).`);
    else if (result.missing) ui.notice(`openspec-autopilot: no hay \`${file}\`; no se ajustan las indicaciones de apply al modo ${mode}.`);
    else if (result.written) ui.notice(`openspec-autopilot: he ajustado \`${file}\` al modo ${mode} (indicaciones de apply de una task por sesión); haz su commit aparte.`, 'info');
    if (result.written) await rebaseReviews();
    if (result.similar) ui.notice(`openspec-autopilot: \`${file}\` tiene un texto parecido a las indicaciones de una task por sesión que no reconozco; revísalo a mano.`);
    return result;
  };

  // Con límite de tiempo (D4): si el ajuste se cuelga, el plugin arranca igual.
  // El ajuste sigue en segundo plano y, si acaba, avisa como siempre.
  const syncGuidance = guard('apply-guidance', async () => {
    const late = adjustGuidance().catch((error) => log('apply-guidance:', error));
    const result = await withTimeout(late, SYNC_TIMEOUT_MS);
    if (result?.timedOut) ui.notice(`openspec-autopilot: el ajuste de \`${file}\` al modo ${mode} tarda más de ${SYNC_TIMEOUT_MS / 1000} s; sigo sin esperarlo.`);
    return result;
  });

  // --- Registro ---

  ctx.tool.transform((editor) => {
    editor.add({
      name: HANDOFF_TOOL,
      description:
        'Cierra el paso del ciclo de OpenSpec que hace esta sesión: el plugin comprueba lo producido y sigue con el ciclo al terminar la respuesta. Llámala una sola vez, al terminar el paso. En el verify, con el veredicto. En una revisión, solo para dar conclusiones: la revisión la cierra el usuario con git.',
      options: { codemode: false },
      input: {
        type: 'object',
        properties: {
          result: { type: 'string', description: 'Verify: "clean" o "critical".' },
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
    editor.add({
      name: WORKTREE_TOOL,
      description:
        'Crea un worktree nuevo del proyecto en una rama con su mismo nombre (desde la rama de origen del remoto) y, en él, la sesión operativa que arranca openspec-new-change. Úsala solo cuando el usuario pida un worktree nuevo. Devuelve el enlace a esa sesión, o su título y su id.',
      options: { codemode: false },
      input: { type: 'object', properties: { name: { type: 'string', description: 'Nombre del worktree y de su rama, en kebab-case; sin él, lo genera OpenCode.' } } },
      execute: async (input, context) => (await newWorktree(input, context)) ?? { content: 'openspec-autopilot no ha podido crear el worktree.' },
    });
  });
  // La estrategia de worktree (D5): la registra cada instancia con el mismo id
  let worktreeRegistration = null;
  try {
    worktreeRegistration = (await ctx.worktree?.transform?.((editor) => editor.add(worktreeStrategy))) ?? null;
  } catch (error) {
    log('worktree:', error);
  }
  // El acuse del aviso: por la sesión, no por una petición en memoria (D5)
  const onAck = guard('ack', async (input) => ({ ok: await releaseNotice(String(input?.sessionID ?? '')) }));
  await syncGuidance();
  await ui.start({
    screen: async (input) => (await onScreen(input)) ?? { action: 'none' },
    origin: async (input) => (await onOrigin(input)) ?? { ok: false, message: 'openspec-autopilot no ha podido cambiar de rama.' },
    ack: async (input) => (await onAck(input)) ?? { ok: false },
  });
  await api.hook('prompt', onPrompt);
  await api.hook('context', onContext);
  await api.hook('experimental.idle', onIdle);
  await api.hook('compaction', onCompaction);
  // Al descargarse, suelta la estrategia de worktree (ADR-0011)
  return async () => {
    try {
      await worktreeRegistration?.dispose?.();
    } catch (error) {
      log('worktree dispose:', error);
    }
  };
}

export default {
  id: ID,
  async setup(ctx) {
    // Instalado de forma global, solo actúa en proyectos intent-driven sin su
    // propio openspec-autopilot (lib/place.mjs); si no, no registra nada
    if (GLOBAL && !globalActs(ctx?.location?.directory, 'openspec-autopilot')) return;
    try {
      return await start(ctx);
    } catch (error) {
      log('setup:', error);
      return undefined;
    }
  },
};
