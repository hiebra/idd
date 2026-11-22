'use strict';

// Core tests of the plugin's pure logic added by autopilot-sesion-operativa:
// the evaluable product (lib/product.mjs, design D7), the review verdict by
// git (lib/git.mjs, D8, with real repositories) and what the TUI does with
// each screen (lib/screen.mjs, D4).
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

test('what the TUI does with each screen', async () => {
  const { directive, modalText } = await load('screen.mjs');
  const op = { id: 'ses_op', title: 'artefacto design de x', change: 'x' };
  assert.deepEqual(directive({ route: { type: 'home' }, operational: null }), { action: 'none' });
  assert.deepEqual(directive({ route: { type: 'home' }, operational: op }), { action: 'modal', sessionID: 'ses_op', title: op.title, change: 'x' });
  assert.deepEqual(directive({ route: { type: 'session', sessionID: 'ses_op' }, operational: op }), { action: 'validate' });
  assert.deepEqual(directive({ route: { type: 'session', sessionID: 'ses_old' }, operational: op, routeSession: { id: 'ses_old', archived: true } }), { action: 'none' });
  assert.equal(directive({ route: { type: 'session', sessionID: 'ses_free' }, operational: op, routeSession: { id: 'ses_free', archived: false } }).action, 'modal');
  // The step that has just handed over, before the plugin navigates away from it and archives it
  assert.deepEqual(directive({ route: { type: 'session', sessionID: 'ses_done' }, operational: op, routeSession: { id: 'ses_done', archived: false, meta: { role: 'free', phase: 'done' } } }), { action: 'none' });
  assert.equal(modalText({ change: 'x', title: 'T' }), 'Mientras se edita el change x en modo autopilot, solo se puede operar con su sesión operativa «T».');
});
