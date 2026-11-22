'use strict';

// Core tests of the openspec-autopilot plugin outside the specs
// (add-openspec-autopilot; autopilot-sesion-operativa), on the simulated
// OpenCode with several sessions:
// - a hot reload does not duplicate navigations or archivings;
// - the TUI part's setup always returns a cleanup that releases its
//   subscriptions, its poll timer and its focus listener, and never throws,
//   even when the RPC fails (ADR-0011);
// - without a TUI, a new session only takes control with `autopilot`, and
//   two taking it at once leave the oldest (D2, D13);
// - the tool called before the step produced anything does not chain (D7);
// - a session waiting for a commit checks the tree again on the next message (D9);
// - in auto mode, the next step waits for the commit only after a zone
//   change and with the tree dirty (D9), and the verify without a verdict
//   does not chain (Modo auto);
// - no exception leaves setup, the hooks, the tools or the RPC handlers, and
//   every wait is bounded.
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
      this.sim = new OpenCodeSim({ projectDir: project.dir, workDir, alreadyOpen: true, ...options });
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

const OWNER = 'Sesión operativa';

// The operational session writes these files and goes idle
async function produce(w, sessionID, files, tool = null) {
  const responses = tool ? [{ files, tool: { name: 'openspec_handoff', input: tool } }, { text: 'Hecho.' }] : [{ files, text: 'Hecho.' }];
  await w.opencodeCall('script', { rules: [{ match: { sessionID }, responses }] });
  await w.opencodeCall('message', { sessionID, text: 'sigue' });
}
const DESIGN = { 'openspec/changes/exportar-datos/design.md': '## Context\n\nPrueba.\n' };
const lastTool = (w, sessionID) => ap.session(w, sessionID).messages.flatMap((m) => (m.content ?? []).filter((p) => p.type === 'tool')).at(-1).state.content[0].text;

test('a hot reload does not duplicate navigations or archivings', async (t) => {
  const w = world(t);
  await ap.prepareChange(w, { artifacts: ['proposal', 'specs'] });
  await w.startOpenCode();
  await w.opencodeCall('reload');
  await w.opencodeCall('reload');
  assert.equal(w.opencode.generation, 3);
  // The earlier loads of the TUI part released their subscriptions (ADR-0011)
  assert.deepEqual([...new Set(w.opencode.subscriptions.map((s) => s.load))], [3], JSON.stringify(w.opencode.subscriptions));
  // Chaining to the review navigates once and archives once
  const owner = await ap.seed(w, { title: OWNER, step: { kind: 'artifact', id: 'design' } });
  await produce(w, owner, DESIGN);
  const next = ap.onlyOwner(w);
  assert.notEqual(next.id, owner);
  assert.deepEqual(w.opencode.navigations, [{ type: 'session', sessionID: next.id }], ap.describeSessions(w));
  assert.deepEqual(w.opencode.archives, [owner]);
  assert.deepEqual(w.opencode.crashes, []);
});

const TUI = path.join(REPO_ROOT, '.opencode', 'plugins', 'openspec-autopilot', 'tui.js');

test("the TUI part's setup returns a cleanup that aborts every subscription, the poll and the focus listener", async () => {
  const tui = (await import(`${pathToFileURL(TUI).href}?cleanup`)).default;
  const signals = [];
  const focus = new Set();
  let routes = 0;
  const context = {
    renderer: { on: (name, fn) => name === 'focus' && focus.add(fn), off: (name, fn) => name === 'focus' && focus.delete(fn) },
    ui: { router: { current: () => (routes++, { type: 'home' }), navigate() {} }, dialog: { select: async () => undefined }, toast: { show() {} } },
    client: {
      rpc: () => ({
        events: { on: (name, handler, options) => signals.push({ name, signal: options?.signal }) },
        hello: async () => ({}),
        screen: async () => ({ action: 'none' }),
        reply: async () => ({}),
      }),
    },
  };
  const cleanup = await tui.setup(context);
  assert.equal(typeof cleanup, 'function');
  assert.deepEqual(signals.map((s) => s.name).sort(), ['hello-request', 'request']);
  assert.ok(signals.every((s) => s.signal instanceof AbortSignal && !s.signal.aborted));
  assert.equal(focus.size, 1);
  await new Promise((resolve) => setTimeout(resolve, 700));
  assert.ok(routes >= 2, 'the TUI polls its screen');
  assert.doesNotThrow(() => cleanup());
  assert.ok(signals.every((s) => s.signal.aborted));
  assert.equal(focus.size, 0);
  const polled = routes;
  await new Promise((resolve) => setTimeout(resolve, 700));
  assert.equal(routes, polled, 'the poll stopped');
});

