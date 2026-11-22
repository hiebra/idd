'use strict';

// Core tests of branch-change.mjs (of the openspec-git-discipline skill) outside the specs (tasks
// 3.1 and 3.3 of add-openspec-autopilot): an `x-main` of another shape is
// treated as absent and warned about, the origin branch may exist only as
// origin/<branch>, and without it the branch's change is unknown.
//
// Run with: npm run test:core

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { git } = require('../support/engine');
const { REPO_ROOT } = require('../support/project');

const MODULE = pathToFileURL(path.join(REPO_ROOT, '.agents', 'skills', 'openspec-git-discipline', 'scripts', 'branch-change.mjs')).href;

function repo(t, config = 'schema: intent-driven\n') {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'branch-change-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  fs.mkdirSync(path.join(dir, 'openspec', 'changes', 'archive'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'openspec', 'config.yaml'), config);
  fs.writeFileSync(path.join(dir, 'openspec', 'changes', 'archive', '.keep'), '');
  git(dir, 'init', '-q', '-b', 'main');
  git(dir, 'add', '-A');
  git(dir, 'commit', '-q', '-m', 'inicio');
  return dir;
}

test('x-main as a list of plain scalars, in flow or block form', async () => {
  const { parsePermanent } = await import(MODULE);
  assert.deepEqual(parsePermanent('x-main: [main, develop]\n').permanent, ['main', 'develop']);
  assert.deepEqual(parsePermanent("x-main: ['main', \"release/2\"] # comentario\n").permanent, ['main', 'release/2']);
  assert.deepEqual(parsePermanent('schema: x\nx-main:\n  - main\n  # nota\n  - develop\nrules: {}\n').permanent, ['main', 'develop']);
  assert.deepEqual(parsePermanent('schema: x\n'), { permanent: null, warning: null });
});

test('x-main of another shape is treated as absent, with a warning', async (t) => {
  const { parsePermanent, branchChange } = await import(MODULE);
  for (const text of ['x-main: main\n', 'x-main: []\n', 'x-main: {a: 1}\n', 'x-main: [main, {a: 1}]\n', 'x-main:\n  a: b\n', 'x-main: [main\n']) {
    const parsed = parsePermanent(text);
    assert.equal(parsed.permanent, null, text);
    assert.match(parsed.warning, /x-main/, text);
  }
  const dir = repo(t, 'schema: intent-driven\nx-main: develop\n');
  const state = branchChange(dir);
  assert.deepEqual(state.permanent, ['main']);
  assert.equal(state.kind, 'permanent');
  assert.match(state.warnings.join('\n'), /x-main/);
});

test('the origin branch only as origin/<branch>', async (t) => {
  const { branchChange } = await import(MODULE);
  const dir = repo(t);
  git(dir, 'update-ref', 'refs/remotes/origin/main', 'HEAD');
  git(dir, 'checkout', '-q', '-b', 'feature/x');
  git(dir, 'branch', '-D', 'main');
  fs.mkdirSync(path.join(dir, 'openspec', 'changes', 'exportar-datos'));
  fs.writeFileSync(path.join(dir, 'openspec', 'changes', 'exportar-datos', 'proposal.md'), 'x\n');
  const state = branchChange(dir);
  assert.equal(state.kind, 'active', JSON.stringify(state));
  assert.equal(state.change, 'exportar-datos');
});

test('without the origin branch the change is unknown', async (t) => {
  const { branchChange, check } = await import(MODULE);
  const dir = repo(t, 'schema: intent-driven\nx-main: [main, develop]\n');
  git(dir, 'checkout', '-q', '-b', 'feature/x');
  const state = branchChange(dir);
  assert.equal(state.kind, 'unknown', JSON.stringify(state));
  assert.match(state.warnings.join('\n'), /develop/);
  assert.equal(check(dir, 'apply', 'exportar-datos').ok, false);
});

