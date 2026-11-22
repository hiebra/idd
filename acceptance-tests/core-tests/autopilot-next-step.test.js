'use strict';

// Core tests of the plugin's pure step logic, lib/next-step.mjs (task 6.1 of
// add-openspec-autopilot, design D6 and D11): artifacts from `openspec
// status`, tasks from the CLI (or tasks.md), verify, archive, wiki and the
// end of the cycle, in both modes, with the zone changes, the waits for the
// user's commit and the discrepancies with `openspec status`
// (autopilot-sesion-operativa, design D5, D9 to D11).
//
// Run with: npm run test:core

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { REPO_ROOT } = require('../support/project');

const MODULE = pathToFileURL(path.join(REPO_ROOT, '.opencode', 'plugins', 'openspec-autopilot', 'lib', 'next-step.mjs')).href;

const status = (ready, complete = false) => ({
  isPlanningComplete: complete,
  artifacts: ['proposal', 'specs', 'design', 'adr', 'tasks'].map((id) => ({ id, status: id === ready ? 'ready' : 'done' })),
});
const planned = (tasks) => ({ change: 'x', status: status(null, true), tasks });

test('tasks: the id is the CLI\'s (in order) and the label, the number in tasks.md', async () => {
  const { parseTasks, taskFromCli } = await import(MODULE);
  assert.deepEqual(parseTasks('## 1. A\n\n- [x] 1.1 Hecha\n- [ ] 1.2 Pendiente\n  - [ ] 1.3. Anidada\nTexto - [ ] no\n- [ ] Sin número\n'), [
    { id: '1', label: '1.1', done: true },
    { id: '2', label: '1.2', done: false },
    { id: '3', label: '1.3', done: false },
    { id: '4', label: '4', done: false },
  ]);
  assert.deepEqual(taskFromCli({ id: '2', description: '1.2 En `x`, según D3:', done: false }), { id: '2', label: '1.2', done: false });
});

test('taking control follows the state of the change', async () => {
  const { next } = await import(MODULE);
  assert.deepEqual(next({ state: { change: null } }).step, { kind: 'new' });
  assert.deepEqual(next({ state: { change: 'x', status: status('design'), tasks: [] } }).step, { kind: 'artifact', id: 'design' });
  assert.deepEqual(next({ state: { change: 'x', status: { isComplete: false, artifacts: [{ id: 'specs', status: 'ready' }] } } }).step, { kind: 'artifact', id: 'specs' }, 'older CLIs say isComplete');
  assert.deepEqual(next({ state: planned([{ id: '1', label: '1.1', done: true }, { id: '2', label: '1.2', done: false }]) }).step, { kind: 'task', id: '2', label: '1.2' });
  assert.deepEqual(next({ state: planned([{ id: '1.1', done: true }]) }).step, { kind: 'verify' });
  assert.deepEqual(next({ state: { change: 'x', status: { isPlanningComplete: false, artifacts: [{ id: 'specs', status: 'blocked' }] } } }).step, { kind: 'blocked' });
});

test('normal mode: the review is opened by the server; after it, git decides', async () => {
  const { next } = await import(MODULE);
  const state = { change: 'x', status: status('adr'), tasks: [] };
  // After a step, the next one by `openspec status` (the server opens the reviews first)
  assert.deepEqual(next({ mode: 'normal', finished: { kind: 'artifact', id: 'design' }, state }).step, { kind: 'artifact', id: 'adr' });
  assert.deepEqual(next({ mode: 'normal', finished: { kind: 'verify' }, result: 'clean', state }).step, { kind: 'review', id: 'verify', of: 'verify' });
  assert.deepEqual(next({ mode: 'normal', finished: { kind: 'review', id: 'design', of: 'artifact' }, result: 'ok', state }).step, { kind: 'artifact', id: 'adr' });
  assert.deepEqual(next({ mode: 'normal', finished: { kind: 'review', id: '3', of: 'task' }, result: 'ko', state }).step, { kind: 'update', id: '3', of: 'task' });
  assert.deepEqual(next({ mode: 'normal', finished: { kind: 'update', id: '3', of: 'task' }, state }).step, { kind: 'review', id: 'plan', of: 'plan' });
  assert.deepEqual(next({ mode: 'normal', finished: { kind: 'review', id: 'plan', of: 'plan' }, result: 'ok', state: planned([{ id: '3', done: false }]) }).step, { kind: 'task', id: '3', label: '3' });
  assert.deepEqual(next({ mode: 'normal', finished: { kind: 'review', id: 'verify', of: 'verify' }, result: 'ok', state }).step, { kind: 'archive' });
  assert.deepEqual(next({ mode: 'normal', finished: { kind: 'review', id: 'verify', of: 'verify' }, result: 'ko', state }).step, { kind: 'update', id: 'verify', of: 'verify' });
});

