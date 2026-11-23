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
const { OpenCodeAgent } = require('./agents/opencode');
const skills = require('./skills');
const { FakeEngine, refIn, refInText, hasPinnedEngine } = require('./engine');
const branches = require('./branches');
const wikiModes = require('./wiki-modes');
const { OpenCodeSim } = require('./agents/opencode-sim');

// Steps run real `npm install`s
setDefaultTimeout(5 * 60 * 1000);

const AGENTS = {
  'Claude Code': new ClaudeCodeAgent(),
  OpenCode: new OpenCodeAgent(),
};
// Scenarios that do not name an agent open a Claude Code session
const DEFAULT_AGENT = 'Claude Code';
// How each agent invokes the engine operations the guide names by marker
const GUIDE_OPERATIONS = {
  'Claude Code': { query: '`/wiki:query --local`', ingest: '`/wiki:ingest <url> --local`' },
  OpenCode: { query: 'la skill `wiki-query`', ingest: 'ingiere la fuente' },
};

class SessionWorld extends World {
  constructor(options) {
    super(options);
    this.workDir = Machine.tmpDir();
    this.machine = new Machine(this.workDir);
    this.project = null;
    this.session = null;
    // The fake wiki engine is only needed once the project pins one
    this.engine = hasPinnedEngine() ? new FakeEngine(this.workDir) : null;
    this.sessions = {};
    // The simulated OpenCode with several sessions, for openspec-autopilot
    this.sim = null;
    this.branches = branches;
  }

  ensureProject() {
    if (!this.project) this.project = new Project(path.join(this.workDir, 'project'), { engineUrl: this.engine?.url ?? null });
    return this.project;
  }

  // Opens a session of the given agent, then records what the session sees
  openSession(agentName = DEFAULT_AGENT) {
    const agent = AGENTS[agentName];
    if (!agent) throw new Error(`no adapter for agent '${agentName}'`);
    const project = this.ensureProject();
    this.machine.resetNpmCalls();
    this.machine.resetGitCalls();
    const session = agent.open({ machine: this.machine, project, workDir: this.workDir });
    this.session = { ...session, agent: agent.name, npmCalls: this.machine.npmCalls(), gitCalls: this.machine.gitCalls() };
    this.sessions[agent.name] = this.session;
    return this.session;
  }

  // Opens a session that must open normally, as the setup of a scenario
  openSetupSession(agentName = DEFAULT_AGENT) {
    const session = this.openSession(agentName);
    if (session.error || session.exitCode !== 0 || session.startProblems.length > 0) {
      throw new Error(`could not open a ${agentName} session for this scenario:\n${session.startProblems.join('\n')}\n${session.log}`);
    }
    return session;
  }

  // Leaves the project installed by a previous session on an ordinary machine
  installProject(agentName = DEFAULT_AGENT) {
    const saved = { ...this.machine };
    Object.assign(this.machine, { hasNpm: true, nodeVersion: null, globalOpenspec: false, offline: false, sessionPathAdjustable: true });
    const session = this.openSession(agentName);
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

  // --- agent-skills ---

  // The project skills the agent finds in the clone, by its discovery rules
  findSkills(agentName) {
    this.foundSkills = { agent: agentName, skills: skills.discoverSkills(agentName, this.ensureProject().dir) };
    return this.foundSkills;
  }

  schemaSkillIds() {
    return skills.schemaSkillIds(this.ensureProject().dir);
  }

  // Checks that every schema skill is available in every supported agent;
  // records the failure, if any
  checkSkillAvailability() {
    const problems = skills.schemaSkillProblems(this.ensureProject().dir);
    this.availabilityCheck = { failed: problems.length > 0, problems };
    return this.availabilityCheck;
  }

  installsIn(dir) {
    return this.session.npmCalls.filter((call) => call.dir === dir && call.args[0] === 'install');
  }

  // --- wiki ---

  // The wiki engine clones made while the session opened
  engineClones() {
    return (this.session?.gitCalls ?? []).filter((call) => /^clone\b/.test(call));
  }

  // What the agent has of the wiki engine: its read-only query and wiki
  // management, each with the engine ref of the file it comes from, and the
  // ref the engine's helper reports from a command of the session
  // (CLAUDE_PLUGIN_ROOT, design D1)
  loadWikiEngine(agentName) {
    const project = this.ensureProject();
    const operations = skills.wikiOperations(agentName, project.dir);
    const refs = Object.fromEntries(Object.entries(operations).map(([kind, op]) => [kind, op ? refIn(op.file) : null]));
    const session = this.sessions[agentName];
    const helper = session ? session.run('"$CLAUDE_PLUGIN_ROOT/bin/llm-wiki"') : null;
    this.wikiEngine = { agent: agentName, operations, refs, helperRef: helper ? refInText(helper.stdout) : null, helper };
    return this.wikiEngine;
  }

  // The engine refs an agent uses, as a set; one element when it is consistent
  engineRefsOf(agentName) {
    const { refs, helperRef } = this.loadWikiEngine(agentName);
    return [...new Set([...Object.values(refs), helperRef])];
  }

  // Sends a user message in the open session
  sendMessage(text = 'qué sabemos del dominio del proyecto') {
    this.sentMessage = { text, result: this.session.sendMessage(text, { reminderFails: Boolean(this.reminderBroken) }) };
    return this.sentMessage.result;
  }

  breakReminder() {
    this.project.breakReminder();
    this.reminderBroken = true;
  }

  // The guide as the agent receives it: the project's guide file in the given
  // mode, by default the clone's (design D2 of add-wiki-lite-mode), without
  // its section identifiers (design D2), with each operation marker replaced
  // by how the agent invokes it (design D1 of fix-wiki-flow-operations)
  guideAsDelivered(agentName = this.session?.agent ?? DEFAULT_AGENT, mode = this.project.wikiEffectiveMode()) {
    const operations = GUIDE_OPERATIONS[agentName];
    return wikiModes
      .modeText(this.project.readGuide(), mode)
      .replace(/<!--[\s\S]*?-->\n?/g, '')
      .replace(/\{\{(\w+)\}\}/g, (marker, name) => operations[name] ?? marker)
      .trim();
  }

  // --- openspec-change-lifecycle and openspec-autopilot ---

  // The project copy with an origin branch whose openspec/changes/ only has
  // the archive, as on main
  lifecycleProject() {
    if (!this.lifecycleReady) {
      branches.clearActiveChanges(this.ensureProject());
      this.lifecycleReady = true;
    }
    return this.project;
  }

  // Opens the simulated OpenCode on the project copy with the given plugin
  async startOpenCode({ plugin = 'openspec-autopilot', tui = true, pluginOptions = {}, failures = {}, rpcLate = false, alreadyOpen = false } = {}) {
    if (this.sim) await this.sim.stop();
    this.sim = new OpenCodeSim({ projectDir: this.lifecycleProject().dir, workDir: this.workDir, plugin, tui, pluginOptions, failures, rpcLate, alreadyOpen });
    this.opencode = await this.sim.start();
    return this.opencode;
  }

  async opencodeCall(op, args) {
    const value = await this.sim.call(op, args);
    if (value && value.sessions) this.opencode = value;
    else if (value && value.state) this.opencode = value.state;
    return value;
  }

  cleanUp() {
    this.sim?.dispose();
    fs.rmSync(this.workDir, { recursive: true, force: true });
  }
}

setWorldConstructor(SessionWorld);
