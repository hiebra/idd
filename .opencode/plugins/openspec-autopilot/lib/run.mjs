// Ejecuta un programa con límite de tiempo, sin lanzar nunca (design D12 de
// add-openspec-autopilot): devuelve { code, stdout, stderr }.

import { spawn } from 'node:child_process';

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
