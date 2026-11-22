// Simulated OpenCode 2 host (design D6), run as a child process with the
// simulated machine's environment, as OpenCode runs plugins in its own process.
//
// It loads a local plugin of the project the way OpenCode 2 does: the parts
// of .opencode/plugins/<plugin>/ by file name (server.js, tui.js), each
// a default export { id, setup }. It calls the server part's setup with a
// fake server context and the TUI part's setup with a fake TUI context, wired
// together by an in-memory plugin RPC. Then it opens a shell the way OpenCode
// does before every command: it runs the create.before hooks on the command's
// environment. Last, it sends one user message: it builds the model request
// the way OpenCode 2 does and runs the session's `context` hooks on it, which
// may change its `system` parts and `messages` (checked with OpenCode 2.3.2,
// tasks 1.2 of add-llm-wiki-support). If a context hook throws, OpenCode
// fails the request: the message does not reach the model.
//
// After the message, it can reload the TUI part, emit an event of the
// plugin's RPC and close the TUI (fix-tui-subscription-cleanup, ADR-0011). As
// OpenCode 2.3.2, before each reload and at close it runs the cleanup that
// each part's setup returned, if it returned a function, and events.on(name,
// handler, { signal }) stops at the signal's abort. Unlike OpenCode, which
// reloads both parts, only the TUI part is reloaded here: running the server
// part again starts the bootstrap core again, and what is checked is the
// TUI's subscription (opencode-sim.mjs reloads both). The emitted event is
// synthetic: the host sends it, the bootstrap core does not produce it.
// Closing is a TUI that runs its own server (--standalone): each
// subscription still alive leaves a trace in the terminal, as OpenCode's
// client prints its ECONNRESET, and so does whatever the plugin writes to
// console.error while closing.
//
// Usage: node opencode-host.mjs <project dir> <options JSON> <result file>
// Options: { plugin, shell, frozenEnv, message, frozenMessages, tuiReloads, emit, close }
//   plugin: the directory name of the plugin under .opencode/plugins/
//   (default: session-bootstrap);
//   shell: "ok" | "none" (a server context without `shell`) | "throws" (its
//   hook() throws); frozenEnv: the command's environment cannot be changed;
//   message: the user message to send; frozenMessages: the request's
//   messages cannot be changed, so a hook that edits them throws;
//   tuiReloads: how many times to reload the TUI part; emit: { event, data },
//   an event of the plugin's RPC to emit after the reloads; close: close the
//   TUI at the end
// Result (JSON): { error, setupMs, env, toasts, logs, request, terminal, subscriptions }
//   terminal: the traces left in the terminal at close; subscriptions: the
//   TUI's subscriptions still alive at the end, { event, load }
//   request: { delivered, system, messages, error } of the message, where
//   system and messages are the texts the model receives

import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const [projectDir, optionsJson, resultFile] = process.argv.slice(2);
const options = JSON.parse(optionsJson);
const PLUGIN_DIR = path.join(projectDir, '.opencode', 'plugins', options.plugin ?? 'session-bootstrap');

const result = { error: null, setupMs: null, env: null, toasts: [], logs: [], request: null, terminal: [], subscriptions: [] };
const done = () => {
  fs.writeFileSync(resultFile, JSON.stringify(result));
  process.exit(0);
};
const fail = (where, error) => {
  result.error = `${where}: ${error?.stack ?? error}`;
  done();
};
// What escapes the plugin's promises or timers would crash OpenCode's process
process.on('uncaughtException', (error) => fail('uncaught exception', error));
process.on('unhandledRejection', (error) => fail('unhandled rejection', error));

// --- In-memory plugin RPC ------------------------------------------------------

const rpcServers = new Map(); // definition id -> { handlers, listeners: Map(name -> [{ fn, load }]) }

function rpcServer(id) {
  if (!rpcServers.has(id)) rpcServers.set(id, { handlers: null, listeners: new Map() });
  return rpcServers.get(id);
}

const pending = new Set(); // in-flight deliveries, awaited before reporting
function track(promise) {
  pending.add(promise);
  promise.finally(() => pending.delete(promise));
  return promise;
}

