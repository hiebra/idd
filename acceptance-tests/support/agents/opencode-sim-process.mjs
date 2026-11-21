// Child process of the simulated OpenCode with several sessions
// (opencode-sim.mjs): OpenCode runs its plugins in its own process, so a
// restart is a new process on the same session store. The World talks to it
// over IPC (opencode-sim.js): each message { id, op, args } gets one reply
// { id, ok, value | error }, after the host has settled.

import { Host } from './opencode-sim.mjs';

let host = null;
// What escapes the plugin's promises or timers would crash OpenCode's process
process.on('uncaughtException', (error) => host?.crash('uncaught exception', error));
process.on('unhandledRejection', (error) => host?.crash('unhandled rejection', error));

const OPS = {
  async start(args) {
    host = new Host(args);
    await host.load();
    return host.state();
  },
  async reload() {
    await host.setup();
    return host.state();
  },
  seed: (args) => host.seedSession(args),
  // The user writes a message in a session of the TUI
  async message({ sessionID, text }) {
    host.startTurn(sessionID, { text });
    await host.settle();
    return host.state();
  },
  // The user opens a new session in the TUI: it exists from its first message
  async open({ text, agent = 'build' }) {
    const id = host.seedSession({ title: text.slice(0, 40), agent });
    const session = host.session(id);
    delete session.time.idle;
    host.startTurn(id, { text });
    await host.settle();
    return { sessionID: id, state: host.state() };
  },
  switchAgent({ sessionID, agent }) {
    host.session(sessionID).agent = agent;
    host.save();
    return host.state();
  },
  script({ rules }) {
    host.script.push(...rules);
    return true;
  },
  answers({ answers }) {
    host.dialogAnswers.push(...answers);
    return true;
  },
  fail({ failures }) {
    Object.assign(host.failures, failures);
    return true;
  },
  async compact({ sessionID }) {
    await host.compact(sessionID);
    await host.settle();
    return host.state();
  },
  async settle() {
    await host.settle();
    return host.state();
  },
  state: () => host.state(),
};

process.on('message', async ({ id, op, args }) => {
  try {
    if (!OPS[op]) throw new Error(`unknown operation ${op}`);
    const value = await OPS[op](args ?? {});
    process.send({ id, ok: true, value });
  } catch (error) {
    process.send({ id, ok: false, error: String(error?.stack ?? error) });
  }
});
process.send({ ready: true });
