'use strict';

// Core tests of the simulated OpenCode with several sessions
// (support/agents/opencode-sim.mjs), with a probe plugin written into the
// project copy, on what the plugins' own tests cannot tell apart from a bug in
// the plugin:
// - an RPC event whose TUI listener waits on a modal does not keep the host
//   busy: in OpenCode the server's emit does not wait for the TUI, so the
//   scenario can see the modal open and close it later, and the TUI's answer
//   still reaches the server (autopilot-plan-explore, design D5 and D6);
// - with the plan agent, each request carries OpenCode's own reminder as a
//   user message: before the user's message in the first request of the
//   turn, and at the end, after the tool's result, in the next ones (task 1.1
//   of autopilot-plan-explore, checked with OpenCode 2.3.2);
// - the `prompt` hook comes once per message, with delivery "steer" and the
//   messageID that the stored message carries as `id` in the `context`
//   input; a message sent while the turn goes on enters the same loop, after
//   the tool's result, with a single idle at the end (task 1.4).
//
// Run with: npm run test:core

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { Machine } = require('../support/machine');
const { OpenCodeSim } = require('../support/agents/opencode-sim');

const DEFINITION = `{
  id: 'probe',
  methods: { ask: { input: { type: 'object' }, output: { type: 'object' } }, reply: { input: { type: 'object' }, output: { type: 'object' } } },
  events: { request: { schema: { type: 'object' } } },
}`;

// The server asks the TUI with an event and logs the TUI's answer
const SERVER = `const DEFINITION = ${DEFINITION};
export default {
  id: 'probe',
  async setup(ctx) {
    const registration = await ctx.rpc.register(DEFINITION, {
      ask: async () => {
        registration.events.emit('request', { question: 'Aviso' });
        return { ok: true };
      },
      reply: async (input) => {
        console.error('probe reply ' + input.value);
        return { ok: true };
      },
    });
    // What each request to the model carries, in order
    await ctx.session.hook('context', async (input) => {
      const text = (m) => (m.content ?? []).map((p) => p.text ?? (p.type === 'tool-call' ? '[call]' : p.type === 'tool-result' ? '[result]' : '')).join('');
      console.error('probe context ' + JSON.stringify({ agent: input.agent, messages: input.messages.map((m) => m.role + ':' + text(m)), ids: input.messages.map((m) => m.id ?? null) }));
    });
    await ctx.session.hook('prompt', async (input) => {
      console.error('probe prompt ' + JSON.stringify({ messageID: input.messageID, delivery: input.delivery, text: input.prompt.text }));
    });
    await ctx.session.hook('experimental.idle', async (input) => {
      console.error('probe idle ' + input.sessionID);
    });
  },
};
`;

// The TUI answers the event with a modal, and asks when the terminal gets the focus
const TUI = `const DEFINITION = ${DEFINITION};
export default {
  id: 'probe',
  async setup(context) {
    const client = context.client.rpc(DEFINITION);
    client.events.on('request', async (event) => {
      const value = await context.ui.dialog.select({ title: event.data.question, options: [{ title: 'Entendido', value: 'ok' }] });
      await client.reply({ value: value ?? 'esc' });
    });
    context.renderer.on('focus', () => {
      client.ask({});
    });
  },
};
`;

function probeSim(t) {
  const workDir = Machine.tmpDir();
  const projectDir = path.join(workDir, 'project');
  const pluginDir = path.join(projectDir, '.opencode', 'plugins', 'probe');
  fs.mkdirSync(pluginDir, { recursive: true });
  fs.writeFileSync(path.join(pluginDir, 'server.js'), SERVER);
  fs.writeFileSync(path.join(pluginDir, 'tui.js'), TUI);
  const sim = new OpenCodeSim({ projectDir, workDir, plugin: 'probe', alreadyOpen: true });
  t.after(() => {
    sim.dispose();
    fs.rmSync(workDir, { recursive: true, force: true });
  });
  return sim;
}

test('an RPC event waiting on a modal does not keep the simulated OpenCode busy', async (t) => {
  const sim = probeSim(t);
  await sim.start();
  await sim.call('dialogWait', { on: true });
  // Settles with the modal open, instead of waiting for the user
  const open = await sim.call('focus');
  const shown = open.dialogs.at(-1);
  assert.equal(shown?.title, 'Aviso', JSON.stringify(open.dialogs));
  assert.equal(shown.open, true);
  assert.deepEqual(open.crashes, []);
  // Closing it sends the TUI's answer to the server
  const closed = await sim.call('answers', { answers: [{ key: 'enter' }], settle: true });
  assert.equal(closed.dialogs.at(-1).open, false);
  assert.ok(closed.logs.includes('probe reply ok'), JSON.stringify(closed.logs));
  assert.deepEqual(closed.crashes, []);
});

