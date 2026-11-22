'use strict';

// OpenCode 2 agent adapter (design D6): opens a session the way OpenCode 2
// loads the project's local session plugins: .opencode/plugins/session-bootstrap/
// and, if the project has it, .opencode/plugins/response-comments/ (D5 of
// update-comment-phrase-and-opencode-marker). With the global install on the
// machine (windows-global-distro), it also loads the ones of
// <config>/opencode/plugins/, first, as OpenCode loads the global config
// before the project's. The autopilot has its own simulator (opencode-sim.mjs).
// The simulated host (opencode-host.mjs) runs as a child process with the
// simulated machine's environment; see that file for what it simulates.
//
// It returns the same session shape as the Claude Code adapter: the messages
// shown to the user are the TUI part's toasts, and a command "in the session"
// runs with the environment the create.before hooks left. The context the
// bootstrap adds is what its `context` hook adds to the system of the first
// request; a message is sent by opening the simulated host again with it, on
// the project as it is then.

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { BASH } = require('../machine');

const HOST = path.join(__dirname, 'opencode-host.mjs');
// OpenCode must not wait for the install to finish before it starts (design D3)
const MAX_SETUP_MS = 2000;
// The project's session plugins, in the order the host loads them
const SESSION_PLUGINS = ['session-bootstrap', 'response-comments'];

// The session plugins OpenCode loads, as directories: the global install's
// first, then the project's. The first one is the one the host times and
// reloads: the project's session-bootstrap if it has one
function sessionPlugins(machine, project) {
  const has = (dir) => fs.existsSync(path.join(dir, 'server.js'));
  const global = machine.globalInstall ? SESSION_PLUGINS.map((name) => path.join(machine.globalInstall.pluginsDir, name)).filter(has) : [];
  const local = SESSION_PLUGINS.map((name) => path.join(project.dir, '.opencode', 'plugins', name)).filter(has);
  const all = [...global, ...local];
  const first = local.find((dir) => path.basename(dir) === SESSION_PLUGINS[0]) ?? all[0] ?? path.join(project.dir, '.opencode', 'plugins', SESSION_PLUGINS[0]);
  return [first, ...all.filter((dir) => dir !== first)];
}

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
    if (!options.plugin && !options.plugins) {
      options = { ...options, plugins: sessionPlugins(machine, project) };
    }
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
    const self = this;
    const request = result.request;
    return {
      request,
      context: request?.delivered ? request.system.slice(1) : [],
      exitCode: child.status,
      error: result.error,
      startProblems,
      warnings: result.toasts.flatMap((toast) => String(toast.message).split('\n')),
      toasts: result.toasts,
      terminal: result.terminal ?? [],
      subscriptions: result.subscriptions ?? [],
      // The environment the create.before hooks left, and how many there were
      env,
      shellHooks: result.shellHooks ?? 0,
      log: `host stderr:\n${child.stderr}\nhost logs:\n${result.logs.join('\n')}\ntoasts: ${JSON.stringify(result.toasts)}\nerror: ${result.error}\nrequest: ${JSON.stringify(result.request)}`,
      run(command) {
        return spawnSync(BASH, ['-c', command], { cwd: project.dir, env, encoding: 'utf8' });
      },
      // Opens the same session again with more host options: reloads of the
      // TUI part, an event of the plugin's RPC and closing the TUI
      // (fix-tui-subscription-cleanup)
      replay(extra) {
        return self.#open({ machine, project, workDir }, { ...options, ...extra });
      },
      // When the reminder cannot be generated, it is also simulated with a
      // request whose messages cannot be changed, so that the plugin's
      // context hook fails inside
      sendMessage(text, { reminderFails = false } = {}) {
        const variants = reminderFails ? [{ ...options, message: text }, { ...options, message: text, frozenMessages: true }] : [{ ...options, message: text }];
        const sent = variants.map((variant) => ({ variant, session: self.#open({ machine, project, workDir }, variant) }));
        const problems = [];
        for (const { variant, session } of sent) {
          if (session.error) problems.push(`${JSON.stringify(variant)}: ${session.error}`);
          if (!session.request) problems.push(`${JSON.stringify(variant)}: no request was made`);
        }
        const requests = sent.map(({ session }) => session.request).filter(Boolean);
        const delivered = requests.length === variants.length && requests.every((r) => r.delivered && r.messages.at(-1)?.role === 'user' && r.messages.at(-1)?.text === text);
        const first = requests[0];
        return {
          delivered,
          request: first ?? null,
          messages: first ? first.messages.filter((m) => m.role === 'user').map((m) => m.text) : [],
          // Messages added before the user's last one
          reminders: first?.delivered ? first.messages.slice(0, -1).filter((m) => m.text !== text).map((m) => m.text) : [],
          problems,
          hooks: first?.contextHooks ?? 0,
          log: sent.map(({ variant, session }) => `${JSON.stringify(variant)}\n${session.log}\nrequest: ${JSON.stringify(session.request)}`).join('\n'),
        };
      },
    };
  }
}

module.exports = { OpenCodeAgent };
