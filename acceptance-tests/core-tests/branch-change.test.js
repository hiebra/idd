'use strict';

// Core tests of .agents/openspec/branch-change.mjs outside the specs (tasks
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

const MODULE = pathToFileURL(path.join(REPO_ROOT, '.agents', 'openspec', 'branch-change.mjs')).href;

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

test('x-main-protected declares the veto only with true', async () => {
  const { parseProtected } = await import(MODULE);
  assert.equal(parseProtected('schema: x\nx-main-protected: true\n'), true);
  assert.equal(parseProtected("x-main-protected: 'true' # veto\n"), true);
  for (const text of ['schema: x\n', 'x-main-protected: false\n', 'x-main-protected: yes\n', 'x-main-protected:\n', '  x-main-protected: true\n']) {
    assert.equal(parseProtected(text), false, text);
  }
});

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
  assert.equal(startBranch(dir, 'Exportar Datos', {}).ok, false, 'not kebab-case');
  assert.equal(startBranch(dir, 'main', {}).ok, false, 'a permanent branch');
  const created = startBranch(dir, 'exportar-datos', {});
  assert.equal(created.ok, true, created.message);
  assert.equal(git(dir, 'symbolic-ref', '--short', 'HEAD').trim(), 'exportar-datos');
  assert.equal(git(dir, 'rev-parse', 'HEAD').trim(), origin);
  assert.match(startBranch(dir, 'exportar-datos', {}).message, /ya existe/);
  fs.writeFileSync(path.join(dir, 'sucio.txt'), 'x');
  const dirty = startBranch(dir, 'otro-cambio', {});
  assert.equal(dirty.ok, false);
  assert.match(dirty.message, /stash/);
});

test('start: from origin/<branch> when the origin branch is only remote', async (t) => {
  const { startBranch } = await import(MODULE);
  const dir = repo(t);
  git(dir, 'update-ref', 'refs/remotes/origin/main', 'main');
  git(dir, 'checkout', '-q', '-b', 'temporal');
  git(dir, 'branch', '-q', '-D', 'main');
  const created = startBranch(dir, 'exportar-datos', {});
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
  assert.equal(switchBranch(dir, 'main', {}).ok, false);
  assert.equal(switchBranch(dir, 'no-existe', {}).ok, false);
  const switched = switchBranch(dir, 'exportar-datos', {});
  assert.equal(switched.ok, true, switched.message);
  assert.equal(listBranches(dir).find((b) => b.current).branch, 'exportar-datos');
});

// --- check commit with a merge in progress (allow-user-requested-merges, D3) ---

const EPHEMERAL = { CLAUDE_CODE_CONTAINER_ID: 'container_suite', CLAUDE_CODE_REMOTE: 'true' };
const IDENTITY = ['-c', 'user.name=suite', '-c', 'user.email=suite@example.invalid'];

function write(dir, rel, content) {
  fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
  fs.writeFileSync(path.join(dir, rel), content);
}

// A session branch `claude/x` with a merge of main in progress that touches
// `files` (path -> content in main), without conflicts
function mergeInProgress(t, files) {
  const dir = repo(t);
  git(dir, 'checkout', '-q', '-b', 'claude/x');
  git(dir, 'config', 'idd.sessionBranch', 'claude/x');
  write(dir, 'src/propio.js', 'propio\n');
  git(dir, 'add', '-A');
  git(dir, 'commit', '-q', '-m', 'propio');
  git(dir, 'checkout', '-q', 'main');
  for (const [rel, content] of Object.entries(files)) write(dir, rel, content);
  git(dir, 'add', '-A');
  git(dir, 'commit', '-q', '-m', 'main');
  git(dir, 'checkout', '-q', 'claude/x');
  git(dir, ...IDENTITY, 'merge', '-q', '--no-commit', '--no-ff', 'main');
  return dir;
}