test("the TUI part's setup returns a cleanup that does not throw when the RPC fails", async () => {
  const tui = (await import(`${pathToFileURL(TUI).href}?rpc-fails`)).default;
  const errors = [];
  const original = console.error;
  console.error = (...args) => errors.push(args.join(' '));
  let cleanup;
  try {
    cleanup = await tui.setup({
      client: {
        rpc: () => {
          throw new Error('simulated: rpc unavailable');
        },
      },
    });
  } finally {
    console.error = original;
  }
  assert.equal(typeof cleanup, 'function');
  assert.doesNotThrow(() => cleanup());
  assert.match(errors.join('\n'), /rpc unavailable/);
});

test('without a TUI, a new session only takes control with `autopilot`', async (t) => {
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
  assert.match(lastTool(w, sessionID), /no es la sesión operativa/);
  assert.equal(ap.sessions(w).length, 1);
});

test('two sessions taking control at once: the oldest wins and the other is left free', async (t) => {
  const w = world(t);
  await ap.prepareChange(w, { artifacts: ['proposal'] });
  await w.startOpenCode({ tui: false });
  const first = await w.opencodeCall('openAsync', { text: 'autopilot' });
  const second = await w.opencodeCall('openAsync', { text: 'autopilot' });
  await w.opencodeCall('settle');
  const owners = ap.owners(w);
  assert.equal(owners.length, 1, ap.describeSessions(w));
  assert.equal(owners[0].id, first);
  assert.notEqual(ap.metaOf(ap.session(w, second))?.role, 'owner');
});

test('the tool called before the step produced anything does not chain', async (t) => {
  const w = world(t);
  await ap.prepareChange(w, { artifacts: ['proposal', 'specs'], commit: true });
  await w.startOpenCode();
  const owner = await ap.seed(w, { title: OWNER, step: { kind: 'artifact', id: 'design' } });
  await ap.scriptTool(w, owner, 'openspec_handoff', {});
  await w.opencodeCall('message', { sessionID: owner, text: 'ya' });
  assert.equal(ap.sessions(w).length, 1, ap.describeSessions(w));
  assert.equal(ap.metaOf(ap.session(w, owner)).phase, 'running');
  assert.match(lastTool(w, owner), /No hay producto evaluable/);
  await ap.prepareChange(w, { artifacts: ['proposal', 'specs', 'design', 'adr'], tasks: [{ id: '1', done: false }] });
  const task = await ap.seed(w, { title: 'task', step: { kind: 'task', id: '1', label: '1' }, meta: { seq: 2 } });
  await ap.scriptTool(w, task, 'openspec_handoff', {});
  await w.opencodeCall('message', { sessionID: task, text: 'ya' });
  assert.equal(ap.sessions(w).length, 2, ap.describeSessions(w));
  assert.match(lastTool(w, task), /No hay producto evaluable: task 1/);
});

