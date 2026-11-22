// El paso siguiente de un change (design D6 y D11 de add-openspec-autopilot,
// D9 a D11 de autopilot-sesion-operativa): funciones puras, sin OpenCode ni
// git, que se prueban con node --test.
//
// Pasos ({ kind, id, label, of }):
//   new                 openspec-new-change
//   artifact <id>       openspec-continue-change de ese artefacto
//   task <id>           openspec-apply-change limitado a esa task (id del CLI;
//                       label, el número de tasks.md)
//   verify              openspec-verify-change
//   archive             openspec-archive-change
//   wiki                la resincronización del wiki de las indicaciones de
//                       archivado, solo con el wiki del proyecto habilitado
//   review <id> of      revisión humana de un artefacto, una task, el verify o el plan
//   update <id> of      openspec-update-change tras una revisión no satisfactoria
//   end                 el ciclo ha terminado
//
// Zonas (spec-as-source): la de specs es openspec/ salvo los tasks.md, y la de
// código es todo lo demás. Cada paso que escribe lo hace en una zona; el
// verify y las revisiones no escriben.

const ZONE = { new: 'specs', artifact: 'specs', update: 'specs', archive: 'specs', task: 'code', wiki: 'code' };

export function zoneOf(step) {
  return step ? ZONE[step.kind] ?? null : null;
}

const LABEL = /^(\d+(?:\.\d+)*)[.:]?(?:\s|$)/;

// Una task de `openspec instructions apply --json`: { id, description, done }
export function taskFromCli(task) {
  const label = LABEL.exec(String(task?.description ?? '').trim())?.[1] ?? String(task?.id ?? '');
  return { id: String(task?.id ?? ''), label, done: Boolean(task?.done) };
}

// Las tasks de un tasks.md, con los mismos ids que el CLI (por orden) y la
// etiqueta de cada línea "- [ ] <número> ..."
export function parseTasks(text) {
  const tasks = [];
  for (const line of String(text ?? '').split(/\r?\n/)) {
    const m = /^\s*-\s+\[([ xX])\]\s+(.*)$/.exec(line);
    if (!m) continue;
    tasks.push(taskFromCli({ id: String(tasks.length + 1), description: m[2], done: m[1] !== ' ' }));
  }
  return tasks;
}

// El paso que dice el estado del change: el primer artefacto listo mientras el
// plan no esté completo, la primera task sin marcar y, con todas marcadas, el verify
export function stepFromState(state) {
  if (!state || !state.change) return { kind: 'new' };
  const complete = state.status?.isPlanningComplete ?? state.status?.isComplete ?? false;
  if (!complete) {
    const ready = (state.status?.artifacts ?? []).find((a) => a.status === 'ready');
    return ready ? { kind: 'artifact', id: ready.id } : { kind: 'blocked' };
  }
  const pending = (state.tasks ?? []).find((t) => !t.done);
  if (pending) return { kind: 'task', id: String(pending.id), label: pending.label ?? String(pending.id) };
  return { kind: 'verify' };
}

// next({ mode, finished, result, state, lastZone, wikiEnabled }) -> { step, zoneChange }
//   mode: "normal" | "auto"
//   finished: el paso terminado ({ kind, id, of }), o null al tomar el control
//   result: "ok" | "ko" (revisiones, por git), "clean" | "critical" (verify)
//   state: { change, status (openspec status --json), tasks }
//   lastZone: la zona del último paso que escribió, para el cambio de zona
//   wikiEnabled: el ajuste del wiki del proyecto, leído al terminar el archive
//     (design D5 de add-project-wiki-toggle); sin él, tras el archive no hay
//     paso del wiki y el ciclo termina
//
// En el modo normal, tras un artefacto, una task, el verify o un update viene
// una revisión: la abre el servidor con la cola de productos (lib/product.mjs).
export function next({ mode = 'normal', finished = null, result = null, state = null, lastZone = null, wikiEnabled = false }) {
  const step = decide({ mode, finished, result, state, wikiEnabled });
  const zone = zoneOf(step);
  const zoneChange = Boolean(zone && lastZone && zone !== lastZone);
  return { step, zoneChange };
}

function decide({ mode, finished, result, state, wikiEnabled }) {
  if (!finished) return stepFromState(state);
  const auto = mode === 'auto';
  switch (finished.kind) {
    case 'new':
    case 'artifact':
    case 'task':
      return stepFromState(state);
    case 'verify':
      if (!auto || result === 'critical') return { kind: 'review', id: 'verify', of: 'verify' };
      return { kind: 'archive' };
    case 'review': {
      if (result !== 'ok') return { kind: 'update', id: finished.id, of: finished.of };
      if (finished.of === 'verify') return { kind: 'archive' };
      return stepFromState(state);
    }
    case 'update':
      return { kind: 'review', id: 'plan', of: 'plan' };
    case 'archive':
      return wikiEnabled ? { kind: 'wiki' } : { kind: 'end' };
    case 'wiki':
      return { kind: 'end' };
    default:
      return stepFromState(state);
  }
}

// Si el paso siguiente tiene que esperar el commit del usuario (design D9):
// tras el archive y tras la resincronización del wiki, en los dos modos (si el
// paso siguiente es end, como tras el archive con el wiki deshabilitado, no hay
// sesión que espere: el ciclo termina); en el
// modo auto, en cada cambio de zona. update-change nunca espera: empieza con
// el árbol sucio a propósito.
export function waitsForCommit({ mode, finished, step, zoneChange }) {
  if (!step || step.kind === 'update' || step.kind === 'review') return false;
  if (finished?.kind === 'archive' || finished?.kind === 'wiki') return true;
  return mode === 'auto' && zoneChange;
}

// Si el paso de una sesión parada no encaja con `openspec status` (design D5):
// solo se comprueban new, artifact y task, y que el producto del paso ya
// exista no es una discrepancia. Devuelve null o { expected }.
export function discrepancy(step, state) {
  if (!step || !['new', 'artifact', 'task'].includes(step.kind)) return null;
  const expected = stepFromState(state);
  if (step.kind === 'new') return state?.change ? null : expected.kind === 'new' ? null : { expected };
  if (step.kind === 'artifact') {
    const artifact = (state?.status?.artifacts ?? []).find((a) => a.id === step.id);
    if (artifact?.status === 'done') return null;
    if (expected.kind === 'artifact' && expected.id === step.id) return null;
    return { expected };
  }
  const task = (state?.tasks ?? []).find((t) => String(t.id) === String(step.id));
  if (task?.done) return null;
  if (expected.kind === 'task' && String(expected.id) === String(step.id)) return null;
  return { expected };
}

// Una descripción corta del paso, para títulos, avisos y el índice
export function describe(step, change) {
  const of = { artifact: 'del artefacto', task: 'de la task', verify: 'del verify', plan: 'del plan' };
  const name = change ? ` de ${change}` : '';
  switch (step?.kind) {
    case 'new':
      return 'nuevo change';
    case 'artifact':
      return `artefacto ${step.id}${name}`;
    case 'task':
      return `task ${step.label ?? step.id}${name}`;
    case 'verify':
      return `verify${name}`;
    case 'archive':
      return `archive${name}`;
    case 'wiki':
      return `resincronización del wiki${name}`;
    case 'review':
      return `revisión ${of[step.of] ?? ''}${step.of === 'verify' || step.of === 'plan' ? '' : ` ${step.label ?? step.id}`}${name}`.replace(/\s+/g, ' ');
    case 'update':
      return `update-change${name}`;
    default:
      return step?.kind ?? 'paso';
  }
}
