'use strict';

// Core tests of the plugin's worktree strategy (lib/worktree.mjs, design D5
// of autopilot-rama-por-sesion), with real repositories and a bare remote:
// a new branch from origin/<origin branch>, --no-track and publishable with a
// plain `git push`; an existing branch; a branch checked out elsewhere; a
// failed fetch; the starting ref ignored; and remove, which keeps the branch
// and asks to force with changes.
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

const LIB = path.join(REPO_ROOT, '.opencode', 'plugins', 'openspec-autopilot', 'lib', 'worktree.mjs');
const BRANCH_CHANGE = path.join(REPO_ROOT, '.agents', 'openspec', 'branch-change.mjs');
const load = () => import(pathToFileURL(LIB).href);

function git(dir, ...args) {
  const result = spawnSync('git', args, { cwd: dir, encoding: 'utf8' });
  if (result.status !== 0) throw new Error(`git ${args.join(' ')}: ${result.stderr}`);
  return result.stdout.trim();
}

const ok = (dir, ...args) => spawnSync('git', args, { cwd: dir, encoding: 'utf8' }).status === 0;

// A clone with branch-change.mjs and openspec/config.yaml, pushed to a bare remote
function setup(t, { config = 'schema: intent-driven\n' } = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), 'autopilot-worktree-'));
  t.after(() => fs.rmSync(root, { recursive: true, force: true }));
  const remote = path.join(root, 'remote.git');
  const clone = path.join(root, 'clone');
  git(root, 'init', '-q', '--bare', '-b', 'main', remote);
  fs.mkdirSync(path.join(clone, '.agents', 'openspec'), { recursive: true });
  fs.mkdirSync(path.join(clone, 'openspec'), { recursive: true });
  fs.copyFileSync(BRANCH_CHANGE, path.join(clone, '.agents', 'openspec', 'branch-change.mjs'));
  fs.writeFileSync(path.join(clone, 'openspec', 'config.yaml'), config);
  git(clone, 'init', '-q', '-b', 'main');
  git(clone, 'config', 'user.email', 'suite@example.com');
  git(clone, 'config', 'user.name', 'Suite');
  git(clone, 'add', '-A');
  git(clone, 'commit', '-q', '-m', 'inicio');
  git(clone, 'remote', 'add', 'origin', `file://${remote}`);
  git(clone, 'push', '-q', 'origin', 'main');
  return { root, remote, clone, worktrees: path.join(root, 'worktrees') };
}

// A commit on the remote's main made from another clone: origin/main goes ahead
function remoteCommit(env, file) {
  const other = path.join(env.root, `otro-${Date.now()}`);
  git(env.root, 'clone', '-q', `file://${env.remote}`, other);
  git(other, 'config', 'user.email', 'suite@example.com');
  git(other, 'config', 'user.name', 'Suite');
  fs.writeFileSync(path.join(other, file), 'remoto\n');
  git(other, 'add', '-A');
  git(other, 'commit', '-q', '-m', 'commit en el remoto');
  git(other, 'push', '-q', 'origin', 'main');
  return git(other, 'rev-parse', 'HEAD');
}

const localConfig = (dir) => git(dir, 'config', '--local', '--list').split('\n').filter((l) => !/^branch\.importar-datos\./.test(l)).sort();

test('a new branch comes from origin/<origin branch>, does not track it and is published by a plain push', async (t) => {
  const { create } = await load();
  const env = setup(t);
  const ahead = remoteCommit(env, 'remoto.txt');
  const before = localConfig(env.clone);
  const directory = path.join(env.worktrees, 'importar-datos');
  // The starting ref the web sends is ignored
  assert.deepEqual(await create({ directory, sourceDirectory: env.clone, branch: 'HEAD~0' }), { directory });
  assert.equal(git(directory, 'symbolic-ref', '--short', 'HEAD'), 'importar-datos');
  assert.equal(git(directory, 'rev-parse', 'HEAD'), ahead, 'the branch starts at the fetched origin/main');
  assert.equal(git(env.clone, 'config', '--get', 'branch.importar-datos.remote'), 'origin');
  assert.equal(git(env.clone, 'config', '--get', 'branch.importar-datos.merge'), 'refs/heads/importar-datos');
  assert.equal(ok(env.clone, 'config', '--get', 'push.autoSetupRemote'), false);
  git(directory, 'config', 'user.email', 'suite@example.com');
  git(directory, 'config', 'user.name', 'Suite');
  fs.writeFileSync(path.join(directory, 'nuevo.txt'), 'x\n');
  git(directory, 'add', '-A');
  git(directory, 'commit', '-q', '-m', 'trabajo');
  git(directory, 'push', '-q');
  assert.equal(git(env.remote, 'rev-parse', 'refs/heads/importar-datos'), git(directory, 'rev-parse', 'HEAD'));
  assert.equal(git(env.remote, 'rev-parse', 'refs/heads/main'), ahead, 'the origin branch of the remote did not change');
  assert.deepEqual(localConfig(env.clone), before);
});

