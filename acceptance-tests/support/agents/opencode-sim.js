'use strict';

// Client of the simulated OpenCode with several sessions (design D16 of
// add-openspec-autopilot): forks opencode-sim-process.mjs with the project
// copy and a session store, and sends it one operation at a time. Restarting
// OpenCode is a new process on the same store.

const fs = require('node:fs');
const path = require('node:path');
const { fork } = require('node:child_process');
const { REPO_ROOT } = require('../project');

const ENTRY = path.join(__dirname, 'opencode-sim-process.mjs');
// The project's OpenSpec CLI, as the session bootstrap puts it in the PATH
const OPENSPEC_BIN = path.join(REPO_ROOT, 'node_modules', '.bin');

class OpenCodeSim {
  constructor({ projectDir, workDir, plugin = 'openspec-autopilot', pluginDir = null, tui = true, tuiSilent = false, rpcLate = false, alreadyOpen = false, pluginOptions = {}, failures = {}, workspacesMountMs = undefined, env = process.env }) {
    // Worktrees go outside the clone, as under OpenCode's data directory
    const worktreesDir = path.join(workDir, 'worktrees');
    this.config = { projectDir, plugin, pluginDir, tui, tuiSilent, rpcLate, alreadyOpen, pluginOptions, failures, worktreesDir, ...(workspacesMountMs !== undefined ? { workspacesMountMs } : {}), dbFile: path.join(workDir, `opencode-sessions-${Date.now()}.json`) };
    this.env = { ...env, PATH: `${OPENSPEC_BIN}${path.delimiter}${env.PATH ?? ''}`, OPENSPEC_TELEMETRY: '0' };
    this.child = null;
    this.seq = 0;
    this.waiting = new Map();
    this.stderr = '';
  }

  async start() {
    this.child = fork(ENTRY, [], { cwd: this.config.projectDir, env: this.env, stdio: ['ignore', 'ignore', 'pipe', 'ipc'] });
    this.child.stderr.on('data', (chunk) => (this.stderr += chunk));
    await new Promise((resolve, reject) => {
      this.child.once('message', (m) => (m.ready ? resolve() : reject(new Error('bad start'))));
      this.child.once('exit', (code) => reject(new Error(`the simulated OpenCode exited (${code}):\n${this.stderr}`)));
    });
    this.child.on('message', ({ id, ok, value, error }) => {
      const waiter = this.waiting.get(id);
      if (!waiter) return;
      this.waiting.delete(id);
      if (ok) waiter.resolve(value);
      else waiter.reject(new Error(`${error}\nhost stderr:\n${this.stderr}`));
    });
    this.child.on('exit', (code) => {
      for (const waiter of this.waiting.values()) waiter.reject(new Error(`the simulated OpenCode exited (${code}):\n${this.stderr}`));
      this.waiting.clear();
    });
    return this.call('start', this.config);
  }

  call(op, args = {}) {
    const id = ++this.seq;
    return new Promise((resolve, reject) => {
      this.waiting.set(id, { resolve, reject });
      this.child.send({ id, op, args });
    });
  }

  // Closes OpenCode and opens it again on the same sessions
  async restart() {
    await this.stop();
    this.config.failures = {};
    this.config.alreadyOpen = false;
    return this.start();
  }

  async stop() {
    if (!this.child || this.child.exitCode !== null) return;
    const exited = new Promise((resolve) => this.child.once('exit', resolve));
    this.child.kill();
    await exited;
  }

  dispose() {
    try {
      this.child?.kill();
    } catch {
      // already gone
    }
    fs.rmSync(this.config.dbFile, { force: true });
  }
}

module.exports = { OpenCodeSim };
