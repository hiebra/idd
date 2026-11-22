// Contrato del RPC entre el servidor y los clientes con interfaz del plugin
// (design D13 de add-openspec-autopilot, D1, D3, D4 y D14 de
// autopilot-sesion-operativa), el mismo en server.js y tui.js.
//
// Cliente -> servidor:
// - hello({ instance, pid, client }): se presenta al cargar y cuando el
//   servidor lo pide con el evento "hello-request" (tras recargarse). Un PID
//   que el servidor no ha visto es un arranque de la TUI; el mismo PID, una
//   recarga en caliente.
// - screen({ instance, route, reason }): la TUI ha cambiado de pantalla o ha
//   recuperado el foco; el servidor responde con la directiva de lib/screen.mjs
//   ({ action: "none" | "modal" | "notice" | "navigate", ... }).
// - reply({ id, instance, value, error }): respuesta a una petición.
//
// Servidor -> cliente (evento "request" { id, instance, op, args }, dirigido a
// la última instancia presentada): op es "toast", "navigate" o "archive". Las
// demás instancias lo ignoran. El servidor acepta una sola respuesta por
// petición, la de la instancia destinataria.

export const RPC = {
  id: 'openspec-autopilot',
  methods: {
    hello: { input: { type: 'object' }, output: { type: 'object' } },
    screen: { input: { type: 'object' }, output: { type: 'object' } },
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
