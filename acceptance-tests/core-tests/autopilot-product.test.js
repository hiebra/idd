'use strict';

// Core tests of the plugin's pure logic added by autopilot-sesion-operativa:
// the evaluable product (lib/product.mjs, design D7), the review verdict by
// git (lib/git.mjs, D8, with real repositories) and what the TUI does with
// each screen (lib/screen.mjs, D4), and, from autopilot-rama-por-sesion,
// entering a session (D3), the modal of `/new` (D4) and the working branch of
// each session (lib/state.mjs, D1).
//
// Run with: npm run test:core

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { pathToFileURL } = require('node:url');
const { REPO_ROOT } = require('../support/project');

const LIB = path.join(REPO_ROOT, '.opencode', 'plugins', 'openspec-autopilot', 'lib');
const load = (name) => import(pathToFileURL(path.join(LIB, name)).href);

const status = (done, ready = []) => ({
  artifacts: ['proposal', 'specs', 'design', 'adr', 'tasks'].map((id) => ({ id, status: done.includes(id) ? 'done' : ready.includes(id) ? 'ready' : 'blocked' })),
  artifactPaths: Object.fromEntries(done.map((id) => [id, { existingOutputPaths: [`/p/${id}.md`] }])),
});

test('the product of an artifact or a task step: what the CLI says changed, in the schema order', async () => {
  const { productOf, snapshotOf } = await load('product.mjs');
  const before = snapshotOf({ change: 'x', status: status(['proposal']), tasks: [] });
  assert.deepEqual(before, { change: 'x', artifacts: ['proposal'], tasks: [], git: null });
  const step = { kind: 'artifact', id: 'specs' };
  assert.deepEqual(productOf({ step, before, state: { change: 'x', status: status(['proposal']), tasks: [] } }), []);
  // The model did more than its step: specs and design
  assert.deepEqual(
    productOf({ step, before, state: { change: 'x', status: status(['proposal', 'design', 'specs']), tasks: [] } }).map((p) => p.id),
    ['specs', 'design']
  );
  const tasks = [{ id: '1', label: '1.1', done: true }, { id: '2', label: '1.2', done: true }, { id: '3', label: '1.3', done: false }];
  const afterTasks = productOf({ step: { kind: 'task', id: '2' }, before: { artifacts: ['proposal', 'specs', 'design', 'adr', 'tasks'], tasks: ['1'] }, state: { change: 'x', status: status(['proposal', 'specs', 'design', 'adr', 'tasks']), tasks } });
  assert.deepEqual(afterTasks, [{ kind: 'tasks', ids: ['2'], labels: ['1.2'] }]);
});

test('the product of the other steps', async () => {
  const { productOf } = await load('product.mjs');
  assert.deepEqual(productOf({ step: { kind: 'new' }, before: {}, branch: { kind: 'none' } }), []);
  assert.deepEqual(productOf({ step: { kind: 'new' }, before: {}, branch: { kind: 'active', change: 'x' }, state: { change: 'x', status: status([]), tasks: [] } }), [{ kind: 'change', change: 'x' }]);
  assert.deepEqual(productOf({ step: { kind: 'verify' }, handoff: null }), []);
  assert.deepEqual(productOf({ step: { kind: 'verify' }, handoff: { result: 'critical' } }), [{ kind: 'verdict', result: 'critical' }]);
  assert.deepEqual(productOf({ step: { kind: 'archive' }, before: { change: 'x' }, branch: { kind: 'active', change: 'x' } }), []);
  assert.deepEqual(productOf({ step: { kind: 'archive' }, before: { change: 'x' }, branch: { kind: 'archived', change: 'x' } }), [{ kind: 'archive' }]);
  assert.deepEqual(productOf({ step: { kind: 'update' }, before: { git: 'a' }, git: { signature: 'a' } }), []);
  assert.deepEqual(productOf({ step: { kind: 'wiki' }, before: { git: 'a' }, git: { signature: 'b' } }), [{ kind: 'files' }]);
  assert.deepEqual(productOf({ step: { kind: 'review' } }), []);
});

