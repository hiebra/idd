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

test('x-main-protected set to true or false, or removed, without touching x-main', (t) => {
  const p = project(t);
  fs.mkdirSync(p.path('openspec'), { recursive: true });
  fs.writeFileSync(p.path('openspec', 'config.yaml'), 'schema: intent-driven\nx-main: [main]\n');
  const read = () => fs.readFileSync(p.path('openspec', 'config.yaml'), 'utf8');
  branches.setProtected(p, true);
  assert.match(read(), /^x-main-protected: true$/m);
  branches.setProtected(p, false);
  assert.match(read(), /^x-main-protected: false$/m);
  assert.doesNotMatch(read(), /x-main-protected: true/);
  branches.setProtected(p, null);
  assert.doesNotMatch(read(), /x-main-protected/);
  assert.match(read(), /^x-main: \[main\]$/m);
  assert.equal(git(p.dir, 'status', '--porcelain').trim(), '');
});

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

// --- Merges (allow-user-requested-merges, task 1.2) ---

test('a merge in progress of origin/main, with conflicts unresolved, resolved, or resolved with a marker', (t) => {
  const p = project(t);
  branches.addRemote(p);
  branches.branch(p, 'claude/x');
  const conflicted = branches.mergeInProgress(p, { touches: ['src/a.js', 'openspec/b.md'], conflicts: ['src/a.js'] });
  assert.deepEqual(conflicted, ['src/a.js']);
  assert.ok(branches.revParse(p, 'MERGE_HEAD'));
  branches.resolveConflict(p, 'src/a.js');
  assert.deepEqual(branches.unresolved(p), []);
  assert.doesNotMatch(fs.readFileSync(p.path('src/a.js'), 'utf8'), /^(<{7}|={7}|>{7})/m);
  branches.resolveConflict(p, 'src/a.js', { marker: '<<<<<<<' });
  assert.match(fs.readFileSync(p.path('src/a.js'), 'utf8'), /^<{7} HEAD$/m);
  assert.deepEqual(branches.unresolved(p), []);

  const q = project(t);
  branches.addRemote(q);
  branches.branch(q, 'claude/x');
  assert.deepEqual(branches.mergeInProgress(q, { touches: ['src/a.js'] }), [], 'without conflicts the merge stays in progress');
  assert.ok(branches.revParse(q, 'MERGE_HEAD'));
});

test('a temporary branch that contains origin/<branch>, and origin/<branch> that contains it', (t) => {
  const p = project(t);
  git(p.dir, 'branch', 'develop');
  branches.addRemote(p, { push: ['main', 'develop'] });
  branches.branch(p, 'feature/x');
  fs.writeFileSync(p.path('x.txt'), 'x\n');
  branches.commitAll(p, 'x');
  branches.remoteCommit(p, { 'r.txt': 'r\n' });
  assert.ok(!branches.contains(p, 'HEAD', 'origin/main'));
  branches.bringIn(p, 'origin/main');
  assert.ok(branches.contains(p, 'HEAD', 'origin/main'));
  assert.ok(!branches.contains(p, 'origin/develop', 'feature/x'));
  const merge = branches.mergeIntoRemote(p, 'feature/x', 'develop');
  assert.equal(branches.revParse(p, 'refs/remotes/origin/develop'), merge);
  assert.ok(branches.contains(p, 'origin/develop', 'feature/x'));
  assert.equal(git(p.dir, 'rev-parse', `${merge}^1`).trim(), branches.revParse(p, 'refs/heads/develop'));
});

test('branch-change.mjs run inside an ephemeral container or outside one', async (t) => {
  const { REPO_ROOT } = require('../support/project');
  const p = project(t);
  const script = ['.agents', 'skills', 'openspec-git-discipline', 'scripts', 'branch-change.mjs'];
  fs.mkdirSync(path.dirname(p.path(...script)), { recursive: true });
  fs.copyFileSync(path.join(REPO_ROOT, ...script), p.path(...script));
  branches.commitAll(p, 'branch-change');
  const env = branches.runBranchChange(p, ['env']);
  assert.match(env.stdout, /ephemeral=false/);
  assert.match(branches.runBranchChange(p, ['env'], { ephemeral: true }).stdout, /ephemeral=true/);
  const gate = branches.checkGate(p, 'commit', null, { ephemeral: false });
  assert.equal(gate.ok, false);
  assert.equal(gate.exitCode, 1);
  const started = branches.startBranch(p, 'exportar-datos');
  assert.equal(started.exitCode, 0, started.stdout);
  assert.equal(branches.currentBranch(p), 'exportar-datos');
  const merge = branches.checkGate(p, 'merge', 'exportar-datos', { args: ['main'] });
  assert.equal(typeof merge.ok, 'boolean', 'check merge <target> <permanent> gives { ok, message }');
  assert.equal(typeof merge.message, 'string');
  const targets = branches.mergeTargets(p, { ephemeral: true });
  assert.deepEqual(targets.targets, [], 'merge-targets --json from a temporary branch without origin');
  const switched = branches.switchBranch(p, 'no-existe');
  assert.equal(switched.exitCode, 1);
  assert.equal(switched.json.ok, false);
});
