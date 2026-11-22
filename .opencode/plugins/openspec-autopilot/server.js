// Parte de servidor del plugin openspec-autopilot para OpenCode 2
// (ADR-0014; design de add-openspec-autopilot y de autopilot-sesion-operativa).
// Toda la lógica del ciclo vive aquí y funciona con cualquier cliente (TUI,
// UI web, OpenCode Desktop, `opencode run`); la TUI solo pone la interfaz
// (tui.js), pedida por el RPC del plugin (D1).
//
// - Sesión operativa (D2): una sola sesión viva por rama, la dueña del change
//   en la metadata de OpenCode (lib/state.mjs). Ninguna otra toma el control
//   mientras sea válida.
// - Arranque (D3): al presentarse una TUI nueva (otro PID), si la rama no
//   tiene sesión operativa, se crea y se arranca sola.
// - Ventanas ajenas (D4) y validación (D5): la TUI informa de cada pantalla
//   (`screen`) y el servidor responde con la directiva de lib/screen.mjs.
// - Cada paso empieza con un mensaje en su sesión (D6) y se le recuerda en
//   cada petición (hook context).
// - Producto evaluable (D7): al quedar la sesión en reposo, el plugin compara
//   la foto del change según el CLI y, con producto, lo pasa al stage y abre
//   la revisión (modo normal) o sigue (modo auto).
// - Las revisiones las cierra git (D8), en el hook `prompt`: HEAD avanzado y
//   nada en el stage es ok; HEAD igual, nada en el stage y cambios, ko.
// - Sin TUI (D13): aviso en el contexto de las sesiones ajenas, archivado
//   diferido (`archivePending`) y arranque con el mensaje `autopilot`.
// - Nunca lanza una excepción hacia OpenCode ni bloquea una petición: un
//   fallo se avisa y deja la sesión libre. Todas las esperas tienen límite.
//
// Sin dependencias: objetos literales { id, setup } y solo módulos node:.

import fs from 'node:fs';
import path from 'node:path';
import { RPC, TIMEOUT_MS } from './lib/rpc.mjs';
import { describe, discrepancy, next, stepFromState, waitsForCommit, zoneOf } from './lib/next-step.mjs';
import { HANDOFF_TOOL, MARK, SESSION_TOOL, START_WORD, WORKFLOW, closedPrompt, foreignPrompt, reminderPrompt, resumeCommand, stepPrompt } from './lib/prompts.mjs';
import { allSessions, branchSessions, changeSessions, isArchived, isWorking, meta, nextSeq, owners, winner, writeMeta } from './lib/state.mjs';
import { branchChange, changeState, validateErrors } from './lib/project.mjs';
import { gitState, stage, treeClean, verdict } from './lib/git.mjs';
import { describeProducts, productOf, reviewQueue, snapshotOf, stagePaths } from './lib/product.mjs';
import { MODAL_BUTTON, directive, modalText } from './lib/screen.mjs';
import { CONFIG_PATH, syncApplyGuidance } from './lib/apply-guidance.mjs';

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

// --- Puente con los clientes con interfaz (D1) ----------------------------------