function serverRpc() {
  const rpc = () => {
    throw new Error('calling RPCs from the server part is not simulated');
  };
  rpc.register = async (definition, handlers) => {
    const server = rpcServer(definition.id);
    server.handlers = handlers;
    return {
      events: {
        emit: (name, data) =>
          track(
            (async () => {
              for (const listener of [...(server.listeners.get(name) ?? [])]) {
                await listener.fn({ type: `rpc.${definition.id}.${name}`, data });
              }
            })()
          ),
      },
    };
  };
  return rpc;
}

const clientRpc = (load) => (definition) => {
  const server = rpcServer(definition.id);
  const client = {
    events: {
      on(name, handler, options) {
        const signal = options?.signal;
        if (signal?.aborted) return () => {};
        if (!server.listeners.has(name)) server.listeners.set(name, []);
        const listener = { fn: handler, load };
        server.listeners.get(name).push(listener);
        const off = () => server.listeners.set(name, (server.listeners.get(name) ?? []).filter((l) => l !== listener));
        signal?.addEventListener('abort', off, { once: true });
        return off;
      },
    },
  };
  for (const name of Object.keys(definition.methods ?? {})) {
    client[name] = async (input) => {
      if (!server.handlers) throw Object.assign(new Error('rpc unavailable'), { type: 'rpc.unavailable' });
      return server.handlers[name](input, { error: (type, data) => ({ type, data }) });
    };
  }
  return client;
};

function subscriptions() {
  const alive = [];
  for (const server of rpcServers.values()) {
    for (const [event, listeners] of server.listeners) for (const listener of listeners) alive.push({ event, load: listener.load });
  }
  return alive;
}

// --- Contexts ------------------------------------------------------------------

const shellHooks = [];
const contextHooks = [];
// OpenCode's own system prompt, before any plugin edits it
const BASE_SYSTEM = 'You are OpenCode (simulated system prompt).';

function serverContext() {
  const ctx = {
    location: { directory: projectDir },
    options: {},
    rpc: serverRpc(),
    session: {
      async hook(name, callback) {
        if (name === 'context') contextHooks.push(callback);
        return { async dispose() {} };
      },
    },
  };
  if (options.shell !== 'none') {
    ctx.shell = {
      hook(name, callback) {
        if (options.shell === 'throws') throw new Error('simulated: shell hooks are not available');
        if (name !== 'create.before') throw new Error(`unknown shell hook '${name}'`);
        shellHooks.push(callback);
        return { dispose() {} };
      },
    };
  }
  return ctx;
}

function tuiContext(load) {
  return {
    options: {},
    location: { directory: projectDir },
    client: { rpc: clientRpc(load) },
    ui: {
      toast: {
        show(toast) {
          result.toasts.push(toast);
        },
      },
    },
  };
}

// A part the plugin directory does not have is skipped, as OpenCode does;
// the server part is required, since it is what the session needs
async function loadPart(name, { required, load = 1 }) {
  const file = path.join(PLUGIN_DIR, `${name}.js`);
  if (!required && !fs.existsSync(file)) return null;
  const plugin = (await import(`${pathToFileURL(file).href}?load=${load}`)).default;
  if (!plugin || typeof plugin.id !== 'string' || typeof plugin.setup !== 'function') {
    throw new Error(`${file} does not export { id, setup } by default`);
  }
  return plugin;
}

// --- Session -------------------------------------------------------------------

const log = (message) => result.logs.push(message);

let server;
let tui;
// What each part's setup returned to run at reload or close
const cleanups = { server: null, tui: null };
const keep = (part, returned) => {
  cleanups[part] = typeof returned === 'function' ? returned : null;
};
// As OpenCode 2.3.2: a failing cleanup is a toast
async function cleanup(part) {
  const fn = cleanups[part];
  cleanups[part] = null;
  if (!fn) return;
  try {
    await fn();
  } catch (error) {
    result.toasts.push({ variant: 'error', title: 'Plugin', message: `${part}: cleanup failed: ${error?.message ?? error}` });
  }
}
try {
  server = await loadPart('server', { required: true });
  tui = await loadPart('tui', { required: false });
} catch (error) {
  fail('loading the plugin', error);
}

