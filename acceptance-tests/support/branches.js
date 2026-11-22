'use strict';

// Git repositories for the scenarios of openspec-change-lifecycle and
// openspec-autopilot (task 2.4 of add-openspec-autopilot), on the project
// copy, which is already a repository whose `main` holds the clone: the
// origin branch with `x-main` or without it, temporary branches with changes
// in progress or archived, with or without a commit, a detached HEAD, a
// tasks.md with tasks checked or not, and the real `openspec status` of the
// copy. What the branch's change is comes from .agents/openspec/branch-change.mjs
// of the copy, run as the workflows run it.
//
// For manage-git-discipline it also builds a bare remote for the copy (push
// and fetch), remote branches ahead of the local one or diverged from it, a
// squash merge, a shallow clone (`--depth 1` from file://) with or without
// access to its remote, and the environment of an ephemeral container for
// branch-change.mjs and the session bootstrap's core.

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { git } = require('./engine');
const { REPO_ROOT } = require('./project');

const CLI = path.join(REPO_ROOT, 'node_modules', '.bin', 'openspec');
const BRANCH_CHANGE = path.join('.agents', 'openspec', 'branch-change.mjs');
const CONFIG = path.join('openspec', 'config.yaml');

// The copy carries this repository's changes in progress; the scenarios start
// from an origin branch whose openspec/changes/ only has the archive, as main
function clearActiveChanges(project) {
  const dir = project.path('openspec', 'changes');
  for (const entry of fs.readdirSync(dir)) {
    if (entry !== 'archive') fs.rmSync(path.join(dir, entry), { recursive: true, force: true });
  }
  commitAll(project, 'rama de origen sin changes en curso');
}

function commitAll(project, message) {
  git(project.dir, 'add', '-A');
  const status = git(project.dir, 'status', '--porcelain');
  if (status.trim() !== '') git(project.dir, 'commit', '-q', '-m', message);
}

// Sets `x-main` in openspec/config.yaml (a list, a raw text, or null to remove it) and commits it
function setPermanent(project, value) {
  const file = project.path(CONFIG);
  const lines = fs.readFileSync(file, 'utf8').split('\n');
  const kept = [];
  for (let i = 0; i < lines.length; i++) {
    if (/^x-main\s*:/.test(lines[i])) {
      while (i + 1 < lines.length && /^\s+-/.test(lines[i + 1])) i++;
      continue;
    }
    kept.push(lines[i]);
  }
  if (value !== null) {
    const text = Array.isArray(value) ? `x-main: [${value.join(', ')}]` : value;
    kept.splice(1, 0, ...text.split('\n'));
  }
  fs.writeFileSync(file, kept.join('\n'));
  commitAll(project, 'x-main');
}

function branch(project, name, { from = null } = {}) {
  git(project.dir, 'checkout', '-q', '-b', name, ...(from ? [from] : []));
}

function checkout(project, name) {
  git(project.dir, 'checkout', '-q', name);
}

function detach(project) {
  git(project.dir, 'checkout', '-q', '--detach', 'HEAD');
}

function currentBranch(project) {
  const result = spawnSync('git', ['symbolic-ref', '--short', '-q', 'HEAD'], { cwd: project.dir, encoding: 'utf8' });
  return result.status === 0 ? result.stdout.trim() : null;
}

// A change in progress: its proposal, or every planning artifact with
// `planned`, and a tasks.md with the given tasks ({ id, done })
function addChange(project, name, { planned = false, tasks = null } = {}) {
  const dir = project.path('openspec', 'changes', name);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, '.openspec.yaml'), 'schema: intent-driven\ncreated: 2026-11-21\n');
  fs.writeFileSync(path.join(dir, 'proposal.md'), `## Why\n\nPrueba de ${name}.\n\n## What Changes\n\n- Exportar los datos.\n\n## Capabilities\n\n### New Capabilities\n- \`prueba-${name}\`: prueba.\n\n### Modified Capabilities\n\n## Impact\n\n- Ninguno.\n`);
  if (planned) {
    fs.mkdirSync(path.join(dir, 'specs', `prueba-${name}`), { recursive: true });
    fs.writeFileSync(
      path.join(dir, 'specs', `prueba-${name}`, 'spec.md'),
      `# prueba-${name}\n\n## ADDED Requirements\n\n### Requirement: Prueba\nEl sistema DEBE probar.\n\n#### Scenario: Prueba\n\n- **WHEN** se prueba\n- **THEN** funciona\n`
    );
    fs.writeFileSync(path.join(dir, 'design.md'), '## Context\n\nPrueba.\n');
    fs.writeFileSync(path.join(dir, 'adr.md'), '# ADR Review Manifest\n\n- Status: completed\n');
    writeTasks(project, name, tasks ?? [{ id: '1.1', done: false }]);
  }
  return dir;
}

