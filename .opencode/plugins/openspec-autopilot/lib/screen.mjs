// Qué hace la interfaz con cada pantalla (design D3 y D4 de
// autopilot-rama-por-sesion; D4 de autopilot-sesion-operativa): funciones
// puras que deciden a partir del estado que les da el servidor.
//
// enterSession({ target, fromDir, head, clean, working, permanent, origin }) ->
//   { action: "none" }                               nada que hacer
//   { action: "toast", message }                     otro directorio: avisa de su rama
//   { action: "checkout", branch, via }              mismo directorio, otra rama, árbol
//                                                    limpio: via "switch" (temporal) u
//                                                    "origin" (la rama de origen)
//   { action: "back", reason, message }              no se cambia de rama: vuelve a la
//                                                    ventana anterior (reason "dirty" o
//                                                    "working")
//   target: la sesión de la ruta ({ id, dir, branch, archived })
//   fromDir: el directorio de la ventana anterior (null: el mismo)
//   head: la rama de HEAD en target.dir (null con HEAD separado)
//   clean: si el árbol de target.dir está limpio
//   working: el título de otra sesión de ese directorio que trabaja, o null
//   permanent, origin: las ramas permanentes y la de origen
//
// newWindow({ route, isNew, routeIsOperational, operational, temporary, clean }) ->
//   { action: "none" } | { action: "modal", message, options }
//   El modal de `/new`: en la pantalla de inicio o una sesión sin mensajes, en
//   una rama temporal que ya tiene sesión operativa, y no en la propia operativa.

export const OPTION = {
  worktree: { title: 'Crear un worktree nuevo', value: 'worktree' },
  origin: { title: 'Cambiar a la rama de origen', value: 'origin' },
};

const where = (dir) => (dir ? ` (${dir})` : '');

export function enterSession({ target, fromDir = null, head, clean, working = null, permanent = ['main'], origin = 'main' }) {
  if (!target || target.archived || !target.branch) return { action: 'none' };
  const otherDir = Boolean(fromDir) && fromDir !== target.dir;
  if (head === target.branch) {
    if (otherDir) return { action: 'toast', message: `openspec-autopilot: estás en la rama ${target.branch}, en su directorio${where(target.dir)}.` };
    return { action: 'none' };
  }
  const why = `no se cambia a la rama ${target.branch} de esta sesión`;
  if (!clean) {
    return {
      action: 'back',
      reason: 'dirty',
      message: `openspec-autopilot: ${why}: el directorio${where(target.dir)} tiene cambios sin commit en la rama ${head ?? '(HEAD separado)'}. Haz el commit, o usa un worktree para trabajar en otra rama a la vez.`,
    };
  }
  if (working) {
    return { action: 'back', reason: 'working', message: `openspec-autopilot: ${why}: hay una sesión trabajando en ese directorio («${working}»). Espera a que termine, o usa un worktree.` };
  }
  if (target.branch === origin) return { action: 'checkout', branch: target.branch, via: 'origin' };
  if (permanent.includes(target.branch)) {
    return { action: 'toast', message: `openspec-autopilot: ${why}: ${target.branch} es una rama permanente y el plugin solo cambia a la rama de origen o a una temporal.` };
  }
  return { action: 'checkout', branch: target.branch, via: 'switch' };
}

export function checkedOut(branch, dir) {
  return `openspec-autopilot: estás en la rama ${branch} tras un checkout${where(dir)}.`;
}

export function newWindow({ route, isNew = false, routeIsOperational = false, operational, temporary, clean }) {
  if (!operational || !temporary || routeIsOperational) return { action: 'none' };
  if (route?.type === 'session' && !isNew) return { action: 'none' };
  if (route?.type !== 'session' && route?.type !== 'home') return { action: 'none' };
  const what = operational.change ? `el change ${operational.change}` : 'un change nuevo';
  const options = clean ? [OPTION.worktree, OPTION.origin] : [OPTION.worktree];
  const message =
    `La rama ${operational.branch} ya tiene su sesión operativa «${operational.title}», que edita ${what} en modo autopilot. ` +
    (clean ? 'Para empezar otro change, crea un worktree nuevo o cambia a la rama de origen.' : 'Para empezar otro change, crea un worktree nuevo (el árbol tiene cambios sin commit).');
  return { action: 'modal', message, options };
}

// El modal de un solo botón de autopilot-sesion-operativa, hasta que server.js
// pase a enterSession y newWindow (task 4.3)
export function directive({ route, operational, routeSession = null }) {
  if (!operational) return { action: 'none' };
  if (route?.type === 'session') {
    if (route.sessionID === operational.id) return { action: 'validate' };
    if (routeSession?.archived) return { action: 'none' };
  } else if (route?.type !== 'home') {
    return { action: 'none' };
  }
  return { action: 'modal', sessionID: operational.id, title: operational.title, change: operational.change ?? null };
}

export const MODAL_BUTTON = 'Ir a la sesión del change';

export function modalText({ change, title }) {
  const what = change ? `el change ${change}` : 'un change nuevo';
  return `Mientras se edita ${what} en modo autopilot, solo se puede operar con su sesión operativa «${title}».`;
}
