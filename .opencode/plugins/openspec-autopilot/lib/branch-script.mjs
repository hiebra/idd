// Dónde está branch-change.mjs (design D4 de windows-global-distro): con la
// skill openspec-git-discipline, en el proyecto o en la instalación global.
// Es el único sitio del plugin que lo busca. Primero el del proyecto, en
// .agents/skills/openspec-git-discipline/scripts/; si no está, el que deja la
// instalación global junto a este plugin: <config>/opencode/plugins/<plugin>/
// y <config>/opencode/skills/openspec-git-discipline/scripts/.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SKILL = 'openspec-git-discipline';
const IN_SKILL = path.join('scripts', 'branch-change.mjs');
// La ruta del script en el proyecto, como la da el SKILL.md de la plantilla completa
export const PROJECT_SCRIPT = ['.agents', 'skills', SKILL, 'scripts', 'branch-change.mjs'].join('/');

// El directorio del plugin: el padre de lib/
const PLUGIN_DIR = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

// { file, command }: la ruta absoluta del script y cómo se escribe en una
// orden para el modelo (relativa al proyecto si es la del proyecto, absoluta
// si es la global). Si no está en ninguno de los dos sitios, la del proyecto.
export function branchScript(directory) {
  const own = path.join(directory, ...PROJECT_SCRIPT.split('/'));
  if (fs.existsSync(own)) return { file: own, command: PROJECT_SCRIPT };
  const global = path.resolve(PLUGIN_DIR, '..', '..', 'skills', SKILL, IN_SKILL);
  if (fs.existsSync(global)) return { file: global, command: global };
  return { file: own, command: PROJECT_SCRIPT };
}
