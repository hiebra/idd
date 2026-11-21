// Parte de servidor del plugin de arranque de sesión para OpenCode 2:
// adaptador del núcleo .agents/hooks/session-bootstrap.sh (ADR-0002).
//
// - Al cargar, lanza el núcleo en segundo plano sobre el proyecto; setup no
//   espera a la instalación.
// - Antes de cada comando de shell, espera al núcleo y pone el openspec del
//   proyecto por delante en el PATH del comando.
// - Los avisos llegan a la TUI (tui.js) por el RPC del plugin: el método
//   warnings() devuelve los acumulados y el evento "warning" trae los nuevos.
// - Nunca lanza una excepción hacia OpenCode: un fallo se convierte en aviso.
//
// Sin dependencias: exporta un objeto literal { id, setup } en lugar de usar
// Plugin.define de @opencode/plugin, que solo lo devuelve tal cual, y usa
// solo módulos node:, porque el propio arranque es lo que instala las
// dependencias del proyecto.

import { spawn } from "node:child_process";
import path from "node:path";

const ID = "session-bootstrap";
const CORE = path.join(".agents", "hooks", "session-bootstrap.sh");
const PATH_WARNING =
  "session-start: no se ha podido ajustar el PATH de la sesión; ejecuta el CLI del proyecto con 'npx openspec'";

// Si el núcleo tarda más que esto, se avisa de que los comandos esperan a la instalación
const SLOW_CORE_MS = 3000;

// Contrato del RPC del plugin, el mismo en tui.js. Rpc.define de
// @opencode/plugin/rpc solo lo comprueba y lo devuelve tal cual.
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

// Ejecuta el núcleo y resuelve con { bin, warnings }; nunca rechaza
function runCore(directory) {
  return new Promise((resolve) => {
    let stdout = "";
    let stderr = "";
    let child;
    const finish = (extra = []) => {
      const bin = stdout
        .split("\n")
        .find((line) => line.startsWith("bin="))
        ?.slice("bin=".length);
      const warnings = stderr.split("\n").filter((line) => line.trim() !== "");
      resolve({ bin: bin || null, warnings: [...warnings, ...extra] });
    };
    try {
      child = spawn("bash", [path.join(directory, CORE), directory], {
        cwd: directory,
        stdio: ["ignore", "pipe", "pipe"],
      });
    } catch (error) {
      finish([`session-start: no se ha podido ejecutar el arranque de sesión (${error.message})`]);
      return;
    }
    child.stdout.on("data", (chunk) => (stdout += chunk));
    child.stderr.on("data", (chunk) => (stderr += chunk));
    child.on("error", (error) =>
      finish([`session-start: no se ha podido ejecutar el arranque de sesión (${error.message})`])
    );
    child.on("close", () => finish());
  });
}

export default {
  id: ID,
  setup(ctx) {
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
      let pathWarned = false;
      try {
        if (ctx.shell && typeof ctx.shell.hook === "function") {
          ctx.shell.hook("create.before", async (event) => {
            try {
              const { bin } = await core;
              if (!bin) return;
              // event.env se cambia en el sitio, como se comprobó con OpenCode 2.3.2
              if (!event.env) event.env = {};
              const current = event.env.PATH ?? process.env.PATH ?? "";
              event.env.PATH = current ? `${bin}${path.delimiter}${current}` : bin;
            } catch (error) {
              log("create.before:", error);
              if (!pathWarned) {
                pathWarned = true;
                addWarnings([PATH_WARNING]);
              }
            }
          });
          hooked = true;
        }
      } catch (error) {
        log("shell.hook:", error);
      }
      if (!hooked) {
        // Solo hace falta avisar si hay un openspec que exponer
        core.then(({ bin }) => {
          if (bin && !pathWarned) {
            pathWarned = true;
            addWarnings([PATH_WARNING]);
          }
        });
      }
    } catch (error) {
      log("setup:", error);
      addWarnings([`session-start: el arranque de sesión ha fallado (${error?.message ?? error})`]);
    }
  },
};
