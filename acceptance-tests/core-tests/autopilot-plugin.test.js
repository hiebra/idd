'use strict';

// Core tests of the openspec-autopilot plugin outside the specs (tasks 4.1,
// 5.5, 6.5, 9.1 and 10.2 of add-openspec-autopilot), on the simulated
// OpenCode with several sessions:
// - a hot reload does not duplicate navigations, dialogs or archivings, and
//   without a TUI that says hello the server orchestrates nothing (D13);
// - two sessions taking control at once: the oldest wins (D4);
// - the tool called before the step did anything does not chain (D6);
// - a session waiting for a commit checks the tree again on the next message (D11);
// - in auto mode, a session taking control checks the tree only after a zone
//   change (D11), and the verify without a verdict does not chain (Modo auto);
// - no exception leaves setup, the hooks, the tools or the RPC handlers, and
//   every wait is bounded (D12).
//
// Run with: npm run test:core

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { Machine } = require('../support/machine');
const { Project, REPO_ROOT } = require('../support/project');
const branches = require('../support/branches');
const ap = require('../support/autopilot');
const { OpenCodeSim } = require('../support/agents/opencode-sim');

// A World-like object with what support/autopilot.js uses
function world(t) {
  const workDir = Machine.tmpDir();
  const project = new Project(path.join(workDir, 'project'));
  branches.clearActiveChanges(project);
  const w = {
    workDir,
    project,
    branches,
    sim: null,
    opencode: null,
    pluginOptions: {},
    lifecycleProject: () => project,
    async startOpenCode(options = {}) {
      if (this.sim) await this.sim.stop();
      this.sim = new OpenCodeSim({ projectDir: project.dir, workDir, ...options });
      this.opencode = await this.sim.start();
      return this.opencode;
    },
    async opencodeCall(op, args) {
      const value = await this.sim.call(op, args);
      if (value && value.sessions) this.opencode = value;
      else if (value && value.state) this.opencode = value.state;
      return value;
    },
  };
  t.after(() => {
    w.sim?.dispose();
    fs.rmSync(workDir, { recursive: true, force: true });
  });
  return w;
}

const OWNER = 'Sesión dueña';

test('a hot reload does not duplicate navigations, dialogs or archivings', async (t) => {
  const w = world(t);
  await ap.prepareChange(w, { artifacts: ['proposal'] });
  await w.startOpenCode();
  await w.opencodeCall('reload');
  await w.opencodeCall('reload');
  assert.equal(w.opencode.generation, 3);
  // A stopped owner: opening a session asks once, and archiving it happens once
  const owner = await ap.seed(w, { title: OWNER, step: { kind: 'artifact', id: 'specs' } });
  await w.opencodeCall('answers', { answers: [{ value: 'take' }] });
  const { sessionID } = await w.opencodeCall('open', { text: 'hola' });
  assert.equal(w.opencode.dialogs.length, 1, ap.describeSessions(w));
  assert.deepEqual(w.opencode.archives, [owner]);
  // Chaining the next step navigates once and archives once
  w.branches.writeArtifact(w.project, ap.CHANGE, 'specs');
  w.branches.commitAll(w.project, 'specs');
  await ap.scriptTool(w, sessionID, 'openspec_handoff', {});
  await w.opencodeCall('message', { sessionID, text: 'listo' });
  const next = ap.onlyOwner(w);
  assert.deepEqual(w.opencode.navigations, [{ type: 'session', sessionID: next.id }], ap.describeSessions(w));
  assert.deepEqual(w.opencode.archives, [owner, sessionID]);
  assert.deepEqual(w.opencode.crashes, []);
});

test('without a TUI the server orchestrates nothing', async (t) => {
  const w = world(t);
  w.branches.branch(w.project, ap.BRANCH);
  await w.startOpenCode({ tui: false });
  const { sessionID } = await w.opencodeCall('open', { text: 'Quiero exportar los datos' });
  const all = ap.sessions(w);
  assert.equal(all.length, 1);
  assert.equal(ap.metaOf(all[0]), null);
  assert.deepEqual(ap.injected(w, sessionID), []);
  // The tool says so instead of closing anything
  await ap.scriptTool(w, sessionID, 'openspec_handoff', {});
  await w.opencodeCall('message', { sessionID, text: 'cierra' });
  const result = ap.session(w, sessionID).messages.flatMap((m) => (m.content ?? []).filter((p) => p.type === 'tool')).at(-1);
  assert.match(result.state.content[0].text, /solo orquesta el change en la TUI/);
  assert.equal(ap.sessions(w).length, 1);
});

