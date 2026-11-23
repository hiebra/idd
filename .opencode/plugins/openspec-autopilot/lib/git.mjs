// El estado de git que necesita el plugin (design D8 de
// autopilot-sesion-operativa): si el árbol está limpio, qué hay en el stage y
// fuera de él, una firma que cambia con cualquier cambio del repositorio, el
// veredicto de una revisión y el stage del producto de un paso.
//
// El veredicto es una función pura; lo demás ejecuta git con límite de tiempo.

import { createHash } from 'node:crypto';
import { run } from './run.mjs';

async function git(dir, args, { timeoutMs = 15000 } = {}) {
  const result = await run('git', args, { cwd: dir, timeoutMs });
  if (result.code !== 0) throw new Error(`git ${args[0]} ha fallado: ${(result.stderr || result.stdout).trim().slice(0, 200)}`);
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
  const diff = await git(dir, ['diff', 'HEAD', '--no-color', '--no-ext-diff'], { timeoutMs: 30000 }).catch(() => '');
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

// Pasa al stage las rutas dadas, o todo (`git add -A`) si no se dan
export async function stage(dir, paths = null) {
  if (Array.isArray(paths) && paths.length > 0) {
    await git(dir, ['add', '-A', '--', ...paths]);
    return;
  }
  await git(dir, ['add', '-A']);
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
