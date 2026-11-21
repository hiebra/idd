// Parte de TUI del plugin de arranque de sesión para OpenCode 2: muestra como
// toast los avisos de la parte de servidor (server.js), que llegan por el RPC
// del plugin. Al cargar recoge los que ya había y después escucha los nuevos.
// Al descargarse (antes de cada recarga en caliente y al cerrar), se da de baja
// con la función que devuelve setup (ADR-0010): sin ella, cada carga anterior
// seguiría mostrando los avisos nuevos y, con --standalone, dejaría una traza
// ECONNRESET al cerrar.
//
// Sin dependencias, como server.js.

const ID = "session-bootstrap";

// Contrato del RPC del plugin, el mismo en server.js
const RPC = {
  id: ID,
  methods: {
    warnings: {
      input: { type: "object" },
      output: {
        type: "array",
        items: {
          type: "object",
          properties: { index: { type: "number" }, message: { type: "string" }, variant: { type: "string" } },
          required: ["index", "message", "variant"],
        },
      },
    },
  },
  events: {
    warning: {
      schema: {
        type: "object",
        properties: { index: { type: "number" }, message: { type: "string" }, variant: { type: "string" } },
        required: ["index", "message", "variant"],
      },
    },
  },
};

const log = (...args) => console.error(`[${ID}]`, ...args);

export default {
  id: ID,
  async setup(context) {
    const shown = new Set();
    const show = (batch) => {
      try {
        if (!batch || shown.has(batch.index)) return;
        shown.add(batch.index);
        context.ui.toast.show({ message: batch.message, variant: batch.variant === "info" ? "info" : "warning" });
      } catch (error) {
        log("toast:", error);
      }
    };
    // OpenCode ejecuta lo que devuelve setup antes de cada recarga y al cerrar
    const subscriptions = new AbortController();
    const cleanup = () => subscriptions.abort();
    try {
      const client = context.client.rpc(RPC);
      // Primero escuchar y después pedir los pendientes, para no perder ninguno
      client.events.on("warning", (event) => show(event.data), { signal: subscriptions.signal });
      const pending = await client.warnings({});
      for (const batch of pending ?? []) show(batch);
    } catch (error) {
      log("rpc:", error);
    }
    return cleanup;
  },
};
