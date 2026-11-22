// Lo que el plugin lee del proyecto: el change de la rama (el módulo neutral
// .agents/openspec/branch-change.mjs), `openspec status`, las tasks según el
// CLI (`openspec instructions apply`, design D11 de autopilot-sesion-operativa),
// los errores de `openspec validate` y si el árbol de trabajo está limpio.
// Todas las esperas tienen límite.

import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseTasks, taskFromCli } from './next-step.mjs';
import { run } from './run.mjs';

export { run } from './run.mjs';
export { treeClean } from './git.mjs';

const BRANCH_CHANGE = path.join('.agents', 'openspec', 'branch-change.mjs');

export async function branchChange(directory) {
  const module = await import(`${pathToFileURL(path.join(directory, BRANCH_CHANGE)).href}`);
  return module.branchChange(directory);
}

// El CLI de OpenSpec del proyecto, el mismo que el arranque pone en el PATH
function openspecBin(directory) {
  const local = path.join(directory, 'node_modules', '.bin', 'openspec');
  return fs.existsSync(local) ? local : 'openspec';
}

async function openspecJson(directory, args) {
  const result = await run(openspecBin(directory), [...args, '--json'], { cwd: directory });
  try {
    return JSON.parse(result.stdout);
  } catch {
    throw new Error(`openspec ${args.join(' ')} ha fallado: ${(result.stderr || result.stdout).trim().slice(0, 300)}`);
  }
}

// El ajuste del wiki del proyecto (design D1 de add-project-wiki-toggle): solo
// el literal true de "enabled" en .agents/wiki/engine.json lo habilita
export function wikiEnabled(directory) {
  try {
    return JSON.parse(fs.readFileSync(path.join(directory, '.agents', 'wiki', 'engine.json'), 'utf8')).enabled === true;
  } catch {
    return false;
  }
}

export async function openspecStatus(directory, change) {
  return openspecJson(directory, ['status', '--change', change]);
}

// Las tasks del change como las numera el CLI: { id, label, done }
export async function readTasks(directory, change) {
  try {
    const apply = await openspecJson(directory, ['instructions', 'apply', '--change', change]);
    if (Array.isArray(apply.tasks)) return apply.tasks.map(taskFromCli);
  } catch {
    // sin CLI o sin tasks.md: se lee el archivo
  }
  try {
    return parseTasks(fs.readFileSync(path.join(directory, 'openspec', 'changes', change, 'tasks.md'), 'utf8'));
  } catch {
    return [];
  }
}

// Los errores (no los avisos) de `openspec validate <change> --json`
export async function validateErrors(directory, change) {
  try {
    const result = await openspecJson(directory, ['validate', change]);
    return (result.items ?? []).flatMap((item) => (item.issues ?? []).filter((i) => i.level === 'ERROR').map((i) => `${i.path ?? item.id}: ${i.message}`));
  } catch (error) {
    return [String(error?.message ?? error)];
  }
}

// El estado del change que necesita next-step: { change, status, tasks }
export async function changeState(directory, change) {
  if (!change) return { change: null, status: null, tasks: [] };
  const status = await openspecStatus(directory, change);
  return { change, status, tasks: await readTasks(directory, change) };
}
