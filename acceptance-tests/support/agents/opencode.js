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

  // A version of OpenCode that does not let the plugin adjust the PATH is
  // simulated three ways (design D6): no `shell` in the server context, a
  // shell.hook() that throws, and a command environment that cannot be
  // changed. Each must open normally, with no exception out of the plugin,
  // and show the same warnings.
  open({ machine, project, workDir }) {
    if (machine.sessionPathAdjustable) return this.#open({ machine, project, workDir }, { shell: 'ok', frozenEnv: false });
    const variants = [
      { shell: 'none', frozenEnv: false },
      { shell: 'throws', frozenEnv: false },
      { shell: 'ok', frozenEnv: true },
    ];
    const [first, ...others] = variants.map((options) => ({ options, session: this.#open({ machine, project, workDir }, options) }));
    const session = first.session;
    const differences = [];
    for (const { options, session: other } of others) {
      const name = JSON.stringify(options);
      if (other.error) differences.push(`${name}: ${other.error}`);
      differences.push(...other.startProblems.map((problem) => `${name}: ${problem}`));
      if (JSON.stringify(other.warnings) !== JSON.stringify(session.warnings)) {
        differences.push(`${name} showed ${JSON.stringify(other.warnings)}\n  instead of ${JSON.stringify(session.warnings)}`);
      }
    }
    // The scenario's steps check one session, so a difference fails the opening itself
    if (differences.length > 0) {
      throw new Error(`OpenCode sessions that cannot adjust the PATH differ:\n${differences.join('\n')}`);
    }
    return session;
  }

  #open({ machine, project, workDir }, options) {
    const resultFile = path.join(workDir, `opencode-${Date.now()}-${Math.random().toString(36).slice(2)}.json`);
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