test('a change deleted in the branch does not count, and an archived one stops being in progress', async (t) => {
  const { branchChange } = await import(MODULE);
  const dir = repo(t);
  fs.mkdirSync(path.join(dir, 'openspec', 'changes', 'viejo'));
  fs.writeFileSync(path.join(dir, 'openspec', 'changes', 'viejo', 'proposal.md'), 'x\n');
  git(dir, 'add', '-A');
  git(dir, 'commit', '-q', '-m', 'viejo en main');
  git(dir, 'checkout', '-q', '-b', 'feature/x');
  fs.rmSync(path.join(dir, 'openspec', 'changes', 'viejo'), { recursive: true });
  assert.equal(branchChange(dir).kind, 'none');
});

// --- list, start and switch (autopilot-sesion-operativa, design D12, ADR-0013) ---

function addChange(dir, name) {
  fs.mkdirSync(path.join(dir, 'openspec', 'changes', name), { recursive: true });
  fs.writeFileSync(path.join(dir, 'openspec', 'changes', name, '.openspec.yaml'), 'schema: intent-driven\n');
  git(dir, 'add', '-A');
  git(dir, 'commit', '-q', '-m', name);
}

test('start: the change branch always comes out of the origin branch, with the change name', async (t) => {
  const { startBranch } = await import(MODULE);
  const dir = repo(t);
  const origin = git(dir, 'rev-parse', 'main').trim();
  git(dir, 'checkout', '-q', '-b', 'otra');
  addChange(dir, 'otra');
  assert.equal(startBranch(dir, 'Exportar Datos').ok, false, 'not kebab-case');
  assert.equal(startBranch(dir, 'main').ok, false, 'a permanent branch');
  const created = startBranch(dir, 'exportar-datos');
  assert.equal(created.ok, true, created.message);
  assert.equal(git(dir, 'symbolic-ref', '--short', 'HEAD').trim(), 'exportar-datos');
  assert.equal(git(dir, 'rev-parse', 'HEAD').trim(), origin);
  assert.match(startBranch(dir, 'exportar-datos').message, /ya existe/);
  fs.writeFileSync(path.join(dir, 'sucio.txt'), 'x');
  const dirty = startBranch(dir, 'otro-cambio');
  assert.equal(dirty.ok, false);
  assert.match(dirty.message, /stash/);
});

test('start: from origin/<branch> when the origin branch is only remote', async (t) => {
  const { startBranch } = await import(MODULE);
  const dir = repo(t);
  git(dir, 'update-ref', 'refs/remotes/origin/main', 'main');
  git(dir, 'checkout', '-q', '-b', 'temporal');
  git(dir, 'branch', '-q', '-D', 'main');
  const created = startBranch(dir, 'exportar-datos');
  assert.equal(created.ok, true, created.message);
  assert.equal(git(dir, 'rev-parse', 'HEAD').trim(), git(dir, 'rev-parse', 'origin/main').trim());
});

test('list: the temporary branches with their change; switch: only to an existing temporary branch', async (t) => {
  const { listBranches, switchBranch } = await import(MODULE);
  const dir = repo(t);
  git(dir, 'checkout', '-q', '-b', 'exportar-datos');
  addChange(dir, 'exportar-datos');
  git(dir, 'checkout', '-q', '-b', 'dos', 'main');
  addChange(dir, 'uno');
  addChange(dir, 'dos');
  git(dir, 'checkout', '-q', '-b', 'vacia', 'main');
  git(dir, 'checkout', '-q', 'main');
  const list = listBranches(dir);
  const by = Object.fromEntries(list.map((b) => [b.branch, b]));
  assert.deepEqual(Object.keys(by).sort(), ['dos', 'exportar-datos', 'vacia']);
  assert.deepEqual([by['exportar-datos'].kind, by['exportar-datos'].change], ['active', 'exportar-datos']);
  assert.equal(by.dos.kind, 'several');
  assert.deepEqual([by.vacia.kind, by.vacia.change], ['none', null]);
  assert.equal(switchBranch(dir, 'main').ok, false);
  assert.equal(switchBranch(dir, 'no-existe').ok, false);
  const switched = switchBranch(dir, 'exportar-datos');
  assert.equal(switched.ok, true, switched.message);
  assert.equal(listBranches(dir).find((b) => b.current).branch, 'exportar-datos');
});
