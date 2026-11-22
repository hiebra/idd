'use strict';

// Core tests of the git helpers of support/branches.js that the scenarios of
// manage-git-discipline use (task 1.2): a bare remote with push and fetch,
// remote branches ahead of the local one or diverged from it, a squash
// merge, shallow clones with or without their remote, and the environment of
// an ephemeral container.
//
// Run with: npm run test:core

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { git } = require('../support/engine');
const branches = require('../support/branches');

// A minimal project, with the shape of support/project.js's copy
function project(t) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'branches-support-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const dir = path.join(root, 'project');
  fs.mkdirSync(path.join(dir, 'openspec', 'changes', 'archive'), { recursive: true });
  fs.writeFileSync(path.join(dir, 'openspec', 'changes', 'archive', '.keep'), '');
  git(dir, 'init', '-q', '-b', 'main');
  git(dir, 'add', '-A');
  git(dir, 'commit', '-q', '-m', 'inicio');
  return { dir, path: (...parts) => path.join(dir, ...parts) };
}

const isAncestor = (p, a, b) => spawnSync('git', ['merge-base', '--is-ancestor', a, b], { cwd: p.dir }).status === 0;

test('a bare remote with push and fetch', (t) => {
  const p = project(t);
  branches.addRemote(p);
  assert.equal(branches.revParse(p, 'refs/remotes/origin/main'), branches.revParse(p, 'refs/heads/main'));
  branches.branch(p, 'claude/x');
  branches.addRemote(p, { push: ['claude/x'] });
  assert.ok(branches.revParse(p, 'refs/remotes/origin/claude/x'));
});

test('a remote branch ahead of the local one, and one that diverged', (t) => {
  const p = project(t);
  const local = branches.revParse(p, 'main');
  const remote = branches.remoteCommit(p, { 'openspec/changes/archive/2026-11-21-importar-datos/proposal.md': 'x\n' });
  assert.equal(branches.revParse(p, 'main'), local, 'the local branch does not move');
  assert.ok(isAncestor(p, 'main', 'origin/main'));
  assert.equal(git(p.dir, 'show', `${remote}:openspec/changes/archive/2026-11-21-importar-datos/proposal.md`), 'x\n');
  fs.writeFileSync(p.path('local.txt'), 'local\n');
  branches.commitAll(p, 'local');
  assert.ok(!isAncestor(p, 'main', 'origin/main') && !isAncestor(p, 'origin/main', 'main'), 'diverged');
});

test('a squash merge brings the content but not the commits', (t) => {
  const p = project(t);
  branches.branch(p, 'feature/x');
  fs.writeFileSync(p.path('a.txt'), 'a\n');
  branches.commitAll(p, 'a');
  branches.squashMerge(p, 'feature/x');
  assert.equal(branches.currentBranch(p), 'feature/x');
  assert.equal(git(p.dir, 'show', 'main:a.txt'), 'a\n');
  assert.ok(!isAncestor(p, 'feature/x', 'main'));
});

test('a shallow clone, with and without access to its remote', (t) => {
  const p = project(t);
  branches.makeShallow(p);
  assert.equal(branches.isShallow(p), true);
  git(p.dir, 'fetch', '-q', '--unshallow');
  assert.equal(branches.isShallow(p), false);

  const q = project(t);
  branches.makeShallow(q, { reachable: false });
  assert.equal(branches.isShallow(q), true);
  assert.throws(() => git(q.dir, 'fetch', '-q', '--unshallow'));
});

test('the environment of an ephemeral container, whatever the machine', () => {
  const base = { PATH: '/bin', CLAUDE_CODE_CONTAINER_ID: 'real', CLAUDE_CODE_REMOTE: 'true' };
  assert.deepEqual(branches.sessionEnv({ base }), { PATH: '/bin' });
  assert.deepEqual(branches.sessionEnv({ ephemeral: true, base }), { PATH: '/bin', ...branches.EPHEMERAL_ENV });
});

test('the session branch in the local git config', (t) => {
  const p = project(t);
  assert.equal(branches.sessionBranch(p), null);
  branches.setSessionBranch(p, 'claude/x');
  assert.equal(branches.sessionBranch(p), 'claude/x');
  branches.setSessionBranch(p, null);
  assert.equal(branches.sessionBranch(p), null);
});