function writeTasks(project, name, tasks) {
  const body = tasks.map((t) => `- [${t.done ? 'x' : ' '}] ${t.id} Tarea ${t.id}`).join('\n');
  fs.writeFileSync(project.path('openspec', 'changes', name, 'tasks.md'), `## 1. Prueba\n\n${body}\n`);
}

// Writes one planning artifact of a change, as a workflow that finishes it would
function writeArtifact(project, name, artifact) {
  const dir = project.path('openspec', 'changes', name);
  const files = {
    proposal: () => addChange(project, name),
    design: () => fs.writeFileSync(path.join(dir, 'design.md'), '## Context\n\nPrueba.\n'),
    adr: () => fs.writeFileSync(path.join(dir, 'adr.md'), '# ADR Review Manifest\n\n- Status: completed\n'),
    specs: () => {
      fs.mkdirSync(path.join(dir, 'specs', `prueba-${name}`), { recursive: true });
      fs.writeFileSync(path.join(dir, 'specs', `prueba-${name}`, 'spec.md'), `# prueba-${name}\n\n## ADDED Requirements\n\n### Requirement: Prueba\nEl sistema DEBE probar.\n\n#### Scenario: Prueba\n\n- **WHEN** se prueba\n- **THEN** funciona\n`);
    },
    tasks: () => writeTasks(project, name, [{ id: '1.1', done: false }]),
  };
  if (!files[artifact]) throw new Error(`unknown artifact ${artifact}`);
  files[artifact]();
}

// Moves a change to openspec/changes/archive/<date>-<name>/, as the archive does
function archiveChange(project, name, date = '2026-11-21') {
  const from = project.path('openspec', 'changes', name);
  if (!fs.existsSync(from)) addChange(project, name, { planned: true });
  fs.renameSync(from, project.path('openspec', 'changes', 'archive', `${date}-${name}`));
}

// What .agents/openspec/branch-change.mjs of the copy says, as JSON
function branchChange(project) {
  const result = spawnSync(process.execPath, [BRANCH_CHANGE, '--json'], { cwd: project.dir, encoding: 'utf8', env: sessionEnv() });
  if (result.status !== 0) throw new Error(`branch-change failed (${result.status}):\n${result.stderr}`);
  return JSON.parse(result.stdout);
}

// A gate of the cycle, as the openspec-git-discipline skill runs it
function checkGate(project, gate, name, { ephemeral = false } = {}) {
  const result = spawnSync(process.execPath, [BRANCH_CHANGE, 'check', gate, ...(name ? [name] : [])], {
    cwd: project.dir,
    encoding: 'utf8',
    env: sessionEnv({ ephemeral }),
  });
  let json = null;
  try {
    json = JSON.parse(result.stdout);
  } catch {
    // reported below
  }
  if (!json) throw new Error(`branch-change check failed (${result.status}):\n${result.stdout}\n${result.stderr}`);
  return { ...json, exitCode: result.status };
}

// --- Remote, shallow clones and ephemeral containers (manage-git-discipline) ---

// The variables that make a session an ephemeral container (design D4)
const EPHEMERAL_VARS = ['CLAUDE_CODE_CONTAINER_ID', 'CLAUDE_CODE_REMOTE'];
const EPHEMERAL_ENV = { CLAUDE_CODE_CONTAINER_ID: 'container_suite', CLAUDE_CODE_REMOTE: 'true' };

// The environment of a process, inside an ephemeral container or outside one,
// whatever the machine that runs the suite is
function sessionEnv({ ephemeral = false, base = process.env } = {}) {
  const env = { ...base };
  for (const name of EPHEMERAL_VARS) delete env[name];
  return ephemeral ? { ...env, ...EPHEMERAL_ENV } : env;
}

function remoteDir(project) {
  return path.join(path.dirname(project.dir), `${path.basename(project.dir)}-remote.git`);
}

// A bare repository as the copy's `origin`, with the given branches pushed
function addRemote(project, { push = ['main'] } = {}) {
  const remote = remoteDir(project);
  if (!fs.existsSync(remote)) {
    git(path.dirname(project.dir), 'init', '-q', '--bare', '-b', 'main', remote);
    git(project.dir, 'remote', 'add', 'origin', `file://${remote}`);
  }
  for (const name of push) git(project.dir, 'push', '-q', 'origin', `${name}:refs/heads/${name}`);
  git(project.dir, 'fetch', '-q', 'origin');
  return remote;
}

