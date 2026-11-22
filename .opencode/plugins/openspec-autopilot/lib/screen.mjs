// Qué hace la interfaz con cada pantalla (design D4 de
// autopilot-sesion-operativa): una función pura.
//
// directive({ route, operational, routeSession }) ->
//   { action: "none" }
//   { action: "modal", sessionID, title, change }   ventana ajena: lleva a la operativa
//   { action: "validate" }                          es la sesión operativa
//
//   route: { type: "home" } | { type: "session", sessionID }
//   operational: la sesión operativa válida de la rama ({ id, title, change }), o null
//   routeSession: la sesión de la ruta ({ id, archived }), o null

export function directive({ route, operational, routeSession = null }) {
  if (!operational) return { action: 'none' };
  if (route?.type === 'session') {
    if (route.sessionID === operational.id) return { action: 'validate' };
    if (routeSession?.archived) return { action: 'none' };
    // El paso que acaba de pasar el control: el plugin navega a la sesión
    // nueva y lo archiva en seguida. Si la TUI consulta la pantalla entre
    // medias, no es una ventana ajena
    if (routeSession?.meta?.phase === 'done') return { action: 'none' };
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
