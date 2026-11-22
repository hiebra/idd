// Plugin de la regla de comentarios para OpenCode 2: adaptador de la regla
// (ADR-0018, design D2 de update-comment-phrase-and-opencode-marker).
//
// - Al cargar, pide al núcleo .agents/hooks/session-bootstrap.mjs, con node,
//   la regla de comentarios (modo comments-rule). Sin node no hay regla: el
//   aviso de que falta lo da session-bootstrap.
// - Con el hook "context" de la sesión, que se ejecuta antes de cada petición
//   al modelo y no guarda lo que añade, pone la regla en el system y, si el
//   último mensaje del usuario la activa, su recordatorio (modo
//   comments-reminder) como mensaje del usuario justo antes de ese mensaje.
//   Qué mensajes la activan lo decide el núcleo (ADR-0010), y solo se le
//   pregunta cuando cambia el texto del último mensaje del usuario.
// - PROJECT_COMMENTS=off la desactiva: el núcleo no devuelve nada. Quitar este
//   directorio también, sin afectar al arranque de sesión.
// - Nunca lanza una excepción hacia OpenCode, y setup devuelve su limpieza
//   (ADR-0011): no registra nada que OpenCode no libere por sí mismo.
//
// - Instalado de forma global (<config>/opencode/plugins/response-comments/,
//   windows-global-distro), pide la regla al núcleo del plugin
//   session-bootstrap global, en ../session-bootstrap/, con --global, y solo
//   actúa donde actúa ese arranque: en proyectos intent-driven sin su propio
//   plugin response-comments. Si no actúa, no registra nada.
//
// Sin dependencias, como session-bootstrap: un objeto literal { id, setup } y
// solo módulos node:. Las reglas de dónde actúa son las de
// session-bootstrap/place.mjs, repetidas aquí porque este plugin se puede
// quitar sin el otro.

import { spawn } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const ID = "response-comments";
const HERE = path.dirname(fileURLToPath(import.meta.url));
// Instalado en el proyecto: el abuelo de su directorio es .opencode
const GLOBAL = path.basename(path.dirname(path.dirname(HERE))) !== ".opencode";
const CORE = path.join(".agents", "hooks", "session-bootstrap.mjs");
const core = (directory) =>
  GLOBAL ? [path.join(HERE, "..", "session-bootstrap", "session-bootstrap.mjs"), "--global"] : [path.join(directory, CORE)];

// Instalado de forma global, actúa en proyectos intent-driven sin su propio response-comments
function globalActs(directory) {
  if (!directory) return false;
  if (fs.existsSync(path.join(directory, ".opencode", "plugins", ID, "server.js"))) return false;
  try {
    const text = fs.readFileSync(path.join(directory, "openspec", "config.yaml"), "utf8");
    return /^schema\s*:\s*["']?intent-driven["']?\s*(#.*)?$/m.test(text);
  } catch {
    return false;
  }
}

const log = (...args) => console.error(`[${ID}]`, ...args);

// Ejecuta el núcleo en un modo de la regla de comentarios (comments-rule o
// comments-reminder, que lee `input` por stdin) y resuelve con su texto, o con
// "" si no hay o falla; nunca rechaza
function coreText(directory, mode, input = null) {
  return new Promise((resolve) => {
    let stdout = "";
    try {
      const child = spawn("node", [...core(directory), mode, "opencode", directory], {
        cwd: directory,
        stdio: [input === null ? "ignore" : "pipe", "pipe", "ignore"],
        windowsHide: true,
      });
      if (input !== null) {
        child.stdin.on("error", () => {});
        child.stdin.end(input);
      }
      child.stdout.on("data", (chunk) => (stdout += chunk));
      child.on("error", () => resolve(""));
      child.on("close", (code) => resolve(code === 0 ? stdout.trim() : ""));
    } catch (error) {
      log(`core ${mode}:`, error);
      resolve("");
    }
  });
}

// El texto del último mensaje del usuario de una petición al modelo, o null
function lastUserText(messages) {
  const last = [...messages].reverse().find((m) => m.role === "user");
  if (!last) return null;
  if (typeof last.content === "string") return last.content;
  if (!Array.isArray(last.content)) return null;
  return last.content
    .filter((part) => part?.type === "text" && typeof part.text === "string")
    .map((part) => part.text)
    .join("\n");
}

export default {
  id: ID,
  setup(ctx) {
    if (GLOBAL && !globalActs(ctx?.location?.directory)) return () => {};
    try {
      const directory = ctx.location.directory;
      const rule = coreText(directory, "comments-rule");
      let comments = { message: null, reminder: Promise.resolve("") };
      // Una excepción en el hook "context" haría fallar la petición al
      // modelo, así que todo va dentro de try/catch
      Promise.resolve(
        ctx.session.hook("context", async (input) => {
          try {
            const message = lastUserText(input.messages);
            if (message !== null && message !== comments.message) {
              comments = { message, reminder: coreText(directory, "comments-reminder", message) };
            }
            const [ruleText, reminder] = await Promise.all([rule, message === null ? "" : comments.reminder]);
            if (ruleText) input.system.push({ type: "text", text: ruleText });
            if (reminder) {
              const messages = input.messages;
              const at = messages.at(-1)?.role === "user" ? messages.length - 1 : messages.length;
              messages.splice(at, 0, { role: "user", content: [{ type: "text", text: reminder }] });
            }
          } catch (error) {
            log("context:", error);
          }
        })
      ).catch((error) => log("session.hook:", error));
    } catch (error) {
      log("setup:", error);
    }
    // Nada que liberar: OpenCode descarta el hook "context" al recargar
    return () => {};
  },
};