test('check commit with a merge: `=======` with more text on its line is not a marker', async (t) => {
  const { checkCommit } = await import(MODULE);
  const dir = mergeInProgress(t, {
    'docs/a.md': 'Título\n======= y más\n',
    'src/b.js': '// <<<<<<<HEAD sin espacio\n  >>>>>>> sangrado\n',
    'openspec/changes/x/design.md': 'x\n',
  });
  const gate = checkCommit(dir, EPHEMERAL);
  assert.equal(gate.ok, true, gate.message);
  assert.match(gate.message, /git commit --no-edit/);
  for (const line of ['=======', '<<<<<<< HEAD', '>>>>>>> main', '<<<<<<<']) {
    write(dir, 'src/b.js', `x\n${line}\ny\n`);
    const marked = checkCommit(dir, EPHEMERAL);
    assert.equal(marked.ok, false, line);
    assert.match(marked.message, /src\/b\.js/, line);
  }
});

test('check commit with a merge: a deleted or binary file is skipped', async (t) => {
  const { checkCommit } = await import(MODULE);
  const dir = mergeInProgress(t, { 'bin/data.bin': Buffer.from([0, 1, 2, ...Buffer.from('\n<<<<<<< HEAD\n')]), 'src/c.js': 'c\n' });
  fs.rmSync(path.join(dir, 'src', 'c.js'));
  fs.rmSync(path.join(dir, 'src', 'propio.js'));
  assert.match(git(dir, 'diff', '--name-only', 'HEAD'), /src\/propio\.js/, 'a deleted file the merge touches');
  const gate = checkCommit(dir, EPHEMERAL);
  assert.equal(gate.ok, true, gate.message);
});

test('check commit without a merge in progress still checks the zones', async (t) => {
  const { checkCommit } = await import(MODULE);
  const dir = repo(t);
  git(dir, 'checkout', '-q', '-b', 'claude/x');
  git(dir, 'config', 'idd.sessionBranch', 'claude/x');
  write(dir, 'src/a.js', '<<<<<<< HEAD\n');
  assert.equal(checkCommit(dir, EPHEMERAL).ok, true, 'markers are only checked in a merge');
  write(dir, 'openspec/changes/x/design.md', 'x\n');
  const mixed = checkCommit(dir, EPHEMERAL);
  assert.equal(mixed.ok, false);
  assert.match(mixed.message, /mezclan la zona de specs/);
  assert.equal(checkCommit(dir, {}).ok, false, 'outside an ephemeral container');
});

// --- check merge (allow-user-requested-merges, D4) ---

test('check merge: another temporary branch or a detached HEAD as target is refused', async (t) => {
  const { checkMerge } = await import(MODULE);
  const dir = repo(t);
  git(dir, 'update-ref', 'refs/remotes/origin/main', 'main');
  git(dir, 'branch', 'otra');
  git(dir, 'checkout', '-q', '-b', 'feature/x');
  const other = checkMerge(dir, 'otra', undefined, {});
  assert.equal(other.ok, false);
  assert.match(other.message, /no admite el destino 'otra'/);
  assert.equal(checkMerge(dir, undefined, undefined, {}).ok, false, 'without a target');
  assert.equal(checkMerge(dir, 'feature/x', 'otra', {}).ok, false, 'bringing a temporary branch');
  git(dir, 'checkout', '-q', '--detach');
  const detached = checkMerge(dir, 'main', undefined, {});
  assert.equal(detached.ok, false);
  assert.match(detached.message, /HEAD separado/);
  git(dir, 'checkout', '-q', 'main');
  assert.equal(checkMerge(dir, 'main', undefined, {}).ok, false, 'from a permanent branch');
});

test('check merge: without origin/<target> it asks to fetch it', async (t) => {
  const { checkMerge } = await import(MODULE);
  const dir = repo(t);
  git(dir, 'checkout', '-q', '-b', 'feature/x');
  for (const target of ['main', 'feature/x']) {
    const gate = checkMerge(dir, target, undefined, {});
    assert.equal(gate.ok, false, target);
    assert.match(gate.message, /git fetch origin main/, target);
  }
});

