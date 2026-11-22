// Dónde está instalado el plugin y si actúa en el proyecto (design D3 de
// windows-global-distro). Lo usan server.js, tui.js y lib/rpc.mjs. Es la
// misma regla que session-bootstrap/place.mjs, repetida porque cada plugin
// se puede instalar o quitar sin los otros.
//
// - En el proyecto, el plugin está en <proyecto>/.opencode/plugins/<id>/ y
//   actúa siempre, como en la plantilla completa.
// - En la instalación global, está en <config>/opencode/plugins/<id>/ y solo
//   actúa en proyectos intent-driven (los que declaran `schema: intent-driven`
//   en openspec/config.yaml) que no tienen su propio plugin con ese nombre: lo
//   del proyecto gana, como en OpenSpec la copia del schema del proyecto.
//
// Sin dependencias: solo módulos node:.

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

// El directorio de un plugin, a partir del import.meta.url de uno de sus archivos
export const pluginDirOf = (url) => path.dirname(fileURLToPath(url));

// Instalado en el proyecto: el abuelo del directorio del plugin es .opencode
export const isProjectPlugin = (dir) => path.basename(path.dirname(path.dirname(dir))) === ".opencode";

// El proyecto declara `schema: intent-driven` en openspec/config.yaml. Se lee
// la línea `schema:` con una expresión regular, sin un parser de YAML
export function isIntentDriven(directory) {
  try {
    const text = fs.readFileSync(path.join(directory, "openspec", "config.yaml"), "utf8");
    return /^schema\s*:\s*["']?intent-driven["']?\s*(#.*)?$/m.test(text);
  } catch {
    return false;
  }
}

// Si el plugin global debe actuar en el proyecto: es intent-driven y no tiene
// su propio plugin con ese nombre
export function globalActs(directory, id) {
  if (!directory) return false;
  if (fs.existsSync(path.join(directory, ".opencode", "plugins", id, "server.js"))) return false;
  return isIntentDriven(directory);
}
