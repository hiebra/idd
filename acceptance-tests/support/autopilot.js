'use strict';

// Support of the openspec-autopilot scenarios (design D16 of
// add-openspec-autopilot): a temporary branch with the change in the state a
// scenario needs, sessions already stored in the simulated OpenCode (the
// change's earlier sessions, a stopped or working owner) and readers of what
// the plugin did.
//
// autopilot-rama-por-sesion (task 1.2): the clone's bare remote with its
// origin branch, worktrees outside the clone (where the simulated OpenCode
// creates them), a change prepared in a worktree or in a branch that is not
// checked out, sessions of a worktree, and readers of the branch of each
// directory, the toasts and the options of the last modal.

const fs = require('node:fs');
const path = require('node:path');

const BRANCH = 'feature/exportar-datos';
const CHANGE = 'exportar-datos';
const MARK = '[openspec-autopilot]';

// The planning artifacts written, in the schema's order; tasks are { id, done }
// `project` is the clone or one of its worktrees (projectAt)
async function prepareChange(world, { artifacts = ['proposal', 'specs', 'design', 'adr', 'tasks'], tasks = null, commit = true, project = world.lifecycleProject() } = {}) {
  const b = world.branches;
  if (b.currentBranch(project) !== BRANCH) b.branch(project, BRANCH);
  const dir = project.path('openspec', 'changes', CHANGE);
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, '.openspec.yaml'), 'schema: intent-driven\ncreated: 2026-11-21\n');
  for (const artifact of artifacts) b.writeArtifact(project, CHANGE, artifact);
  if (tasks) b.writeTasks(project, CHANGE, tasks);
  if (commit) b.commitAll(project, `exportar-datos: ${artifacts.join(', ')}`);
  return dir;
}

function ownerMeta(world, step, extra = {}) {
  const worktree = extra.worktree ?? world.project.dir;
  return { v: 1, worktree, branch: BRANCH, change: CHANGE, role: 'owner', step, seq: 1, phase: 'running', zone: null, snapshot: snapshotNow(world, CHANGE, projectAt(worktree)), ...extra };
}

// A directory of the clone (the clone itself or a worktree) as the branch helpers take it
function projectAt(dir) {
  return { dir, path: (...parts) => path.join(dir, ...parts) };
}

// The photo of the change the plugin takes when a step starts (design D7 of
// autopilot-sesion-operativa), from the real CLI of the copy
function snapshotNow(world, change = CHANGE, project = world.project) {
  const dir = project.path('openspec', 'changes', change);
  if (!fs.existsSync(dir)) return { change: null, artifacts: [], tasks: [], git: null };
  const status = world.branches.openspecStatus(project, change);
  const apply = world.branches.openspec(project, ['instructions', 'apply', '--change', change, '--json']);
  let tasks = [];
  try {
    tasks = JSON.parse(apply.stdout).tasks ?? [];
  } catch {
    tasks = [];
  }
  return {
    change,
    artifacts: (status.artifacts ?? []).filter((a) => a.status === 'done').map((a) => a.id),
    tasks: tasks.filter((t) => t.done).map((t) => String(t.id)),
    git: null,
  };
}

// OpenCode already open (not starting): its TUI has presented itself before
async function ensureOpenCode(world, options = {}) {
  if (!world.sim) await world.startOpenCode({ pluginOptions: world.pluginOptions ?? {}, alreadyOpen: true, ...options });
  return world.sim;
}

// The paths in git's stage
function staged(world) {
  const { spawnSync } = require('node:child_process');
  return spawnSync('git', ['diff', '--cached', '--name-only'], { cwd: world.project.dir, encoding: 'utf8' }).stdout.split('\n').filter(Boolean);
}

function gitIn(world, ...args) {
  const { spawnSync } = require('node:child_process');
  const result = spawnSync('git', args, { cwd: world.project.dir, encoding: 'utf8' });
  if (result.status !== 0) throw new Error(`git ${args.join(' ')}: ${result.stderr}`);
  return result.stdout;
}

// A session already in OpenCode's store
// `directory` is the session's (a worktree's); its metadata names it as its worktree
async function seed(world, { title, step, busy = false, archived = false, agent = 'build', meta = {}, messages = [], directory = null }) {
  await ensureOpenCode(world);
  const dir = directory ?? world.project.dir;
  const metadata = step === null ? (Object.keys(meta).length > 0 ? { openspec: { v: 1, worktree: dir, ...meta } } : {}) : { openspec: ownerMeta(world, step, { worktree: dir, ...meta }) };
  return world.opencodeCall('seed', { title, agent, metadata, busy, archived, messages, directory: dir });
}

// --- Remote, worktrees and branches of each directory (autopilot-rama-por-sesion) ---

// The clone's bare remote with the origin branch pushed
function ensureRemote(world) {
  const project = world.lifecycleProject();
  const remote = world.branches.remoteDir(project);
  if (!fs.existsSync(remote)) world.branches.addRemote(project, { push: ['main'] });
  return remote;
}

function remoteUnreachable(world) {
  const remote = ensureRemote(world);
  fs.renameSync(remote, `${remote}.inaccesible`);
}

// Where the simulated OpenCode creates worktrees (opencode-sim.js)
function worktreesDir(world) {
  return path.join(world.workDir, 'worktrees');
}

