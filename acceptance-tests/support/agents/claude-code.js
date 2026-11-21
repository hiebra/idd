'use strict';

// Claude Code agent adapter (design D6): opens a session the way Claude Code
// runs the hooks registered in .claude/settings.json.
//
// Every agent adapter returns the same session shape to the World:
//   - exitCode / error: how the agent's entry point ended (exit code, or the
//     exception it threw)
//   - npmCalls: the npm calls made while the session opened
//   - startProblems: what would keep the agent from opening the session
//     normally (empty when it opens normally)
//   - warnings: the messages shown to the user in the agent's interface
//   - context: the texts the bootstrap added to the session's context
//   - log: diagnostic output for failure messages
//   - run(command): runs a shell command "in the session", as the agent would
//   - sendMessage(text, options): sends a user message and returns
//     { delivered, reminders, problems, log }: whether the message reaches the
//     model, and the texts added to it
//
// Claude Code runs each hook command with the `env` of .claude/settings.json
// and .claude/settings.local.json (the user's, not versioned) in its
// environment, and the project directory in CLAUDE_PROJECT_DIR.

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const SETTINGS = [path.join('.claude', 'settings.json'), path.join('.claude', 'settings.local.json')];

function readSettings(projectDir) {
  return SETTINGS.map((rel) => path.join(projectDir, rel))
    .filter((file) => fs.existsSync(file))
    .map((file) => JSON.parse(fs.readFileSync(file, 'utf8')));
}

// The hook commands registered for an event
function hookCommands(projectDir, event) {
  return readSettings(projectDir).flatMap((settings) =>
    (settings.hooks?.[event] ?? []).flatMap((group) => (group.hooks ?? []).filter((h) => h.type === 'command').map((h) => h.command))
  );
}

function settingsEnv(projectDir) {
  return Object.assign({}, ...readSettings(projectDir).map((settings) => settings.env ?? {}));
}

// What a hook's stdout gives Claude Code: plain text on stdout goes into
// Claude's context unseen, so it must be empty or exactly one JSON object.
// Claude Code shows the user its `systemMessage`, adds
// hookSpecificOutput.additionalContext to the context, and blocks with
// `decision: "block"` or `continue: false`.
function readHookOutput(stdout, event) {
  const none = { problems: [], warnings: [], context: null, blocks: false };
  if (stdout === '') return none;
  let output;
  try {
    output = JSON.parse(stdout);
  } catch (error) {
    return { ...none, problems: [`the ${event} hook stdout is not one valid JSON value (${error.message}): ${JSON.stringify(stdout)}`] };
  }
  if (output === null || typeof output !== 'object' || Array.isArray(output)) {
    return { ...none, problems: [`the ${event} hook stdout is not a JSON object: ${JSON.stringify(stdout)}`] };
  }
  const problems = [];
  let warnings = [];
  if (output.systemMessage !== undefined) {
    if (typeof output.systemMessage === 'string') warnings = output.systemMessage.split('\n');
    else problems.push(`systemMessage is not a string: ${JSON.stringify(stdout)}`);
  }
  let context = null;
  const specific = output.hookSpecificOutput;
  if (specific !== undefined) {
    if (specific?.hookEventName !== event) problems.push(`hookSpecificOutput.hookEventName is not '${event}': ${JSON.stringify(stdout)}`);
    else if (specific.additionalContext !== undefined) {
      if (typeof specific.additionalContext === 'string') context = specific.additionalContext;
      else problems.push(`additionalContext is not a string: ${JSON.stringify(stdout)}`);
    }
  }
  return { problems, warnings, context, blocks: output.decision === 'block' || output.continue === false };
}

class ClaudeCodeAgent {
  get name() {
    return 'Claude Code';
  }

  #runHooks({ machine, project, envFile, event, input }) {
    const env = machine.env({ ...settingsEnv(project.dir), CLAUDE_PROJECT_DIR: project.dir });
    if (envFile) env.CLAUDE_ENV_FILE = envFile;
    return hookCommands(project.dir, event).map((command) => {
      const result = spawnSync('bash', ['-c', command], {
        cwd: project.dir,
        env,
        input: JSON.stringify({ hook_event_name: event, cwd: project.dir, session_id: 'suite', ...input }),
        encoding: 'utf8',
      });
      return { command, result, output: readHookOutput(result.stdout ?? '', event) };
    });
  }

  open({ machine, project, workDir }) {
    const envFile = machine.sessionPathAdjustable ? path.join(workDir, `session-${Date.now()}.env`) : null;
    if (envFile) fs.writeFileSync(envFile, '');

    const runs = this.#runHooks({ machine, project, envFile, event: 'SessionStart', input: { source: 'startup' } });
    const failed = runs.find((r) => r.result.status !== 0 || r.result.error);
    const log = (list) => list.map((r) => `${r.command}\nexit ${r.result.status}\nstdout:\n${r.result.stdout}\nstderr:\n${r.result.stderr}`).join('\n');
    const agent = this;
    return {
      exitCode: failed ? failed.result.status : 0,
      error: failed?.result.error ?? null,
      startProblems: [
        ...(runs.length === 0 ? ['no SessionStart hook is registered in .claude/settings.json'] : []),
        ...runs.flatMap((r) => r.output.problems),
      ],
      warnings: runs.flatMap((r) => r.output.warnings),
      context: runs.map((r) => r.output.context).filter((text) => text !== null),
      log: log(runs),
      run(command) {
        const source = envFile ? `source '${envFile}'; ` : '';
        return spawnSync('bash', ['-c', `${source}${command}`], {
          cwd: project.dir,
          env: machine.env(),
          encoding: 'utf8',
        });
      },
      // Claude Code blocks the message when a UserPromptSubmit hook exits
      // with 2 or decides to block it; any other failure only shows an error
      sendMessage(text) {
        const sent = agent.#runHooks({ machine, project, envFile, event: 'UserPromptSubmit', input: { prompt: text } });
        const blocked = sent.filter((r) => r.result.status === 2 || r.output.blocks);
        return {
          delivered: blocked.length === 0,
          messages: [text],
          reminders: sent.map((r) => r.output.context).filter((t) => t !== null),
          problems: [
            ...sent.flatMap((r) => r.output.problems),
            ...sent.filter((r) => r.result.status !== 0).map((r) => `${r.command} exited with ${r.result.status}`),
          ],
          hooks: sent.length,
          log: log(sent),
        };
      },
    };
  }
}

module.exports = { ClaudeCodeAgent };
