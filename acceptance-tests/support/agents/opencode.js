'use strict';

// OpenCode 2 agent adapter (design D6): opens a session the way OpenCode 2
// loads the project's local plugin, .opencode/plugins/session-bootstrap/.
// The simulated host (opencode-host.mjs) runs as a child process with the
// simulated machine's environment; see that file for what it simulates.
//
// It returns the same session shape as the Claude Code adapter: the messages
// shown to the user are the TUI part's toasts, and a command "in the session"
// runs with the environment the create.before hooks left.

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const HOST = path.join(__dirname, 'opencode-host.mjs');
// OpenCode must not wait for the install to finish before it starts (design D3)
const MAX_SETUP_MS = 2000;

class OpenCodeAgent {
  get name() {
    return 'OpenCode';
  }

  open({ machine, project, workDir }) {
    const resultFile = path.join(workDir, `opencode-${Date.now()}.json`);
    const options = { shell: machine.sessionPathAdjustable };
    const child = spawnSync(process.execPath, [HOST, project.dir, JSON.stringify(options), resultFile], {
      cwd: project.dir,
      env: machine.env(),
      encoding: 'utf8',
    });
    let result;
    try {
      result = JSON.parse(fs.readFileSync(resultFile, 'utf8'));
    } catch {
      result = { error: `the simulated OpenCode host did not report (exit ${child.status}):\n${child.stderr}`, toasts: [], logs: [] };
    }
    const startProblems = [];
    if (result.setupMs !== null && result.setupMs > MAX_SETUP_MS) {
      startProblems.push(`the server part's setup took ${result.setupMs} ms: OpenCode waits for it to start`);
    }
    const env = result.env ?? machine.env();
    return {
      exitCode: child.status,
      error: result.error,
      startProblems,
      warnings: result.toasts.flatMap((toast) => String(toast.message).split('\n')),
      log: `host stderr:\n${child.stderr}\nhost logs:\n${result.logs.join('\n')}\ntoasts: ${JSON.stringify(result.toasts)}\nerror: ${result.error}`,
      run(command) {
        return spawnSync('bash', ['-c', command], { cwd: project.dir, env, encoding: 'utf8' });
      },
    };
  }
}

module.exports = { OpenCodeAgent };
