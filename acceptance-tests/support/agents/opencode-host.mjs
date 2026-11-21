// Simulated OpenCode 2 host (design D6), run as a child process with the
// simulated machine's environment, as OpenCode runs plugins in its own process.
//
// It loads the project's local plugin the way OpenCode 2 does: the parts of
// .opencode/plugins/session-bootstrap/ by file name (server.js, tui.js), each
// a default export { id, setup }. It calls the server part's setup with a
// fake server context and the TUI part's setup with a fake TUI context, wired
// together by an in-memory plugin RPC. Then it opens a shell the way OpenCode
// does before every command: it runs the create.before hooks on the command's
// environment.
//
// Usage: node opencode-host.mjs <project dir> <options JSON> <result file>
// Options: { shell: boolean } (false: a server context without `shell`)
// Result (JSON): { error, setupMs, env, toasts, logs }

import fs from 'node:fs';
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
  if (options.shell) {
    ctx.shell = {
      hook(name, callback) {
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
  const event = { command: 'openspec --version', cwd: projectDir, timeout: 120000, shell: 'bash', env: { ...process.env } };
  for (const hook of shellHooks) await hook(event);
  result.env = event.env;
} catch (error) {
  fail('shell create.before hook', error);
}

// Deliveries to the TUI still in flight
while (pending.size > 0) await Promise.all([...pending]);
await new Promise((resolve) => setTimeout(resolve, 50));
log(`shell hooks: ${shellHooks.length}`);
done();
