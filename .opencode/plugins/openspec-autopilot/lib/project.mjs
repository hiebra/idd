// Lo que el plugin lee del proyecto: el change de la rama (el módulo neutral
// branch-change.mjs de la skill openspec-git-discipline, que busca
// branch-script.mjs), `openspec status`, las tasks según el
// CLI (`openspec instructions apply`, design D11 de autopilot-sesion-operativa),
// los errores de `openspec validate` y si el árbol de trabajo está limpio.
// Todas las esperas tienen límite.

import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { branchScript } from './branch-script.mjs';
import { parseTasks, taskFromCli } from './next-step.mjs';
import { run } from './run.mjs';

export { run } from './run.mjs';
export { treeClean } from './git.mjs';

export async function branchChange(directory) {
  const module = await import(`${pathToFileURL(branchScript(directory).file).href}`);
  return module.branchChange(directory);
}

// El CLI de OpenSpec del proyecto, el mismo que el arranque pone en el PATH,
// como { command, prefix }. Se ejecuta su script con `node`, sin pasar por
// node_modules/.bin/, que en Windows es un script de shell, y sin el
// openspec.cmd, que Node.js no lanza sin shell (design D6 de
// windows-support). No es process.execPath: en OpenCode es el binario de
// OpenCode. Sin el CLI del proyecto, el `openspec` del PATH
function openspecCommand(directory) {
  try {
    const dir = path.join(directory, 'node_modules', '@fission-ai', 'openspec');
    const pkg = JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'));
    const bin = typeof pkg.bin === 'string' ? pkg.bin : pkg.bin?.openspec;
    const script = bin ? path.join(dir, bin) : null;
    if (script && fs.existsSync(script)) return { command: 'node', prefix: [script] };
  } catch {
    // sin el paquete del proyecto
  }
  return { command: 'openspec', prefix: [] };
}

async function openspecJson(directory, args) {
  const { command, prefix } = openspecCommand(directory);
  const result = await run(command, [...prefix, ...args, '--json'], { cwd: directory });
  try {
    return JSON.parse(result.stdout);
  } catch {
    throw new Error(`openspec ${args.join(' ')} ha fallado: ${(result.stderr || result.stdout).trim().slice(0, 300)}`);
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