const contexts = (state) => state.logs.filter((l) => l.startsWith('probe context ')).map((l) => JSON.parse(l.slice('probe context '.length)));

test('with the plan agent, each request carries the plan reminder as a user message, where OpenCode puts it', async (t) => {
  const sim = probeSim(t);
  await sim.start();
  await sim.call('script', { rules: [{ match: { agent: 'plan' }, responses: [{ tool: { name: 'read', input: {} } }, { text: 'Hecho.' }] }] });
  const { state } = await sim.call('open', { text: '¿Qué queda?', agent: 'plan' });
  const [first, second] = contexts(state);
  assert.equal(first.agent, 'plan');
  assert.equal(first.messages.length, 2, JSON.stringify(first));
  assert.match(first.messages[0], /^user:<system-reminder>[\s\S]*Plan mode/);
  assert.equal(first.messages[1], 'user:¿Qué queda?');
  // After the tool, the reminder goes at the end
  assert.deepEqual(second.messages.slice(0, 3), ['user:¿Qué queda?', 'assistant:[call]', 'tool:[result]'], JSON.stringify(second));
  assert.match(second.messages[3], /^user:<system-reminder>[\s\S]*Plan mode/);
  assert.equal(second.messages.length, 4);
  // With build, no reminder
  const built = await sim.call('open', { text: 'Sigue.', agent: 'build' });
  const last = contexts(built.state).at(-1);
  assert.equal(last.agent, 'build');
  assert.deepEqual(last.messages, ['user:Sigue.']);
});

const prompts = (state) => state.logs.filter((l) => l.startsWith('probe prompt ')).map((l) => JSON.parse(l.slice('probe prompt '.length)));
const idles = (state) => state.logs.filter((l) => l.startsWith('probe idle '));

test('the prompt hook comes once per message, and its messageID is the id of the stored message', async (t) => {
  const sim = probeSim(t);
  await sim.start();
  await sim.call('script', { rules: [{ responses: [{ tool: { name: 'read', input: {} } }, { text: 'Hecho.' }] }] });
  const { sessionID, state } = await sim.call('open', { text: 'Hola', agent: 'plan' });
  const [p] = prompts(state);
  assert.equal(prompts(state).length, 1);
  assert.equal(p.delivery, 'steer');
  assert.match(p.messageID, /^msg_/);
  const [first, second] = contexts(state);
  // The plan reminder has no id in the first request, and its own one after the tool
  assert.deepEqual(first.ids, [null, p.messageID], JSON.stringify(first));
  assert.equal(second.ids[0], p.messageID);
  assert.ok(second.ids[1], 'the assistant message has an id');
  assert.equal(second.ids[2], null, 'a tool result has no id');
  assert.ok(second.ids[3] && second.ids[3] !== p.messageID, JSON.stringify(second));
  // Another message: another messageID
  const next = await sim.call('message', { sessionID, text: 'Otra' });
  assert.notEqual(prompts(next).at(-1).messageID, p.messageID);
});

test('a message sent while the turn goes on enters the same loop, after the tool, with a single idle', async (t) => {
  const sim = probeSim(t);
  await sim.start();
  // The model takes a while with its tool, so the user writes meanwhile
  await sim.call('script', { rules: [{ responses: [{ tool: { name: 'read', input: {} }, delayMs: 400 }, { text: 'Visto.' }] }] });
  const sessionID = await sim.call('openAsync', { text: 'Mira el README', agent: 'build' });
  await new Promise((resolve) => setTimeout(resolve, 150));
  const state = await sim.call('message', { sessionID, text: 'Y el CHANGELOG' });
  assert.deepEqual(prompts(state).map((p) => p.text), ['Mira el README', 'Y el CHANGELOG']);
  const all = contexts(state);
  assert.equal(all.length, 2, JSON.stringify(all));
  assert.deepEqual(all[1].messages, ['user:Mira el README', 'assistant:[call]', 'tool:[result]', 'user:Y el CHANGELOG']);
  assert.equal(all[1].ids[3], prompts(state)[1].messageID);
  assert.equal(idles(state).length, 1, JSON.stringify(state.logs));
  assert.deepEqual(state.crashes, []);
});