test('a session waiting for a commit checks the tree again on the next message', async (t) => {
  const w = world(t);
  await ap.prepareChange(w, { artifacts: ['proposal', 'specs'] });
  await w.startOpenCode();
  const owner = await ap.seed(w, { title: 'artefacto design de exportar-datos (esperando commit)', step: { kind: 'artifact', id: 'design' }, meta: { phase: 'waiting-commit' } });
  fs.appendFileSync(w.project.path('README.md'), '\nSin commit.\n');
  await w.opencodeCall('message', { sessionID: owner, text: 'hola' });
  assert.match(ap.injected(w, owner).at(-1), /esperando a que el usuario haga el commit/);
  assert.equal(ap.metaOf(ap.session(w, owner)).phase, 'waiting-commit');
  w.branches.commitAll(w.project, 'commit del usuario');
  await w.opencodeCall('message', { sessionID: owner, text: 'hecho el commit' });
  const started = ap.session(w, owner).messages.filter((m) => m.type === 'user').at(-1).text;
  assert.match(started, /openspec-continue-change/);
  assert.match(started, /Mensaje del usuario: hecho el commit/);
  assert.equal(ap.metaOf(ap.session(w, owner)).phase, 'running');
  assert.doesNotMatch(ap.session(w, owner).title, /esperando commit/);
  // Once started, only the reminder of the step
  await w.opencodeCall('message', { sessionID: owner, text: 'sigue' });
  assert.match(ap.injected(w, owner).at(-1), /Recordatorio/);
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
  await ap.prepareChange(w, { artifacts: ['proposal', 'specs'] });
  await w.startOpenCode({ tuiSilent: true });
  const owner = await ap.seed(w, { title: OWNER, step: { kind: 'artifact', id: 'design' } });
  const started = Date.now();
  await produce(w, owner, DESIGN);
  assert.ok(Date.now() - started < 60000);
  assert.equal(ap.owners(w).length, 1, ap.describeSessions(w));
  assert.notEqual(ap.onlyOwner(w).id, owner);
  assert.deepEqual(w.opencode.crashes, []);
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

test('auto mode: within a zone the next step starts with the tree dirty', async (t) => {
  const w = world(t);
  await ap.prepareChange(w, { artifacts: ['proposal', 'specs'] });
  await w.startOpenCode({ pluginOptions: { auto: true } });
  const owner = await ap.seed(w, { title: OWNER, step: { kind: 'artifact', id: 'design' }, meta: { zone: 'specs' } });
  fs.appendFileSync(w.project.path('README.md'), '\nSin commit.\n');
  await produce(w, owner, DESIGN);
  const next = ap.onlyOwner(w);
  assert.deepEqual(ap.metaOf(next).step, { kind: 'artifact', id: 'adr' }, ap.describeSessions(w));
  assert.equal(ap.metaOf(next).phase, 'running');
});

test('auto mode: after a zone change with the tree clean, the next step starts', async (t) => {
  const w = world(t);
  await ap.prepareChange(w, { artifacts: ['proposal', 'specs', 'design', 'adr'] });
  await w.startOpenCode({ pluginOptions: { auto: true } });
  const owner = await ap.seed(w, { title: OWNER, step: { kind: 'artifact', id: 'tasks' }, meta: { zone: 'specs' } });
  // The tasks artifact is written and committed before the session goes idle
  w.branches.writeTasks(w.project, ap.CHANGE, [{ id: '1', done: false }]);
  w.branches.commitAll(w.project, 'tasks');
  await w.opencodeCall('message', { sessionID: owner, text: 'listo' });
  const next = ap.onlyOwner(w);
  assert.deepEqual(ap.metaOf(next).step, { kind: 'task', id: '1', label: '1' }, ap.describeSessions(w));
  assert.equal(ap.metaOf(next).phase, 'running');
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

test('one process with two projects: loading the second does not retire the first', async () => {
  const server = (await import(`${pathToFileURL(path.join(REPO_ROOT, '.opencode', 'plugins', 'openspec-autopilot', 'server.js')).href}?two-projects`)).default;
  const owner = { id: 'ses_a', title: 'Operativa', time: { created: 1 }, metadata: { openspec: { v: 1, role: 'owner', step: { kind: 'artifact', id: 'design' }, change: 'x', phase: 'running' } } };
  const context = (directory) => {
    const hooks = {};
    return {
      hooks,
      ctx: {
        location: { directory },
        options: {},
        rpc: { register: async () => ({ events: { emit: async () => {} } }) },
        tool: { transform: () => {} },
        session: { hook: async (name, fn) => (hooks[name] = fn), get: async () => owner },
      },
    };
  };
  const a = context('/proyecto/a');
  const b = context('/proyecto/b');
  await server.setup(a.ctx);
  await server.setup(b.ctx);
  const input = { sessionID: 'ses_a', messages: [{ role: 'user', content: [{ type: 'text', text: 'hola' }] }] };
  await a.hooks.context(input);
  assert.equal(input.messages.length, 2, 'the first project still answers its hooks');
  assert.match(input.messages[0].content[0].text, /Recordatorio/);
  // A reload of the same project does retire its previous load
  const a2 = context('/proyecto/a');
  await server.setup(a2.ctx);
  const again = { sessionID: 'ses_a', messages: [{ role: 'user', content: [{ type: 'text', text: 'hola' }] }] };
  await a.hooks.context(again);
  assert.equal(again.messages.length, 1);
});

test("the user's description in the new step reaches the next steps", async (t) => {
  const w = world(t);
  w.branches.branch(w.project, ap.BRANCH);
  await w.startOpenCode({ pluginOptions: { auto: true } });
  const owner = await ap.seed(w, { title: OWNER, step: { kind: 'new' }, meta: { change: null, snapshot: { change: null, artifacts: [], tasks: [], git: null } } });
  const files = { 'openspec/changes/exportar-datos/.openspec.yaml': 'schema: intent-driven\ncreated: 2026-11-21\n' };
  await w.opencodeCall('script', { rules: [{ match: { sessionID: owner }, responses: [{ files, text: 'Creado.' }] }] });
  await w.opencodeCall('message', { sessionID: owner, text: 'Quiero exportar los datos a CSV con una cabecera.' });
  const next = ap.onlyOwner(w);
  assert.deepEqual(ap.metaOf(next).step, { kind: 'artifact', id: 'proposal' }, ap.describeSessions(w));
  assert.match(ap.instructionOf(w, next.id), /exportar los datos a CSV con una cabecera/);
});

// autopilot-plan-explore (D2): what the plugin injects with the plan agent
const injectedIn = (request) => request.messages.filter((m) => m.role === 'user' && m.text.includes('[openspec-autopilot]')).map((m) => m.text);

test('in a plan turn with several tools, every request carries the full exploration, also after the plan reminder', async (t) => {
  const w = world(t);
  await ap.prepareChange(w, { artifacts: ['proposal', 'specs'] });
  await w.startOpenCode();
  const owner = await ap.seed(w, { title: OWNER, step: { kind: 'artifact', id: 'design' } });
  await w.opencodeCall('message', { sessionID: owner, text: 'Empieza.' });
  await w.opencodeCall('switchAgent', { sessionID: owner, agent: 'plan' });
  await w.opencodeCall('script', { rules: [{ match: { sessionID: owner }, responses: [{ tool: { name: 'read', input: {} } }, { tool: { name: 'grep', input: {} } }, { text: 'Hay dos opciones.' }] }] });
  await w.opencodeCall('message', { sessionID: owner, text: '¿Qué opciones hay?' });
  const plan = ap.requestsOf(w, owner).filter((r) => r.agent === 'plan');
  assert.equal(plan.length, 3, ap.describeSessions(w));
  for (const request of plan) {
    const texts = injectedIn(request);
    assert.equal(texts.length, 1, JSON.stringify(texts));
    assert.match(texts[0], /`openspec-explore`/);
    assert.match(texts[0], /compañero de pensamiento/);
  }
  // The next message in plan only gets the reminder
  await w.opencodeCall('message', { sessionID: owner, text: '¿Y la segunda?' });
  assert.match(injectedIn(ap.requestsOf(w, owner).at(-1))[0], /Recordatorio: estás explorando/);
  assert.deepEqual(w.opencode.crashes, []);
});

test('a message sent mid-turn after a Tab to plan gets the exploration from the first request that carries it', async (t) => {
  const w = world(t);
  await ap.prepareChange(w, { artifacts: ['proposal', 'specs'] });
  await w.startOpenCode();
  const owner = await ap.seed(w, { title: OWNER, step: { kind: 'artifact', id: 'design' } });
  // A build turn whose tool takes a while; the user switches to plan and writes meanwhile
  await w.opencodeCall('script', { rules: [{ match: { sessionID: owner }, responses: [{ tool: { name: 'read', input: {} }, delayMs: 400 }, { text: 'Visto.' }, { text: 'Opciones.' }] }] });
  await w.opencodeCall('messageAsync', { sessionID: owner, text: 'Empieza.' });
  await new Promise((resolve) => setTimeout(resolve, 150));
  await w.opencodeCall('switchAgent', { sessionID: owner, agent: 'plan' });
  await w.opencodeCall('message', { sessionID: owner, text: '¿Qué opciones hay?' });
  const requests = ap.requestsOf(w, owner);
  const last = requests.at(-1);
  assert.equal(last.agent, 'plan', ap.describeSessions(w));
  assert.ok(last.messages.some((m) => m.text === '¿Qué opciones hay?'));
  assert.match(injectedIn(last)[0], /compañero de pensamiento/);
  assert.deepEqual(w.opencode.crashes, []);
});

test('a failure writing the turn does not block the request nor throw', async (t) => {
  const w = world(t);
  await ap.prepareChange(w, { artifacts: ['proposal', 'specs'] });
  await w.startOpenCode();
  const owner = await ap.seed(w, { title: OWNER, step: { kind: 'artifact', id: 'design' } });
  await w.opencodeCall('switchAgent', { sessionID: owner, agent: 'plan' });
  await w.opencodeCall('fail', { failures: { 'session.update': 20 } });
  await w.opencodeCall('message', { sessionID: owner, text: '¿Qué opciones hay?' });
  const last = ap.requestsOf(w, owner).at(-1);
  assert.equal(last.failed, null);
  // Without the key written, the turn is decided as if the previous one were build
  assert.match(injectedIn(last)[0], /`openspec-explore`/);
  assert.deepEqual(w.opencode.crashes, []);
});

// autopilot-plan-explore (D4, D5): the notice of what was modified with the plan agent
const DESIGN_FILE = { 'openspec/changes/exportar-datos/design.md': '## Context\n\nEscrito en plan.\n' };
const noticeDialogs = (w) => w.opencode.dialogs.filter((d) => /con el agente plan se han hecho modificaciones/.test(d.title ?? ''));

// An operational session doing `design`; its plan turn writes these files
async function planWrites(w, files, { keepOpen = true } = {}) {
  await ap.prepareChange(w, { artifacts: ['proposal', 'specs'] });
  await w.startOpenCode();
  if (keepOpen) await w.opencodeCall('dialogWait', { on: true });
  const owner = await ap.seed(w, { title: OWNER, step: { kind: 'artifact', id: 'design' }, meta: { zone: 'specs' } });
  await w.opencodeCall('switchAgent', { sessionID: owner, agent: 'plan' });
  await w.opencodeCall('script', { rules: [{ match: { sessionID: owner }, responses: [{ files, text: 'Hecho.' }] }] });
  await w.opencodeCall('message', { sessionID: owner, text: 'Escríbelo.' });
  return owner;
}

test('a plan turn keeps the git state of its start until the session goes idle', async (t) => {
  const w = world(t);
  await ap.prepareChange(w, { artifacts: ['proposal', 'specs'] });
  await w.startOpenCode();
  const owner = await ap.seed(w, { title: OWNER, step: { kind: 'artifact', id: 'design' } });
  await w.opencodeCall('switchAgent', { sessionID: owner, agent: 'plan' });
  await w.opencodeCall('script', { rules: [{ match: { sessionID: owner }, responses: [{ tool: { name: 'read', input: {} }, delayMs: 400 }, { text: 'Visto.' }] }] });
  await w.opencodeCall('messageAsync', { sessionID: owner, text: '¿Qué hay?' });
  await new Promise((resolve) => setTimeout(resolve, 200));
  await ap.refresh(w);
  const during = ap.metaOf(ap.session(w, owner)).planTurn;
  assert.match(during?.git?.signature ?? '', /^[0-9a-f]{40}$/, ap.describeSessions(w));
  await w.opencodeCall('settle');
  assert.equal(ap.metaOf(ap.session(w, owner)).planTurn, null);
  assert.equal(noticeDialogs(w).length, 0);
  assert.deepEqual(w.opencode.crashes, []);
});

test('a pending notice is asked again of a TUI with another PID, not after a hot reload nor on each screen', async (t) => {
  const w = world(t);
  const owner = await planWrites(w, DESIGN_FILE);
  assert.equal(noticeDialogs(w).length, 1);
  await w.opencodeCall('reload');
  await w.opencodeCall('goto', { sessionID: owner });
  await w.opencodeCall('focus');
  assert.equal(noticeDialogs(w).length, 1, 'the modal of the previous load is still on screen');
  assert.equal(ap.metaOf(ap.session(w, owner)).phase, 'plan-notice');
  // A new TUI (another process): the notice again; this one is closed at once, and the chain goes on
  w.opencode = await w.sim.restart();
  await w.opencodeCall('settle');
  assert.equal(noticeDialogs(w).length, 1, ap.describeSessions(w));
  const review = ap.onlyOwner(w);
  assert.notEqual(review.id, owner);
  assert.equal(ap.metaOf(review).step.kind, 'review');
  assert.deepEqual(w.opencode.crashes, []);
});

test('after a hot reload with the modal open, closing it chains once through the new server', async (t) => {
  const w = world(t);
  const owner = await planWrites(w, DESIGN_FILE);
  await w.opencodeCall('reload');
  await w.opencodeCall('answers', { answers: [{ key: 'esc' }], settle: true });
  const review = ap.onlyOwner(w);
  assert.notEqual(review.id, owner, ap.describeSessions(w));
  assert.deepEqual(ap.metaOf(review).step, { kind: 'review', id: 'design', of: 'artifact' });
  assert.equal(ap.sessions(w).length, 2);
  assert.deepEqual(w.opencode.crashes, []);
});

test('a prompt with the notice pending chains, with the notice in the next session, and a later ack is ignored', async (t) => {
  const w = world(t);
  const owner = await planWrites(w, DESIGN_FILE);
  await w.opencodeCall('message', { sessionID: owner, text: 'Vale, sigue.' });
  const review = ap.onlyOwner(w);
  assert.notEqual(review.id, owner, ap.describeSessions(w));
  assert.match(ap.instructionOf(w, review.id), /con el agente plan se han hecho modificaciones/);
  // The modal, still open, is closed now: its ack finds no session waiting
  await w.opencodeCall('answers', { answers: [{ key: 'enter' }], settle: true });
  assert.equal(ap.onlyOwner(w).id, review.id);
  assert.equal(ap.sessions(w).length, 2, ap.describeSessions(w));
  assert.deepEqual(w.opencode.crashes, []);
});

test('a build turn gives no notice although git changes', async (t) => {
  const w = world(t);
  await ap.prepareChange(w, { artifacts: ['proposal', 'specs'] });
  await w.startOpenCode();
  await w.opencodeCall('dialogWait', { on: true });
  const owner = await ap.seed(w, { title: OWNER, step: { kind: 'artifact', id: 'design' } });
  await w.opencodeCall('script', { rules: [{ match: { sessionID: owner }, responses: [{ files: { 'README.md': '# Cambiado en build\n' }, text: 'Hecho.' }] }] });
  await w.opencodeCall('message', { sessionID: owner, text: 'Arregla el README.' });
  assert.equal(noticeDialogs(w).length, 0);
  assert.equal(ap.metaOf(ap.session(w, owner)).planNotice ?? null, null);
  assert.deepEqual(w.opencode.crashes, []);
});
