'use strict';

// Core tests of the simulated OpenCode with several sessions
// (support/agents/opencode-sim.mjs), with a probe plugin written into the
// project copy, on what the plugins' own tests cannot tell apart from a bug in
// the plugin:
// - an RPC event whose TUI listener waits on a modal does not keep the host
//   busy: in OpenCode the server's emit does not wait for the TUI, so the
//   scenario can see the modal open and close it later, and the TUI's answer
//   still reaches the server (autopilot-plan-explore, design D5 and D6).
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
