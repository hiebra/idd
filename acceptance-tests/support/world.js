'use strict';

// World for session-bootstrap: opens Claude Code sessions on a disposable
// project copy, on a simulated machine, the way Claude Code runs the
// SessionStart hook (design D9). Step definitions only call these
// intent-level methods and assert on their results.

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { setWorldConstructor, setDefaultTimeout, World } = require('@cucumber/cucumber');
const { Machine } = require('./machine');
const { Project } = require('./project');

// Steps run real `npm install`s
setDefaultTimeout(5 * 60 * 1000);

const HOOK = path.join('.claude', 'hooks', 'session-start.sh');

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

  // Opens a session: runs the hook, then records what the session sees
  openSession() {
    const project = this.ensureProject();
    this.machine.resetNpmCalls();
    const envFile = this.machine.supportsEnvFile ? path.join(this.workDir, `session-${Date.now()}.env`) : null;
    if (envFile) fs.writeFileSync(envFile, '');
    const extra = { CLAUDE_PROJECT_DIR: project.dir };
    if (envFile) extra.CLAUDE_ENV_FILE = envFile;

    const result = spawnSync('bash', [project.path(HOOK)], {
      cwd: project.dir,
      env: this.machine.env(extra),
      encoding: 'utf8',
    });
    this.session = {
      exitCode: result.status,
      stdout: result.stdout,
      stderr: result.stderr,
      envFile,
      npmCalls: this.machine.npmCalls(),
    };
    return this.session;
  }

  // Leaves the project installed by a previous session on an ordinary machine
  installProject() {
    const saved = { ...this.machine };
    Object.assign(this.machine, { hasNpm: true, nodeVersion: null, globalOpenspec: false, offline: false, supportsEnvFile: true });
    const session = this.openSession();
    Object.assign(this.machine, saved);
    if (session.exitCode !== 0 || !this.project.hasStamp()) {
      throw new Error(`could not install the project for this scenario:\n${session.stderr}`);
    }
    if (this.project.hasAcceptanceProject() && !this.project.hasStamp(this.project.acceptanceDir)) {
      throw new Error(`could not install acceptance-tests/ for this scenario:\n${session.stderr}`);
    }
  }

  // `openspec --version` as a command in the opened session sees it
  openspecVersionInSession() {
    const source = this.session.envFile ? `source '${this.session.envFile}'; ` : '';
    const result = spawnSync('bash', ['-c', `${source}openspec --version`], {
      cwd: this.project.dir,
      env: this.machine.env(),
      encoding: 'utf8',
    });
    return (result.stdout || '').trim();
  }

  installsIn(dir) {
    return this.session.npmCalls.filter((call) => call.dir === dir && call.args[0] === 'install');
  }

  cleanUp() {
    fs.rmSync(this.workDir, { recursive: true, force: true });
  }
}

setWorldConstructor(SessionWorld);
