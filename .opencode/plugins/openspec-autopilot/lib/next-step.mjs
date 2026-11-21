// El paso siguiente de un change (design D6 y D11 de add-openspec-autopilot):
// una función pura, sin OpenCode ni git, que se prueba con node --test.
//
// Pasos ({ kind, id, of }):
//   new                 openspec-new-change
//   artifact <id>       openspec-continue-change de ese artefacto
//   task <id>           openspec-apply-change limitado a esa task
//   verify              openspec-verify-change
//   archive             openspec-archive-change
//   wiki                la resincronización del wiki de las indicaciones de archivado
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

// Las tasks de un tasks.md: cada línea "- [ ] <id> ..." o "- [x] <id> ..."
export function parseTasks(text) {
  const tasks = [];
  for (const line of String(text ?? '').split(/\r?\n/)) {
    const m = /^\s*-\s+\[([ xX])\]\s+(\S+)/.exec(line);
    if (m) tasks.push({ id: m[2].replace(/[.:]$/, ''), done: m[1] !== ' ' });
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
  if (pending) return { kind: 'task', id: pending.id };
  return { kind: 'verify' };
}

const REVIEWED = new Set(['artifact', 'task', 'verify']);

// next({ mode, finished, result, state }) -> { step, zoneChange }
//   mode: "normal" | "auto"
//   finished: el paso terminado ({ kind, id, of }), o null al tomar el control
//   result: el resultado que dio la tool: "ok" | "no ok" (revisiones),
//     "clean" | "critical" (verify)
//   state: { change, status (openspec status --json), tasks }
//   lastZone: la zona del último paso que escribió, para el cambio de zona
export function next({ mode = 'normal', finished = null, result = null, state = null, lastZone = null }) {
  const step = decide({ mode, finished, result, state });
  const zone = zoneOf(step);
  const zoneChange = Boolean(zone && lastZone && zone !== lastZone);
  return { step, zoneChange };
}

function decide({ mode, finished, result, state }) {
  if (!finished) return stepFromState(state);
  const auto = mode === 'auto';
  switch (finished.kind) {
    case 'new':
      return stepFromState(state);
    case 'artifact':
    case 'task':
      if (!auto) return { kind: 'review', id: finished.id ?? finished.kind, of: finished.kind };
      return stepFromState(state);
    case 'verify':
      if (!auto) return { kind: 'review', id: 'verify', of: 'verify' };
      return result === 'critical' ? { kind: 'review', id: 'verify', of: 'verify' } : { kind: 'archive' };
    case 'review': {
      if (result !== 'ok') return { kind: 'update', id: finished.id, of: finished.of };
      if (finished.of === 'verify') return { kind: 'archive' };
      return stepFromState(state);
    }
    case 'update':
      return { kind: 'review', id: 'plan', of: 'plan' };
    case 'archive':
      return { kind: 'wiki' };
    case 'wiki':
      return { kind: 'end' };
    default:
      return stepFromState(state);
  }
}

// Si el paso terminado necesita que el usuario confirme el cierre (design D8)
export function needsConfirmation({ mode, step, result }) {
  if (step?.kind === 'review') return true;
  return mode === 'auto' && step?.kind === 'verify' && result === 'critical';
}

export function isReviewed(kind) {
  return REVIEWED.has(kind);
}

// Una descripción corta del paso, para títulos, avisos y el índice
export function describe(step, change) {
  const of = { artifact: 'el artefacto', task: 'la task', verify: 'el verify', plan: 'el plan' };
  const name = change ? ` de ${change}` : '';
  switch (step?.kind) {
    case 'new':
      return 'nuevo change';
    case 'artifact':
      return `artefacto ${step.id}${name}`;
    case 'task':
      return `task ${step.id}${name}`;
    case 'verify':
      return `verify${name}`;
    case 'archive':
      return `archive${name}`;
    case 'wiki':
      return `resincronización del wiki${name}`;
    case 'review':
      return `revisión de ${of[step.of] ?? ''}${step.of === 'verify' || step.of === 'plan' ? '' : ` ${step.id}`}${name}`.replace(/\s+/g, ' ');
    case 'update':
      return `update-change${name}`;
    default:
      return step?.kind ?? 'paso';
  }
}
