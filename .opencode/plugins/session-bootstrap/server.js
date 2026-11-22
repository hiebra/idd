// Parte de servidor del plugin de arranque de sesión para OpenCode 2:
// adaptador del núcleo .agents/hooks/session-bootstrap.mjs (ADR-0023).
//
// - Al cargar, lanza el núcleo con node en segundo plano sobre el proyecto;
//   setup no espera a la instalación. Si no hay node, avisa con el mismo
//   texto que da el núcleo cuando falta npm.
// - Antes de cada comando de shell, espera al núcleo, pone el openspec del
//   proyecto por delante en el PATH del comando y exporta CLAUDE_PLUGIN_ROOT
//   con el motor del wiki, para que sus skills encuentren su helper.
// - Entrega la guía del wiki y su recordatorio por mensaje que prepara el
//   núcleo, con el hook "context" de la sesión, que se ejecuta antes de cada
//   petición al modelo y no guarda lo que añade: la guía va al system y el
//   recordatorio, como mensaje del usuario, justo antes del último mensaje del
//   usuario, como hace el modo Plan de OpenCode. Así nunca se acumulan. La
//   regla de comentarios la entrega su propio plugin, response-comments
//   (ADR-0018).
// - Los avisos llegan a la TUI (tui.js) por el RPC del plugin: el método
//   warnings() devuelve los acumulados y el evento "warning" trae los nuevos.
// - Nunca lanza una excepción hacia OpenCode: un fallo se convierte en aviso.
//
// - Instalado de forma global (<config>/opencode/plugins/session-bootstrap/,
//   windows-global-distro), lleva consigo el núcleo y sus textos, lo lanza con
//   --global, y solo actúa en proyectos intent-driven sin su propio plugin
//   session-bootstrap (place.mjs). Si no actúa, no registra nada ni avisa.
//
// Sin dependencias: exporta un objeto literal { id, setup } en lugar de usar
// Plugin.define de @opencode/plugin, que solo lo devuelve tal cual, y usa
// solo módulos node:, porque el propio arranque es lo que instala las
// dependencias del proyecto.

import { spawn } from "node:child_process";
import path from "node:path";
import { globalActs, isProjectPlugin, pluginDirOf } from "./place.mjs";

const ID = "session-bootstrap";
const HERE = pluginDirOf(import.meta.url);
const GLOBAL = !isProjectPlugin(HERE);
// El núcleo: el del proyecto, o el que lleva consigo el plugin global
const CORE = path.join(".agents", "hooks", "session-bootstrap.mjs");
const core = (directory) => (GLOBAL ? [path.join(HERE, "session-bootstrap.mjs"), "--global"] : [path.join(directory, CORE)]);
// El mismo texto que da el núcleo cuando falta npm
const NO_NODE_WARNING =
  "session-start: hace falta Node.js con npm para instalar las dependencias del proyecto; no se instala nada";
const PATH_WARNING =
  "session-start: no se ha podido ajustar el PATH de la sesión; ejecuta el CLI del proyecto con 'npx openspec'";
const ENGINE_WARNING =
  "session-start: no se ha podido exportar CLAUDE_PLUGIN_ROOT; las operaciones del wiki que usan el helper del motor no lo encontrarán";

// Si el núcleo tarda más que esto, se avisa de que los comandos esperan a la instalación
const SLOW_CORE_MS = 3000;

