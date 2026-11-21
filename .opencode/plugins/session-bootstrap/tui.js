// Parte de TUI del plugin de arranque de sesión para OpenCode 2: muestra como
// toast los avisos de la parte de servidor (server.js), que llegan por el RPC
// del plugin. Al cargar recoge los que ya había y después escucha los nuevos.
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
    try {
      const client = context.client.rpc(RPC);
      // Primero escuchar y después pedir los pendientes, para no perder ninguno
      client.events.on("warning", (event) => show(event.data));
      const pending = await client.warnings({});
      for (const batch of pending ?? []) show(batch);
    } catch (error) {
      log("rpc:", error);
    }
  },
};