test('two sessions taking control at once: the oldest wins and the other is left free', async (t) => {
  const w = world(t);
  await ap.prepareChange(w, { artifacts: ['proposal'] });
  await w.startOpenCode();
  const first = await w.opencodeCall('openAsync', { text: 'primera' });
  const second = await w.opencodeCall('openAsync', { text: 'segunda' });
  await w.opencodeCall('settle');
  const owners = ap.owners(w);
  assert.equal(owners.length, 1, ap.describeSessions(w));
  assert.equal(owners[0].id, first);
  assert.notEqual(ap.metaOf(ap.session(w, second))?.role, 'owner');
  // Raced, the loser is warned; when the first one had already decided, the
  // second finds an owner and follows design D5 (warned if it works, asked if not)
  const warned = /queda libre/.test(ap.toasts(w));
  const asked = w.opencode.dialogs.some((d) => d.options.some((o) => o.value === 'take'));
  assert.ok(warned || asked, ap.describeSessions(w));
});

test('the tool called before the step did anything does not chain, and warns', async (t) => {
  const w = world(t);
  await ap.prepareChange(w, { artifacts: ['proposal', 'specs'], commit: true });
  await w.startOpenCode();
  const owner = await ap.seed(w, { title: OWNER, step: { kind: 'artifact', id: 'design' } });
  await ap.scriptTool(w, owner, 'openspec_handoff', {});
  await w.opencodeCall('message', { sessionID: owner, text: 'ya' });
  assert.equal(ap.sessions(w).length, 1, ap.describeSessions(w));
  assert.equal(ap.metaOf(ap.session(w, owner)).phase, 'running');
  assert.match(ap.toasts(w), /no se encadena/);
  const tasks = await ap.prepareChange(w, { artifacts: ['proposal', 'specs', 'design', 'adr'], tasks: [{ id: '1', done: false }] });
  assert.ok(tasks);
  const task = await ap.seed(w, { title: 'task', step: { kind: 'task', id: '1' }, meta: { seq: 2 } });
  await ap.scriptTool(w, task, 'openspec_handoff', {});
  await w.opencodeCall('message', { sessionID: task, text: 'ya' });
  assert.equal(ap.sessions(w).length, 2, ap.describeSessions(w));
  assert.match(ap.toasts(w), /la task 1 no está marcada/);
});

test('a session waiting for a commit checks the tree again on the next message', async (t) => {
  const w = world(t);
  await ap.prepareChange(w, { artifacts: ['proposal', 'specs'] });
  await w.startOpenCode();
  const owner = await ap.seed(w, { title: 'design (esperando commit)', step: { kind: 'artifact', id: 'design' }, meta: { phase: 'waiting-commit', injected: false } });
  fs.appendFileSync(w.project.path('README.md'), '\nSin commit.\n');
  await w.opencodeCall('message', { sessionID: owner, text: 'hola' });
  assert.match(ap.injected(w, owner).at(-1), /cambios sin commit/);
  assert.equal(ap.metaOf(ap.session(w, owner)).phase, 'waiting-commit');
  w.branches.commitAll(w.project, 'commit del usuario');
  await w.opencodeCall('message', { sessionID: owner, text: 'hecho el commit' });
  assert.match(ap.injected(w, owner).at(-1), /openspec-continue-change/);
  const m = ap.metaOf(ap.session(w, owner));
  assert.equal(m.phase, 'running');
  assert.doesNotMatch(ap.session(w, owner).title, /esperando commit/);
  // Once started, nothing more is injected
  await w.opencodeCall('message', { sessionID: owner, text: 'sigue' });
  const last = ap.requestsOf(w, owner).at(-1);
  assert.ok(!last.messages.some((msg) => msg.text.includes(ap.MARK)), JSON.stringify(last));
});

