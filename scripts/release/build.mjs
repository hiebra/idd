#!/usr/bin/env node
// Monta los artefactos de una release desde un tag (design D5 de
// windows-global-distro, ADR-0024):
//
// - idd-global-<versión>.zip, lo que instala el .bat en Windows:
//     installed.txt                       las entradas que instala, una por línea
//     data/openspec/schemas/intent-driven/  el schema, tal cual
//     data/idd/wiki-engine/                el motor del wiki, en la versión de
//                                          .agents/wiki/engine.json
//     config/opencode/skills/<id>/         las skills de .agents/skills/ y las del
//                                          motor que usa OpenCode (wiki-query y
//                                          wiki-manager); openspec-git-discipline
//                                          sin su SKILL.md, que escribe el .bat
//     config/opencode/plugins/<plugin>/    openspec-autopilot, session-bootstrap
//                                          (con el núcleo, wiki/ -guía, recordatorio,
//                                          opencode-note.md y archive-guidance.yaml-
//                                          y comments/) y response-comments
//     pieces/openspec-git-discipline/      el SKILL.md de esa skill en dos piezas,
//                                          SKILL.head.md y SKILL.tail.md: lo que
//                                          va antes y después de la línea
//                                          «El script es: …», que el .bat escribe
//                                          con la ruta absoluta del script
// - idd-<versión>.bat, el instalador, con la versión y la URL del zip dentro;
// - idd-slim-<versión>.zip, la variante adelgazada: el árbol del tag sin
//   openspec/schemas/, .agents/, .opencode/, .claude/ ni los changes de la
//   plantilla, en curso o archivados, y sin lo que describe o prueba la plantilla completa: sus
//   specs, su suite (en su lugar va una vacía, con las copias de la skill
//   acceptance-test-authoring) y sus herramientas de release.
//
// Uso:
//   node scripts/release/build.mjs --repo <repositorio> --tag v<x.y.z> --out <dir>
//     [--base-url <URL de descarga de la release>] [--engine <URL git del motor>]
//
// El árbol sale del tag con `git archive`, no del árbol de trabajo. La URL de
// descarga por defecto es la de la release en GitHub (--github <dueño/repo>,
// por defecto el de origin).
//
// Sin dependencias: solo módulos node:, git y tar.

import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { writeZip } from './zip.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BAT_TEMPLATE = path.join(HERE, 'idd.bat');

