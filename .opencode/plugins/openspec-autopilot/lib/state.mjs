// El estado del change en la metadata de las sesiones (design D4 de
// add-openspec-autopilot): la clave `openspec` de cada sesión orquestada.
//
//   { v: 1, worktree, branch, change, role: "owner" | "free",
//     step: { kind, id, of }, seq, phase, zone, injected, handoff, review,
//     lessons, leftFrom, resumed }
//
// La dueña es la sesión no archivada de ese worktree y esa rama con
// role "owner". `branch` es la rama de trabajo de la sesión (design D1 de
// autopilot-rama-por-sesion): la que tenía HEAD en su directorio al crearse, y
// la nueva si se hace un checkout dentro de la sesión. Una dueña que cambia
// así de rama pasa a "free" con phase "left" y `leftFrom`, la rama que deja;
// cuando el directorio vuelve a ella, la sesión operativa nueva retoma el
// paso y la sesión anterior queda con `resumed`. La metadata se escribe siempre entera (lección 2: update la
// sustituye), leyendo con get, combinando y escribiendo, y se vuelve a leer
// para confirmarlo, porque una operación sin error no prueba nada (lección 1).

export const KEY = 'openspec';

export function meta(session) {
  const value = session?.metadata?.[KEY];
  return value && typeof value === 'object' ? value : null;
}

export function isArchived(session) {
  return Boolean(session?.time?.archived);
}

// Trabaja si time.busy es posterior a time.idle, o no hay time.idle (lección 6)
export function isWorking(session) {
  const time = session?.time ?? {};
  if (!time.busy) return false;
  return !time.idle || time.busy > time.idle;
}

// Escribe la clave openspec de una sesión combinándola con lo que tiene
export async function writeMeta(api, sessionID, patch) {
  const current = await api.get({ sessionID });
  const metadata = { ...(current.metadata ?? {}) };
  metadata[KEY] = { ...(meta(current) ?? { v: 1 }), ...patch, v: 1 };
  await api.update({ sessionID, metadata });
  const after = await api.get({ sessionID });
  const written = meta(after);
  for (const [key, value] of Object.entries(patch)) {
    if (JSON.stringify(written?.[key]) !== JSON.stringify(value)) {
      throw new Error(`la metadata de ${sessionID} no ha quedado escrita (${key})`);
    }
  }
  return written;
}

// Todas las sesiones, archivadas incluidas: list() devuelve { data, cursor }
// por páginas (comprobado con OpenCode 2.3.2, task 12.2)
export async function allSessions(api, { pageSize = 100, maxPages = 50 } = {}) {
  const all = [];
  let cursor;
  for (let page = 0; page < maxPages; page++) {
    const result = await api.list({ limit: pageSize, ...(cursor ? { cursor } : {}) });
    const data = Array.isArray(result) ? result : Array.isArray(result?.data) ? result.data : [];
    all.push(...data);
    cursor = result?.cursor?.next;
    if (!cursor || data.length === 0) break;
  }
  return all;
}

// Las sesiones de un worktree y una rama, archivadas incluidas
export async function branchSessions(api, { worktree, branch }) {
  const all = await allSessions(api);
  return all.filter((s) => {
    const m = meta(s);
    return m && m.worktree === worktree && m.branch === branch;
  });
}

export function owners(sessions) {
  return sessions.filter((s) => !isArchived(s) && meta(s)?.role === 'owner');
}

// La dueña que gana entre varias: la de time.created más antiguo (design D4)
export function winner(candidates) {
  return [...candidates].sort((a, b) => (a.time?.created ?? 0) - (b.time?.created ?? 0) || String(a.id).localeCompare(String(b.id)))[0] ?? null;
}

// Las sesiones de un change, por seq: las de su rama con ese change, más la
// que lo creó (paso new, sin change todavía)
export function changeSessions(sessions, change) {
  return sessions
    .filter((s) => {
      const m = meta(s);
      return m.change === change || (m.step?.kind === 'new' && !m.change);
    })
    .filter((s) => typeof meta(s).seq === 'number')
    .sort((a, b) => meta(a).seq - meta(b).seq);
}

export function nextSeq(sessions) {
  return sessions.reduce((max, s) => Math.max(max, meta(s)?.seq ?? 0), 0) + 1;
}

// El directorio de una sesión: el suyo en OpenCode, o el de su metadata
export function sessionDir(session) {
  return session?.location?.directory ?? session?.directory ?? meta(session)?.worktree ?? null;
}

// Si una sesión ha cambiado de rama dentro de sí misma (design D1): su rama de
// trabajo no es la de HEAD y no ha sido el plugin quien ha hecho el checkout
// (pluginCheckout: el último que hizo en el directorio, { from, to }).
// Devuelve null o el parche de la metadata.
export function branchMoved({ meta: m, head, pluginCheckout = null }) {
  if (!m?.branch || !head || m.branch === head) return null;
  if (pluginCheckout && pluginCheckout.to === head && pluginCheckout.from === m.branch) return null;
  if (m.role === 'owner') return { branch: head, role: 'free', phase: 'left', leftFrom: m.branch, resumed: false };
  return { branch: head };
}

// Las sesiones que dejaron de ser la operativa de una rama al cambiar de rama
// y que la rama todavía no ha retomado
export function leftFrom(sessions, { worktree, branch }) {
  return sessions.filter((s) => {
    const m = meta(s);
    return m && m.worktree === worktree && m.leftFrom === branch && !m.resumed;
  });
}