test('no exception leaves the plugin when every session operation fails', async (t) => {
  const w = world(t);
  await ap.prepareChange(w, { artifacts: ['proposal'] });
  const failures = Object.fromEntries(['session.get', 'session.list', 'session.update', 'session.create', 'session.prompt', 'session.context', 'tui.session.update', 'tui.navigate'].map((op) => [op, 1000]));
  await w.startOpenCode({ failures });
  const { sessionID } = await w.opencodeCall('open', { text: 'hola' });
  await ap.scriptTool(w, sessionID, 'openspec_handoff', { result: 'ok' });
  await w.opencodeCall('message', { sessionID, text: 'cierra' });
  await ap.scriptTool(w, sessionID, 'openspec_session', { sessionID: 'ses_x' });
  await w.opencodeCall('message', { sessionID, text: 'lee' });
  await w.opencodeCall('compact', { sessionID });
  await w.opencodeCall('reload');
  await w.opencodeCall('message', { sessionID, text: 'sigue' });
  assert.deepEqual(w.opencode.crashes, []);
  assert.deepEqual(w.opencode.toolErrors, []);
  assert.ok(w.opencode.requests.every((r) => r.failed === null), JSON.stringify(w.opencode.requests.filter((r) => r.failed)));
  const s = ap.session(w, sessionID);
  assert.equal(s.messages.at(-1).outcome, 'succeeded');
});

test('every wait is bounded: a TUI that never answers does not hang the chaining', async (t) => {
  const w = world(t);
  await ap.prepareChange(w, { artifacts: ['proposal'] });
  await w.startOpenCode({ tuiSilent: true });
  const owner = await ap.seed(w, { title: OWNER, step: { kind: 'artifact', id: 'specs' } });
  w.branches.writeArtifact(w.project, ap.CHANGE, 'specs');
  w.branches.commitAll(w.project, 'specs');
  await ap.scriptTool(w, owner, 'openspec_handoff', {});
  const started = Date.now();
  await w.opencodeCall('message', { sessionID: owner, text: 'ya' });
  assert.ok(Date.now() - started < 40000);
  assert.equal(ap.owners(w).length, 1, ap.describeSessions(w));
  assert.deepEqual(w.opencode.crashes, []);
  // The waits the plugin declares are all finite; the dialog's, within what OpenCode tolerated (task 1.3)
  const { TIMEOUT_MS } = await import(pathToFileURL(path.join(REPO_ROOT, '.opencode', 'plugins', 'openspec-autopilot', 'lib', 'rpc.mjs')).href);
  for (const [op, ms] of Object.entries(TIMEOUT_MS)) assert.ok(Number.isFinite(ms) && ms > 0 && ms <= 300000, op);
  const server = fs.readFileSync(path.join(REPO_ROOT, '.opencode', 'plugins', 'openspec-autopilot', 'server.js'), 'utf8');
  assert.match(server, /TIMEOUT_MS\[op\] \?\? 10000/);
});

test('openspec_session reads a session of the change index and refuses any other', async (t) => {
  const w = world(t);
  await ap.prepareChange(w, { tasks: [{ id: '1', done: true }] });
  await w.startOpenCode();
  const earlier = await ap.seed(w, {
    title: 'Revisión',
    step: { kind: 'review', id: '1', of: 'task' },
    archived: true,
    meta: { role: 'free', phase: 'done', seq: 1 },
    messages: [
      { type: 'user', text: 'Revisemos la task 1' },
      { type: 'assistant', agent: 'plan', content: [{ type: 'text', text: 'La task 1 no valida las fechas.' }, { type: 'tool', name: 'read', state: { status: 'completed', input: {}, content: [{ type: 'text', text: 'SALIDA-DE-TOOL' }] } }] },
    ],
  });
  const outsider = await ap.seed(w, { title: 'Otra', step: null, messages: [{ type: 'user', text: 'ajena' }] });
  const owner = await ap.seed(w, { title: 'Update', step: { kind: 'update', id: '1', of: 'task' }, meta: { seq: 2 } });
  const call = async (sessionID) => {
    await ap.scriptTool(w, owner, 'openspec_session', { sessionID });
    await w.opencodeCall('message', { sessionID: owner, text: 'lee' });
    return ap.session(w, owner).messages.flatMap((m) => (m.content ?? []).filter((p) => p.type === 'tool')).at(-1).state.content[0].text;
  };
  const read = await call(earlier);
  assert.match(read, /Revisemos la task 1/);
  assert.match(read, /no valida las fechas/);
  assert.doesNotMatch(read, /SALIDA-DE-TOOL/);
  assert.match(await call(outsider), /no es del change/);
});