// Contrato del RPC del plugin, el mismo en tui.js. Rpc.define de
// @opencode/plugin/rpc solo lo comprueba y lo devuelve tal cual.
const RPC = {
  // El global, con su propio id, para que sus eventos no lleguen a la TUI del
  // plugin del proyecto
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

// Ejecuta el núcleo en un modo que imprime un texto para el agente (guide o
// reminder) y resuelve con ese texto, o con "" si no hay o falla; nunca rechaza
function coreText(directory, mode) {
  return new Promise((resolve) => {
    let stdout = "";
    try {
      const child = spawn("node", [...core(directory), mode, "opencode", directory], {
        cwd: directory,
        stdio: ["ignore", "pipe", "ignore"],
        windowsHide: true,
      });
      child.stdout.on("data", (chunk) => (stdout += chunk));
      child.on("error", () => resolve(""));
      child.on("close", (code) => resolve(code === 0 ? stdout.trim() : ""));
    } catch (error) {
      log(`core ${mode}:`, error);
      resolve("");
    }
  });
}

// Añade al system de una petición al modelo los textos de sesión (la guía
// del wiki) y, justo antes del último mensaje del usuario, cada recordatorio. Lanza si la petición no se deja cambiar; quien
// la llama lo captura
function addContext(input, systemTexts, reminders) {
  for (const text of systemTexts) if (text) input.system.push({ type: "text", text });
  const messages = input.messages;
  for (const reminder of reminders) {
    if (!reminder) continue;
    const at = messages.at(-1)?.role === "user" ? messages.length - 1 : messages.length;
    messages.splice(at, 0, { role: "user", content: [{ type: "text", text: reminder }] });
  }
}

// Ejecuta el núcleo y resuelve con { bin, engine, warnings }; nunca rechaza
function runCore(directory) {
  return new Promise((resolve) => {
    let stdout = "";
    let stderr = "";
    let child;
    const finish = (extra = []) => {
      const value = (key) =>
        stdout
          .split("\n")
          .find((line) => line.startsWith(`${key}=`))
          ?.slice(key.length + 1) || null;
      const warnings = stderr.split("\n").filter((line) => line.trim() !== "");
      resolve({ bin: value("bin"), engine: value("wiki-engine"), warnings: [...warnings, ...extra] });
    };
    const failed = (error) =>
      finish([
        error?.code === "ENOENT"
          ? NO_NODE_WARNING
          : `session-start: no se ha podido ejecutar el arranque de sesión (${error.message})`,
      ]);
    try {
      child = spawn("node", [...core(directory), directory], {
        cwd: directory,
        stdio: ["ignore", "pipe", "pipe"],
        windowsHide: true,
      });
    } catch (error) {
      failed(error);
      return;
    }
    child.stdout.on("data", (chunk) => (stdout += chunk));
    child.stderr.on("data", (chunk) => (stderr += chunk));
    child.on("error", failed);
    child.on("close", () => finish());
  });
}

export default {
  id: ID,
  setup(ctx) {
    if (GLOBAL && !globalActs(ctx?.location?.directory, ID)) return () => {};
    // Avisos por lotes: cada lote es un toast
    const batches = [];
    let registration = null;
    const addWarnings = (list, variant = "warning") => {
      if (list.length === 0) return;
      const batch = { index: batches.length, message: list.join("\n"), variant };
      batches.push(batch);
      for (const warning of list) log(warning);
      Promise.resolve(registration)
        .then((reg) => reg?.events.emit("warning", batch))
        .catch((error) => log("rpc emit:", error));
    };

    try {
      registration = Promise.resolve(ctx.rpc.register(RPC, { warnings: async () => batches })).catch((error) => {
        log("rpc register:", error);
        return null;
      });
    } catch (error) {
      log("rpc register:", error);
    }

    // La guía y el recordatorio: una excepción en el hook "context" haría
    // fallar la petición al modelo, así que todo va dentro de try/catch
    try {
      const directory = ctx.location.directory;
      const texts = Promise.all([coreText(directory, "guide"), coreText(directory, "reminder")]);
      Promise.resolve(
        ctx.session.hook("context", async (input) => {
          try {
            const [guide, reminder] = await texts;
            addContext(input, [guide], [reminder]);
          } catch (error) {
            log("context:", error);
          }
        })
      ).catch((error) => log("session.hook:", error));
    } catch (error) {
      log("session.hook:", error);
    }

    try {
      const directory = ctx.location.directory;
      let finished = false;
      const core = runCore(directory).then((result) => {
        finished = true;
        addWarnings(result.warnings);
        return result;
      });
      const slow = setTimeout(() => {
        if (!finished) {
          addWarnings(
            ["session-start: instalando las dependencias del proyecto; los comandos de la sesión esperan a que termine"],
            "info"
          );
        }
      }, SLOW_CORE_MS);
      slow.unref?.();

      let hooked = false;
      let envWarned = false;
      // Lo que no se ha podido poner en el entorno de los comandos, avisado una sola vez
      const warnEnv = ({ bin, engine }) => {
        if (envWarned || (!bin && !engine)) return;
        envWarned = true;
        addWarnings([...(bin ? [PATH_WARNING] : []), ...(engine ? [ENGINE_WARNING] : [])]);
      };
      try {
        if (ctx.shell && typeof ctx.shell.hook === "function") {
          ctx.shell.hook("create.before", async (event) => {
            let result = {};
            try {
              result = await core;
              const { bin, engine } = result;
              if (!bin && !engine) return;
              // event.env se cambia en el sitio, como se comprobó con OpenCode 2.3.2
              if (!event.env) event.env = {};
              if (engine) event.env.CLAUDE_PLUGIN_ROOT = engine;
              if (!bin) return;
              // En Windows la variable se llama Path, y una copia del entorno distingue mayúsculas
              const key = Object.keys(event.env).find((name) => name.toUpperCase() === "PATH") ?? "PATH";
              const current = event.env[key] ?? process.env.PATH ?? "";
              event.env[key] = current ? `${bin}${path.delimiter}${current}` : bin;
            } catch (error) {
              log("create.before:", error);
              warnEnv(result);
            }
          });
          hooked = true;
        }
      } catch (error) {
        log("shell.hook:", error);
      }
      if (!hooked) {
        // Solo hace falta avisar si hay algo que poner en el entorno
        core.then(warnEnv);
      }
    } catch (error) {
      log("setup:", error);
      addWarnings([`session-start: el arranque de sesión ha fallado (${error?.message ?? error})`]);
    }
  },
};
