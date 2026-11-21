// Contrato del RPC entre el servidor y la TUI del plugin (design D13 de
// add-openspec-autopilot), el mismo en server.js y tui.js.
//
// - La TUI se presenta con hello({ instance }), al cargar y cuando el
//   servidor lo pide con el evento "hello-request" (tras recargarse).
// - El servidor pide cosas a la TUI con el evento "request"
//   { id, instance, op, args }, dirigido a la última instancia presentada:
//   op es "toast", "navigate", "archive" o "select". Las demás instancias,
//   que siguen vivas tras cada recarga (lección 5), lo ignoran.
// - La TUI contesta con reply({ id, instance, value }); el servidor acepta
//   una sola respuesta por petición, la de la instancia destinataria.

export const RPC = {
  id: 'openspec-autopilot',
  methods: {
    hello: { input: { type: 'object' }, output: { type: 'object' } },
    reply: { input: { type: 'object' }, output: { type: 'object' } },
  },
  events: {
    request: { schema: { type: 'object' } },
    'hello-request': { schema: { type: 'object' } },
  },
};

// Límites de espera de cada petición a la TUI (design D12); el del diálogo se
// fijó con OpenCode 2.3.2 (task 1.3: el hook context aguanta al menos 300 s)
export const TIMEOUT_MS = { toast: 10000, navigate: 10000, archive: 15000, select: 120000 };
