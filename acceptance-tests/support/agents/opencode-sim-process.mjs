// Child process of the simulated OpenCode with several sessions
// (opencode-sim.mjs): OpenCode runs its plugins in its own process, so a
// restart is a new process on the same session store. The World talks to it
// over IPC (opencode-sim.js): each message { id, op, args } gets one reply
// { id, ok, value | error }, after the host has settled.

import { register } from 'node:module';
import { fileURLToPath } from 'node:url';
import { Host } from './opencode-sim.mjs';

// The branch-change.mjs files the process imports, as paths
const imported = [];
const { port1, port2 } = new MessageChannel();
port1.on('message', (url) => imported.push(fileURLToPath(url.replace(/\?.*$/, ''))));
port1.unref();
register('./load-recorder.mjs', { parentURL: import.meta.url, data: { port: port2 }, transferList: [port2] });
globalThis[Symbol.for('opencode-sim.imported')] = imported;

let host = null;

// Longer than the TUI's poll (300 ms), then until nothing is pending
async function waitScreen() {
  await new Promise((resolve) => setTimeout(resolve, 450));
  await host.settle();
  await new Promise((resolve) => setTimeout(resolve, 50));
  await host.settle();
  return host.state();
}
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
  // The user closes a TUI that runs its own server (--standalone)
  async close() {
    await host.close();
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
  // Answers dialogs: the open ones first, then the next ones
  async answers({ answers, settle = false }) {
    for (const answer of answers) host.answer(answer);
    if (settle) await host.settle();
    return host.state();
  },
  dialogWait({ on = true }) {
    host.dialogWait = on;
    return true;
  },
  // Writes a message without waiting for what it sets off (a dialog may stay open)
  messageAsync({ sessionID, text }) {
    host.startTurn(sessionID, { text });
    return true;
  },
  openAsync({ text, agent = 'build' }) {
    const id = host.seedSession({ title: text.slice(0, 40), agent });
    delete host.session(id).time.idle;
    host.startTurn(id, { text });
    return id;
  },
  // Waits until a dialog is open
  async waitDialog({ limitMs = 10000 }) {
    const deadline = Date.now() + limitMs;
    while (host.openDialogs.length === 0) {
      if (Date.now() > deadline) throw new Error('no dialog was opened');
      await new Promise((resolve) => setTimeout(resolve, 20));
    }
    return host.state();
  },
  // The TUI's screen: what the user sees changes, and the TUI notices it in its next poll
  async home() {
    host.setRoute({ type: 'home' });
    return waitScreen();
  },
  async goto({ sessionID }) {
    host.setRoute({ type: 'session', sessionID });
    return waitScreen();
  },
  async blur() {
    host.focus('blur');
    return waitScreen();
  },
  async focus() {
    host.focus('focus');
    return waitScreen();
  },
  // The user writes the first message in the home screen: the session exists from it
  async openHome({ text, agent = 'build' }) {
    const id = host.seedSession({ title: text.slice(0, 40), agent });
    delete host.session(id).time.idle;
    host.startTurn(id, { text });
    host.setRoute({ type: 'session', sessionID: id });
    await waitScreen();
    return { sessionID: id, state: host.state() };
  },
  async waitScreen() {
    return waitScreen();
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