test('check merge: bringing a permanent branch the branch already contains, nothing to do', async (t) => {
  const { checkMerge } = await import(MODULE);
  const dir = repo(t, 'schema: intent-driven\nx-main: [main, develop]\n');
  git(dir, 'add', '-A');
  git(dir, 'branch', 'develop');
  git(dir, 'update-ref', 'refs/remotes/origin/main', 'main');
  git(dir, 'update-ref', 'refs/remotes/origin/develop', 'develop');
  git(dir, 'checkout', '-q', '-b', 'feature/x');
  write(dir, 'src/a.js', 'a\n');
  git(dir, 'add', '-A');
  git(dir, 'commit', '-q', '-m', 'a');
  for (const source of [undefined, 'main']) {
    const gate = checkMerge(dir, 'feature/x', source, {});
    assert.equal(gate.ok, true, gate.message);
    assert.match(gate.message, /no hay nada que traer/);
    assert.doesNotMatch(gate.message, /git merge/);
  }
  // In an ephemeral container, only in the session branch
  assert.equal(checkMerge(dir, 'feature/x', undefined, EPHEMERAL).ok, false, 'without a session branch');
  git(dir, 'config', 'idd.sessionBranch', 'feature/x');
  assert.equal(checkMerge(dir, 'feature/x', undefined, EPHEMERAL).ok, true);
});

// --- merge-targets (allow-user-requested-merges, D6) ---

test('merge-targets: bringFirst, a branch of x-main without origin, and none from a permanent branch or a detached HEAD', async (t) => {
  const { mergeTargets } = await import(MODULE);
  const dir = repo(t, 'schema: intent-driven\nx-main: [main, release, develop]\n');
  git(dir, 'branch', 'develop');
  git(dir, 'update-ref', 'refs/remotes/origin/main', 'main');
  git(dir, 'update-ref', 'refs/remotes/origin/develop', 'develop');
  git(dir, 'checkout', '-q', '-b', 'feature/x');
  write(dir, 'src/a.js', 'a\n');
  git(dir, 'add', '-A');
  git(dir, 'commit', '-q', '-m', 'a');
  // origin/develop moves ahead: the branch has to bring it first
  git(dir, 'checkout', '-q', 'develop');
  write(dir, 'src/d.js', 'd\n');
  git(dir, 'add', '-A');
  git(dir, 'commit', '-q', '-m', 'd');
  git(dir, 'update-ref', 'refs/remotes/origin/develop', 'develop');
  git(dir, 'checkout', '-q', 'feature/x');
  const result = mergeTargets(dir);
  assert.deepEqual(result.targets, [{ branch: 'main', bringFirst: false }, { branch: 'develop', bringFirst: true }]);
  assert.match(result.warnings.join('\n'), /origin\/release/);
  assert.equal(result.branch, 'feature/x');
  git(dir, 'checkout', '-q', 'main');
  assert.deepEqual(mergeTargets(dir).targets, []);
  git(dir, 'checkout', '-q', '--detach', 'feature/x');
  assert.deepEqual(mergeTargets(dir).targets, []);
});

test('start and switch refuse in an ephemeral container before anything else', async (t) => {
  const { startBranch, switchBranch } = await import(MODULE);
  const dir = repo(t);
  git(dir, 'branch', 'otra');
  fs.writeFileSync(path.join(dir, 'sucio.txt'), 'x');
  for (const result of [startBranch(dir, 'exportar-datos', EPHEMERAL), startBranch(dir, 'main', EPHEMERAL), switchBranch(dir, 'otra', EPHEMERAL)]) {
    assert.equal(result.ok, false);
    assert.match(result.message, /sigue en la rama de la sesión/);
    assert.doesNotMatch(result.message, /stash|permanente/);
  }
  assert.equal(git(dir, 'symbolic-ref', '--short', 'HEAD').trim(), 'main');
});

// --- The title of the merge (name-change-in-merge-title, D1 to D3) ---

// A temporary branch `feature/x` that contains origin/main, with a commit
// that adds the given paths
function branchWith(t, paths, config) {
  const dir = repo(t, config);
  git(dir, 'update-ref', 'refs/remotes/origin/main', 'main');
  git(dir, 'checkout', '-q', '-b', 'feature/x');
  for (const rel of paths) write(dir, rel, 'x\n');
  git(dir, 'add', '-A');
  git(dir, 'commit', '-q', '-m', 'cambios de la rama');
  return dir;
}