test('the review queue and what goes to the stage for each product', async () => {
  const { reviewQueue, stagePaths } = await load('product.mjs');
  const products = [{ kind: 'change', change: 'x' }, { kind: 'artifact', id: 'proposal', paths: ['/p/proposal.md'] }, { kind: 'artifact', id: 'specs', paths: ['/p/specs/a/spec.md'] }];
  assert.deepEqual(reviewQueue(products, { kind: 'new' }).map((q) => q.step), [{ kind: 'review', id: 'proposal', of: 'artifact' }, { kind: 'review', id: 'specs', of: 'artifact' }]);
  assert.deepEqual(reviewQueue([{ kind: 'tasks', ids: ['2', '3'], labels: ['1.2', '1.3'] }], { kind: 'task' }).map((q) => q.step), [{ kind: 'review', id: '2,3', label: '1.2, 1.3', of: 'task' }]);
  assert.deepEqual(reviewQueue([{ kind: 'files' }], { kind: 'update' }).map((q) => q.step), [{ kind: 'review', id: 'plan', of: 'plan' }]);
  assert.deepEqual(reviewQueue([{ kind: 'files' }], { kind: 'wiki' }), [], 'the wiki is not reviewed');
  assert.deepEqual(reviewQueue([{ kind: 'archive' }], { kind: 'archive' }), []);
  assert.deepEqual(stagePaths(products[1], { last: false, changeDir: '/p' }), ['/p/proposal.md', '/p/.openspec.yaml']);
  assert.equal(stagePaths(products[1], { last: true, changeDir: '/p' }), null, 'the last product takes everything (git add -A)');
  assert.equal(stagePaths({ kind: 'tasks', ids: ['1'] }, {}), null);
});

function repo() {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'autopilot-git-'));
  const git = (...args) => {
    const r = spawnSync('git', args, { cwd: dir, encoding: 'utf8' });
    if (r.status !== 0) throw new Error(r.stderr);
    return r.stdout;
  };
  git('init', '-q', '-b', 'main');
  git('config', 'user.email', 't@example.com');
  git('config', 'user.name', 'T');
  fs.writeFileSync(path.join(dir, 'a.txt'), 'a\n');
  git('add', '-A');
  git('commit', '-q', '-m', 'a');
  return { dir, git };
}

