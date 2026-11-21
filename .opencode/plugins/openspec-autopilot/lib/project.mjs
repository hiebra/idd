// Lo que el plugin lee del proyecto: el change de la rama (el módulo neutral
// .agents/openspec/branch-change.mjs, design D1), `openspec status`, el
// tasks.md del change y si el árbol de trabajo está limpio. Todas las esperas
// tienen límite (design D12).

import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { parseTasks } from './next-step.mjs';

const BRANCH_CHANGE = path.join('.agents', 'openspec', 'branch-change.mjs');

export function run(command, args, { cwd, timeoutMs = 30000 } = {}) {
  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    let settled = false;
    const finish = (result) => {
      if (settled) return;
      settled = true;
      clearTimeout(timer);
      resolve(result);
    };
    let child;
    try {
      child = spawn(command, args, { cwd, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, OPENSPEC_TELEMETRY: '0', NO_COLOR: '1' } });
    } catch (error) {
      resolve({ code: null, stdout, stderr: String(error?.message ?? error) });
      return;
    }
    const timer = setTimeout(() => {
      try {
        child.kill();
      } catch {
        // already gone
      }
      finish({ code: null, stdout, stderr: `${command}: sin respuesta en ${timeoutMs} ms` });
    }, timeoutMs);
    timer.unref?.();
    child.stdout.on('data', (chunk) => (stdout += chunk));
    child.stderr.on('data', (chunk) => (stderr += chunk));
    child.on('error', (error) => finish({ code: null, stdout, stderr: String(error?.message ?? error) }));
    child.on('close', (code) => finish({ code, stdout, stderr }));
  });
}

export async function branchChange(directory) {
  const module = await import(pathToFileURL(path.join(directory, BRANCH_CHANGE)).href);
  return module.branchChange(directory);
}

// El CLI de OpenSpec del proyecto, el mismo que el arranque pone en el PATH
function openspecBin(directory) {
  const local = path.join(directory, 'node_modules', '.bin', 'openspec');
  return fs.existsSync(local) ? local : 'openspec';
}

export async function openspecStatus(directory, change) {
  const result = await run(openspecBin(directory), ['status', '--change', change, '--json'], { cwd: directory });
  try {
    return JSON.parse(result.stdout);
  } catch {
    throw new Error(`openspec status --change ${change} ha fallado: ${(result.stderr || result.stdout).trim().slice(0, 300)}`);
  }
}

export function readTasks(directory, change) {
  try {
    return parseTasks(fs.readFileSync(path.join(directory, 'openspec', 'changes', change, 'tasks.md'), 'utf8'));
  } catch {
    return [];
  }
}

// El estado del change que necesita next-step: { change, status, tasks }
export async function changeState(directory, change) {
  if (!change) return { change: null, status: null, tasks: [] };
  return { change, status: await openspecStatus(directory, change), tasks: readTasks(directory, change) };
}

export async function treeClean(directory) {
  const result = await run('git', ['status', '--porcelain'], { cwd: directory, timeoutMs: 10000 });
  if (result.code !== 0) throw new Error(`git status ha fallado: ${result.stderr.trim().slice(0, 200)}`);
  return result.stdout.trim() === '';
}
