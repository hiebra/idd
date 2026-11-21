'use strict';

// Claude Code agent adapter (design D6): opens a session the way Claude Code
// runs the SessionStart hook registered in .claude/settings.json.
//
// Every agent adapter returns the same session shape to the World:
//   - exitCode / error: how the agent's entry point ended (exit code, or the
//     exception it threw)
//   - npmCalls: the npm calls made while the session opened
//   - startProblems: what would keep the agent from opening the session
//     normally (empty when it opens normally)
//   - warnings: the messages shown to the user in the agent's interface
//   - log: diagnostic output for failure messages
//   - run(command): runs a shell command "in the session", as the agent would

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const HOOK = path.join('.claude', 'hooks', 'session-start.sh');
const WARNING_RE = /^session-start: /;

class ClaudeCodeAgent {
  get name() {
    return 'Claude Code';
  }

  open({ machine, project, workDir }) {
    const envFile = machine.supportsEnvFile ? path.join(workDir, `session-${Date.now()}.env`) : null;
    if (envFile) fs.writeFileSync(envFile, '');
    const extra = { CLAUDE_PROJECT_DIR: project.dir };
    if (envFile) extra.CLAUDE_ENV_FILE = envFile;

    const result = spawnSync('bash', [project.path(HOOK)], {
      cwd: project.dir,
      env: machine.env(extra),
      encoding: 'utf8',
    });
    return {
      exitCode: result.status,
      error: result.error ?? null,
      // Hook stdout goes into Claude's context: it must stay empty
      startProblems: result.stdout === '' ? [] : [`the hook wrote to stdout: ${JSON.stringify(result.stdout)}`],
      warnings: result.stderr.split('\n').filter((line) => WARNING_RE.test(line)),
      log: result.stderr,
      run(command) {
        const source = envFile ? `source '${envFile}'; ` : '';
        return spawnSync('bash', ['-c', `${source}${command}`], {
          cwd: project.dir,
          env: machine.env(),
          encoding: 'utf8',
        });
      },
    };
  }
}

module.exports = { ClaudeCodeAgent };