// A worktree of the clone in `branch`, created from the origin branch if it does not exist
function addWorktree(world, branch, name = path.basename(branch)) {
  const project = world.lifecycleProject();
  const dir = path.join(worktreesDir(world), name);
  fs.mkdirSync(worktreesDir(world), { recursive: true });
  const exists = world.branches.revParse(project, `refs/heads/${branch}`);
  gitAt(project.dir, 'worktree', 'add', '-q', ...(exists ? [dir, branch] : ['-b', branch, dir, 'main']));
  return dir;
}

function gitAt(dir, ...args) {
  const { spawnSync } = require('node:child_process');
  const result = spawnSync('git', args, { cwd: dir, encoding: 'utf8' });
  if (result.status !== 0) throw new Error(`git ${args.join(' ')} (${dir}): ${result.stderr}`);
  return result.stdout;
}

// The branch a directory is on, or null with HEAD detached
function branchAt(dir) {
  return dirBranch(dir);
}

function dirBranch(dir) {
  const { spawnSync } = require('node:child_process');
  const result = spawnSync('git', ['symbolic-ref', '--short', '-q', 'HEAD'], { cwd: dir, encoding: 'utf8' });
  return result.status === 0 ? result.stdout.trim() : null;
}

// The worktrees of the clone: [{ directory, branch }]
function worktrees(world) {
  const text = gitAt(world.project.dir, 'worktree', 'list', '--porcelain');
  const list = [];
  for (const line of text.split('\n')) {
    if (line.startsWith('worktree ')) list.push({ directory: line.slice(9), branch: null });
    else if (line.startsWith('branch ') && list.length > 0) list.at(-1).branch = line.slice(7).replace(/^refs\/heads\//, '');
  }
  return list;
}

// The clone's local git config, without the entries of a branch
function localConfig(world, exceptBranch = null) {
  return gitAt(world.project.dir, 'config', '--local', '--list')
    .split('\n')
    .filter(Boolean)
    .filter((l) => !exceptBranch || !l.startsWith(`branch.${exceptBranch}.`))
    .sort();
}

// The options of the last modal the TUI showed
function lastModal(world) {
  return [...world.opencode.dialogs].reverse().find((d) => !d.kind && !d.alert) ?? null;
}

async function refresh(world) {
  return world.opencodeCall('state');
}


const sessions = (world) => Object.values(world.opencode.sessions);
const metaOf = (session) => session?.metadata?.openspec ?? null;

function owners(world) {
  return sessions(world).filter((s) => !s.time.archived && metaOf(s)?.role === 'owner');
}

function onlyOwner(world) {
  const list = owners(world);
  if (list.length !== 1) throw new Error(`expected one owner session, found ${list.length}:\n${describeSessions(world)}`);
  return list[0];
}

function session(world, id) {
  const s = world.opencode.sessions[id];
  if (!s) throw new Error(`no session ${id}:\n${describeSessions(world)}`);
  return s;
}

// The texts the model received in the requests of a session
function requestsOf(world, id) {
  return world.opencode.requests.filter((r) => r.sessionID === id);
}

function injected(world, id) {
  return requestsOf(world, id).flatMap((r) => r.messages.filter((m) => m.role === 'user' && m.text.includes(MARK)).map((m) => m.text));
}

// The instruction a session started with: its first user message, or the
// instruction injected into its first request
function instructionOf(world, id) {
  const s = session(world, id);
  const first = s.messages.find((m) => m.type === 'user');
  if (first?.text?.includes(MARK)) return first.text;
  return injected(world, id)[0] ?? '';
}

function toasts(world) {
  return world.opencode.toasts.map((t) => t.message).join('\n');
}

function describeSessions(world) {
  return sessions(world)
    .map((s) => `${s.id} «${s.title}» ${s.agent}${s.time.archived ? ' archived' : ''}${s.time.busy && (!s.time.idle || s.time.busy > s.time.idle) ? ' busy' : ''} ${JSON.stringify(metaOf(s))}\n  ${s.messages.map((m) => `${m.type}${m.text ? `:${m.text.slice(0, 80)}` : ''}${m.content ? `:${m.content.map((p) => (p.type === 'tool' ? `tool ${p.name}→${p.state.content?.[0]?.text?.slice(0, 80)}` : p.text?.slice(0, 60))).join('|')}` : ''}`).join('\n  ')}`)
    .join('\n') + `\ntoasts: ${toasts(world)}\ndialogs: ${JSON.stringify(world.opencode.dialogs)}\ncrashes: ${world.opencode.crashes.join('\n')}\ntool errors: ${world.opencode.toolErrors.join('\n')}`;
}

// The model of a session calls a tool in reply to the next message
async function scriptTool(world, sessionID, name, input) {
  await world.opencodeCall('script', { rules: [{ match: { sessionID, afterTool: false }, responses: [{ tool: { name, input } }] }] });
}

module.exports = {
  BRANCH,
  CHANGE,
  MARK,
  prepareChange,
  ownerMeta,
  ensureOpenCode,
  seed,
  refresh,
  sessions,
  metaOf,
  owners,
  onlyOwner,
  session,
  requestsOf,
  injected,
  instructionOf,
  toasts,
  describeSessions,
  scriptTool,
  snapshotNow,
  staged,
  gitIn,
  gitAt,
  projectAt,
  ensureRemote,
  remoteUnreachable,
  worktreesDir,
  addWorktree,
  branchAt,
  worktrees,
  localConfig,
  lastModal,
};
