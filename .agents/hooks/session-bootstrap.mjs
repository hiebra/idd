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
//       - Instala el motor del wiki en la versión fijada en
//         .agents/wiki/engine.json, en .agents/wiki-engine/ (ignorado por git),
//         y lo expone a cada agente con symlinks (en Windows, con junctions,
//         que no piden permisos).
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
//       está desactivado o no se puede generar.
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
// El wiki se desactiva en local con PROJECT_WIKI=off: no se instala el motor,
// se retiran sus symlinks y la guía y el recordatorio quedan vacíos.
// La regla de comentarios se desactiva en local con PROJECT_COMMENTS=off.
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

const wikiDisabled = () => process.env.PROJECT_WIKI === 'off';
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
  if (fs.existsSync(BRANCH_CHANGE)) {
    const info = spawnSync(process.execPath, [BRANCH_CHANGE, 'env'], { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], windowsHide: true });
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
  for (const name of permanent) {
    if (name === current) continue;
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

// Instala el motor del wiki en la versión fijada, si falta o es otra (design D1)
function installWikiEngine() {
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
  const url = engineUrl(repo);
  const want = `${ref} ${repo}`;
  if (chomp(readText(ENGINE_STAMP) ?? '') !== want) {
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
function enter(dir) {
  if (!dir) return false;
  try {
    process.chdir(dir);
    PROJECT = path.resolve(dir);
    return true;
  } catch {
    return false;
  }
}

function prepare(dir) {
  if (!enter(dir)) {
    warn(`no se puede entrar en el directorio del proyecto ('${dir ?? ''}')`);
    return;
  }
  const out = [];
  guard('git', prepareGit);
  // El motor no depende de npm, así que va antes y se instala aunque falte
  const engine = guard('motor del wiki', installWikiEngine);
  if (!wikiDisabled()) guard('wiki versionado', keepWikiVersioned);
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
  if (wikiDisabled()) return '';
  if (!fs.existsSync(ENGINE_JSON)) return '';
  if (!(agent in MARKERS)) return '';
  let text;
  if (mode === 'guide') {
    const guide = readText(path.join(WIKI_DIR, 'guide.md'));
    if (guide === null) return '';
    // Sin los identificadores de sección, que solo sirven para revisarla
    text = chomp(dropLines(guide, /^<!-- wiki-guide:[a-z0-9-]* -->$/));
    if (!text) return '';
    if (agent === 'opencode') {
      const note = readText(path.join(WIKI_DIR, 'opencode-note.md'));
      if (note !== null && chomp(note)) text = `${chomp(note)}\n\n${text}`;
    }
  } else {
    const reminder = readText(path.join(WIKI_DIR, 'reminder.md'));
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
    const rule = readText(path.join(COMMENTS_DIR, 'rule.md'));
    if (rule === null) return '';
    // Sin los identificadores de sección, que solo sirven para revisarla
    text = chomp(dropLines(rule, /^<!-- comments-rule:[a-z0-9-]* -->$/));
  } else {
    if (!activatesComments(chomp(readStdin()))) return '';
    const reminder = readText(path.join(COMMENTS_DIR, 'reminder.md'));
    if (reminder === null) return '';
    text = chomp(reminder);
    if (charCount(text) > REMINDER_MAX) return '';
  }
  return text ? `${text}\n` : '';
}

// --- Entrada ----------------------------------------------------------------------------

function main(argv) {
  const [mode, ...rest] = argv;
  switch (mode) {
    case 'guide':
    case 'reminder':
      process.stdout.write(wikiText(mode, rest[0], rest[1]));
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
