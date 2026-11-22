'use strict';

// Core tests of prepareGit in .agents/hooks/session-bootstrap.mjs (task 4.1
// of manage-git-discipline, design D5), on test repositories: a shallow clone
// is completed, a permanent branch that is behind and not checked out is
// moved forward with update-ref, the checked-out one is left alone, a
// diverged one is warned about, without a remote it warns and exits with 0,
// and only an ephemeral container saves idd.sessionBranch, keeping one that
// is already saved.
//
// The core runs with node and git but without npm, so it installs nothing.
//
// Run with: npm run test:core

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { git } = require('../support/engine');
const { REPO_ROOT } = require('../support/project');
const { sessionEnv } = require('../support/branches');

const { runCore } = require('../support/core');
const MODULE = path.join('.agents', 'openspec', 'branch-change.mjs');

function root(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'prepare-git-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const bin = path.join(dir, 'bin');
  fs.mkdirSync(bin);
  fs.symlinkSync(process.execPath, path.join(bin, 'node'));
  return { dir, bin };
}

// A remote with two commits on main, and a clone of it in `project`
function setup(t, { depth = null } = {}) {
  const r = root(t);
  const seed = path.join(r.dir, 'seed');
  fs.mkdirSync(path.join(seed, '.agents', 'openspec'), { recursive: true });
  fs.copyFileSync(path.join(REPO_ROOT, MODULE), path.join(seed, MODULE));
  fs.mkdirSync(path.join(seed, 'openspec'));
  fs.writeFileSync(path.join(seed, 'openspec', 'config.yaml'), 'schema: intent-driven\n');
  git(seed, 'init', '-q', '-b', 'main');
  git(seed, 'add', '-A');
  git(seed, 'commit', '-q', '-m', 'uno');
  git(seed, 'commit', '-q', '--allow-empty', '-m', 'dos');
  const remote = path.join(r.dir, 'remote.git');
  git(r.dir, 'clone', '-q', '--bare', seed, remote);
  const project = path.join(r.dir, 'project');
  git(r.dir, 'clone', '-q', ...(depth ? ['--depth', String(depth)] : []), `file://${remote}`, project);
  return { ...r, remote, project };
}

// A new commit on the remote's main, fetched into the project
function advanceRemote(s) {
  const other = path.join(s.dir, `otro-${Date.now()}`);
  git(s.dir, 'clone', '-q', `file://${s.remote}`, other);
  git(other, 'commit', '-q', '--allow-empty', '-m', 'remoto');
  git(other, 'push', '-q', 'origin', 'HEAD:main');
  git(s.project, 'fetch', '-q', 'origin');
}

function rev(dir, ref) {
  return git(dir, 'rev-parse', ref).trim();
}

function run(s, { ephemeral = false } = {}) {
  const env = sessionEnv({ ephemeral });
  for (const key of Object.keys(env)) if (/^GIT_/.test(key)) delete env[key];
  env.PATH = [s.bin, '/usr/bin', '/bin'].join(path.delimiter);
  const result = runCore([s.project], { env, encoding: 'utf8', timeout: 120000 });
  return { status: result.status, warnings: (result.stderr ?? '').split('\n').filter((l) => l.startsWith('session-start:')).join('\n') };
}

function sessionBranch(dir) {
  const result = spawnSync('git', ['config', '--get', 'idd.sessionBranch'], { cwd: dir, encoding: 'utf8' });
  return result.status === 0 ? result.stdout.trim() : null;
}

test('a shallow clone is completed', (t) => {
  const s = setup(t, { depth: 1 });
  assert.equal(git(s.project, 'rev-parse', '--is-shallow-repository').trim(), 'true');
  const result = run(s);
  assert.equal(result.status, 0);
  assert.equal(git(s.project, 'rev-parse', '--is-shallow-repository').trim(), 'false', result.warnings);
});

test('a permanent branch behind origin and not checked out moves forward; the checked-out one does not', (t) => {
  const s = setup(t);
  git(s.project, 'checkout', '-q', '-b', 'claude/x');
  advanceRemote(s);
  assert.notEqual(rev(s.project, 'main'), rev(s.project, 'origin/main'));
  const result = run(s);
  assert.equal(result.status, 0);
  assert.equal(rev(s.project, 'main'), rev(s.project, 'origin/main'), result.warnings);
  assert.equal(git(s.project, 'symbolic-ref', '--short', 'HEAD').trim(), 'claude/x');

  const c = setup(t);
  advanceRemote(c);
  const before = rev(c.project, 'main');
  const status = git(c.project, 'status', '--porcelain');
  run(c);
  assert.equal(rev(c.project, 'main'), before);
  assert.equal(git(c.project, 'status', '--porcelain'), status);
});

test('a diverged permanent branch is warned about and left alone', (t) => {
  const s = setup(t);
  git(s.project, 'commit', '-q', '--allow-empty', '-m', 'local');
  git(s.project, 'checkout', '-q', '-b', 'claude/x');
  advanceRemote(s);
  const before = rev(s.project, 'main');
  const result = run(s);
  assert.equal(result.status, 0);
  assert.equal(rev(s.project, 'main'), before);
  assert.match(result.warnings, /main.*divergido/);
});

test('without its remote it warns and exits with 0', (t) => {
  const s = setup(t, { depth: 1 });
  fs.rmSync(s.remote, { recursive: true, force: true });
  const result = run(s);
  assert.equal(result.status, 0);
  assert.match(result.warnings, /no se pudo completar el clon/);

  const e = setup(t);
  git(e.project, 'remote', 'remove', 'origin');
  const ephemeral = run(e, { ephemeral: true });
  assert.equal(ephemeral.status, 0);
  assert.match(ephemeral.warnings, /git fetch/);
});

test('an ephemeral container saves the session branch and keeps one already saved', (t) => {
  const s = setup(t);
  git(s.project, 'checkout', '-q', '-b', 'claude/x');
  run(s, { ephemeral: true });
  assert.equal(sessionBranch(s.project), 'claude/x');
  git(s.project, 'checkout', '-q', '-b', 'claude/y');
  run(s, { ephemeral: true });
  assert.equal(sessionBranch(s.project), 'claude/x');
  assert.equal(git(s.project, 'status', '--porcelain'), '');
});

test('outside an ephemeral container no session branch is saved', (t) => {
  const s = setup(t);
  git(s.project, 'checkout', '-q', '-b', 'claude/x');
  run(s);
  assert.equal(sessionBranch(s.project), null);
});