test('the origin branch is the last one of x-main', async (t) => {
  const { create } = await load();
  const env = setup(t, { config: 'schema: intent-driven\nx-main: [main, develop]\n' });
  git(env.clone, 'switch', '-q', '-c', 'develop');
  fs.writeFileSync(path.join(env.clone, 'develop.txt'), 'd\n');
  git(env.clone, 'add', '-A');
  git(env.clone, 'commit', '-q', '-m', 'develop');
  git(env.clone, 'push', '-q', 'origin', 'develop');
  git(env.clone, 'switch', '-q', 'main');
  const directory = path.join(env.worktrees, 'importar-datos');
  await create({ directory, sourceDirectory: env.clone });
  assert.equal(git(directory, 'rev-parse', 'HEAD'), git(env.clone, 'rev-parse', 'develop'));
});

test('an existing branch keeps its commits; one checked out elsewhere is refused, naming the directory', async (t) => {
  const { create } = await load();
  const env = setup(t);
  git(env.clone, 'switch', '-q', '-c', 'importar-datos');
  fs.writeFileSync(path.join(env.clone, 'propio.txt'), 'p\n');
  git(env.clone, 'add', '-A');
  git(env.clone, 'commit', '-q', '-m', 'commit propio');
  const own = git(env.clone, 'rev-parse', 'HEAD');
  const directory = path.join(env.worktrees, 'importar-datos');
  await assert.rejects(create({ directory, sourceDirectory: env.clone }), (error) => {
    assert.ok(error.message.includes(env.clone), error.message);
    assert.match(error.message, /importar-datos/);
    return true;
  });
  assert.equal(fs.existsSync(directory), false);
  git(env.clone, 'switch', '-q', 'main');
  await create({ directory, sourceDirectory: env.clone });
  assert.equal(git(directory, 'symbolic-ref', '--short', 'HEAD'), 'importar-datos');
  assert.equal(git(directory, 'rev-parse', 'HEAD'), own);
});

test('a failed fetch creates no worktree and says why', async (t) => {
  const { create } = await load();
  const env = setup(t);
  fs.renameSync(env.remote, `${env.remote}.inaccesible`);
  const directory = path.join(env.worktrees, 'importar-datos');
  await assert.rejects(create({ directory, sourceDirectory: env.clone }), /No se ha podido actualizar la rama de origen del remoto/);
  assert.equal(fs.existsSync(directory), false);
  assert.equal(ok(env.clone, 'rev-parse', '--verify', '-q', 'refs/heads/importar-datos'), false);
});

test('remove keeps the branch, and with changes asks to force', async (t) => {
  const { create, remove, list } = await load();
  const env = setup(t);
  const directory = path.join(env.worktrees, 'importar-datos');
  await create({ directory, sourceDirectory: env.clone });
  const listed = await list(env.clone);
  assert.deepEqual(listed.map((w) => w.type), ['root', 'worktree']);
  assert.equal(fs.realpathSync(listed[1].directory), fs.realpathSync(directory));
  fs.writeFileSync(path.join(directory, 'sin-commit.txt'), 'x\n');
  await assert.rejects(remove({ directory, sourceDirectory: env.clone }), (error) => error.forceRequired === true);
  assert.ok(fs.existsSync(directory));
  await remove({ directory, sourceDirectory: env.clone, force: true });
  assert.equal(fs.existsSync(directory), false);
  assert.ok(ok(env.clone, 'rev-parse', '--verify', '-q', 'refs/heads/importar-datos'), 'the branch is kept');
});
