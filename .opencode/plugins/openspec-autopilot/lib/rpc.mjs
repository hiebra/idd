// Contrato del RPC entre el servidor y los clientes con interfaz del plugin
// (design D13 de add-openspec-autopilot, D1, D3, D4 y D14 de
// autopilot-sesion-operativa, D2 a D4 de autopilot-rama-por-sesion), el mismo
// en server.js y tui.js.
//
// Hay una instancia de la parte de servidor por directorio (el checkout
// principal y cada worktree), y cada llamada de la TUI va a la del directorio
// en que está en ese momento (`{ location: { directory } }`).
//
// Cliente -> servidor:
// - hello({ instance, pid, client }): se presenta a la instancia de un
//   directorio la primera vez que entra en él, y cuando esa instancia lo pide
//   con el evento "hello-request" (tras recargarse). Un PID que la instancia
//   no ha visto es un arranque de la TUI en ese directorio; el mismo PID, una
//   recarga en caliente.
// - screen({ instance, route, previous, reason }): la TUI ha cambiado de
//   pantalla o ha recuperado el foco; route y previous (la pantalla anterior)
//   llevan su `directory`. El servidor responde con una directiva
//   ({ action: "none" | "toast" | "back" | "modal" | "notice" | "navigate",
//   toast?, ... }).
// - origin({ instance }): la opción «Cambiar a la rama de origen» del modal de
//   `/new`; responde { ok, message }.
// - reply({ id, instance, value, error }): respuesta a una petición.
//
// Servidor -> cliente (evento "request" { id, instance, directory, op, args },
// dirigido a la última instancia presentada): op es "toast", "navigate" o
// "archive", y la respuesta va a la instancia del servidor de `directory`.
// Las demás instancias de la TUI lo ignoran. El servidor acepta una sola
// respuesta por petición, la de la instancia destinataria. "hello-request"
// lleva el `directory` de la instancia que lo pide.

export const RPC = {
  id: 'openspec-autopilot',
  methods: {
    hello: { input: { type: 'object' }, output: { type: 'object' } },
    screen: { input: { type: 'object' }, output: { type: 'object' } },
    origin: { input: { type: 'object' }, output: { type: 'object' } },
    reply: { input: { type: 'object' }, output: { type: 'object' } },
  },
  events: {
    request: { schema: { type: 'object' } },
    'hello-request': { schema: { type: 'object' } },
  },
};

// Límites de espera de cada petición a la TUI
export const TIMEOUT_MS = { toast: 5000, navigate: 5000, archive: 8000 };

// Reintentos de hello mientras el servidor no ha registrado su RPC (design D14)
export const HELLO_RETRY_MS = [200, 400, 800, 1600, 3200, 4000];

export function rpcUnavailable(error) {
  const text = `${error?.type ?? ''} ${error?.message ?? ''} ${error?.cause?.type ?? ''} ${JSON.stringify(error?.data ?? '')}`;
  return /rpc\.unavailable|RPC is unavailable|rpc unavailable/i.test(text);
}
