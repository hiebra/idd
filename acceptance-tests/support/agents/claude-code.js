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

// Claude Code shows the user the `systemMessage` of the JSON a SessionStart
// hook prints on stdout; stderr is not shown, and plain text on stdout goes
// into Claude's context. So stdout must be empty or exactly one JSON object.
function readHookOutput(stdout) {
  if (stdout === '') return { problems: [], warnings: [] };
  let output;
  try {
    output = JSON.parse(stdout);
  } catch (error) {
    return { problems: [`the hook stdout is not one valid JSON value (${error.message}): ${JSON.stringify(stdout)}`], warnings: [] };
  }
  if (output === null || typeof output !== 'object' || Array.isArray(output)) {
    return { problems: [`the hook stdout is not a JSON object: ${JSON.stringify(stdout)}`], warnings: [] };
  }
  if (output.systemMessage === undefined) return { problems: [], warnings: [] };
  if (typeof output.systemMessage !== 'string') {
    return { problems: [`systemMessage is not a string: ${JSON.stringify(stdout)}`], warnings: [] };
  }
  return { problems: [], warnings: output.systemMessage.split('\n') };
}

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
    const { problems, warnings } = readHookOutput(result.stdout ?? '');
    return {
      exitCode: result.status,
      error: result.error ?? null,
      startProblems: problems,
      warnings,
      log: `stdout:\n${result.stdout}\nstderr:\n${result.stderr}`,
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