test('auto mode: no reviews; the verify goes to the archive unless it has critical problems', async () => {
  const { next } = await import(MODULE);
  const state = { change: 'x', status: status('adr'), tasks: [] };
  assert.deepEqual(next({ mode: 'auto', finished: { kind: 'artifact', id: 'design' }, state }).step, { kind: 'artifact', id: 'adr' });
  assert.deepEqual(next({ mode: 'auto', finished: { kind: 'task', id: '1' }, state: planned([{ id: '1', done: true }, { id: '2', done: false }]) }).step, { kind: 'task', id: '2', label: '2' });
  assert.deepEqual(next({ mode: 'auto', finished: { kind: 'task', id: '2' }, state: planned([{ id: '1', done: true }, { id: '2', done: true }]) }).step, { kind: 'verify' });
  assert.deepEqual(next({ mode: 'auto', finished: { kind: 'verify' }, result: 'clean', state }).step, { kind: 'archive' });
  assert.deepEqual(next({ mode: 'auto', finished: { kind: 'verify' }, result: 'critical', state }).step, { kind: 'review', id: 'verify', of: 'verify' });
});

test('after the archive the wiki, and after the wiki the end of the cycle', async () => {
  const { next } = await import(MODULE);
  for (const mode of ['normal', 'auto']) {
    assert.deepEqual(next({ mode, finished: { kind: 'archive' } }).step, { kind: 'wiki' });
    assert.deepEqual(next({ mode, finished: { kind: 'wiki' } }).step, { kind: 'end' });
    assert.deepEqual(next({ mode, finished: { kind: 'new' }, state: { change: 'x', status: status('proposal'), tasks: [] } }).step, { kind: 'artifact', id: 'proposal' });
  }
});

test('zone changes: from the plan to the tasks, from the tasks to the archive and from the archive to the wiki', async () => {
  const { next, zoneOf } = await import(MODULE);
  assert.equal(zoneOf({ kind: 'artifact' }), 'specs');
  assert.equal(zoneOf({ kind: 'task' }), 'code');
  assert.equal(zoneOf({ kind: 'verify' }), null);
  assert.equal(zoneOf({ kind: 'review' }), null);
  // From the last artifact to the first task
  assert.equal(next({ mode: 'auto', finished: { kind: 'artifact', id: 'tasks' }, state: planned([{ id: '1', done: false }]), lastZone: 'specs' }).zoneChange, true);
  // Within the plan
  assert.equal(next({ mode: 'auto', finished: { kind: 'artifact', id: 'specs' }, state: { change: 'x', status: status('design'), tasks: [] }, lastZone: 'specs' }).zoneChange, false);
  // Within the tasks
  assert.equal(next({ mode: 'auto', finished: { kind: 'task', id: '1' }, state: planned([{ id: '1', done: true }, { id: '2', done: false }]), lastZone: 'code' }).zoneChange, false);
  // From the tasks to the archive, through the verify, which does not write
  assert.equal(next({ mode: 'auto', finished: { kind: 'task', id: '2' }, state: planned([{ id: '2', done: true }]), lastZone: 'code' }).zoneChange, false);
  assert.equal(next({ mode: 'auto', finished: { kind: 'verify' }, result: 'clean', lastZone: 'code' }).zoneChange, true);
  // From the archive to the wiki
  assert.equal(next({ mode: 'auto', finished: { kind: 'archive' }, lastZone: 'specs' }).zoneChange, true);
});

test('waits for the user\'s commit: after the archive and the wiki, and in auto mode at a zone change', async () => {
  const { waitsForCommit } = await import(MODULE);
  for (const mode of ['normal', 'auto']) {
    assert.equal(waitsForCommit({ mode, finished: { kind: 'archive' }, step: { kind: 'wiki' } }), true);
    assert.equal(waitsForCommit({ mode, finished: { kind: 'wiki' }, step: { kind: 'end' } }), true);
    assert.equal(waitsForCommit({ mode, finished: { kind: 'review' }, step: { kind: 'update' }, zoneChange: true }), false, 'update-change starts with the tree dirty on purpose');
  }
  assert.equal(waitsForCommit({ mode: 'auto', finished: { kind: 'artifact' }, step: { kind: 'task' }, zoneChange: true }), true);
  assert.equal(waitsForCommit({ mode: 'auto', finished: { kind: 'artifact' }, step: { kind: 'artifact' }, zoneChange: false }), false);
  assert.equal(waitsForCommit({ mode: 'normal', finished: { kind: 'review' }, step: { kind: 'task' }, zoneChange: true }), false);
});

test('a stopped step that does not fit `openspec status` is a discrepancy, unless its product exists', async () => {
  const { discrepancy } = await import(MODULE);
  const state = { change: 'x', status: { isPlanningComplete: false, artifacts: [{ id: 'proposal', status: 'done' }, { id: 'specs', status: 'ready' }, { id: 'design', status: 'ready' }, { id: 'tasks', status: 'blocked' }] }, tasks: [] };
  assert.deepEqual(discrepancy({ kind: 'artifact', id: 'tasks' }, state), { expected: { kind: 'artifact', id: 'specs' } });
  assert.equal(discrepancy({ kind: 'artifact', id: 'specs' }, state), null);
  assert.equal(discrepancy({ kind: 'artifact', id: 'proposal' }, state), null, 'its product exists');
  assert.equal(discrepancy({ kind: 'review', id: 'design', of: 'artifact' }, state), null, 'only new, artifact and task are checked');
  const tasks = planned([{ id: '1', done: true }, { id: '2', done: false }, { id: '3', done: false }]);
  assert.equal(discrepancy({ kind: 'task', id: '2' }, tasks), null);
  assert.equal(discrepancy({ kind: 'task', id: '1' }, tasks), null);
  assert.deepEqual(discrepancy({ kind: 'task', id: '3' }, tasks), { expected: { kind: 'task', id: '2', label: '2' } });
});