const GIT_DISCIPLINE = 'openspec-git-discipline';
const SCRIPT_LINE = /^El script es: `[^`]+`$/m;
const PLUGINS = ['openspec-autopilot', 'session-bootstrap', 'response-comments'];
// Lo que lleva el plugin session-bootstrap en la instalación global, además de
// sus propios archivos: el núcleo y los textos que prepara (design D2)
const SESSION_BOOTSTRAP_FILES = {
  'session-bootstrap.mjs': '.agents/hooks/session-bootstrap.mjs',
  'wiki/guide.md': '.agents/wiki/guide.md',
  'wiki/reminder.md': '.agents/wiki/reminder.md',
  'wiki/opencode-note.md': '.agents/wiki/opencode-note.md',
  'wiki/archive-guidance.yaml': '.agents/wiki/archive-guidance.yaml',
  'comments/rule.md': '.agents/comments/rule.md',
  'comments/reminder.md': '.agents/comments/reminder.md',
};
// Las skills del motor que usa OpenCode, y dónde están en el motor
const ENGINE_SKILLS = {
  'wiki-query': 'plugins/llm-wiki-opencode/skills/wiki-query',
  'wiki-manager': 'claude-plugin/skills/wiki-manager',
};
// Lo que no lleva la variante adelgazada (slim-template)
const NOT_IN_SLIM = [
  /^openspec\/schemas\//,
  /^\.agents\//,
  /^\.opencode\//,
  /^\.claude\//,
  /^openspec\/changes\/./,
  /^openspec\/specs\/./,
  /^acceptance-tests\//,
  /^scripts\/release\//,
  /^\.github\/workflows\/release\.yml$/,
];
// La suite vacía de la variante adelgazada: las copias de la skill
// acceptance-test-authoring y, de la suite de la plantilla, sus dependencias
const SKILL_REFERENCES = '.agents/skills/acceptance-test-authoring/references';
const EMPTY_SUITE = {
  'acceptance-tests/cucumber.cjs': `${SKILL_REFERENCES}/javascript/cucumber.cjs`,
  'acceptance-tests/extract-gherkin.cjs': `${SKILL_REFERENCES}/javascript/extract-gherkin.cjs`,
  'acceptance-tests/openspec-effective-paths.cjs': `${SKILL_REFERENCES}/javascript/openspec-effective-paths.cjs`,
  'acceptance-tests/.gplintrc': `${SKILL_REFERENCES}/gplintrc.json`,
  'acceptance-tests/package-lock.json': 'acceptance-tests/package-lock.json',
};
// Los scripts de la suite que no dependen de la plantilla
const SUITE_SCRIPTS = ['test', 'test:specs', 'lint:specs'];

function args(argv) {
  const out = {};
  for (let i = 0; i < argv.length; i += 1) {
    const key = argv[i].replace(/^--/, '');
    out[key] = argv[i + 1];
    i += 1;
  }
  return out;
}

const git = (cwd, ...a) => execFileSync('git', a, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();

// El árbol del tag, en un directorio temporal
function exportTag(repo, tag, dir) {
  const archive = path.join(dir, 'tree.tar');
  git(repo, 'archive', '--format=tar', '-o', archive, `${tag}^{commit}`);
  const tree = path.join(dir, 'tree');
  fs.mkdirSync(tree);
  const result = spawnSync('tar', ['-xf', archive, '-C', tree], { encoding: 'utf8' });
  if (result.status !== 0) throw new Error(`tar -xf: ${result.stderr}`);
  fs.rmSync(archive);
  return tree;
}

// Cada archivo de un directorio, con su ruta relativa con /
function filesUnder(dir, rel = '') {
  const out = [];
  for (const entry of fs.readdirSync(path.join(dir, rel), { withFileTypes: true })) {
    const child = rel ? `${rel}/${entry.name}` : entry.name;
    if (entry.isDirectory()) out.push(...filesUnder(dir, child));
    else if (entry.isFile()) out.push(child);
  }
  return out.sort();
}

class Entries {
  constructor() {
    this.list = [];
  }

  file(name, data, mode = 0o644) {
    this.list.push({ name, data: Buffer.isBuffer(data) ? data : Buffer.from(data), mode });
  }

  // Todo un directorio bajo el prefijo; skip, archivos relativos que no van
  dir(prefix, from, { skip = [] } = {}) {
    for (const rel of filesUnder(from)) {
      if (skip.includes(rel)) continue;
      const file = path.join(from, rel);
      this.file(`${prefix}/${rel}`, fs.readFileSync(file), fs.statSync(file).mode & 0o777);
    }
  }
}

// El motor del wiki en la versión que fija el árbol
function fetchEngine(tree, engineUrl, dir) {
  const config = JSON.parse(fs.readFileSync(path.join(tree, '.agents', 'wiki', 'engine.json'), 'utf8'));
  const repo = engineUrl ?? (/^[\w.-]+\/[\w.-]+$/.test(config.repo) ? `https://github.com/${config.repo}.git` : config.repo);
  const engine = path.join(dir, 'engine');
  execFileSync('git', ['-c', 'advice.detachedHead=false', 'clone', '--quiet', '--depth', '1', '--branch', config.ref, repo, engine], {
    stdio: ['ignore', 'pipe', 'pipe'],
    env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
  });
  fs.rmSync(path.join(engine, '.git'), { recursive: true, force: true });
  fs.writeFileSync(path.join(engine, '.wiki-engine-ref'), `${config.ref} ${config.repo}\n`);
  return engine;
}

// El SKILL.md de openspec-git-discipline en dos piezas, sin la línea de la ruta
function skillPieces(skillMd) {
  const text = fs.readFileSync(skillMd, 'utf8');
  const match = SCRIPT_LINE.exec(text);
  if (!match) throw new Error(`${skillMd} no tiene la línea «El script es: \`…\`»`);
  const head = text.slice(0, match.index);
  const tail = text.slice(match.index + match[0].length).replace(/^\r?\n/, '');
  return { head, tail };
}

function globalZip(tree, engine, file) {
  const entries = new Entries();
  const installed = [];
  const top = (name) => installed.push(name.split('/').join('\\'));

  entries.dir('data/openspec/schemas/intent-driven', path.join(tree, 'openspec', 'schemas', 'intent-driven'));
  top('data/openspec/schemas/intent-driven');
  entries.dir('data/idd/wiki-engine', engine);
  top('data/idd/wiki-engine');

  const skills = path.join(tree, '.agents', 'skills');
  for (const id of fs.readdirSync(skills).sort()) {
    if (!fs.existsSync(path.join(skills, id, 'SKILL.md'))) continue;
    if (id === GIT_DISCIPLINE) {
      entries.dir(`config/opencode/skills/${id}`, path.join(skills, id), { skip: ['SKILL.md'] });
      const { head, tail } = skillPieces(path.join(skills, id, 'SKILL.md'));
      entries.file(`pieces/${id}/SKILL.head.md`, head);
      entries.file(`pieces/${id}/SKILL.tail.md`, tail);
    } else {
      entries.dir(`config/opencode/skills/${id}`, path.join(skills, id));
    }
    top(`config/opencode/skills/${id}`);
  }
  for (const [id, rel] of Object.entries(ENGINE_SKILLS)) {
    entries.dir(`config/opencode/skills/${id}`, path.join(engine, ...rel.split('/')));
    top(`config/opencode/skills/${id}`);
  }

  for (const plugin of PLUGINS) {
    entries.dir(`config/opencode/plugins/${plugin}`, path.join(tree, '.opencode', 'plugins', plugin));
    if (plugin === 'session-bootstrap') {
      for (const [to, from] of Object.entries(SESSION_BOOTSTRAP_FILES)) {
        const source = path.join(tree, ...from.split('/'));
        entries.file(`config/opencode/plugins/${plugin}/${to}`, fs.readFileSync(source), fs.statSync(source).mode & 0o777);
      }
    }
    top(`config/opencode/plugins/${plugin}`);
  }

  entries.file('installed.txt', installed.map((line) => `${line}\r\n`).join(''));
  writeZip(file, entries.list);
}

