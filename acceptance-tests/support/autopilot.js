'use strict';

// Support of the openspec-autopilot scenarios (design D16 of
// add-openspec-autopilot): a temporary branch with the change in the state a
// scenario needs, sessions already stored in the simulated OpenCode (the
// change's earlier sessions, a stopped or working owner) and readers of what
// the plugin did.

const fs = require('node:fs');
const path = require('node:path');

const BRANCH = 'feature/exportar-datos';
const CHANGE = 'exportar-datos';
const MARK = '[openspec-autopilot]';

// The planning artifacts written, in the schema's order; tasks are { id, done }
async function prepareChange(world, { artifacts = ['proposal', 'specs', 'design', 'adr', 'tasks'], tasks = null, commit = true } = {}) {
  const project = world.lifecycleProject();
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
  return { v: 1, worktree: world.project.dir, branch: BRANCH, change: CHANGE, role: 'owner', step, seq: 1, phase: 'running', zone: null, injected: true, ...extra };
}

async function ensureOpenCode(world, options = {}) {
  if (!world.sim) await world.startOpenCode({ pluginOptions: world.pluginOptions ?? {}, ...options });
  return world.sim;
}

// A session already in OpenCode's store
async function seed(world, { title, step, busy = false, archived = false, agent = 'build', meta = {}, messages = [] }) {
  await ensureOpenCode(world);
  const metadata = step === null ? {} : { openspec: ownerMeta(world, step, meta) };
  return world.opencodeCall('seed', { title, agent, metadata, busy, archived, messages });
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
};