test('the verdict of a review, by git', async () => {
  const { gitState, stage, verdict } = await load('git.mjs');
  const { dir, git } = repo();
  try {
    fs.writeFileSync(path.join(dir, 'b.txt'), 'b\n');
    fs.writeFileSync(path.join(dir, 'c.txt'), 'c\n');
    await stage(dir, [path.join(dir, 'b.txt')]);
    const start = await gitState(dir);
    assert.deepEqual([start.staged, start.unstaged, start.clean], [true, true, false]);
    assert.equal(verdict(start, await gitState(dir)), 'continue', 'nothing changed');
    // A partial unstage: something is still staged
    fs.writeFileSync(path.join(dir, 'd.txt'), 'd\n');
    await stage(dir, [path.join(dir, 'd.txt')]);
    git('restore', '--staged', 'b.txt');
    assert.equal(verdict(start, await gitState(dir)), 'continue');
    // Everything out of the stage: ko
    git('restore', '--staged', '.');
    assert.equal(verdict(start, await gitState(dir)), 'ko');
    // The commit of what was staged, with other changes left out of it: ok
    await stage(dir, [path.join(dir, 'b.txt')]);
    git('commit', '-q', '-m', 'b');
    assert.equal(verdict(start, await gitState(dir)), 'ok');
    // An empty commit on a clean tree: ok
    await stage(dir);
    git('commit', '-q', '-m', 'rest');
    const clean = await gitState(dir);
    assert.equal(clean.clean, true);
    assert.equal(verdict(clean, await gitState(dir)), 'continue', 'a question in a review that started clean does not close it');
    git('commit', '-q', '--allow-empty', '-m', 'verify');
    assert.equal(verdict(clean, await gitState(dir)), 'ok');
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('the signature changes with any change of the repository', async () => {
  const { gitState } = await load('git.mjs');
  const { dir } = repo();
  try {
    const a = await gitState(dir);
    fs.writeFileSync(path.join(dir, 'a.txt'), 'a2\n');
    const b = await gitState(dir);
    fs.writeFileSync(path.join(dir, 'a.txt'), 'a3\n');
    const c = await gitState(dir);
    fs.writeFileSync(path.join(dir, 'new.txt'), 'x\n');
    const d = await gitState(dir);
    fs.writeFileSync(path.join(dir, 'new.txt'), 'y\n');
    const e = await gitState(dir);
    assert.equal(new Set([a, b, c, d, e].map((s) => s.signature)).size, 5);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('entering a session: its branch, or back to the previous window (D3 of autopilot-rama-por-sesion)', async () => {
  const { enterSession } = await load('screen.mjs');
  const target = { id: 'ses_op', dir: '/wt/x', branch: 'feature/x', archived: false };
  const base = { target, fromDir: '/clon', head: 'feature/x', clean: true, working: null, permanent: ['main'], origin: 'main' };
  // Another directory, already in its branch: a toast with the branch and the directory
  const other = enterSession(base);
  assert.equal(other.action, 'toast');
  assert.match(other.message, /feature\/x/);
  assert.match(other.message, /\/wt\/x/);
  // The same directory and its branch: nothing
  assert.deepEqual(enterSession({ ...base, fromDir: '/wt/x' }), { action: 'none' });
  assert.deepEqual(enterSession({ ...base, fromDir: null }), { action: 'none' });
  // The same directory, another branch: checkout of a temporary branch, or of the origin branch
  const same = { ...base, target: { ...target, dir: '/clon' }, fromDir: '/clon', head: 'main' };
  assert.deepEqual(enterSession(same), { action: 'checkout', branch: 'feature/x', via: 'switch' });
  assert.deepEqual(enterSession({ ...same, target: { ...same.target, branch: 'main' }, head: 'feature/x' }), { action: 'checkout', branch: 'main', via: 'origin' });
  // Another permanent branch: nothing but a toast
  const develop = enterSession({ ...same, target: { ...same.target, branch: 'develop' }, permanent: ['develop', 'main'] });
  assert.equal(develop.action, 'toast');
  assert.match(develop.message, /permanente/);
  // Dirty tree, or another session working: back, saying why
  const dirty = enterSession({ ...same, clean: false });
  assert.equal(dirty.action, 'back');
  assert.equal(dirty.reason, 'dirty');
  assert.match(dirty.message, /cambios sin commit/);
  assert.match(dirty.message, /commit/);
  assert.match(dirty.message, /worktree/);
  const working = enterSession({ ...same, working: 'Otra sesión' });
  assert.deepEqual([working.action, working.reason], ['back', 'working']);
  assert.match(working.message, /sesión trabajando/);
  // Archived sessions, or sessions without a working branch: nothing
  assert.deepEqual(enterSession({ ...same, target: { ...same.target, archived: true } }), { action: 'none' });
  assert.deepEqual(enterSession({ ...same, target: { ...same.target, branch: null } }), { action: 'none' });
});

test('entering a session with x-main-protected: a branch of x-main even with a dirty tree (D2 and D3 of checkout-al-cambiar-de-sesion)', async () => {
  const { enterSession } = await load('screen.mjs');
  const target = { id: 'ses_main', dir: '/clon', branch: 'main', archived: false };
  const base = { target, fromDir: '/clon', head: 'feature/x', clean: false, working: null, permanent: ['develop', 'main'], origin: 'main', protected: true };
  // The veto and a branch of x-main: checkout via "permanent", with a dirty tree and with another permanent branch
  assert.deepEqual(enterSession(base), { action: 'checkout', branch: 'main', via: 'permanent', carried: true });
  const develop = { ...base, target: { ...target, branch: 'develop' } };
  assert.deepEqual(enterSession(develop), { action: 'checkout', branch: 'develop', via: 'permanent', carried: true });
  // carried says whether there were uncommitted changes
  assert.deepEqual(enterSession({ ...develop, clean: true }), { action: 'checkout', branch: 'develop', via: 'permanent', carried: false });
  assert.deepEqual(enterSession({ ...base, clean: true }), { action: 'checkout', branch: 'main', via: 'permanent', carried: false });
  // Another session working: back, even with the veto
  const working = enterSession({ ...base, working: 'Otra sesión' });
  assert.deepEqual([working.action, working.reason], ['back', 'working']);
  assert.match(working.message, /sesión trabajando/);
  // A temporary branch with a dirty tree: back, as today
  const temporary = enterSession({ ...base, target: { ...target, branch: 'importar-datos' } });
  assert.deepEqual([temporary.action, temporary.reason], ['back', 'dirty']);
  // Already in the branch: nothing
  assert.deepEqual(enterSession({ ...base, head: 'main' }), { action: 'none' });
  // Without the veto (no key or any other value), the same outputs as today
  for (const p of [undefined, false, 'true', null]) {
    const noVeto = { ...base, protected: p };
    assert.deepEqual([enterSession(noVeto).action, enterSession(noVeto).reason], ['back', 'dirty']);
    assert.deepEqual(enterSession({ ...noVeto, clean: true }), { action: 'checkout', branch: 'main', via: 'origin' });
    const other = enterSession({ ...noVeto, clean: true, target: { ...target, branch: 'develop' } });
    assert.equal(other.action, 'toast');
    assert.match(other.message, /permanente/);
    assert.deepEqual(enterSession({ ...noVeto, clean: true, target: { ...target, branch: 'importar-datos' } }), { action: 'checkout', branch: 'importar-datos', via: 'switch' });
  }
});

test("the modal of `/new`: its options by the tree, and where it does not show (D4 of autopilot-rama-por-sesion)", async () => {
  const { newWindow, OPTION } = await load('screen.mjs');
  const operational = { id: 'ses_op', title: 'T', change: 'x', branch: 'feature/x' };
  const home = { type: 'home', location: { directory: '/clon' } };
  const clean = newWindow({ route: home, operational, temporary: true, clean: true });
  assert.equal(clean.action, 'modal');
  assert.deepEqual(clean.options, [OPTION.worktree, OPTION.origin]);
  assert.match(clean.message, /«T»/);
  assert.deepEqual(newWindow({ route: home, operational, temporary: true, clean: false }).options, [OPTION.worktree]);
  assert.deepEqual(OPTION.worktree.title, 'Crear un worktree nuevo');
  assert.deepEqual(OPTION.origin.title, 'Cambiar a la rama de origen');
  // A new session (no messages) too; a session with messages, the operational one, no operational session or a permanent branch, no
  assert.equal(newWindow({ route: { type: 'session', sessionID: 'ses_n' }, isNew: true, operational, temporary: true, clean: true }).action, 'modal');
  assert.deepEqual(newWindow({ route: { type: 'session', sessionID: 'ses_n' }, isNew: false, operational, temporary: true, clean: true }), { action: 'none' });
  assert.deepEqual(newWindow({ route: { type: 'session', sessionID: 'ses_op' }, isNew: true, routeIsOperational: true, operational, temporary: true, clean: true }), { action: 'none' });
  assert.deepEqual(newWindow({ route: home, operational: null, temporary: true, clean: true }), { action: 'none' });
  assert.deepEqual(newWindow({ route: home, operational, temporary: false, clean: true }), { action: 'none' });
});

test('the working branch of a session and a checkout inside it (D1 of autopilot-rama-por-sesion)', async () => {
  const { branchMoved, leftFrom, sessionDir } = await load('state.mjs');
  const owner = { v: 1, worktree: '/clon', branch: 'feature/x', role: 'owner', step: { kind: 'task', id: '3' } };
  assert.equal(branchMoved({ meta: owner, head: 'feature/x' }), null);
  assert.equal(branchMoved({ meta: owner, head: null }), null, 'a detached HEAD changes nothing');
  assert.equal(branchMoved({ meta: null, head: 'main' }), null);
  // The operational session leaves its branch: free, not archived, remembering the branch it left
  assert.deepEqual(branchMoved({ meta: owner, head: 'main' }), { branch: 'main', role: 'free', phase: 'left', leftFrom: 'feature/x', resumed: false });
  // Another session just follows its branch
  assert.deepEqual(branchMoved({ meta: { ...owner, role: 'free' }, head: 'main' }), { branch: 'main' });
  // A checkout made by the plugin does not count
  assert.equal(branchMoved({ meta: owner, head: 'main', pluginCheckout: { from: 'feature/x', to: 'main' } }), null);
  assert.deepEqual(branchMoved({ meta: owner, head: 'main', pluginCheckout: { from: 'otra', to: 'main' } }).role, 'free');
  // The sessions a branch resumes when the directory goes back to it
  const s = (id, m) => ({ id, metadata: { openspec: { v: 1, ...m } } });
  const sessions = [s('a', { worktree: '/clon', leftFrom: 'feature/x', resumed: false }), s('b', { worktree: '/clon', leftFrom: 'feature/x', resumed: true }), s('c', { worktree: '/wt', leftFrom: 'feature/x' })];
  assert.deepEqual(leftFrom(sessions, { worktree: '/clon', branch: 'feature/x' }).map((x) => x.id), ['a']);
  assert.equal(sessionDir({ location: { directory: '/wt' }, metadata: { openspec: { worktree: '/clon' } } }), '/wt');
  assert.equal(sessionDir({ metadata: { openspec: { worktree: '/clon' } } }), '/clon');
});

// D1 of autopilot-rama-por-sesion: the first metadata of a session. The TUI's
// screen read the session before it had any, and meanwhile the prompt hook of
// `autopilot` made it the owner; the screen's write must not leave it free.
test('the first metadata does not overwrite an owner written in the meantime', async () => {
  const { firstMeta, meta, KEY } = await load('state.mjs');
  const owner = { v: 1, worktree: '/p', branch: 'feature/x', role: 'owner', step: { kind: 'new' }, seq: 1, phase: 'running' };
  const store = { id: 'ses_1', metadata: {} };
  const api = {
    get: async () => structuredClone(store),
    update: async ({ metadata }) => {
      store.metadata = structuredClone(metadata);
    },
  };
  const stale = structuredClone(store);
  // The concurrent prompt hook takes control
  store.metadata = { [KEY]: owner };
  const written = await firstMeta(api, stale, { worktree: '/p', branch: 'feature/x' });
  assert.deepEqual(meta(store), owner);
  assert.deepEqual(written, owner);

  // A session that still has none gets its working branch, free
  const fresh = { id: 'ses_2', metadata: {} };
  const api2 = { get: async () => structuredClone(fresh), update: async ({ metadata }) => { fresh.metadata = structuredClone(metadata); } };
  await firstMeta(api2, structuredClone(fresh), { worktree: '/p', branch: 'feature/x' });
  assert.deepEqual(meta(fresh), { v: 1, worktree: '/p', branch: 'feature/x', role: 'free' });
});