function clientBridge(ctx, gen, registry, directory, onFirst) {
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
        await onFirst({ first });
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
      Promise.resolve(registration.events.emit('hello-request', { gen })).catch((error) => log('hello-request:', error));
    } catch (error) {
      log('rpc:', error);
    }
  };

  return { ready, request, toast, notice, start };
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

  const actionable = (bc) => Boolean(bc?.branch) && ['none', 'active', 'archived', 'permanent'].includes(bc.kind);

  // Si una dueña sigue siendo válida en el estado de la rama (D2)
  const validFor = (bc) => (session) => {
    const m = meta(session);
    if (!m) return false;
    // Encadenando, sigue siendo la operativa hasta que pase el control
    if (m.phase === 'chaining') return true;
    if (m.change) return bc.change === m.change && (bc.kind === 'active' || bc.kind === 'archived');
    // El paso new: el change que acaba de crear es su producto
    return bc.kind === 'none' || bc.kind === 'permanent' || (m.step?.kind === 'new' && bc.kind === 'active');
  };

  const opOf = async (bc) => {
    const sessions = await branchSessions(api, { worktree: directory, branch: bc.branch });
    const live = owners(sessions);
    const valid = live.filter(validFor(bc));
    const invalid = live.filter((s) => !validFor(bc)(s));
    return { op: winner(valid), invalid, sessions };
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

  // --- Empezar un paso (D6, D7) ---

  const takeSnapshot = async (m) => {
    const git = await gitState(directory);
    let state = null;
    if (m.change && ['artifact', 'task', 'archive', 'verify'].includes(m.step.kind)) {
      try {
        state = await changeState(directory, m.change);
      } catch (error) {
        log('snapshot:', error?.message ?? error);
      }
    }
    return { snapshot: { ...snapshotOf(state ?? { change: m.change }, git.signature) }, git };
  };

  // Deja la sesión lista para su paso y devuelve la instrucción; con `send`, la envía
  const startStep = async (sessionID, m, { send = true } = {}) => {
    const { snapshot, git } = await takeSnapshot(m);
    const isReview = m.step.kind === 'review';
    const review = isReview ? { ...(m.review ?? {}), git: { head: git.head, signature: git.signature } } : m.review;
    const patch = { phase: isReview ? 'review' : 'running', snapshot, handoff: null, ...(isReview ? { review } : {}) };
    await writeMeta(api, sessionID, patch);
    const text = await promptFor({ ...m, review });
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
  const ensureOperational = async (bc, { go = false } = {}) => {
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
    const created = await createStep({ branch: bc.branch, change: bc.change ?? null, step, seq: nextSeq(sessions), zone: null, wait: !clean });
    // Escribir y comprobar: si otra TUI ha creado otra a la vez, gana la más antigua
    const { op: first } = await opOf(bc);
    if (first && first.id !== created.id) {
      await release(await api.get({ sessionID: created.id }), 'lost');
      return { session: first, created: false };
    }
    if (!clean) ui.toast(`openspec-autopilot: haz el commit de los cambios pendientes; ${describe(step, bc.change)} empezará con el árbol limpio.`);
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

  const onFirst = guard('hello', async ({ first }) => {
    await archivePending();
    if (!first) return;
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
      await ensureOperational(bc, { go: true });
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

  const onScreen = guard('screen', async (input) => {
    const route = input?.route ?? { type: 'home' };
    const bc = await branchChange(directory);
    if (!actionable(bc)) return { action: 'none' };
    const { op, invalid } = await opOf(bc);
    // Una dueña cuyo change ya no está en la rama: se libera y se actúa como al arrancar
    if (!op && invalid.some((s) => !isWorking(s))) {
      const ensured = await ensureOperational(bc);
      return ensured?.created ? { action: 'navigate', sessionID: ensured.session.id } : { action: 'none' };
    }
    let routeSession = null;
    if (route.type === 'session' && route.sessionID) {
      try {
        const s = await api.get({ sessionID: route.sessionID });
        routeSession = { id: s.id, archived: isArchived(s), meta: meta(s), working: isWorking(s) };
      } catch {
        routeSession = null;
      }
    }
    // La sesión operativa de otra rama tras cambiar HEAD: las reglas de la rama actual
    if (!op && routeSession?.meta?.role === 'owner' && !routeSession.archived && routeSession.meta.branch !== bc.branch && !routeSession.working) {
      const ensured = await ensureOperational(bc);
      return ensured?.created ? { action: 'navigate', sessionID: ensured.session.id } : { action: 'none' };
    }
    const d = directive({ route, operational: op ? { id: op.id, title: op.title, change: meta(op).change } : null, routeSession });
    if (d.action === 'modal') return { ...d, message: modalText(d), button: MODAL_BUTTON };
    if (d.action === 'validate') return validate(op, bc);
    return d;
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
      ui.toast(`openspec-autopilot: el ciclo de ${m.change} ha terminado. Haz el commit del wiki, aparte del commit del archive, y fusiona la rama.`, 'info');
      await archiveOrMark(from.id);
      return;
    }
    if (step.kind === 'blocked') throw new Error(`openspec status no da ningún artefacto listo para ${m.change}`);
    // Solo se espera el commit si queda algo por hacer en el árbol (D9)
    if (wait) wait = !(await treeClean(directory));
    let created;
    try {
      created = await createStep({ branch: m.branch, change: m.change, step, seq: (m.seq ?? 0) + 1, zone: lastZone, wait, extra: { ...(m.description ? { description: m.description } : {}), ...extra } });
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
    const { step, zoneChange } = next({ mode, finished: m.step, result: m.handoff?.result, state, lastZone });
    await chainTo({ from: session, m: mm, step, wait: waitsForCommit({ mode, finished: m.step, step, zoneChange }), lastZone });
  };

  const onIdle = guard('idle', async ({ sessionID }) => {
    if (chaining.has(sessionID)) return;
    const session = await api.get({ sessionID });
    const m = meta(session);
    if (!m || m.role !== 'owner' || isArchived(session) || !['running', 'handed-off'].includes(m.phase) || !m.step) return;
    chaining.add(sessionID);
    try {
      const evaluated = await evaluate(m);
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

  const onPrompt = guard('prompt', async (input) => {
    const sessionID = input?.sessionID;
    const text = String(input?.prompt?.text ?? '');
    if (!sessionID || text.startsWith(MARK)) return;
    const session = await api.get({ sessionID });
    if (isArchived(session)) return;
    const m = meta(session);
    if (m?.role === 'owner') {
      if (m.phase === 'review') return reviewPrompted(session, m, input);
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
    const bc = await branchChange(directory);
    if (!actionable(bc) || bc.kind === 'archived') return;
    const { op, sessions } = await opOf(bc);
    if (op) return;
    const state = bc.kind === 'active' ? await changeState(directory, bc.change) : null;
    const step = bc.kind === 'active' ? stepFromState(state) : { kind: 'new' };
    if (step.kind === 'blocked') return;
    const nm = { worktree: directory, branch: bc.branch, change: bc.change ?? null, role: 'owner', step, seq: nextSeq(sessions), phase: 'starting', zone: null };
    await writeMeta(api, sessionID, nm);
    // Escribir y comprobar: si otra sesión ha tomado el control a la vez, gana la más antigua
    const { op: first } = await opOf(bc);
    if (first && first.id !== sessionID) {
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
  });

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

  const onContext = guard('context', async (input) => {
    const sessionID = input.sessionID;
    const session = await api.get({ sessionID });
    if (isArchived(session)) return;
    const m = meta(session);
    if (m?.role === 'owner') {
      if (m.step) inject(input, reminderPrompt({ step: m.step, change: m.change, phase: m.phase }));
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
  const syncGuidance = guard('apply-guidance', async () => {
    const result = await syncApplyGuidance(directory, mode);
    const file = CONFIG_PATH.split(path.sep).join('/');
    if (result.error) ui.notice(`openspec-autopilot: no se ha podido ajustar \`${file}\` al modo ${mode} (${result.error?.message ?? result.error}).`);
    else if (result.missing) ui.notice(`openspec-autopilot: no hay \`${file}\`; no se ajustan las indicaciones de apply al modo ${mode}.`);
    else if (result.written) ui.notice(`openspec-autopilot: he ajustado \`${file}\` al modo ${mode} (indicaciones de apply de una task por sesión); haz su commit aparte.`, 'info');
    if (result.similar) ui.notice(`openspec-autopilot: \`${file}\` tiene un texto parecido a las indicaciones de una task por sesión que no reconozco; revísalo a mano.`);
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
  });
  await syncGuidance();
  await ui.start({ screen: async (input) => (await onScreen(input)) ?? { action: 'none' } });
  await api.hook('prompt', onPrompt);
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
