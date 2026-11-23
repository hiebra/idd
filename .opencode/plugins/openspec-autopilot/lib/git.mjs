// El estado de git que necesita el plugin (design D8 de
// autopilot-sesion-operativa): si el árbol está limpio, qué hay en el stage y
// fuera de él, una firma que cambia con cualquier cambio del repositorio, el
// veredicto de una revisión y el stage del producto de un paso.
//
// El veredicto es una función pura; lo demás ejecuta git con límite de tiempo.

import { createHash } from 'node:crypto';
import { run as runCommand } from './run.mjs';

// git, sin los bloqueos opcionales: el plugin lee git en cada pantalla, y un
// `git status` o un `git diff HEAD` normales refrescan el índice tomando su
// bloqueo, con lo que un `git add` del plugin a la vez falla («index.lock:
// File exists»). Las órdenes que escriben siguen tomando el que necesitan
const GIT = ['--no-optional-locks'];
const run = (command, args, options) => runCommand(command, command === 'git' ? [...GIT, ...args] : args, options);

async function git(dir, args, { timeoutMs = 15000 } = {}) {
  const result = await run('git', args, { cwd: dir, timeoutMs });
  if (result.code !== 0) {
    // El mensaje, recortado; la salida de error entera, para saber la causa
    throw Object.assign(new Error(`git ${args[0]} ha fallado: ${(result.stderr || result.stdout).trim().slice(0, 200)}`), { stderr: result.stderr ?? '' });
  }
  return result.stdout;
}

// Las líneas de `git status --porcelain=v1`, sin el árbol de .gitignore
export function parsePorcelain(text) {
  const lines = String(text ?? '').split('\n').filter((l) => l.length >= 3);
  let staged = false;
  let unstaged = false;
  for (const line of lines) {
    const x = line[0];
    const y = line[1];
    if (x === '?' && y === '?') {
      unstaged = true;
      continue;
    }
    if (x !== ' ') staged = true;
    if (y !== ' ') unstaged = true;
  }
  return { clean: lines.length === 0, staged, unstaged };
}

// { head, clean, staged, unstaged, signature }
export async function gitState(dir) {
  const head = (await run('git', ['rev-parse', '-q', '--verify', 'HEAD'], { cwd: dir, timeoutMs: 10000 })).stdout.trim();
  const porcelain = await git(dir, ['status', '--porcelain=v1', '--untracked-files=all']);
  // diff-index y no `git diff HEAD`, que refresca el índice aun con
  // --no-optional-locks; la salida es la misma
  const diff = await git(dir, ['diff-index', '-p', '--no-color', '--no-ext-diff', 'HEAD'], { timeoutMs: 30000 }).catch(() => '');
  const untracked = (await git(dir, ['ls-files', '--others', '--exclude-standard'])).split('\n').filter(Boolean);
  let hashes = '';
  if (untracked.length > 0) {
    const result = await run('git', ['hash-object', '--', ...untracked.slice(0, 500)], { cwd: dir, timeoutMs: 30000 });
    hashes = result.stdout;
  }
  const signature = createHash('sha1').update(`${head}\n${porcelain}\n${diff}\n${hashes}`).digest('hex');
  return { head, ...parsePorcelain(porcelain), signature };
}

// El veredicto de una revisión (design D8), comparando el estado de git al
// empezar la revisión con el de ahora:
// - "continue": git no ha cambiado, o queda algo en el stage
// - "ok": HEAD ha avanzado (el usuario hizo el commit) y no queda nada en el stage
// - "ko": HEAD no ha cambiado, no queda nada en el stage y hay cambios en el árbol,
//   o el usuario lo ha descartado todo
export function verdict(start, now) {
  if (!start || !now) return 'continue';
  if (start.signature === now.signature) return 'continue';
  if (now.staged) return 'continue';
  if (now.head !== start.head) return 'ok';
  return 'ko';
}

// Las pausas antes de reintentar un `git add` que encuentra el índice
// bloqueado por otro proceso (git, un editor): 750 ms en total
const LOCK_RETRY_MS = [50, 100, 200, 400];
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

// Pasa al stage las rutas dadas, o todo (`git add -A`) si no se dan. Si otro
// proceso tiene el bloqueo del índice, espera un poco a que lo suelte; si no
// lo suelta, falla con el error de git
export async function stage(dir, paths = null) {
  const args = Array.isArray(paths) && paths.length > 0 ? ['add', '-A', '--', ...paths] : ['add', '-A'];
  for (let attempt = 0; ; attempt++) {
    try {
      await git(dir, args);
      return;
    } catch (error) {
      if (attempt >= LOCK_RETRY_MS.length || !/index\.lock/.test(error.stderr ?? error.message)) throw error;
      await sleep(LOCK_RETRY_MS[attempt]);
    }
  }
}

// La rama de HEAD, o null con HEAD separado
export async function currentBranch(dir) {
  const result = await run('git', ['symbolic-ref', '--short', '-q', 'HEAD'], { cwd: dir, timeoutMs: 10000 });
  return result.code === 0 ? result.stdout.trim() || null : null;
}

export async function treeClean(dir) {
  const porcelain = await git(dir, ['status', '--porcelain=v1']);
  return porcelain.trim() === '';
}
