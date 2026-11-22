#!/usr/bin/env node
// Núcleo del arranque de sesión, neutral respecto al agente (ADR-0023, que
// sustituye a ADR-0002; ADR-0005).
//
// Uso:
//   node session-bootstrap.mjs <directorio del proyecto>
//       Prepara el proyecto para la sesión:
//       - Prepara git (manage-git-discipline, design D5): completa el clon si
//         es superficial; en un contenedor efímero, trae las referencias de
//         origin con git fetch; pone al día con update-ref cada rama
//         permanente local (x-main) atrasada respecto a origin/<rama>, salvo
//         la rama en la que está el clon, y avisa de las que han divergido; y
//         en un contenedor efímero guarda la rama de la sesión en
//         git config idd.sessionBranch, si no hay una guardada. No toca el
//         árbol de trabajo. Fuera de un contenedor efímero solo usa la red para
//         completar un clon superficial.
//       - Con el wiki del proyecto habilitado, instala el motor del wiki en la
//         versión fijada en .agents/wiki/engine.json, en .agents/wiki-engine/
//         (ignorado por git), y lo expone a cada agente con symlinks (en
//         Windows, con junctions, que no piden permisos); con el wiki
//         deshabilitado, retira esos symlinks. Con el wiki habilitado, avisa si
//         los pasos del wiki de openspec/config.yaml no coinciden con su
//         fuente; nunca reescribe config.yaml.
//       - Instala todas las dependencias del proyecto (npm install) en la raíz
//         y en acceptance-tests/ cuando faltan o han cambiado package.json,
//         package-lock.json o este script.
//       Por stdout, una línea "clave=valor" por dato que el adaptador necesita,
//       y nada más:
//         bin=<ruta absoluta a node_modules/.bin>, si hay un openspec del proyecto
//         wiki-engine=<ruta absoluta del paquete de Claude Code del motor>, el
//           valor de CLAUDE_PLUGIN_ROOT, si el motor está instalado
//   node session-bootstrap.mjs guide <agente> <directorio del proyecto>
//   node session-bootstrap.mjs reminder <agente> <directorio del proyecto>
//       Por stdout, la guía del wiki o el recordatorio por mensaje, ya
//       preparados para el agente (claude-code u opencode), o nada si el wiki
//       está deshabilitado o no se puede generar.
//   node session-bootstrap.mjs wiki <status|on|off> <directorio del proyecto>
//       La parte determinista de /toggle-wiki (design D3 de
//       add-project-wiki-toggle). Por stdout, líneas "clave=valor":
//       - status: enabled=true|false, wiki-dir=true|false (si existe .wiki/) y,
//         para la ingesta inicial, source=<ruta> por cada archivo versionado
//         que entraría y excluded=<ruta>|<motivo> por cada uno que no (lo
//         generado, informes, lockfiles, la copia del motor, enlaces, archivos
//         vacíos o de configuración trivial).
//       - on: pone "enabled": true, inserta los pasos del wiki de
//         archive-guidance.yaml en operations.archive.guidance de
//         openspec/config.yaml, entre "# wiki:archive-guidance:begin" y
//         "# wiki:archive-guidance:end" (crea las claves que falten, dentro de
//         las marcas), instala y expone el motor como el arranque y pasa al
//         stage engine.json y config.yaml. Imprime staged= y enabled=.
//       - off: pone "enabled": false, quita lo que hay entre las marcas, marcas
//         incluidas (y guidance, si se queda vacía), retira los symlinks del
//         motor y pasa al stage los mismos dos archivos. No toca .wiki/.
//       Ni on ni off hacen commit. Con las marcas mal formadas o repetidas no
//       cambian nada y avisan. La edición de config.yaml es de texto, línea a
//       línea: conserva byte a byte el resto del archivo.
//   node session-bootstrap.mjs comments-rule <agente> <directorio del proyecto>
//   node session-bootstrap.mjs comments-reminder <agente> <directorio del proyecto>
//       Por stdout, la regla de comentarios, o su recordatorio si el mensaje
//       del usuario, que se lee por stdin, la activa (es un comentario o
//       contiene una palabra de cierre: "p", "procesa", "procesar", "r",
//       "reformula" o "reformular"); nada si la regla está desactivada, el
//       mensaje no la activa o el texto no se puede generar.
//
// En todos los modos, avisos por stderr, uno por línea, con el prefijo
// "session-start:", y termina siempre con 0: nunca bloquea la sesión.
//
// El wiki del proyecto está habilitado solo si .agents/wiki/engine.json dice
// literalmente "enabled": true (design D1 de add-project-wiki-toggle, ADR-0021);
// vale para todo el proyecto y ninguna variable local lo cambia. Deshabilitado,
// no se instala el motor, se retiran sus symlinks y la guía y el recordatorio
// quedan vacíos. Del proyecto solo se leen engine.json, openspec/config.yaml y
// .wiki/; la guía, el recordatorio, opencode-note.md y archive-guidance.yaml se
// buscan en ../wiki/ respecto a este script (design D8), o en wiki/ junto a él
// en la instalación global.
// La regla de comentarios se desactiva en local con PROJECT_COMMENTS=off.
//
// Modo global (design D2 de windows-global-distro): con --global delante del
// modo, el núcleo es el que lleva el plugin session-bootstrap de la
// instalación global (<config>/opencode/plugins/session-bootstrap/):
// - solo actúa si el proyecto declara `schema: intent-driven` en
//   openspec/config.yaml; si no, no hace nada, en ningún modo, ni avisa;
// - no descarga el motor del wiki ni crea symlinks: usa el de
//   <data>/idd/wiki-engine, donde <data> es XDG_DATA_HOME o, si no está
//   definida, LOCALAPPDATA (en otros sistemas, ~/.local/share), y expone su
//   ruta igual que en el proyecto;
// - toma la guía, el recordatorio, opencode-note.md, archive-guidance.yaml y la
//   regla de comentarios de su propio directorio (wiki/ y comments/ junto a
//   este script); el ajuste del wiki es el del proyecto, como en la plantilla
//   completa;
// - prepara git, instala las dependencias del proyecto y pone su openspec en
//   el PATH igual que en el proyecto.
//
// Cada agente tiene su adaptador, que lanza este script con node, ajusta el
// entorno de su sesión, entrega la guía y el recordatorio y muestra los
// avisos. Si node no existe, es el adaptador el que avisa, con el mismo texto
// que da aquí la falta de npm.
//
// Sin dependencias: solo módulos node:, porque es el propio arranque el que
// instala las dependencias del proyecto.

import { spawnSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const SELF = fileURLToPath(import.meta.url);
const WINDOWS = process.platform === 'win32';

// Lanzado desde la instalación global (--global)
let GLOBAL = false;

const WIKI_DIR = path.join('.agents', 'wiki');
const ENGINE_JSON = path.join(WIKI_DIR, 'engine.json');
const ENGINE_DIR = path.join('.agents', 'wiki-engine');
const ENGINE_STAMP = path.join(ENGINE_DIR, '.wiki-engine-ref');
// Lo que se expone a cada agente (design D1 de add-llm-wiki-support): ruta del
// agente y destino relativo a ella
const ENGINE_LINKS = [
  [path.join('.claude', 'skills', 'wiki-manager'), '../../.agents/wiki-engine/claude-plugin/skills/wiki-manager'],
  [path.join('.claude', 'commands', 'wiki'), '../../.agents/wiki-engine/claude-plugin/commands'],
  [path.join('.opencode', 'skills', 'wiki-query'), '../../.agents/wiki-engine/plugins/llm-wiki-opencode/skills/wiki-query'],
];
const REMINDER_MAX = 600;
const COMMENTS_DIR = path.join('.agents', 'comments');
const BRANCH_CHANGE = path.join('.agents', 'skills', 'openspec-git-discipline', 'scripts', 'branch-change.mjs');
// El de la skill instalada de forma global, junto a los plugins:
// <config>/opencode/skills/… respecto a <config>/opencode/plugins/session-bootstrap/
const GLOBAL_BRANCH_CHANGE = path.resolve(path.dirname(SELF), '..', '..', 'skills', 'openspec-git-discipline', 'scripts', 'branch-change.mjs');

const CONFIG_YAML = path.join('openspec', 'config.yaml');
const BLOCK_BEGIN = '# wiki:archive-guidance:begin';
const BLOCK_END = '# wiki:archive-guidance:end';

// Dónde están los textos que viajan con la distribución (design D8 de
// add-project-wiki-toggle): ../wiki/ respecto a este script, no en el proyecto
// (en este repositorio coinciden); junto a él, en wiki/, en la instalación global
const wikiDir = () => (GLOBAL ? path.join(path.dirname(SELF), 'wiki') : path.resolve(path.dirname(SELF), '..', 'wiki'));
const commentsDir = () => (GLOBAL ? path.join(path.dirname(SELF), 'comments') : COMMENTS_DIR);

// <data> de la instalación global, como lo calculan OpenSpec y el instalador
function dataDir() {
  if (process.env.XDG_DATA_HOME) return process.env.XDG_DATA_HOME;
  if (WINDOWS && process.env.LOCALAPPDATA) return process.env.LOCALAPPDATA;
  return path.join(os.homedir(), '.local', 'share');
}

// El proyecto declara `schema: intent-driven` en openspec/config.yaml (en el
// directorio actual). Se lee la línea `schema:` con una expresión regular, sin
// un parser de YAML, como branch-change.mjs lee x-main
function intentDriven() {
  const text = readText(path.join('openspec', 'config.yaml'));
  return text !== null && /^schema\s*:\s*["']?intent-driven["']?\s*(#.*)?$/m.test(text);
}
const GIT_TIMEOUT_MS = 300 * 1000;

export const NO_NPM_WARNING = 'hace falta Node.js con npm para instalar las dependencias del proyecto; no se instala nada';

const warn = (message) => process.stderr.write(`session-start: ${message}\n`);
// Las últimas líneas de un log, como avisos de detalle
const warnTail = (log, lines) => {
  for (const line of lastLines(log, lines)) process.stderr.write(`session-start:   ${line}\n`);
};

function lastLines(text, count) {
  const lines = String(text ?? '').split('\n');
  if (lines.at(-1) === '') lines.pop();
  return lines.slice(-count);
}

// El wiki está habilitado solo si engine.json dice literalmente "enabled": true.
// Un archivo que falta, un error o cualquier otro valor lo dejan deshabilitado
const wikiEnabled = () => /"enabled"[ \t\r\f\v]*:[ \t\r\f\v]*true(?:[^A-Za-z0-9_."]|$)/m.test(readText(ENGINE_JSON) ?? '');
const wikiDisabled = () => !wikiEnabled();
const commentsDisabled = () => process.env.PROJECT_COMMENTS === 'off';

// --- Utilidades -----------------------------------------------------------------

// Un comando del PATH, como `command -v`; en Windows, con las extensiones de PATHEXT
function which(command) {
  const exts = WINDOWS ? (process.env.PATHEXT || '.EXE;.CMD;.BAT;.COM').split(';').filter(Boolean) : [''];
  for (const dir of (process.env.PATH || '').split(path.delimiter)) {
    if (!dir) continue;
    for (const ext of exts) {
      const candidate = path.join(dir, command + ext);
      try {
        const stat = fs.statSync(candidate);
        if (!stat.isFile()) continue;
        if (!WINDOWS) fs.accessSync(candidate, fs.constants.X_OK);
        return candidate;
      } catch {
        // sigue buscando
      }
    }
  }
  return null;
}

// Ejecuta git en el directorio actual; { ok, out, log }
function git(args, { timeout = 10000, env = null } = {}) {
  const result = spawnSync('git', args, {
    encoding: 'utf8',
    timeout,
    env: env ?? process.env,
    stdio: ['ignore', 'pipe', 'pipe'],
    windowsHide: true,
  });
  return {
    ok: !result.error && result.status === 0,
    out: (result.stdout ?? '').trim(),
    log: `${result.stdout ?? ''}${result.stderr ?? ''}${result.error ? `${result.error.message}\n` : ''}`,
  };
}

const networkEnv = () => ({ ...process.env, GIT_TERMINAL_PROMPT: '0' });

function readText(file) {
  try {
    return fs.readFileSync(file, 'utf8');
  } catch {
    return null;
  }
}

// El texto sin los saltos de línea finales, como lo deja $(...) en bash
const chomp = (text) => text.replace(/\n+$/, '');

function exists(file) {
  try {
    fs.lstatSync(file);
    return true;
  } catch {
    return false;
  }
}

function isDir(file) {
  try {
    return fs.statSync(file).isDirectory();
  } catch {
    return false;
  }
}

// --- Git -------------------------------------------------------------------------

// prepareGit: deja el clon listo para el ciclo de git del proyecto (design D5
// de manage-git-discipline). La detección del contenedor efímero y la lista
// x-main vienen de branch-change.mjs
function prepareGit() {
  if (!which('git')) return;
  if (!git(['rev-parse', '--is-inside-work-tree']).ok) return;
  let ephemeral = false;
  let permanent = ['main'];
  const script = [BRANCH_CHANGE, GLOBAL_BRANCH_CHANGE].find((file) => fs.existsSync(file));
  if (script) {
    const info = spawnSync(process.execPath, [script, 'env'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], windowsHide: true });
    for (const line of (info.stdout ?? '').split('\n')) {
      if (line.startsWith('ephemeral=')) ephemeral = line.slice('ephemeral='.length).trim() === 'true';
      else if (/^permanent=\S/.test(line)) permanent = line.slice('permanent='.length).trim().split(/\s+/);
    }
  }
  let fetched = false;
  if (git(['rev-parse', '--is-shallow-repository']).out === 'true') {
    const result = git(['fetch', '--unshallow', '--quiet'], { timeout: GIT_TIMEOUT_MS, env: networkEnv() });
    if (result.ok) fetched = true;
    else {
      warn('no se pudo completar el clon superficial (git fetch --unshallow); las puertas del ciclo usan las referencias que haya');
      warnTail(result.log, 2);
    }
  }
  if (ephemeral && !fetched) {
    const result = git(['fetch', '--quiet', 'origin'], { timeout: GIT_TIMEOUT_MS, env: networkEnv() });
    if (!result.ok) {
      warn('no se pudo actualizar las referencias de origin (git fetch origin); las puertas del ciclo usan las que haya');
      warnTail(result.log, 2);
    }
  }
  const head = git(['symbolic-ref', '--short', '-q', 'HEAD']);
  const current = head.ok ? head.out : '';
  // Las ramas sacadas en cualquier directorio del clon (el principal o un
  // worktree): update-ref movería la referencia sin su árbol ni su índice
  // (design D11 de autopilot-rama-por-sesion)
  const checkedOut = new Set([current]);
  for (const line of git(['worktree', 'list', '--porcelain']).out.split('\n')) {
    if (line.startsWith('branch refs/heads/')) checkedOut.add(line.slice('branch refs/heads/'.length).trim());
  }
  for (const name of permanent) {
    if (checkedOut.has(name)) continue;
    const old = git(['rev-parse', '--verify', '-q', `refs/heads/${name}`]);
    if (!old.ok) continue;
    const next = git(['rev-parse', '--verify', '-q', `refs/remotes/origin/${name}`]);
    if (!next.ok || old.out === next.out) continue;
    if (git(['merge-base', '--is-ancestor', old.out, next.out]).ok) {
      if (!git(['update-ref', `refs/heads/${name}`, next.out, old.out]).ok) {
        warn(`no se pudo poner al día la rama permanente local '${name}' con origin/${name}`);
      }
    } else if (!git(['merge-base', '--is-ancestor', next.out, old.out]).ok) {
      warn(`la rama permanente local '${name}' y origin/${name} han divergido; no se toca`);
    }
  }
  if (ephemeral && current && !git(['config', '--get', 'idd.sessionBranch']).out) {
    if (!git(['config', 'idd.sessionBranch', current]).ok) warn('no se pudo guardar la rama de la sesión (git config idd.sessionBranch)');
  }
}

// --- Motor del wiki ----------------------------------------------------------------

// engineField NAME: el valor de texto NAME de engine.json
function engineField(name) {
  const text = readText(ENGINE_JSON) ?? '';
  return text.match(new RegExp(`"${name}"\\s*:\\s*"([^"]*)"`))?.[1] ?? '';
}

// "owner/name" es un repositorio de GitHub; cualquier otra cosa, una URL de git
const engineUrl = (repo) => (/^[A-Za-z0-9_.-]+\/[A-Za-z0-9_.-]+$/.test(repo) ? `https://github.com/${repo}.git` : repo);

// LINK es un symlink (o junction) que puso este script: apunta dentro del motor
function isEngineLink(link) {
  try {
    if (!fs.lstatSync(link).isSymbolicLink()) return false;
    const target = path.resolve(path.dirname(link), fs.readlinkSync(link));
    return target.startsWith(path.resolve(ENGINE_DIR) + path.sep);
  } catch {
    return false;
  }
}

function removeLink(link) {
  try {
    fs.rmSync(link, { force: true });
  } catch {
    try {
      fs.rmdirSync(link);
    } catch {
      // nada más que hacer
    }
  }
}

function removeEngineLinks() {
  for (const [link] of ENGINE_LINKS) if (isEngineLink(link)) removeLink(link);
}

// El destino del enlace tal como se crea: relativo, salvo en Windows, donde
// una junction necesita la ruta absoluta
const linkTarget = (link, target) => (WINDOWS ? path.resolve(path.dirname(link), target) : target);

// Expone el motor instalado a cada agente. Lo que ya exista con esos nombres
// y no sea un enlace del motor no se toca (design D8)
function linkEngine() {
  for (const [link, target] of ENGINE_LINKS) {
    const wanted = linkTarget(link, target);
    if (isEngineLink(link)) {
      if (fs.readlinkSync(link) === wanted || path.resolve(path.dirname(link), fs.readlinkSync(link)) === path.resolve(path.dirname(link), target)) continue;
      removeLink(link);
    } else if (exists(link)) {
      warn(`ya existe '${toPosix(link)}' y no es del motor del wiki; no se sustituye, así que el agente no verá esa parte del motor`);
      continue;
    }
    try {
      fs.mkdirSync(path.dirname(link), { recursive: true });
      fs.symlinkSync(wanted, link, WINDOWS ? 'junction' : 'dir');
    } catch {
      warn(`no se ha podido crear '${toPosix(link)}', que expone el motor del wiki al agente`);
    }
  }
}

const toPosix = (rel) => rel.split(path.sep).join('/');

function processAlive(pid) {
  try {
    process.kill(pid, 0);
    return true;
  } catch (error) {
    return error.code === 'EPERM';
  }
}

// El motor de la instalación global, sin instalar nada (design D2 de
// windows-global-distro)
function globalWikiEngine() {
  const dir = path.join(dataDir(), 'idd', 'wiki-engine', 'claude-plugin');
  return isDir(dir) ? dir : null;
}

// fetchEngine REPO REF: descarga el motor del wiki en ENGINE_DIR, o avisa. Es la
// única función que sabe de dónde sale el motor (design D8 de
// add-project-wiki-toggle), para que una instalación global pueda cambiarlo sin
// tocar el resto
function fetchEngine(repo, ref) {
  const url = engineUrl(repo);
  const want = `${ref} ${repo}`;
  const dir = toPosix(ENGINE_DIR);
  const manual = `rm -rf ${dir} && git clone --depth 1 --branch ${ref} ${url} ${dir} && echo '${want}' > ${toPosix(ENGINE_STAMP)}`;
  if (!which('git')) {
    warn(`falló la instalación del motor del wiki (${repo} ${ref}): hace falta git; se reintentará en la siguiente sesión. Para instalarlo a mano: ${manual}`);
  } else {
    // Se descarga aparte y se sustituye al final, para no dejar nunca una copia a medias
    const tmp = `${ENGINE_DIR}.tmp.${process.pid}`;
    const old = `${ENGINE_DIR}.old.${process.pid}`;
    // Restos de un arranque que se interrumpió (su proceso ya no existe)
    const parent = path.dirname(ENGINE_DIR);
    const base = path.basename(ENGINE_DIR);
    for (const name of fs.existsSync(parent) ? fs.readdirSync(parent) : []) {
      const match = name.match(new RegExp(`^${base.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\.(?:tmp|old)\\.(\\d+)$`));
      if (match && !processAlive(Number(match[1]))) fs.rmSync(path.join(parent, name), { recursive: true, force: true });
    }
    fs.rmSync(tmp, { recursive: true, force: true });
    const clone = git(['-c', 'advice.detachedHead=false', 'clone', '--quiet', '--depth', '1', '--branch', ref, url, tmp], {
      timeout: GIT_TIMEOUT_MS,
      env: networkEnv(),
    });
    let cloned = clone.ok;
    if (cloned) {
      try {
        fs.rmSync(path.join(tmp, '.git'), { recursive: true, force: true });
        fs.writeFileSync(path.join(tmp, '.wiki-engine-ref'), `${want}\n`);
      } catch {
        cloned = false;
      }
    }
    if (cloned) {
      let moved = false;
      try {
        if (exists(ENGINE_DIR)) fs.renameSync(ENGINE_DIR, old);
        fs.renameSync(tmp, ENGINE_DIR);
        moved = true;
      } catch {
        if (exists(old) && !exists(ENGINE_DIR)) {
          try {
            fs.renameSync(old, ENGINE_DIR);
          } catch {
            // queda como esté
          }
        }
        warn(`no se ha podido sustituir ${dir} por el motor del wiki ${ref}; se reintentará en la siguiente sesión`);
      }
      if (moved) fs.rmSync(old, { recursive: true, force: true });
    } else {
      warn(`falló la instalación del motor del wiki (${repo} ${ref}, git clone); se reintentará en la siguiente sesión. Para instalarlo a mano: ${manual}`);
      warnTail(clone.log, 3);
    }
    fs.rmSync(tmp, { recursive: true, force: true });
  }
}

// Instala el motor del wiki en la versión fijada, si falta o es otra (design D1)
function installWikiEngine() {
  if (GLOBAL) return wikiEnabled() ? globalWikiEngine() : null;
  if (!fs.existsSync(ENGINE_JSON)) return null;
  if (wikiDisabled()) {
    removeEngineLinks();
    return null;
  }
  const repo = engineField('repo');
  const ref = engineField('ref');
  if (!repo || !ref) {
    warn(`${toPosix(ENGINE_JSON)} no declara "repo" y "ref"; no se instala el motor del wiki`);
    return null;
  }
  const want = `${ref} ${repo}`;
  if (chomp(readText(ENGINE_STAMP) ?? '') !== want) fetchEngine(repo, ref);
  if (!isDir(path.join(ENGINE_DIR, 'claude-plugin'))) return null;
  linkEngine();
  return path.join(PROJECT, ENGINE_DIR, 'claude-plugin');
}

// .wiki/ se versiona siempre (design D5 de add-llm-wiki-support): el motor lo
// añade a .gitignore al inicializar un wiki en modo local. Las líneas exactas
// ".wiki" o ".wiki/" se retiran; si lo ignora otra regla, solo se avisa
function keepWikiVersioned() {
  if (!isDir('.wiki')) return;
  if (!which('git') || !git(['rev-parse', '--is-inside-work-tree']).ok) return;
  if (!wikiIgnored()) return;
  const text = readText('.gitignore');
  if (text !== null) {
    const lines = text.split('\n');
    if (lines.at(-1) === '') lines.pop();
    const kept = lines.filter((line) => !/^\.wiki\/?$/.test(line));
    if (kept.length !== lines.length) {
      try {
        fs.writeFileSync('.gitignore', kept.map((line) => `${line}\n`).join(''));
        warn("se ha quitado '.wiki/' de .gitignore: el wiki del proyecto se versiona con el repositorio");
      } catch {
        // se avisa abajo si sigue ignorado
      }
    }
  }
  if (wikiIgnored()) {
    warn("git ignora archivos de .wiki/ por otra regla; el wiki del proyecto debe versionarse (compruébalo con 'git check-ignore -v .wiki/<archivo>')");
  }
}

// El estado personal de Obsidian (.wiki/.obsidian/) se ignora a propósito
// en .gitignore, así que no cuenta
function wikiIgnored() {
  if (git(['check-ignore', '-q', '.wiki']).ok) return true;
  const ignored = git(['ls-files', '--others', '--ignored', '--exclude-standard', '--', '.wiki', ':(exclude).wiki/.obsidian']);
  return ignored.out !== '';
}

// --- El ajuste del wiki y /toggle-wiki (design D1-D3 de add-project-wiki-toggle) -----------

// setEnabled VALUE: cambia "enabled" en engine.json sin reescribir el resto
function setEnabled(value) {
  const text = readText(ENGINE_JSON);
  if (text === null || !text.includes('"')) {
    fs.mkdirSync(WIKI_DIR, { recursive: true });
    fs.writeFileSync(ENGINE_JSON, `{\n  "enabled": ${value}\n}\n`);
    return;
  }
  let out;
  if (/"enabled"[ \t\r\f\v]*:/.test(text)) {
    const re = /("enabled"[ \t\r\f\v]*:[ \t\r\f\v]*)("[^"]*"|[A-Za-z0-9_.+-]+)/;
    out = text.split('\n').map((line) => line.replace(re, (_, head) => `${head}${value}`)).join('\n');
  } else {
    const lines = text.split('\n');
    if (lines.at(-1) === '') lines.pop();
    const alone = lines.findIndex((line) => /^[ \t\r\f\v]*\{[ \t\r\f\v]*$/.test(line));
    if (alone >= 0) lines.splice(alone + 1, 0, `  "enabled": ${value},`);
    else {
      const first = lines.findIndex((line) => line.includes('{'));
      if (first >= 0) lines[first] = lines[first].replace('{', `{ "enabled": ${value},`);
    }
    out = `${lines.join('\n')}\n`;
  }
  fs.writeFileSync(ENGINE_JSON, out);
}

// Edición de texto, línea a línea, del bloque de pasos del wiki en
// operations.archive.guidance de config.yaml (design D2). No reescribe el YAML:
// conserva comentarios, orden y formato del resto. Modos de blockEdit:
//   check   'none', 'one' o 'bad' según las marcas
//   remove  config.yaml sin el bloque (marcas incluidas); si guidance queda
//           vacía, también sin ella
//   insert  config.yaml con el bloque al final de guidance; crea guidance,
//           archive u operations, dentro del bloque, si faltan
//   extract las entradas que hay dentro del bloque, sin sangría
// Devuelve { code, lines }: 0 bien; 2 marcas mal formadas; 3 no hay dónde
// ponerlo (por ejemplo, "guidance: []"); 4 quitarlo dejaría líneas huérfanas.
// Las líneas se numeran desde 1, como en el awk de la primera versión
const indOf = (s) => s.match(/^ */)[0].length;
const blankish = (s) => /^[ \t]*$/.test(s) || /^[ \t]*#/.test(s);
const keyOnly = (s) => /^ *[A-Za-z_][A-Za-z0-9_-]*:[ \t]*(#.*)?$/.test(s);
const keyName = (s) => s.replace(/^ */, '').replace(/:.*/, '');
const isMarker = (s, marker) => s.replace(/^[ \t]+/, '').replace(/[ \t]+$/, '') === marker;
const spaces = (k) => ' '.repeat(Math.max(k, 0));
const ITEM = /^ *-( |$)/;

function blockEdit(mode, text, source = []) {
  const lines = text.split('\n');
  if (lines.at(-1) === '') lines.pop();
  const L = ['', ...lines];
  const n = lines.length;
  // Última línea que pertenece a la clave de la línea k, sin las finales en blanco o de comentario
  const extent = (k) => {
    const ki = indOf(L[k]);
    let last = k;
    for (let i = k + 1; i <= n; i += 1) {
      if (blankish(L[i])) continue;
      if (indOf(L[i]) > ki || (indOf(L[i]) === ki && ITEM.test(L[i]))) {
        last = i;
        continue;
      }
      break;
    }
    return last;
  };
  // La sangría de los hijos de la clave de la línea k, o -1 si no tiene
  const childInd = (k) => {
    const e = extent(k);
    for (let i = k + 1; i <= e; i += 1) if (!blankish(L[i])) return indOf(L[i]);
    return -1;
  };
  // La línea de la clave hija NAME de la línea k (0 si no está, -1 si tiene un valor en línea)
  const child = (k, name) => {
    const e = extent(k);
    const ci = childInd(k);
    for (let i = k + 1; i <= e; i += 1) {
      if (blankish(L[i]) || indOf(L[i]) !== ci) continue;
      if (keyName(L[i]) === name && /^ *[A-Za-z_][A-Za-z0-9_-]*:/.test(L[i])) return keyOnly(L[i]) ? i : -1;
    }
    return 0;
  };
  const range = (from, to) => (to < from ? [] : L.slice(from, to + 1));

  let nb = 0;
  let ne = 0;
  let b = 0;
  let e = 0;
  let bad = false;
  for (let i = 1; i <= n; i += 1) {
    if (isMarker(L[i], BLOCK_BEGIN)) {
      nb += 1;
      if (!b) b = i;
      if (e) bad = true;
    }
    if (isMarker(L[i], BLOCK_END)) {
      ne += 1;
      if (!e) e = i;
      if (!b) bad = true;
    }
  }
  const state = nb > 1 || ne > 1 || nb !== ne || bad || (b && e < b) ? 'bad' : nb ? 'one' : 'none';
  if (mode === 'check') return { code: 0, state };
  if (state === 'bad') return { code: 2 };
  if (mode === 'extract') {
    if (state !== 'one') return { code: 0, lines: [] };
    let first = 0;
    for (let i = b + 1; i < e; i += 1) {
      if (ITEM.test(L[i])) {
        first = i;
        break;
      }
    }
    if (!first) return { code: 0, lines: [] };
    const d = indOf(L[first]);
    return { code: 0, lines: range(first, e - 1).map((line) => line.slice(d)) };
  }
  if (mode === 'remove') {
    if (state === 'none') return { code: 0, lines };
    // Lo que va después del bloque no puede colgar de una clave que se quita con él
    let top = -1;
    for (let i = b + 1; i < e; i += 1) {
      if (keyOnly(L[i])) {
        top = indOf(L[i]);
        break;
      }
    }
    if (top >= 0) {
      for (let i = e + 1; i <= n; i += 1) {
        if (blankish(L[i])) continue;
        if (indOf(L[i]) > top) return { code: 4 };
        break;
      }
    }
    // La clave de la que cuelga el bloque, y si se queda sin hijos
    let owner = 0;
    for (let i = b - 1; i >= 1; i -= 1) {
      if (keyOnly(L[i]) && indOf(L[i]) <= indOf(L[b])) {
        owner = i;
        break;
      }
    }
    let drop = 0;
    if (owner && keyName(L[owner]) === 'guidance') {
      let empty = true;
      for (let i = owner + 1; i <= n; i += 1) {
        if (i >= b && i <= e) continue;
        if (blankish(L[i])) continue;
        if (indOf(L[i]) > indOf(L[owner]) || (indOf(L[i]) === indOf(L[owner]) && ITEM.test(L[i]))) empty = false;
        break;
      }
      if (empty) drop = owner;
    }
    return { code: 0, lines: lines.filter((_, k) => (k + 1 < b || k + 1 > e) && k + 1 !== drop) };
  }
  // insert
  if (state === 'one') return { code: 2 };
  // De la fuente, sin los comentarios y líneas en blanco iniciales
  const S = [...source];
  while (S.length && (/^#/.test(S[0]) || /^[ \t]*$/.test(S[0]))) S.shift();
  let o = 0;
  for (let i = 1; i <= n; i += 1) {
    if (/^operations:/.test(L[i])) {
      if (!keyOnly(L[i])) return { code: 3 };
      o = i;
      break;
    }
  }
  let at;
  let pre;
  let d;
  let mi;
  if (!o) {
    at = n;
    pre = ['operations:', '  archive:', '    guidance:'];
    d = 6;
    mi = 0;
  } else {
    let ci = childInd(o);
    if (ci < 0) ci = 2;
    const a = child(o, 'archive');
    if (a < 0) return { code: 3 };
    if (!a) {
      at = extent(o);
      pre = [`${spaces(ci)}archive:`, `${spaces(ci + 2)}guidance:`];
      d = ci + 4;
      mi = ci;
    } else {
      let ai = childInd(a);
      if (ai < 0) ai = indOf(L[a]) + 2;
      const g = child(a, 'guidance');
      if (g < 0) return { code: 3 };
      if (!g) {
        at = extent(a);
        pre = [`${spaces(ai)}guidance:`];
        d = ai + 2;
        mi = ai;
      } else {
        at = extent(g);
        pre = [];
        const gi = childInd(g);
        d = gi < 0 ? indOf(L[g]) + 2 : gi;
        mi = d;
      }
    }
  }
  // Las claves que se crean van dentro del bloque, para que quitarlo las quite
  return {
    code: 0,
    lines: [
      ...range(1, at),
      `${spaces(mi)}${BLOCK_BEGIN}`,
      ...pre,
      ...S.map((line) => (line === '' ? '' : `${spaces(d)}${line}`)),
      `${spaces(mi)}${BLOCK_END}`,
      ...range(at + 1, n),
    ],
  };
}

const withNewline = (lines) => (lines.length ? `${lines.join('\n')}\n` : '');

// Las líneas de archive-guidance.yaml que van al bloque, o null si falta
function guidanceSource() {
  const text = readText(path.join(wikiDir(), 'archive-guidance.yaml'));
  if (text === null) return null;
  const lines = text.split('\n');
  if (lines.at(-1) === '') lines.pop();
  return lines;
}

// editBlock insert|remove: aplica el cambio a config.yaml, o avisa y no lo toca
function editBlock(action) {
  if (!fs.existsSync(CONFIG_YAML)) {
    warn(`no existe ${toPosix(CONFIG_YAML)}; no se cambian las indicaciones de archivado`);
    return true;
  }
  let text = fs.readFileSync(CONFIG_YAML, 'utf8');
  if (blockEdit('check', text).state === 'bad') {
    warn(`las marcas '${BLOCK_BEGIN}' y '${BLOCK_END}' de ${toPosix(CONFIG_YAML)} están mal formadas o repetidas; no se toca el archivo. Deja como mucho un par, con la de inicio antes que la de fin, y vuelve a ejecutar /toggle-wiki`);
    return false;
  }
  const source = guidanceSource();
  if (action === 'insert' && source === null) {
    warn(`no se encuentra ${toPosix(path.join(wikiDir(), 'archive-guidance.yaml'))}, la fuente de los pasos del wiki; no se toca ${toPosix(CONFIG_YAML)}`);
    return false;
  }
  let result;
  if (action === 'insert' && blockEdit('check', text).state === 'one') {
    // Se sustituye: primero se quita el bloque que hay
    result = blockEdit('remove', text);
    if (result.code === 0) result = blockEdit('insert', withNewline(result.lines), source);
  } else {
    result = blockEdit(action, text, source ?? []);
  }
  switch (result.code) {
    case 0:
      fs.writeFileSync(CONFIG_YAML, withNewline(result.lines));
      return true;
    case 3:
      warn(`no se sabe dónde poner los pasos del wiki en ${toPosix(CONFIG_YAML)} (operations, archive o guidance tienen un valor en la misma línea); no se toca el archivo`);
      return false;
    case 4:
      warn(`quitar los pasos del wiki de ${toPosix(CONFIG_YAML)} dejaría líneas sin la clave de la que cuelgan; no se toca el archivo`);
      return false;
    default:
      warn(`no se ha podido editar ${toPosix(CONFIG_YAML)}; no se toca el archivo`);
      return false;
  }
}

// Con el wiki habilitado, avisa si los pasos de config.yaml no coinciden con su fuente (design D2)
function warnStaleBlock() {
  if (!wikiEnabled()) return;
  const config = readText(CONFIG_YAML);
  const source = guidanceSource();
  if (config === null || source === null) return;
  if (blockEdit('check', config).state !== 'one') return;
  const current = chomp(blockEdit('extract', config).lines.join('\n'));
  const wanted = chomp(source.join('\n').replace(/^(?:(?:#[^\n]*|[ \t]*)\n)+/, ''));
  if (current === wanted) return;
  warn(`los pasos del wiki de ${toPosix(CONFIG_YAML)} no coinciden con su fuente (${toPosix(path.join(wikiDir(), 'archive-guidance.yaml'))}); para ponerlos al día, ejecuta /toggle-wiki dos veces y haz el commit`);
}

// Por qué la ruta no entra en la ingesta inicial, o null (la lista de
// exclusiones de la guía del wiki)
function ingestExclusion(file, mode) {
  const slashed = `/${file}`;
  const engine = toPosix(ENGINE_DIR);
  if (file.startsWith('.wiki/')) return 'el propio wiki';
  if (file.startsWith(`${engine}/`) || file.startsWith(`${engine}.`)) return 'la copia del motor';
  if (slashed.includes('/node_modules/') || slashed.includes('/.extracted/')) return 'generado';
  if (slashed.includes('/reports/')) return 'informe';
  const base = file.slice(file.lastIndexOf('/') + 1);
  if (['package-lock.json', 'npm-shrinkwrap.json', 'yarn.lock', 'pnpm-lock.yaml', 'bun.lockb'].includes(base) || base.endsWith('.lock')) return 'lockfile';
  if (['.gitignore', '.gitattributes', '.editorconfig', '.npmrc', '.nvmrc', '.node-version', '.prettierignore'].includes(base)) return 'configuración trivial';
  if (mode === '120000') return 'enlace';
  try {
    if (fs.statSync(file).size === 0) return 'vacío';
  } catch {
    return 'vacío';
  }
  return null;
}

// El ajuste, si existe .wiki/ y qué entraría en la ingesta inicial
function wikiStatus() {
  const out = [`enabled=${wikiEnabled()}`, `wiki-dir=${isDir('.wiki')}`];
  if (git(['rev-parse', '--is-inside-work-tree']).ok) {
    // Solo lo versionado; los symlinks son otra vía a lo que ya entra (ADR-0003)
    const listing = spawnSync('git', ['ls-files', '-s', '-z'], { encoding: 'utf8', maxBuffer: 1 << 28, windowsHide: true });
    for (const entry of (listing.stdout ?? '').split('\0')) {
      const tab = entry.indexOf('\t');
      if (tab < 0) continue;
      const file = entry.slice(tab + 1);
      const reason = ingestExclusion(file, entry.slice(0, entry.indexOf(' ')));
      out.push(reason ? `excluded=${file}|${reason}` : `source=${file}`);
    }
  }
  return out;
}

// wikiToggle on|off: la parte determinista de /toggle-wiki (design D3)
function wikiToggle(action) {
  const out = [];
  if (action === 'on') {
    if (!editBlock('insert')) return out;
    try {
      setEnabled(true);
    } catch {
      warn(`no se ha podido cambiar "enabled" en ${toPosix(ENGINE_JSON)}`);
    }
    guard('motor del wiki', installWikiEngine);
    guard('wiki versionado', keepWikiVersioned);
  } else {
    if (!editBlock('remove')) return out;
    try {
      setEnabled(false);
    } catch {
      warn(`no se ha podido cambiar "enabled" en ${toPosix(ENGINE_JSON)}`);
    }
    removeEngineLinks();
  }
  if (git(['rev-parse', '--is-inside-work-tree']).ok) {
    const files = [toPosix(ENGINE_JSON), ...(fs.existsSync(CONFIG_YAML) ? [toPosix(CONFIG_YAML)] : [])];
    if (!git(['add', '--', ...files]).ok) warn(`no se han podido pasar al stage ${files.join(' ')}`);
    out.push(`staged=${files.join(' ')}`);
  }
  out.push(`enabled=${wikiEnabled()}`);
  return out;
}

// wikiMode status|on|off DIRECTORIO
function wikiMode(action, dir) {
  if (!['status', 'on', 'off'].includes(action)) {
    warn('uso: session-bootstrap.mjs wiki <status|on|off> <directorio del proyecto>');
    return;
  }
  if (!enter(dir)) {
    if (!GLOBAL || !PROJECT) warn(`no se puede entrar en el directorio del proyecto ('${dir ?? ''}')`);
    return;
  }
  const out = action === 'status' ? wikiStatus() : wikiToggle(action);
  for (const line of out) process.stdout.write(`${line}\n`);
}

// --- Dependencias ------------------------------------------------------------------

function sha256(file) {
  return crypto.createHash('sha256').update(fs.readFileSync(file)).digest('hex');
}

// El sello de una instalación correcta: las sumas de package.json,
// package-lock.json y este script; null si falta alguno
function stampOf(dir) {
  try {
    return [path.join(dir, 'package.json'), path.join(dir, 'package-lock.json'), SELF]
      .map((file) => `${sha256(file)}  ${toPosix(path.relative(PROJECT, file) || file)}\n`)
      .join('');
  } catch {
    return null;
  }
}

// npm, y si hace falta una shell para lanzarlo (en Windows es npm.cmd)
function runNpm(dir, args, logFd) {
  return spawnSync('npm', args, { cwd: dir, stdio: ['ignore', logFd, logFd], shell: WINDOWS, windowsHide: true });
}

// installProject DIR: instala las dependencias del proyecto Node en DIR
// (relativo a la raíz) si faltan o han cambiado desde la última instalación correcta
function installProject(dir) {
  // Un sello por proyecto
  const stamp = path.join(dir, 'node_modules', '.session-start.sha256');
  const current = stampOf(dir);
  if (current !== null && readText(stamp) === current) return;
  // Borrar el sello antes, para que un fallo se reintente en la siguiente sesión
  fs.rmSync(stamp, { force: true });
  const logFile = path.join(fs.mkdtempSync(path.join(os.tmpdir(), 'session-start-')), 'npm.log');
  const fd = fs.openSync(logFile, 'w');
  let result;
  try {
    // npm install (no npm ci) de todas las dependencias
    result = runNpm(dir, ['install', '--no-audit', '--no-fund'], fd);
  } finally {
    fs.closeSync(fd);
  }
  if (!result.error && result.status === 0) {
    const after = stampOf(dir);
    if (after !== null) {
      try {
        fs.writeFileSync(stamp, after);
      } catch {
        fs.rmSync(stamp, { force: true });
      }
    }
  } else {
    warn(`falló la instalación de dependencias en '${toPosix(dir)}' (npm install); se reintentará en la siguiente sesión`);
    warnTail(`${readText(logFile) ?? ''}${result.error ? `${result.error.message}\n` : ''}`, 5);
  }
  fs.rmSync(path.dirname(logFile), { recursive: true, force: true });
}

// La versión mínima de un engines.node de la forma ">=X[.Y[.Z]]", o null
function minimumNode(required) {
  const match = String(required).match(/^\s*>=\s*v?(\d+)(?:\.(\d+))?(?:\.(\d+))?\s*$/);
  return match ? [Number(match[1]), Number(match[2] ?? 0), Number(match[3] ?? 0)] : null;
}

function olderThan(current, min) {
  for (let i = 0; i < 3; i += 1) {
    if ((current[i] ?? 0) !== min[i]) return (current[i] ?? 0) < min[i];
  }
  return false;
}

function installDependencies() {
  // Lo primero, comprobar npm
  if (!which('npm')) {
    warn(NO_NPM_WARNING);
    return null;
  }

  // Versión de Node frente a engines.node
  const current = process.versions.node;
  let required = '';
  try {
    required = String(JSON.parse(fs.readFileSync('package.json', 'utf8')).engines?.node ?? '');
  } catch {
    // sin package.json o sin engines.node
  }
  const min = minimumNode(required);
  if (min) {
    if (olderThan(current.split('.').map(Number), min)) {
      warn(`el proyecto necesita Node.js ${required} y la versión encontrada es ${current}; no se instala nada`);
      return null;
    }
  } else {
    warn(`no se puede comprobar la versión de Node.js (engines.node: '${required || 'ausente'}'); se continúa`);
  }

  // La raíz y, si existe, el proyecto de tests de aceptación; un fallo en uno no impide el otro
  installProject('.');
  if (fs.existsSync(path.join('acceptance-tests', 'package.json'))) installProject('acceptance-tests');

  // El openspec del proyecto, para que el adaptador lo ponga por delante en el PATH
  const bin = path.join('node_modules', '.bin');
  const names = WINDOWS ? ['openspec.cmd', 'openspec'] : ['openspec'];
  for (const name of names) {
    try {
      if (!WINDOWS) fs.accessSync(path.join(bin, name), fs.constants.X_OK);
      else fs.accessSync(path.join(bin, name));
      return path.join(PROJECT, bin);
    } catch {
      // el siguiente
    }
  }
  return null;
}

// --- Preparar la sesión --------------------------------------------------------------

let PROJECT = null;

// Entra en el directorio del proyecto; false si no se puede
// En modo global, además, el proyecto tiene que ser intent-driven
function enter(dir) {
  if (!dir) return false;
  try {
    process.chdir(dir);
    PROJECT = path.resolve(dir);
  } catch {
    return false;
  }
  return !GLOBAL || intentDriven();
}

function prepare(dir) {
  if (!enter(dir)) {
    // En modo global, un proyecto que no es intent-driven no recibe avisos
    if (!GLOBAL || !PROJECT) warn(`no se puede entrar en el directorio del proyecto ('${dir ?? ''}')`);
    return;
  }
  const out = [];
  guard('git', prepareGit);
  // El motor no depende de npm, así que va antes y se instala aunque falte
  const engine = guard('motor del wiki', installWikiEngine);
  if (wikiEnabled()) guard('wiki versionado', keepWikiVersioned);
  guard('pasos del wiki', warnStaleBlock);
  const bin = guard('dependencias', installDependencies);
  if (bin) out.push(`bin=${bin}`);
  if (engine) out.push(`wiki-engine=${engine}`);
  for (const line of out) process.stdout.write(`${line}\n`);
}

// Un paso que falla de forma inesperada se convierte en aviso
function guard(step, fn) {
  try {
    return fn();
  } catch (error) {
    warn(`ha fallado un paso del arranque (${step}: ${error?.message ?? error}); se continúa`);
    return null;
  }
}

// --- Guía y recordatorio del wiki --------------------------------------------------------

// Cada marcador de operación del motor y cómo se invoca en el agente (design
// D1 de fix-wiki-flow-operations)
const MARKERS = {
  'claude-code': { query: '`/wiki:query --local`', ingest: '`/wiki:ingest <url> --local`' },
  opencode: { query: 'la skill `wiki-query`', ingest: 'ingiere la fuente' },
};

const fillMarkers = (agent, text) =>
  Object.entries(MARKERS[agent]).reduce((acc, [marker, value]) => acc.split(`{{${marker}}}`).join(value), text);

const charCount = (text) => [...text].length;

// La guía o el recordatorio para el agente (design D2, D3 de
// add-llm-wiki-support). Con el wiki desactivado, sin engine.json o si no se
// puede generar, nada
function wikiText(mode, agent, dir) {
  if (!enter(dir)) return '';
  // El wiki del proyecto lo declara su engine.json, también con la instalación global
  if (wikiDisabled()) return '';
  if (!(agent in MARKERS)) return '';
  let text;
  if (mode === 'guide') {
    const guide = readText(path.join(wikiDir(), 'guide.md'));
    if (guide === null) return '';
    // Sin los identificadores de sección, que solo sirven para revisarla
    text = chomp(dropLines(guide, /^<!-- wiki-guide:[a-z0-9-]* -->$/));
    if (!text) return '';
    if (agent === 'opencode') {
      const note = readText(path.join(wikiDir(), 'opencode-note.md'));
      if (note !== null && chomp(note)) text = `${chomp(note)}\n\n${text}`;
    }
  } else {
    const reminder = readText(path.join(wikiDir(), 'reminder.md'));
    if (reminder === null) return '';
    text = chomp(reminder);
  }
  text = fillMarkers(agent, text);
  // Un texto vacío o con marcadores desconocidos no se entrega
  if (!text || /\{\{[\s\S]*\}\}/.test(text)) return '';
  if (mode === 'reminder' && charCount(text) > REMINDER_MAX) return '';
  return `${text}\n`;
}

function dropLines(text, pattern) {
  return text
    .split('\n')
    .filter((line) => !pattern.test(line))
    .join('\n');
}

// --- Regla de comentarios -------------------------------------------------------------

const CLOSING = /(?<![\p{L}\p{N}_])(?:p|procesa|procesar|r|reformula|reformular)(?![\p{L}\p{N}_])/iu;

// Si el mensaje activa la regla de comentarios (design D2 de
// add-quote-comment-rule; D1 y D2 de update-comment-closing-and-quotes; D1 y
// D1b de update-comment-phrase-and-opencode-marker). Es un comentario si, sin
// los espacios ni los comentarios HTML iniciales (la app de Claude antepone
// `<!-- attach -->` a las citas), empieza por una cadena no vacía entre
// comillas simples dobladas (''así'') o por una cita de Markdown (`>`), o si
// incluye una cita de la web de OpenCode. Si no lo es, la activa una palabra
// de cierre como palabra completa, sin distinguir mayúsculas. Dentro de un
// comentario las palabras de cierre no cambian nada: el mensaje ya la activa.
export function activatesComments(message) {
  let rest = message;
  for (;;) {
    rest = rest.replace(/^[ \t\n\r\v\f]+/, '');
    // Como en bash: empieza por "<!--" y tiene un "-->" detrás, y se quita
    // hasta el primer "-->"
    if (!rest.startsWith('<!--') || rest.indexOf('-->', 4) === -1) break;
    rest = rest.slice(rest.indexOf('-->') + 3);
  }
  if (/^''[^']+''/.test(rest)) return true;
  if (rest.startsWith('>')) return true;
  // La cita de la web de OpenCode llega como texto en cualquier punto del
  // mensaje: una línea "The user quoted the following from <origen>:" seguida
  // de una línea que empieza por "> "
  const lines = rest.split('\n');
  for (let i = 1; i < lines.length; i += 1) {
    if (/^The user quoted the following from .+:$/.test(lines[i - 1]) && lines[i].startsWith('> ')) return true;
  }
  return lines.some((line) => CLOSING.test(line));
}

function readStdin() {
  try {
    return fs.readFileSync(0, 'utf8');
  } catch {
    return '';
  }
}

// La regla (rule) o su recordatorio (reminder, según el mensaje de stdin). Si
// no corresponde, nada
function commentsText(mode, agent, dir) {
  if (!enter(dir)) return '';
  if (commentsDisabled()) return '';
  if (!(agent in MARKERS)) return '';
  let text;
  if (mode === 'rule') {
    const rule = readText(path.join(commentsDir(), 'rule.md'));
    if (rule === null) return '';
    // Sin los identificadores de sección, que solo sirven para revisarla
    text = chomp(dropLines(rule, /^<!-- comments-rule:[a-z0-9-]* -->$/));
  } else {
    if (!activatesComments(chomp(readStdin()))) return '';
    const reminder = readText(path.join(commentsDir(), 'reminder.md'));
    if (reminder === null) return '';
    text = chomp(reminder);
    if (charCount(text) > REMINDER_MAX) return '';
  }
  return text ? `${text}\n` : '';
}

// --- Entrada ----------------------------------------------------------------------------

function main(argv) {
  if (argv[0] === '--global') {
    GLOBAL = true;
    argv = argv.slice(1);
  }
  const [mode, ...rest] = argv;
  switch (mode) {
    case 'guide':
    case 'reminder':
      process.stdout.write(wikiText(mode, rest[0], rest[1]));
      break;
    case 'wiki':
      wikiMode(rest[0], rest[1]);
      break;
    case 'comments-rule':
      process.stdout.write(commentsText('rule', rest[0], rest[1]));
      break;
    case 'comments-reminder':
      process.stdout.write(commentsText('reminder', rest[0], rest[1]));
      break;
    default:
      prepare(mode);
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === SELF) {
  try {
    main(process.argv.slice(2));
  } catch (error) {
    warn(`el arranque de sesión ha fallado (${error?.message ?? error})`);
  }
  process.exitCode = 0;
}
