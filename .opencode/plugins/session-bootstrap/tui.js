// Parte de TUI del plugin de arranque de sesión para OpenCode 2: muestra como
// toast los avisos de la parte de servidor (server.js), que llegan por el RPC
// del plugin. Al cargar recoge los que ya había y después escucha los nuevos.
// Al descargarse (antes de cada recarga en caliente y al cerrar), se da de baja
// con la función que devuelve setup (ADR-0011): sin ella, cada carga anterior
// seguiría mostrando los avisos nuevos y, con --standalone, dejaría una traza
// ECONNRESET al cerrar.
//
// Instalado de forma global, se comporta como server.js (place.mjs).
//
// Sin dependencias, como server.js.

import { globalActs, isProjectPlugin, pluginDirOf } from "./place.mjs";

const ID = "session-bootstrap";
const GLOBAL = !isProjectPlugin(pluginDirOf(import.meta.url));

// Contrato del RPC del plugin, el mismo en server.js
const RPC = {
  id: GLOBAL ? `${ID}-global` : ID,
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
const RETRY_MS = [200, 400, 800, 1600, 3200, 4000];

export default {
  id: ID,
  async setup(context) {
    // Instalado de forma global, no hace nada donde no actúa la parte de
    // servidor (place.mjs); sin directorio, escucha su propio RPC, que solo
    // existe si la parte de servidor actúa
    const directory = context?.location?.directory;
    if (GLOBAL && directory && !globalActs(directory, ID)) return () => {};
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
    let retry = null;
    const cleanup = () => {
      subscriptions.abort();
      if (retry) clearTimeout(retry);
    };
    // Al arrancar, la TUI puede llamar antes de que la parte de servidor
    // registre su RPC (rpc.unavailable): se reintenta sin escribir nada
    // (design D14 de autopilot-sesion-operativa)
    const unavailable = (error) => /rpc\.unavailable|RPC is unavailable/i.test(`${error?.type ?? ""} ${error?.message ?? ""}`);
    try {
      const client = context.client.rpc(RPC);
      // Sin sesión abierta, una llamada sin ubicación no llega a la parte de servidor del proyecto
      const at = context.location?.directory ? { location: { directory: context.location.directory } } : undefined;
      // Primero escuchar y después pedir los pendientes, para no perder ninguno
      client.events.on("warning", (event) => show(event.data), { signal: subscriptions.signal });
      const fetchPending = async (attempt = 0) => {
        if (subscriptions.signal.aborted) return;
        try {
          const pending = await client.warnings({}, at);
          for (const batch of pending ?? []) show(batch);
        } catch (error) {
          if (unavailable(error) && attempt < RETRY_MS.length) {
            retry = setTimeout(() => fetchPending(attempt + 1), RETRY_MS[attempt]);
            retry.unref?.();
            return;
          }
          log("rpc:", error);
        }
      };
      await fetchPending();
    } catch (error) {
      log("rpc:", error);
    }
    return cleanup;
  },
};