// A commit on origin/<branch> made from another clone, then fetched: the
// remote branch goes ahead of the local one. `files` maps paths to contents
// (null removes the path).
function remoteCommit(project, files, { branch: name = 'main', message = 'commit en el remoto' } = {}) {
  const remote = fs.existsSync(remoteDir(project)) ? remoteDir(project) : addRemote(project);
  const other = fs.mkdtempSync(path.join(path.dirname(project.dir), 'otro-clon-'));
  try {
    git(other, 'clone', '-q', '--branch', name, `file://${remote}`, '.');
    for (const [rel, content] of Object.entries(files)) {
      const file = path.join(other, rel);
      if (content === null) fs.rmSync(file, { recursive: true, force: true });
      else {
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, content);
      }
    }
    git(other, 'add', '-A');
    git(other, 'commit', '-q', '--allow-empty', '-m', message);
    git(other, 'push', '-q', 'origin', `HEAD:refs/heads/${name}`);
  } finally {
    fs.rmSync(other, { recursive: true, force: true });
  }
  git(project.dir, 'fetch', '-q', 'origin');
  return revParse(project, `refs/remotes/origin/${name}`);
}

function revParse(project, ref) {
  const result = spawnSync('git', ['rev-parse', '--verify', '-q', ref], { cwd: project.dir, encoding: 'utf8' });
  return result.status === 0 ? result.stdout.trim() : null;
}

// Merges a branch into another with --squash, as a hosting service does, and
// goes back to the branch the clone was on
function squashMerge(project, from, into = 'main') {
  const back = currentBranch(project);
  checkout(project, into);
  git(project.dir, 'merge', '-q', '--squash', from);
  git(project.dir, 'commit', '-q', '-m', `${from} (squash)`);
  if (back) checkout(project, back);
}

function isShallow(project) {
  return git(project.dir, 'rev-parse', '--is-shallow-repository').trim() === 'true';
}

// Turns the copy into a shallow clone (`--depth 1` from file://) of a remote
// that holds its history; with `reachable: false`, the remote is then gone
function makeShallow(project, { reachable = true } = {}) {
  git(project.dir, 'commit', '-q', '--allow-empty', '-m', 'segundo commit');
  const remote = addRemote(project);
  const clone = fs.mkdtempSync(path.join(path.dirname(project.dir), 'clon-superficial-'));
  git(clone, 'clone', '-q', '--depth', '1', `file://${remote}`, 'repo');
  fs.rmSync(project.path('.git'), { recursive: true, force: true });
  fs.renameSync(path.join(clone, 'repo', '.git'), project.path('.git'));
  fs.rmSync(clone, { recursive: true, force: true });
  if (!reachable) fs.renameSync(remote, `${remote}.inaccesible`);
  if (!isShallow(project)) throw new Error('could not make the copy a shallow clone');
}

// The session branch saved in the clone's local git config, or null to remove it
function setSessionBranch(project, name) {
  if (name === null) spawnSync('git', ['config', '--unset', 'idd.sessionBranch'], { cwd: project.dir });
  else git(project.dir, 'config', 'idd.sessionBranch', name);
}

function sessionBranch(project) {
  const result = spawnSync('git', ['config', '--get', 'idd.sessionBranch'], { cwd: project.dir, encoding: 'utf8' });
  return result.status === 0 ? result.stdout.trim() : null;
}

// The project's OpenSpec CLI on the copy
function openspec(project, args) {
  if (!fs.existsSync(CLI)) throw new Error(`the project's OpenSpec CLI is not installed: ${CLI}`);
  const result = spawnSync(CLI, args, { cwd: project.dir, encoding: 'utf8', env: { ...process.env, OPENSPEC_TELEMETRY: '0', NO_COLOR: '1' } });
  return { exitCode: result.status, stdout: result.stdout ?? '', stderr: result.stderr ?? '' };
}

function openspecStatus(project, name) {
  const result = openspec(project, ['status', '--change', name, '--json']);
  return JSON.parse(result.stdout);
}

module.exports = {
  clearActiveChanges,
  commitAll,
  setPermanent,
  branch,
  checkout,
  detach,
  currentBranch,
  addChange,
  writeTasks,
  writeArtifact,
  archiveChange,
  branchChange,
  checkGate,
  openspec,
  openspecStatus,
  EPHEMERAL_VARS,
  EPHEMERAL_ENV,
  sessionEnv,
  addRemote,
  remoteCommit,
  revParse,
  squashMerge,
  isShallow,
  makeShallow,
  setSessionBranch,
  sessionBranch,
};
