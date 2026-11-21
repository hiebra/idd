// Parte de servidor del plugin de arranque de sesión para OpenCode 2:
// adaptador del núcleo .agents/hooks/session-bootstrap.sh (ADR-0002).
//
// - Al cargar, lanza el núcleo en segundo plano sobre el proyecto; setup no
//   espera a la instalación.
// - Antes de cada comando de shell, espera al núcleo y pone el openspec del
//   proyecto por delante en el PATH del comando.
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
    const warnings = [];
    const addWarnings = (list) => {
      for (const warning of list) {
        warnings.push(warning);
        log(warning);
      }
    };

    try {
      const directory = ctx.location.directory;
      const core = runCore(directory).then((result) => {
        addWarnings(result.warnings);
        return result;
      });

      let hooked = false;
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
            }
          });
          hooked = true;
        }
      } catch (error) {
        log("shell.hook:", error);
      }
      if (!hooked) {
        // Solo hace falta avisar si hay un openspec que exponer
        core.then(({ bin }) => bin && addWarnings([PATH_WARNING]));
      }
    } catch (error) {
      log("setup:", error);
      addWarnings([`session-start: el arranque de sesión ha fallado (${error?.message ?? error})`]);
    }
  },
};
