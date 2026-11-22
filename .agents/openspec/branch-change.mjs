#!/usr/bin/env node
// El change de la rama (openspec-change-lifecycle, design D1 de
// add-openspec-autopilot): un módulo neutral, común a los dos agentes, que
// lee de git qué change tiene la rama actual. Lo importa el plugin de
// OpenCode y lo ejecutan los workflows de OpenSpec desde la skill
// openspec-git-discipline.
//
// - Ramas permanentes: la lista `x-main` de openspec/config.yaml, o ["main"].
//   Su último elemento es la rama de origen. Solo se entiende una lista de
//   escalares simples, en flujo ([main, develop]) o en bloque (- main); con
//   cualquier otra forma la clave se trata como ausente y se avisa.
// - Rama temporal: cualquier rama local fuera de la lista; con HEAD separado
//   no hay ninguna.
// - Changes de la rama: lo que hay hoy en openspec/changes/ y ha cambiado
//   entre el merge-base de HEAD con la rama de origen y el árbol de trabajo,
//   con commit o sin él. openspec/changes/<nombre>/ es un change en curso y
//   openspec/changes/archive/<fecha>-<nombre>/, uno archivado.
//
// Resultado: { kind, branch, origin, permanent, changes, change, warnings }
//   kind: "permanent" (rama permanente o HEAD separado), "unknown" (no se
//   encuentra la rama de origen), "none", "active", "archived" o "several".
//
// CLI:
//   node .agents/openspec/branch-change.mjs --json
//   node .agents/openspec/branch-change.mjs check <propose|apply|archive> [<change>]
//   node .agents/openspec/branch-change.mjs list [--json]
//   node .agents/openspec/branch-change.mjs start <change>
//   node .agents/openspec/branch-change.mjs switch <rama>
// `check`, `start` y `switch` imprimen { ok, message } en JSON y salen con 0
// si se puede seguir y con 1 si no. `list` da las ramas temporales con su
// change; `start` crea la rama del change desde la rama de origen y cambia a
// ella; `switch` cambia a una rama temporal (ADR-0012, design D12 de
// autopilot-sesion-operativa). Ni `start` ni `switch` actúan con el árbol sucio.
//
// Sin dependencias: solo módulos node:.

import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const CONFIG = path.join('openspec', 'config.yaml');
const CHANGES = 'openspec/changes/';
const DEFAULT_PERMANENT = ['main'];

function git(dir, ...args) {
  const result = spawnSync('git', args, { cwd: dir, encoding: 'utf8', timeout: 10000 });
  return { ok: result.status === 0, out: (result.stdout ?? '').trim() };
}