function slimZip(tree, file) {
  const entries = new Entries();
  for (const rel of filesUnder(tree)) {
    if (NOT_IN_SLIM.some((re) => re.test(rel))) continue;
    const source = path.join(tree, ...rel.split('/'));
    entries.file(rel, fs.readFileSync(source), fs.statSync(source).mode & 0o777);
  }
  // openspec/specs/ sin ninguna spec, y openspec/changes/ sin ningún change
  entries.file('openspec/specs/.gitkeep', '');
  entries.file('openspec/changes/archive/.gitkeep', '');
  for (const [to, from] of Object.entries(EMPTY_SUITE)) entries.file(to, fs.readFileSync(path.join(tree, ...from.split('/'))));
  const suite = JSON.parse(fs.readFileSync(path.join(tree, 'acceptance-tests', 'package.json'), 'utf8'));
  suite.scripts = Object.fromEntries(Object.entries(suite.scripts ?? {}).filter(([name]) => SUITE_SCRIPTS.includes(name)));
  // Sin specs, extract-gherkin.cjs no crea .extracted y gplint no tiene qué revisar
  if (suite.scripts['lint:specs']) {
    suite.scripts['lint:specs'] = suite.scripts['lint:specs'].replace(
      /^node extract-gherkin\.cjs && /,
      'node extract-gherkin.cjs && node -e "require(\'node:fs\').mkdirSync(\'.extracted\', { recursive: true })" && '
    );
  }
  entries.file('acceptance-tests/package.json', `${JSON.stringify(suite, null, 2)}\n`);
  writeZip(file, entries.list);
}

// El .bat con la versión y la URL del zip dentro, con finales de línea de Windows
function bat(version, url, file) {
  const text = fs
    .readFileSync(BAT_TEMPLATE, 'utf8')
    .replace(/\r\n/g, '\n')
    .replaceAll('@IDD_VERSION@', version)
    .replaceAll('@IDD_URL@', url);
  fs.writeFileSync(file, text.replace(/\n/g, '\r\n'));
}

// La URL de descarga de la release en GitHub, a partir de origin
function githubBase(repo, tag, slug) {
  let name = slug;
  if (!name) {
    const remote = git(repo, 'remote', 'get-url', 'origin');
    name = /github\.com[:/]([^/]+\/[^/.]+?)(?:\.git)?$/.exec(remote)?.[1];
    if (!name) throw new Error(`no se sabe el repositorio de GitHub de origin (${remote}); usa --github o --base-url`);
  }
  return `https://github.com/${name}/releases/download/${tag}`;
}

export function build({ repo, tag, out, baseUrl = null, engine: engineUrl = null, github = null }) {
  const match = /^v(\d+\.\d+\.\d+(?:-[0-9A-Za-z.-]+)?)$/.exec(tag ?? '');
  if (!match) throw new Error(`el tag tiene que ser una versión semántica, v<x.y.z>: '${tag}'`);
  const version = match[1];
  const work = fs.mkdtempSync(path.join(os.tmpdir(), 'idd-release-'));
  try {
    const tree = exportTag(repo, tag, work);
    const engine = fetchEngine(tree, engineUrl, work);
    fs.mkdirSync(out, { recursive: true });
    const names = { global: `idd-global-${version}.zip`, bat: `idd-${version}.bat`, slim: `idd-slim-${version}.zip` };
    globalZip(tree, engine, path.join(out, names.global));
    const base = (baseUrl ?? githubBase(repo, tag, github)).replace(/\/+$/, '');
    bat(version, `${base}/${names.global}`, path.join(out, names.bat));
    slimZip(tree, path.join(out, names.slim));
    return Object.fromEntries(Object.entries(names).map(([kind, name]) => [kind, path.join(out, name)]));
  } finally {
    fs.rmSync(work, { recursive: true, force: true });
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const opts = args(process.argv.slice(2));
  try {
    const built = build({ repo: opts.repo ?? process.cwd(), tag: opts.tag, out: opts.out ?? 'dist', baseUrl: opts['base-url'] ?? null, engine: opts.engine ?? null, github: opts.github ?? null });
    for (const file of Object.values(built)) console.log(file);
  } catch (error) {
    console.error(`build: ${error.message}`);
    process.exitCode = 1;
  }
}
