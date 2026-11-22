'use strict';

// Core tests of what the openspec-autopilot plugin injects when the user
// switches agents in the operational session (autopilot-plan-explore, design
// D2 and D3), outside the specs:
// - the turn's key does not change between the requests of one turn (after
//   each tool), whatever other hooks inject before the user's message, and
//   changes with each new message of the user;
// - the transitions between build and plan, with an absent or unknown agent
//   treated as build;
// - the texts name the step or the review, explorePrompt names the skill
//   `openspec-explore`, and none asks for a commit.
//
// Run with: npm run test:core

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { REPO_ROOT } = require('../support/project');

const LIB = path.join(REPO_ROOT, '.opencode', 'plugins', 'openspec-autopilot', 'lib');
const TURN = pathToFileURL(path.join(LIB, 'agent-turn.mjs')).href;
const PROMPTS = pathToFileURL(path.join(LIB, 'prompts.mjs')).href;

const user = (text) => ({ role: 'user', content: [{ type: 'text', text }] });
const assistant = (text) => ({ role: 'assistant', content: [{ type: 'text', text }] });
const call = (name) => ({ role: 'assistant', content: [{ type: 'tool-call', name, input: {} }] });
const result = (name) => ({ role: 'tool', content: [{ type: 'tool-result', name, result: { type: 'text', value: 'ok' } }] });

test('the turn key is stable within a turn and changes with each message of the user', async () => {
  const { turnKey } = await import(TURN);
  const first = [user('[openspec-autopilot] Esta sesión es la sesión operativa…')];
  const afterTool = [...first, call('read'), result('read')];
  assert.equal(turnKey(first), turnKey(afterTool));
  // Another hook (session-bootstrap) injects its reminder before the last user message
  assert.equal(turnKey(first), turnKey([user('Recordatorio del wiki'), ...afterTool]));
  const second = [...afterTool, assistant('Hecho.'), user('¿Qué queda?')];
  assert.notEqual(turnKey(second), turnKey(first));
  const third = [...second, assistant('Nada.'), user('¿Qué queda?')];
  assert.notEqual(turnKey(third), turnKey(second));
  assert.equal(turnKey([]), null);
});

test('the transitions between build and plan decide what the turn injects', async () => {
  const { transition } = await import(TURN);
  assert.equal(transition(undefined, 'build'), 'step');
  assert.equal(transition('build', 'build'), 'step');
  assert.equal(transition(undefined, 'plan'), 'explore');
  assert.equal(transition('build', 'plan'), 'explore');
  assert.equal(transition('plan', 'plan'), 'explore-reminder');
  assert.equal(transition('plan', 'build'), 'return');
  // An absent or unknown agent is build: the plugin behaves as before
  assert.equal(transition('plan', undefined), 'return');
  assert.equal(transition('build', 'general'), 'step');
  assert.equal(transition('general', 'plan'), 'explore');
});

test('a new turn decides once, and the requests of the same turn repeat it', async () => {
  const { agentTurn } = await import(TURN);
  const t1 = agentTurn(null, { key: 'k1', agent: 'build' });
  assert.deepEqual(t1, { state: { key: 'k1', agent: 'build', kind: 'step' }, fresh: true });
  const t2 = agentTurn(t1.state, { key: 'k2', agent: 'plan' });
  assert.deepEqual(t2, { state: { key: 'k2', agent: 'plan', kind: 'explore' }, fresh: true });
  // A request after a tool, same turn: no new decision
  assert.deepEqual(agentTurn(t2.state, { key: 'k2', agent: 'plan' }), { state: t2.state, fresh: false });
  const t3 = agentTurn(t2.state, { key: 'k3', agent: 'plan' });
  assert.equal(t3.state.kind, 'explore-reminder');
  const t4 = agentTurn(t3.state, { key: 'k4', agent: 'build' });
  assert.equal(t4.state.kind, 'return');
  assert.equal(agentTurn(t4.state, { key: 'k5', agent: 'plan' }).state.kind, 'explore');
  // Without a key (no user message), nothing is decided
  assert.deepEqual(agentTurn(t4.state, { key: null, agent: 'plan' }), { state: t4.state, fresh: false });
});

const STEPS = [
  [{ kind: 'artifact', id: 'design' }, /artefacto design de exportar-datos/],
  [{ kind: 'task', id: '3', label: '3' }, /task 3 de exportar-datos/],
  [{ kind: 'review', id: '3', label: '3', of: 'task' }, /revisión de la task 3 de exportar-datos/],
];
const ASKS_COMMIT = /haz (el|un) commit|git commit|haz commit/i;

test('the texts name the step or the review, and none asks for a commit', async () => {
  const { MARK, explorePrompt, exploreReminderPrompt, returnPrompt, planNoticeText } = await import(PROMPTS);
  for (const [step, name] of STEPS) {
    const explore = explorePrompt({ step, change: 'exportar-datos' });
    assert.ok(explore.startsWith(MARK), explore);
    assert.match(explore, /`openspec-explore`/);
    assert.match(explore, name);
    const reminder = exploreReminderPrompt({ step, change: 'exportar-datos' });
    assert.ok(reminder.startsWith(MARK), reminder);
    assert.match(reminder, name);
    assert.ok(reminder.length < explore.length);
    const back = returnPrompt({ step, change: 'exportar-datos', phase: step.kind === 'review' ? 'review' : 'running' });
    assert.ok(back.startsWith(MARK), back);
    assert.match(back, /vuelves de explorar/i);
    assert.match(back, name);
    assert.doesNotMatch(back, /openspec-explore/);
    for (const text of [explore, reminder, back]) assert.doesNotMatch(text, ASKS_COMMIT, text);
  }
  const waiting = returnPrompt({ step: { kind: 'artifact', id: 'design' }, change: 'exportar-datos', phase: 'waiting-commit' });
  assert.match(waiting, /esperando a que el usuario haga el commit/);
  const notice = planNoticeText();
  assert.match(notice, /agente plan/);
  assert.match(notice, /agente build/);
  assert.doesNotMatch(notice, ASKS_COMMIT);
});
