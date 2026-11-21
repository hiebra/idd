'use strict';

// World for session-bootstrap: opens agent sessions on a disposable project
// copy, on a simulated machine. How a session opens depends on the agent, so
// the World delegates it to an agent adapter (support/agents/, design D6);
// every adapter returns the same session shape. Step definitions only call
// these intent-level methods and assert on their results.

const fs = require('node:fs');
const path = require('node:path');
const { setWorldConstructor, setDefaultTimeout, World } = require('@cucumber/cucumber');
const { Machine } = require('./machine');
const { Project } = require('./project');
const { ClaudeCodeAgent } = require('./agents/claude-code');

// Steps run real `npm install`s
setDefaultTimeout(5 * 60 * 1000);

const AGENTS = {
  'Claude Code': new ClaudeCodeAgent(),
};
// Scenarios that do not name an agent open a Claude Code session
const DEFAULT_AGENT = 'Claude Code';

class SessionWorld extends World {
  constructor(options) {
    super(options);
    this.workDir = Machine.tmpDir();
    this.machine = new Machine(this.workDir);
    this.project = null;
    this.session = null;
  }

  ensureProject() {
    if (!this.project) this.project = new Project(path.join(this.workDir, 'project'));
    return this.project;
  }

  // Opens a session of the given agent, then records what the session sees
  openSession(agentName = DEFAULT_AGENT) {
    const agent = AGENTS[agentName];
    if (!agent) throw new Error(`no adapter for agent '${agentName}'`);
    const project = this.ensureProject();
    this.machine.resetNpmCalls();
    const session = agent.open({ machine: this.machine, project, workDir: this.workDir });
    this.session = { ...session, agent: agent.name, npmCalls: this.machine.npmCalls() };
    return this.session;
  }

  // Leaves the project installed by a previous session on an ordinary machine
  installProject() {
    const saved = { ...this.machine };
    Object.assign(this.machine, { hasNpm: true, nodeVersion: null, globalOpenspec: false, offline: false, supportsEnvFile: true });
    const session = this.openSession();
    Object.assign(this.machine, saved);
    if (session.exitCode !== 0 || !this.project.hasStamp()) {
      throw new Error(`could not install the project for this scenario:\n${session.log}`);
    }
    if (this.project.hasAcceptanceProject() && !this.project.hasStamp(this.project.acceptanceDir)) {
      throw new Error(`could not install acceptance-tests/ for this scenario:\n${session.log}`);
    }
  }

  // `openspec --version` as a command in the opened session sees it
  openspecVersionInSession() {
    return (this.session.run('openspec --version').stdout || '').trim();
  }

  installsIn(dir) {
    return this.session.npmCalls.filter((call) => call.dir === dir && call.args[0] === 'install');
  }

  cleanUp() {
    fs.rmSync(this.workDir, { recursive: true, force: true });
  }
}

setWorldConstructor(SessionWorld);