try {
  const start = Date.now();
  keep('server', await server.setup(serverContext()));
  result.setupMs = Date.now() - start;
} catch (error) {
  fail('server setup', error);
}

try {
  if (tui) keep('tui', await tui.setup(tuiContext(1)));
} catch (error) {
  fail('tui setup', error);
}

// The first command of the session: OpenCode runs the create.before hooks on
// its environment, then spawns the shell with the resulting environment
try {
  const env = { ...process.env };
  const event = { command: 'openspec --version', cwd: projectDir, timeout: 120000, shell: 'bash', env: options.frozenEnv ? Object.freeze(env) : env };
  if (options.frozenEnv) Object.freeze(event);
  for (const hook of shellHooks) await hook(event);
  result.env = event.env;
} catch (error) {
  fail('shell create.before hook', error);
}

// The user sends a message: OpenCode builds the request and runs the
// context hooks on it before calling the model
const textOf = (content) =>
  typeof content === 'string' ? content : (content ?? []).filter((p) => p?.type === 'text').map((p) => p.text).join('\n');
try {
  const messages = [{ role: 'user', content: [{ type: 'text', text: options.message ?? 'hola' }] }];
  const input = {
    sessionID: 'ses_suite',
    model: { providerID: 'simulated', id: 'model' },
    agent: 'build',
    system: [{ type: 'text', text: BASE_SYSTEM }],
    messages: options.frozenMessages ? Object.freeze(messages) : messages,
    options: {},
    tools: {},
  };
  let error = null;
  for (const hook of contextHooks) {
    try {
      await hook(input);
    } catch (e) {
      error = `context hook: ${e?.stack ?? e}`;
      break;
    }
  }
  result.request = {
    delivered: error === null,
    error,
    system: error ? [] : input.system.map((part) => part.text),
    messages: error ? [] : input.messages.map((m) => ({ role: m.role, text: textOf(m.content) })),
    contextHooks: contextHooks.length,
  };
} catch (error) {
  fail('sending a message', error);
}

// The plugin's child processes still running (the bootstrap core, when no
// hook waits for it), as OpenCode keeps running while they do; Linux only,
// with a fixed wait elsewhere
async function childrenDone() {
  const file = `/proc/${process.pid}/task/${process.pid}/children`;
  if (!fs.existsSync(file)) return new Promise((resolve) => setTimeout(resolve, 2000));
  const deadline = Date.now() + 120000;
  while (fs.readFileSync(file, 'utf8').trim() !== '' && Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, 20));
  }
}
await childrenDone();
await new Promise((resolve) => setTimeout(resolve, 20));

// Deliveries to the TUI still in flight
while (pending.size > 0) await Promise.all([...pending]);
await new Promise((resolve) => setTimeout(resolve, 50));
// Hot reloads of the TUI part: the earlier load's cleanup, then a new load
try {
  for (let load = 2; tui && load <= 1 + (options.tuiReloads ?? 0); load += 1) {
    await cleanup('tui');
    tui = await loadPart('tui', { required: true, load });
    keep('tui', await tui.setup(tuiContext(load)));
  }
} catch (error) {
  fail('tui reload', error);
}

if (options.emit) {
  const id = tui?.id ?? server.id;
  for (const listener of [...(rpcServer(id).listeners.get(options.emit.event) ?? [])]) {
    try {
      await listener.fn({ type: `rpc.${id}.${options.emit.event}`, data: options.emit.data });
    } catch (error) {
      fail(`rpc listener ${options.emit.event}`, error);
    }
  }
  await new Promise((resolve) => setTimeout(resolve, 50));
}

if (options.close) {
  const original = console.error;
  console.error = (...args) => result.terminal.push(args.map((a) => (a instanceof Error ? a.stack : String(a))).join(' '));
  try {
    await cleanup('tui');
    await cleanup('server');
    for (const sub of subscriptions()) {
      result.terminal.push(`ClientError: Transport: ECONNRESET: The socket connection was closed unexpectedly (rpc event ${sub.event}, TUI load ${sub.load})`);
    }
  } finally {
    console.error = original;
  }
}

result.subscriptions = subscriptions();
log(`shell hooks: ${shellHooks.length}`);
done();