test('auto mode: taking control checks the tree only on the first step after a zone change', async (t) => {
  const w = world(t);
  w.pluginOptions = { auto: true };
  await ap.prepareChange(w, { artifacts: ['proposal', 'specs'], tasks: null });
  await w.startOpenCode({ pluginOptions: { auto: true } });
  // Same zone: the stopped owner was writing design after specs
  const owner = await ap.seed(w, { title: OWNER, step: { kind: 'artifact', id: 'design' }, meta: { zone: 'specs' } });
  fs.appendFileSync(w.project.path('README.md'), '\nSin commit.\n');
  await w.opencodeCall('answers', { answers: [{ value: 'take' }] });
  const { sessionID } = await w.opencodeCall('open', { text: 'sigo' });
  assert.deepEqual(w.opencode.archives, [owner]);
  const m = ap.metaOf(ap.session(w, sessionID));
  assert.equal(m.role, 'owner', ap.describeSessions(w));
  assert.equal(m.phase, 'running');
  assert.match(ap.injected(w, sessionID).at(-1), /openspec-continue-change/);
});

test('auto mode: taking control after a zone change waits for the commit', async (t) => {
  const w = world(t);
  await ap.prepareChange(w, { tasks: [{ id: '1', done: false }] });
  await w.startOpenCode({ pluginOptions: { auto: true } });
  // The last step that wrote was the tasks artifact (specs); the next one, task 1 (code)
  await ap.seed(w, { title: 'tasks', step: { kind: 'artifact', id: 'tasks' }, archived: true, meta: { role: 'free', phase: 'done', zone: 'specs' } });
  fs.appendFileSync(w.project.path('README.md'), '\nSin commit.\n');
  const { sessionID } = await w.opencodeCall('open', { text: 'sigo' });
  const m = ap.metaOf(ap.session(w, sessionID));
  assert.equal(m.role, 'owner', ap.describeSessions(w));
  assert.deepEqual(m.step, { kind: 'task', id: '1' });
  assert.equal(m.phase, 'waiting-commit');
  assert.match(ap.injected(w, sessionID).at(-1), /cambios sin commit/);
});

test('auto mode: the verify without a verdict does not chain to the archive', async (t) => {
  const w = world(t);
  await ap.prepareChange(w, { tasks: [{ id: '1', done: true }] });
  await w.startOpenCode({ pluginOptions: { auto: true } });
  const owner = await ap.seed(w, { title: 'verify', step: { kind: 'verify' }, meta: { zone: 'code' } });
  const lastTool = () => ap.session(w, owner).messages.flatMap((m) => (m.content ?? []).filter((p) => p.type === 'tool')).at(-1).state.content[0].text;
  for (const input of [{}, { result: 'ok' }]) {
    await ap.scriptTool(w, owner, 'openspec_handoff', input);
    await w.opencodeCall('message', { sessionID: owner, text: 'ya' });
    assert.match(lastTool(), /Falta el veredicto del verify/);
    assert.equal(ap.sessions(w).length, 1, ap.describeSessions(w));
    assert.equal(ap.metaOf(ap.session(w, owner)).phase, 'running');
  }
  await ap.scriptTool(w, owner, 'openspec_handoff', { result: 'clean' });
  await w.opencodeCall('message', { sessionID: owner, text: 'ya' });
  assert.deepEqual(ap.metaOf(ap.onlyOwner(w)).step, { kind: 'archive' });
  assert.equal(w.opencode.dialogs.length, 0);
});
