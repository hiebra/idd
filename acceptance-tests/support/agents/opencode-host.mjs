// Simulated OpenCode 2 host (design D6), run as a child process with the
// simulated machine's environment, as OpenCode runs plugins in its own process.
//
// It loads the project's local plugin the way OpenCode 2 does: the parts of
// .opencode/plugins/session-bootstrap/ by file name (server.js, tui.js), each
// a default export { id, setup }. It calls the server part's setup with a
// fake server context and the TUI part's setup with a fake TUI context, wired
// together by an in-memory plugin RPC. Then it opens a shell the way OpenCode
// does before every command: it runs the create.before hooks on the command's
// environment. Like a real session, which stays open, it reports only once
// the processes the plugin started in the background have finished and their
// warnings have reached the TUI.
//
// Usage: node opencode-host.mjs <project dir> <options JSON> <result file>
// Options: { shell, frozenEnv }
//   shell: "ok" | "none" (a server context without `shell`) | "throws" (its
//   hook() throws); frozenEnv: the command's environment cannot be changed
// Result (JSON): { error, setupMs, env, toasts, logs }

import childProcess from 'node:child_process';
import fs from 'node:fs';
import { syncBuiltinESMExports } from 'node:module';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const [projectDir, optionsJson, resultFile] = process.argv.slice(2);
const options = JSON.parse(optionsJson);
const PLUGIN_DIR = path.join(projectDir, '.opencode', 'plugins', 'session-bootstrap');

const result = { error: null, setupMs: null, env: null, toasts: [], logs: [] };
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

// --- Background processes ----------------------------------------------------

// The plugin starts the session-bootstrap core with spawn() and does not wait
// for it when nothing else does (no shell hook to run). A real session stays
// open meanwhile, so the host waits for every process the plugin started
// before reporting. syncBuiltinESMExports() makes the plugin's
// `import { spawn } from "node:child_process"` see the wrapper.
const running = new Set();
const originalSpawn = childProcess.spawn;
childProcess.spawn = function spawn(...args) {
  const child = originalSpawn.apply(this, args);
  const closed = new Promise((resolve) => {
    child.on('close', resolve);
    child.on('error', resolve);
  });
  running.add(closed);
  closed.finally(() => running.delete(closed));
  return child;
};
syncBuiltinESMExports();

// --- In-memory plugin RPC ------------------------------------------------------

const rpcServers = new Map(); // definition id -> { handlers, listeners }

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
              for (const handler of server.listeners.get(name) ?? []) {
                await handler({ type: `rpc.${definition.id}.${name}`, data });
              }
            })()
          ),
      },
    };
  };
  return rpc;
}

function clientRpc(definition) {
  const server = rpcServer(definition.id);
  const client = {
    events: {
      on(name, handler) {
        if (!server.listeners.has(name)) server.listeners.set(name, []);
        server.listeners.get(name).push(handler);
        return () => server.listeners.set(name, server.listeners.get(name).filter((h) => h !== handler));
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
}

// --- Contexts ------------------------------------------------------------------

const shellHooks = [];

function serverContext() {
  const ctx = {
    location: { directory: projectDir },
    options: {},
    rpc: serverRpc(),
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

function tuiContext() {
  return {
    options: {},
    location: { directory: projectDir },
    client: { rpc: clientRpc },
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
async function loadPart(name, { required }) {
  const file = path.join(PLUGIN_DIR, `${name}.js`);
  if (!required && !fs.existsSync(file)) return null;
  const plugin = (await import(pathToFileURL(file).href)).default;
  if (!plugin || typeof plugin.id !== 'string' || typeof plugin.setup !== 'function') {
    throw new Error(`${file} does not export { id, setup } by default`);
  }
  return plugin;
}

// --- Session -------------------------------------------------------------------

const log = (message) => result.logs.push(message);

let server;
let tui;
try {
  server = await loadPart('server', { required: true });
  tui = await loadPart('tui', { required: false });
} catch (error) {
  fail('loading the plugin', error);
}

try {
  const start = Date.now();
  await server.setup(serverContext());
  result.setupMs = Date.now() - start;
} catch (error) {
  fail('server setup', error);
}

try {
  if (tui) await tui.setup(tuiContext());
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

// Background processes and deliveries to the TUI still in flight; a process
// that ends may queue new deliveries, so wait until both are done
const settle = () => new Promise((resolve) => setTimeout(resolve, 50));
do {
  while (running.size > 0) await Promise.all([...running]);
  await settle();
  while (pending.size > 0) await Promise.all([...pending]);
  await settle();
} while (running.size > 0 || pending.size > 0);
log(`shell hooks: ${shellHooks.length}`);
done();
