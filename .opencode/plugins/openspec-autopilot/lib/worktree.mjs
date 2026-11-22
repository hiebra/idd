// La estrategia de worktree del plugin (design D5 de autopilot-rama-por-sesion,
// ADR-0022): los worktrees de OpenCode nacen en una rama con el nombre del
// worktree, en lugar de en HEAD separado como con la estrategia git incluida.
// La usan la TUI («Manage workspaces», el modal de `/new`), la web y la tool
// openspec_worktree, porque todas piden el worktree a `worktree.create`.
//
// - create({ directory, sourceDirectory, branch }): la rama es
//   basename(directory). Si ya está sacada en otro directorio, se rechaza
//   diciendo en cuál. Si existe, el worktree se abre en ella. Si no, se crea
//   desde origin/<rama de origen> tras un `git fetch`, con --no-track y con
//   branch.<rama>.remote/merge hacia origin/<rama>, para que el primer `git push`
//   sin argumentos la publique sin tocar push.autoSetupRemote. Un `fetch`
//   fallido no crea nada. `branch` (la referencia de partida que manda la web)
//   se ignora. Devuelve { directory }.
// - remove({ directory, sourceDirectory, force }): `git worktree remove`, en
//   sourceDirectory o, si no llega (OpenCode 2.3.2), en el propio worktree; la
//   rama se conserva. Con cambios no se quita: el error dice que se haga antes
//   el commit o se quite con `git worktree remove --force`.
// - list(sourceDirectory): `git worktree list --porcelain`, como
//   [{ directory, type: "root" | "worktree" }].
//
// La rama de origen es la última de `x-main` (readPermanent del
// branch-change.mjs del checkout canónico, donde lo encuentre branchScript()).

import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { branchScript } from './branch-script.mjs';
import { run } from './run.mjs';

export const STRATEGY_ID = 'openspec-autopilot';

async function git(dir, args, timeoutMs = 60000) {
  return run('git', args, { cwd: dir, timeoutMs });
}

const output = (result) => (result.stderr || result.stdout || '').trim().slice(0, 400);

// Las entradas de `git worktree list --porcelain`: [{ directory, branch }]
export function parseWorktrees(text) {
  const entries = [];
  let current = null;
  for (const line of String(text ?? '').split('\n')) {
    if (line.startsWith('worktree ')) {
      current = { directory: line.slice('worktree '.length), branch: null };
      entries.push(current);
    } else if (current && line.startsWith('branch ')) {
      current.branch = line.slice('branch '.length).replace(/^refs\/heads\//, '');
    }
  }
  return entries;
}

async function originBranch(sourceDirectory) {
  try {
    const module = await import(pathToFileURL(branchScript(sourceDirectory).file).href);
    return module.readPermanent(sourceDirectory).permanent.at(-1);
  } catch {
    return 'main';
  }
}

// Un error que OpenCode muestra al usuario; con forceRequired, pide confirmación
// para forzar (Worktree.OperationError de @opencode/plugin, sin depender de él)
export function operationError(message, { forceRequired = false } = {}) {
  return Object.assign(new Error(message), { name: 'OperationError', _tag: 'OperationError', forceRequired });
}

export async function listWorktrees(sourceDirectory) {
  const result = await git(sourceDirectory, ['worktree', 'list', '--porcelain']);
  if (result.code !== 0) throw operationError(`git worktree list ha fallado: ${output(result)}`);
  return parseWorktrees(result.stdout);
}

export async function create({ directory, sourceDirectory }) {
  const name = path.basename(directory);
  const valid = await git(sourceDirectory, ['check-ref-format', '--branch', name]);
  if (valid.code !== 0) throw operationError(`'${name}' no es un nombre de rama válido para el worktree.`);
  const out = (await listWorktrees(sourceDirectory)).find((w) => w.branch === name);
  if (out) throw operationError(`La rama '${name}' ya está sacada en ${out.directory}: no se crea otro worktree en ella.`);
  const exists = (await git(sourceDirectory, ['rev-parse', '--verify', '-q', `refs/heads/${name}`])).code === 0;
  if (exists) {
    const added = await git(sourceDirectory, ['worktree', 'add', directory, name]);
    if (added.code !== 0) throw operationError(`git worktree add ha fallado: ${output(added)}`);
    return { directory };
  }
  const origin = await originBranch(sourceDirectory);
  const fetched = await git(sourceDirectory, ['fetch', '-q', 'origin', origin]);
  if (fetched.code !== 0) {
    throw operationError(`No se ha podido actualizar la rama de origen del remoto (git fetch origin ${origin}): ${output(fetched)}. No se ha creado el worktree.`);
  }
  const added = await git(sourceDirectory, ['worktree', 'add', '--no-track', '-b', name, directory, `origin/${origin}`]);
  if (added.code !== 0) throw operationError(`git worktree add ha fallado: ${output(added)}`);
  // El primer `git push` sin argumentos crea origin/<rama> y la deja como upstream
  for (const [key, value] of [[`branch.${name}.remote`, 'origin'], [`branch.${name}.merge`, `refs/heads/${name}`]]) {
    const set = await git(sourceDirectory, ['config', key, value]);
    if (set.code !== 0) throw operationError(`git config ${key} ha fallado: ${output(set)}`);
  }
  return { directory };
}

export async function remove({ directory, sourceDirectory, force = false }) {
  // OpenCode 2.3.2 manda solo { directory, force }: git se ejecuta entonces en
  // el propio worktree, que sabe de qué clon es
  const cwd = sourceDirectory ?? directory;
  const result = await git(cwd, ['worktree', 'remove', ...(force ? ['--force'] : []), directory]);
  if (result.code === 0) return;
  const text = output(result);
  if (!force && /modified or untracked|is dirty|--force/i.test(text)) {
    // forceRequired, por si una versión de OpenCode lo respeta; la 2.3.2 solo
    // muestra el mensaje, porque no es de sus propias clases de error
    throw operationError(
      `El worktree ${directory} tiene cambios sin commit: haz antes el commit, o quítalo con \`git worktree remove --force ${directory}\`. Su rama se conserva.`,
      { forceRequired: true }
    );
  }
  throw operationError(`git worktree remove ha fallado: ${text}`);
}

export async function list(sourceDirectory) {
  const entries = await listWorktrees(sourceDirectory);
  return entries.map((w, i) => ({ directory: w.directory, type: i === 0 ? 'root' : 'worktree' }));
}

export const strategy = {
  id: STRATEGY_ID,
  create: (input) => create(input),
  remove: (input) => remove(input),
  list: (sourceDirectory) => list(typeof sourceDirectory === 'string' ? sourceDirectory : sourceDirectory?.sourceDirectory),
};