test('merge title: a directory of openspec/changes/ that is not kebab-case stays out of the title and of the order', async (t) => {
  const { branchChange, checkMerge, mergeTitle } = await import(MODULE);
  const odd = ['$(touch pwned)', 'con`acento', 'Notas Sueltas', 'con_guion_bajo'];
  const dir = branchWith(t, ['exportar-datos', ...odd].map((name) => `openspec/changes/${name}/proposal.md`));
  // The module still counts them as changes of the branch: only the title leaves them out
  const state = branchChange(dir);
  assert.deepEqual(state.changes.map((c) => c.name).sort(), ['exportar-datos', ...odd].sort(), JSON.stringify(state));
  assert.equal(mergeTitle(state, 'main'), 'Merge exportar-datos into main');
  const gate = checkMerge(dir, 'main', undefined, {});
  assert.equal(gate.ok, true, gate.message);
  assert.ok(gate.message.includes('-m "Merge exportar-datos into main"'), gate.message);
  for (const name of odd) assert.ok(!gate.message.includes(name), `${name}: ${gate.message}`);
  // Nor to the title of the PR, in an ephemeral container
  git(dir, 'config', 'idd.sessionBranch', 'feature/x');
  const pr = checkMerge(dir, 'main', undefined, EPHEMERAL);
  assert.equal(pr.ok, true, pr.message);
  assert.ok(pr.message.includes('con el título `Merge exportar-datos into main`'), pr.message);
  for (const name of odd) assert.ok(!pr.message.includes(name), `${name}: ${pr.message}`);
  // Without any kebab-case change left, the title names the branch, and the PR gets no title
  fs.rmSync(path.join(dir, 'openspec', 'changes', 'exportar-datos'), { recursive: true });
  git(dir, 'add', '-A');
  git(dir, 'commit', '-q', '-m', 'sin exportar-datos');
  assert.equal(mergeTitle(branchChange(dir), 'main'), 'Merge feature/x into main');
  const untitled = checkMerge(dir, 'main', undefined, EPHEMERAL);
  assert.equal(untitled.ok, true, untitled.message);
  assert.doesNotMatch(untitled.message, /título/);
  for (const name of odd) assert.ok(!untitled.message.includes(name), `${name}: ${untitled.message}`);
});

test('merge title: a change in progress and archived under the same name is named once', async (t) => {
  const { checkMerge } = await import(MODULE);
  const dir = branchWith(t, [
    'openspec/changes/exportar-datos/proposal.md',
    'openspec/changes/archive/2026-11-22-exportar-datos/proposal.md',
    'openspec/changes/archive/2026-11-22-importar-datos/proposal.md',
  ]);
  const gate = checkMerge(dir, 'main', undefined, {});
  assert.equal(gate.ok, true, gate.message);
  assert.ok(gate.message.includes('-m "Merge exportar-datos, importar-datos into main"'), gate.message);
});

test('merge title: towards another permanent branch, the changes are still those against the origin branch', async (t) => {
  const { checkMerge } = await import(MODULE);
  const dir = repo(t, 'schema: intent-driven\nx-main: [main, develop]\n');
  // develop, the origin branch, is ahead of main with a change of its own
  git(dir, 'checkout', '-q', '-b', 'develop');
  write(dir, 'openspec/changes/otro-change/proposal.md', 'x\n');
  git(dir, 'add', '-A');
  git(dir, 'commit', '-q', '-m', 'otro-change en develop');
  git(dir, 'update-ref', 'refs/remotes/origin/main', 'main');
  git(dir, 'update-ref', 'refs/remotes/origin/develop', 'develop');
  git(dir, 'checkout', '-q', '-b', 'feature/x');
  write(dir, 'openspec/changes/exportar-datos/proposal.md', 'x\n');
  git(dir, 'add', '-A');
  git(dir, 'commit', '-q', '-m', 'exportar-datos');
  for (const target of ['main', 'develop']) {
    const gate = checkMerge(dir, target, undefined, {});
    assert.equal(gate.ok, true, gate.message);
    assert.ok(gate.message.includes(`-m "Merge exportar-datos into ${target}"`), gate.message);
  }
});