function scalar(raw) {
  const value = raw.trim();
  const quoted = /^(['"])(.*)\1$/.exec(value);
  if (quoted) return quoted[2];
  return /^[A-Za-z0-9._/-]+$/.test(value) ? value : null;
}

// Lee la lista `x-main` del texto de openspec/config.yaml.
// Devuelve { permanent, warning }: permanent es null si la clave no está o no
// se entiende.
export function parsePermanent(text) {
  const lines = text.split(/\r?\n/);
  const at = lines.findIndex((line) => /^x-main\s*:/.test(line));
  if (at === -1) return { permanent: null, warning: null };
  const invalid = {
    permanent: null,
    warning: "openspec/config.yaml: 'x-main' no es una lista de nombres de rama; se usa [main]",
  };
  const rest = lines[at].replace(/^x-main\s*:/, '').replace(/\s+#.*$/, '').trim();
  let items;
  if (rest.startsWith('[')) {
    const flow = /^\[(.*)\]$/.exec(rest);
    if (!flow) return invalid;
    items = flow[1].trim() === '' ? [] : flow[1].split(',').map(scalar);
  } else if (rest === '') {
    items = [];
    for (const line of lines.slice(at + 1)) {
      if (/^\s*(#.*)?$/.test(line)) continue;
      const item = /^\s+-\s+(.*?)\s*(#.*)?$/.exec(line);
      if (!item) break;
      items.push(scalar(item[1]));
    }
  } else {
    return invalid;
  }
  if (items.length === 0 || items.some((item) => !item)) return invalid;
  return { permanent: items, warning: null };
}

export function readPermanent(dir) {
  let text = '';
  try {
    text = fs.readFileSync(path.join(dir, CONFIG), 'utf8');
  } catch {
    return { permanent: DEFAULT_PERMANENT, warning: null };
  }
  const { permanent, warning } = parsePermanent(text);
  return { permanent: permanent ?? DEFAULT_PERMANENT, warning };
}

// Los changes de una lista de rutas de openspec/changes/ que existen hoy
export function changesOf(paths) {
  const found = new Map();
  for (const file of paths) {
    if (!file.startsWith(CHANGES)) continue;
    const parts = file.slice(CHANGES.length).split('/');
    if (parts.length < 2) continue;
    if (parts[0] === 'archive') {
      if (parts.length < 3) continue;
      const name = parts[1].replace(/^\d{4}-\d{2}-\d{2}-/, '');
      found.set(`archived:${name}`, { name, state: 'archived', dir: `${CHANGES}archive/${parts[1]}` });
    } else {
      found.set(`active:${parts[0]}`, { name: parts[0], state: 'active', dir: `${CHANGES}${parts[0]}` });
    }
  }
  return [...found.values()].sort((a, b) => a.name.localeCompare(b.name) || a.state.localeCompare(b.state));
}

export function branchChange(dir = process.cwd()) {
  const { permanent, warning } = readPermanent(dir);
  const origin = permanent.at(-1);
  const warnings = warning ? [warning] : [];
  const base = { branch: null, origin, permanent, changes: [], change: null, warnings };

  const head = git(dir, 'symbolic-ref', '--short', '-q', 'HEAD');
  if (!head.ok || !head.out) return { ...base, kind: 'permanent' };
  const branch = head.out;
  if (permanent.includes(branch)) return { ...base, branch, kind: 'permanent' };

  const ref = [`refs/heads/${origin}`, `refs/remotes/origin/${origin}`].find(
    (candidate) => git(dir, 'rev-parse', '--verify', '-q', candidate).ok
  );
  if (!ref) {
    return { ...base, branch, kind: 'unknown', warnings: [...warnings, `no se encuentra la rama de origen '${origin}' (ni local ni en origin)`] };
  }
  const mergeBase = git(dir, 'merge-base', 'HEAD', ref);
  if (!mergeBase.ok) {
    return { ...base, branch, kind: 'unknown', warnings: [...warnings, `la rama '${branch}' no tiene merge-base con '${origin}'`] };
  }
  const diff = git(dir, 'diff', '--name-only', mergeBase.out, '--', CHANGES);
  const untracked = git(dir, 'ls-files', '--others', '--exclude-standard', '--', CHANGES);
  const paths = [...diff.out.split('\n'), ...untracked.out.split('\n')]
    .filter(Boolean)
    .filter((file) => fs.existsSync(path.join(dir, file)));
  const changes = changesOf(paths);
  const names = new Set(changes.map((c) => c.name));
  let kind = 'none';
  if (names.size > 1) kind = 'several';
  else if (names.size === 1) kind = changes.some((c) => c.state === 'active') ? 'active' : 'archived';
  const change = names.size === 1 ? changes[0].name : null;
  return { ...base, branch, kind, changes, change };
}

// Las puertas del ciclo (design D2): propose, apply y archive
export function check(dir, gate, name) {
  const state = branchChange(dir);
  const temp = 'el change se trabaja en una rama temporal que sale de la rama de origen';
  const named = state.changes.map((c) => c.name).join(', ');
  const deny = (message) => ({ ok: false, message, state });
  if (!['propose', 'apply', 'archive'].includes(gate)) return deny(`puerta desconocida '${gate}'`);
  if (state.kind === 'permanent') {
    const where = state.branch ? `la rama permanente '${state.branch}'` : 'un HEAD separado';
    if (gate === 'archive') return deny(`El archive se hace en la rama temporal del change, no en ${where}.`);
    return deny(`El clon está en ${where}: ${temp} '${state.origin}'.`);
  }
  if (state.kind === 'unknown') return deny(`No se puede leer el change de la rama: ${state.warnings.at(-1)}.`);
  if (state.kind === 'several') return deny(`La rama '${state.branch}' tiene varios changes (${named}); tiene que quedar uno solo.`);
  if (gate === 'propose') {
    if (state.kind === 'none') return { ok: true, message: `La rama '${state.branch}' no tiene change: se puede proponer uno.`, state };
    return deny(`La rama '${state.branch}' ya tiene el change '${state.change}': un change por rama.`);
  }
  if (!name) return deny(`Falta el nombre del change para la puerta '${gate}'.`);
  if (state.kind !== 'active' || state.change !== name) {
    const has = state.kind === 'none' ? 'no tiene ningún change en curso' : `tiene el change ${state.kind === 'archived' ? 'archivado' : 'en curso'} '${state.change}'`;
    return deny(`El ${gate} de '${name}' se hace en su rama temporal, y la rama '${state.branch}' ${has}.`);
  }
  const verb = gate === 'apply' ? 'aplicar' : 'archivar';
  return { ok: true, message: `Se puede ${verb} '${name}' en la rama temporal '${state.branch}'.`, state };
}

// La rama de origen como referencia de git: la local, o la de origin
function originRef(dir, origin) {
  return [`refs/heads/${origin}`, `refs/remotes/origin/${origin}`].find((candidate) => git(dir, 'rev-parse', '--verify', '-q', candidate).ok) ?? null;
}

// Las ramas temporales con su change: [{ branch, current, kind, change, changes }]
export function listBranches(dir = process.cwd()) {
  const { permanent } = readPermanent(dir);
  const origin = permanent.at(-1);
  const ref = originRef(dir, origin);
  const current = git(dir, 'symbolic-ref', '--short', '-q', 'HEAD').out;
  const names = git(dir, 'for-each-ref', '--format=%(refname:short)', 'refs/heads/').out.split('\n').filter(Boolean);
  const result = [];
  for (const branch of names) {
    if (permanent.includes(branch)) continue;
    if (branch === current) {
      const state = branchChange(dir);
      result.push({ branch, current: true, kind: state.kind, change: state.change, changes: state.changes.map((c) => c.name) });
      continue;
    }
    if (!ref) {
      result.push({ branch, current: false, kind: 'unknown', change: null, changes: [] });
      continue;
    }
    const base = git(dir, 'merge-base', branch, ref);
    if (!base.ok) {
      result.push({ branch, current: false, kind: 'unknown', change: null, changes: [] });
      continue;
    }
    const diff = git(dir, 'diff', '--name-only', base.out, branch, '--', CHANGES).out.split('\n').filter(Boolean);
    const tree = new Set(git(dir, 'ls-tree', '-r', '--name-only', branch, '--', CHANGES).out.split('\n').filter(Boolean));
    const changes = changesOf(diff.filter((file) => tree.has(file)));
    const unique = new Set(changes.map((c) => c.name));
    let kind = 'none';
    if (unique.size > 1) kind = 'several';
    else if (unique.size === 1) kind = changes.some((c) => c.state === 'active') ? 'active' : 'archived';
    result.push({ branch, current: false, kind, change: unique.size === 1 ? changes[0].name : null, changes: [...unique] });
  }
  return result;
}

const dirty = (dir) => git(dir, 'status', '--porcelain').out !== '';
const COMMIT_FIRST = 'el árbol de trabajo tiene cambios sin commit: haz antes el commit o guárdalos (git stash)';

// Crea la rama temporal de un change desde la rama de origen y cambia a ella
export function startBranch(dir, name) {
  const { permanent } = readPermanent(dir);
  const origin = permanent.at(-1);
  if (!name || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name)) return { ok: false, message: `El nombre del change tiene que ser kebab-case ('${name ?? ''}').` };
  if (permanent.includes(name)) return { ok: false, message: `'${name}' es una rama permanente.` };
  if (dirty(dir)) return { ok: false, message: `No se crea la rama '${name}': ${COMMIT_FIRST}.` };
  if (git(dir, 'rev-parse', '--verify', '-q', `refs/heads/${name}`).ok) return { ok: false, message: `La rama '${name}' ya existe: cambia a ella con 'switch ${name}'.` };
  const ref = originRef(dir, origin);
  if (!ref) return { ok: false, message: `No se encuentra la rama de origen '${origin}' (ni local ni en origin).` };
  const created = spawnSync('git', ['switch', '-q', '-c', name, ref.replace(/^refs\/(heads|remotes)\//, '')], { cwd: dir, encoding: 'utf8', timeout: 10000 });
  if (created.status !== 0) return { ok: false, message: `git switch ha fallado: ${(created.stderr ?? '').trim()}` };
  if (ref.startsWith('refs/remotes/')) git(dir, 'branch', '-q', '--unset-upstream');
  return { ok: true, message: `Creada la rama temporal '${name}' desde '${origin}'; el clon está en ella.` };
}

// Cambia a una rama temporal que ya existe
export function switchBranch(dir, name) {
  const { permanent } = readPermanent(dir);
  if (!name) return { ok: false, message: 'Falta el nombre de la rama.' };
  if (permanent.includes(name)) return { ok: false, message: `'${name}' es una rama permanente: el change se trabaja en una rama temporal.` };
  if (!git(dir, 'rev-parse', '--verify', '-q', `refs/heads/${name}`).ok) return { ok: false, message: `La rama '${name}' no existe: créala con 'start <change>'.` };
  if (dirty(dir)) return { ok: false, message: `No se cambia a '${name}': ${COMMIT_FIRST}.` };
  const switched = spawnSync('git', ['switch', '-q', name], { cwd: dir, encoding: 'utf8', timeout: 10000 });
  if (switched.status !== 0) return { ok: false, message: `git switch ha fallado: ${(switched.stderr ?? '').trim()}` };
  return { ok: true, message: `El clon está en la rama temporal '${name}'.` };
}

function main(argv) {
  const dir = process.cwd();
  if (argv[0] === 'start' || argv[0] === 'switch') {
    const result = argv[0] === 'start' ? startBranch(dir, argv[1]) : switchBranch(dir, argv[1]);
    process.stdout.write(`${JSON.stringify(result)}\n`);
    return result.ok ? 0 : 1;
  }
  if (argv[0] === 'list') {
    const branches = listBranches(dir);
    if (argv.includes('--json')) process.stdout.write(`${JSON.stringify(branches, null, 2)}\n`);
    else for (const b of branches) process.stdout.write(`${b.current ? '*' : ' '} ${b.branch}\t${b.change ?? (b.kind === 'none' ? '(sin change)' : `(${b.kind})`)}\n`);
    return 0;
  }
  if (argv[0] === 'check') {
    const result = check(dir, argv[1], argv[2]);
    process.stdout.write(`${JSON.stringify({ ok: result.ok, message: result.message })}\n`);
    return result.ok ? 0 : 1;
  }
  const state = branchChange(dir);
  if (argv.includes('--json')) process.stdout.write(`${JSON.stringify(state, null, 2)}\n`);
  else {
    process.stdout.write(`${state.kind}${state.change ? ` ${state.change}` : ''}\n`);
    for (const warning of state.warnings) process.stderr.write(`aviso: ${warning}\n`);
  }
  return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main(process.argv.slice(2));
}
