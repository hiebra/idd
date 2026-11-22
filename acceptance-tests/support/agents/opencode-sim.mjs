// Simulated OpenCode 2 with several sessions (design D16 of
// add-openspec-autopilot), run as a long-lived child process (forked by
// opencode-sim.js) and driven by the World over IPC, one operation at a time.
//
// It loads a local plugin of the project (.opencode/plugins/<plugin>/, its
// server.js and tui.js) and simulates what that plugin may use of OpenCode,
// following the contract checked with OpenCode 2.3.2 (tasks 1.1-1.5 of
// add-openspec-autopilot and the lessons in
// .wiki/raw/notes/2026-11-21-ll-sesiones-opencode-autopilot.md):
//
// - Sessions in a store that survives a restart (a JSON file): create, get,
//   list (archived included unless filtered; { data, cursor } by pages, with
//   small pages here so that paging is exercised), update. `update({ metadata })`
//   replaces the metadata whole; `archived` is ignored by the server's
//   ctx.session and applied by the TUI's client (lesson 1).
// - Execution: prompt and command start a turn in the background; each model
//   request runs the `context` hooks first (a hook that throws fails the
//   request), then asks the scripted model. A tool call runs the tool and asks
//   again. When the model answers with text, the session goes idle and the
//   `experimental.idle` hooks run; after an interruption they do not.
//   time.busy and time.idle tell whether a session works.
// - context({ sessionID }) returns the messages of any session, archived too.
// - Tools: only those declared with options.codemode === false reach the model.
// - TUI: ui.router.navigate, ui.dialog.select with scripted answers, toasts,
//   and client.session.update. Without a TUI, tui.js is not loaded.
// - Plugin RPC in memory. A reload runs setup again: the server keeps only the
//   last generation's hooks, tools and RPC handlers (task 1.4 of
//   add-openspec-autopilot). Before it, as OpenCode 2.3.2 does, it runs the
//   cleanup that each part's previous setup returned, if it returned a
//   function. The TUI's event listeners stay alive across reloads only if the
//   plugin does not release them: events.on(name, handler, { signal }) stops
//   at the signal's abort and returns a function that unsubscribes
//   (fix-tui-subscription-cleanup, ADR-0011).
// - Closing a TUI that runs its own server (--standalone): runs the cleanups,
//   then closes the server. Each subscription still alive leaves a trace in
//   the terminal, as OpenCode's client prints its ECONNRESET, and so does
//   whatever the plugin writes to console.error while closing.
// - Failures can be injected per operation (e.g. "session.create").
// - autopilot-sesion-operativa (design D15): the `prompt` hook, run with each
//   user message before the `context` hooks, with a mutable text; the TUI's
//   screen (ui.router.current(), its own route, changed by navigations, by
//   opening the home screen and by jumping to a session) and the terminal's
//   focus (renderer.on/off "focus" | "blur"); dialogs answered with Enter
//   (the first option) or Esc (undefined), and ui.dialog.alert; the TUI's PID
//   (a restart is a new process; a reload keeps it); a TUI part that loads
//   before the server registers its RPC (`rpcLate`); a client without TUI
//   that writes in sessions; and model responses with effects on the project
//   (`files`, `git`) before their text or tool call. What the plugin writes to
//   console.error is kept in `logs`.
// - autopilot-rama-por-sesion (design D9), as checked with OpenCode 2.3.2:
//   - several directories of the same project (the main checkout and its
//     worktrees), each session with its own (`location.directory`), and one
//     instance of the server part per directory, loaded the first time the
//     TUI enters it or one of its sessions works; the earlier ones stay alive.
//     Hooks, tools and RPC handlers are per instance; a session's turn uses
//     those of its directory, and a TUI call goes to the instance of the
//     location it names (without one, to the directory the TUI started in);
//   - the TUI's `context.location`, which follows its screen: a session's
//     directory, or the location of a home route ({ type: "home", location });
//   - `ctx.worktree.transform` with `add` of a strategy { id, create, remove,
//     list }: the last one registered and still loaded is selected (one with
//     the same id replaces the earlier), and a reload or unload drops the
//     earlier ones, back to the bundled git strategy (`git worktree add --detach`). `ctx.worktree.create({ name })`,
//     the TUI and the web create worktrees with it under a directory outside
//     the clone; a worktree is removed with the strategy that created it;
//   - `context.keymap.dispatch`: "session.move" opens «Manage workspaces» and
//     then "dialog.move_session.new" opens «Name worktree»; confirming it
//     (`nameWorktree`, with a name or generated) creates the worktree and
//     opens the home screen in it;
//   - model responses' `git` effects run in their session's directory.
// - The fixes after the tests with OpenCode 2.3.2 real (section 8 of tasks):
//   - the server context has `location.project` ({ id, directory,
//     canonical }) and no `project`;
//   - a strategy's `remove` gets only { directory, force }, and an error from
//     a strategy reaches the client wrapped ("Worktree strategy <id> failed
//     to <operation>: <message>"), without `forceRequired`;
//   - "dialog.move_session.new" does nothing until «Manage workspaces» is
//     mounted, a moment after "session.move" (WORKSPACES_MOUNT_MS, or the
//     `workspacesMountMs` option);
//   - from the home screen, confirming «Name worktree» leaves the worktree
//     pending ("(new worktree)"): it is created with the user's first
//     message, in a session of the worktree with that message, and the TUI
//     goes to that session. From a session, it is created at once and the
//     TUI opens the home screen in it.
// - autopilot-plan-explore (design D6): an RPC delivery to the TUI whose
//   listener waits on an open dialog (dialogWait) does not keep settle()
//   waiting, as OpenCode's emit does not wait for the TUI; the scenario sees
//   the dialog open in `dialogs` and closes it with `answers`. Model rules
//   match the session's agent (`match.agent`), switched with `switchAgent`.
//   With the plan agent, each request carries OpenCode's reminder as a user
//   message (`<system-reminder>`): before the user's message in the first
//   request of a turn, at the end after a tool's result in the next ones.
//   Each stored message carries its `id` in the `context` input (a user
//   message, the messageID of its `prompt` hook). A message sent while the
//   turn goes on passes the `prompt` hook when it enters and joins the same
//   loop (delivery "steer"), before the next request, with a single idle at
//   the end. A scripted response may take `delayMs` before it acts.
//
// The model is a script per scenario: rules matched against the session,
// each with a queue of responses ({ text }, { tool: { name, input } }).

import fs from 'node:fs';
import { AsyncLocalStorage } from 'node:async_hooks';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const BASE_SYSTEM = 'You are OpenCode (simulated system prompt).';
// «Manage workspaces» takes a moment to mount after session.move
export const WORKSPACES_MOUNT_MS = 60;
const PLAN_REMINDER = '<system-reminder>\nYou are in Plan mode (simulated): you must not make any edits; only read, search and plan.\n</system-reminder>';
const BUILTIN_TOOLS = ['edit', 'glob', 'grep', 'question', 'read', 'shell', 'skill', 'subagent', 'write'];
const PROJECT_ID = 'prj_simulado';

let clock = 0;
// Strictly increasing times, so that busy/idle comparisons are exact
const now = () => {
  const t = Math.max(Date.now(), clock + 1);
  clock = t;
  return t;
};
const clone = (value) => (value === undefined ? undefined : JSON.parse(JSON.stringify(value)));


// An error from a plugin's strategy, as OpenCode 2.3.2 passes it on: wrapped,
// without forceRequired (only its own error classes keep it)
async function wrapped(id, operation, fn) {
  try {
    return await fn();
  } catch (error) {
    throw new Error(`Worktree strategy ${id} failed to ${operation}: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export class Host {
  constructor({ projectDir, plugin, pluginDir = null, dbFile, tui = true, pluginOptions = {}, failures = {}, tuiSilent = false, rpcLate = false, alreadyOpen = false, worktreesDir = null, workspacesMountMs = WORKSPACES_MOUNT_MS }) {
    // OpenCode was already open: this process's TUI has presented itself
    // before, so loading the plugin is like a hot reload and not a start
    // (the registry the plugin keeps in globalThis, design D3 of
    // autopilot-sesion-operativa)
    if (alreadyOpen) globalThis[Symbol.for('openspec-autopilot.registry')] = { gens: {}, pids: { [projectDir]: [String(process.pid)] } };
    this.rpcLate = rpcLate;
    this.projectDir = projectDir;
    // Where worktrees are created (OpenCode's data directory in the real one)
    this.worktreesDir = worktreesDir ?? path.join(path.dirname(projectDir), `${path.basename(projectDir)}-worktrees`);
    this.route = { type: 'home', location: { directory: projectDir } };
    this.lastDir = projectDir;
    this.focusListeners = { focus: new Set(), blur: new Set() };
    // A TUI that never answers what the server asks it (its event listeners get nothing)
    this.tuiSilent = tuiSilent;
    this.projectDir = projectDir;
    // A plugin of the project, or one installed elsewhere (the global
    // install's <config>/opencode/plugins/<plugin>)
    this.pluginDir = pluginDir ?? path.join(projectDir, '.opencode', 'plugins', plugin);
    this.dbFile = dbFile;
    this.withTui = tui;
    this.pluginOptions = pluginOptions;
    this.failures = { ...failures };
    this.store = fs.existsSync(dbFile) ? JSON.parse(fs.readFileSync(dbFile, 'utf8')) : { seq: 0, sessions: {}, worktrees: {} };
    this.store.worktrees ??= {};
    this.generation = 0;
    // One instance of the server part per directory: { dir, hooks, tools, loaded }
    this.instances = new Map();
    this.loading = new Map();
    this.rpc = new Map(); // definition id -> { handlers: Map(dir -> handlers), listeners: Map(name -> [{ fn, load }]) }
    // Worktree strategies registered by the instances: [{ strategy, dir, generation }]
    this.strategies = [];
    // What each part's last setup returned to run at reload or close
    this.cleanups = [];
    // Loads of the TUI part, the first one is 1
    this.tuiLoad = 0;
    this.closed = false;
    this.script = [];
    this.dialogAnswers = [];
    // With dialogWait, a dialog with no queued answer stays open until one arrives
    this.dialogWait = false;
    this.openDialogs = [];
    // The keymap's dialogs: «Manage workspaces» and «Name worktree»
    this.workspaces = null;
    this.pendingWorktree = null;
    this.workspacesMountMs = workspacesMountMs;
    this.out = { toasts: [], navigations: [], dialogs: [], archives: [], requests: [], crashes: [], toolErrors: [], logs: [], terminal: [], prompts: [], routes: [], rpcCalls: [], keymap: [], worktrees: [] };
    const original = console.error;
    console.error = (...args) => {
      this.out.logs.push(args.map((a) => (a instanceof Error ? a.stack : typeof a === 'string' ? a : JSON.stringify(a))).join(' '));
      original(...args);
    };
    this.pending = new Set();
    // Sessions with a turn running, and the messages that entered during it (steer)
    this.running = new Set();
    this.steering = new Map();
    // RPC deliveries to the TUI that wait on an open dialog (see settle)
    this.delivery = new AsyncLocalStorage();
    // Each tracked delivery and its state ({ blocked }), set while it waits on an open dialog
    this.deliveries = new Map();
    this.interrupted = new Set();
    this.slugs = 0;
  }

  // --- bookkeeping ---------------------------------------------------------

  save() {
    fs.writeFileSync(this.dbFile, JSON.stringify(this.store));
  }

  track(promise) {
    const p = Promise.resolve(promise).catch((error) => this.crash('background', error));
    this.pending.add(p);
    p.finally(() => this.pending.delete(p));
    return p;
  }

  // An RPC delivery to the TUI: tracked, and idle for settle() while it waits on an open dialog
  trackDelivery(store, fn) {
    const p = this.track(this.delivery.run(store, fn));
    this.deliveries.set(p, store);
    p.finally(() => this.deliveries.delete(p));
    return p;
  }

  crash(where, error) {
    this.out.crashes.push(`${where}: ${error?.stack ?? error}`);
  }

  // Waits until no turn, hook, tool or RPC delivery is still running. A
  // delivery to the TUI that waits on an open dialog does not count: in
  // OpenCode the server's emit does not wait for the TUI, so the scenario sees
  // the dialog open and answers it later (autopilot-plan-explore, D6)
  async settle(limitMs = 20000) {
    const deadline = Date.now() + limitMs;
    const idle = () => [...this.pending].every((p) => this.deliveries.get(p)?.blocked === true);
    for (;;) {
      await new Promise((resolve) => setTimeout(resolve, 10));
      if (idle()) {
        await new Promise((resolve) => setTimeout(resolve, 30));
        if (idle()) return;
      }
      if (Date.now() > deadline) throw new Error(`the simulated OpenCode did not settle (${this.pending.size} pending)`);
      await Promise.race([Promise.all([...this.pending]), new Promise((resolve) => setTimeout(resolve, 50))]);
    }
  }

  inject(operation) {
    if (this.failures[operation] > 0) {
      this.failures[operation] -= 1;
      throw new Error(`simulated: OpenCode rejected ${operation}`);
    }
  }

  session(sessionID) {
    const session = this.store.sessions[sessionID];
    if (!session) throw new Error(`session not found: ${sessionID}`);
    return session;
  }

  dirOf(session) {
    return session?.location?.directory ?? this.projectDir;
  }

  info(session) {
    const { messages, ...info } = session;
    return clone(info);
  }

  // A session as it is stored, without going through the plugin (scenario setup)
  seedSession({ title = 'Sesión', agent = 'build', metadata = {}, busy = false, archived = false, messages = [], directory = this.projectDir } = {}) {
    const id = `ses_${String(++this.store.seq).padStart(4, '0')}`;
    const t = now();
    this.store.sessions[id] = {
      id,
      title,
      agent,
      projectID: PROJECT_ID,
      location: { directory },
      metadata: clone(metadata),
      time: { created: t, updated: t, ...(busy ? { busy: now() } : { busy: t, idle: now() }), ...(archived ? { archived: now() } : {}) },
      messages: clone(messages),
    };
    this.save();
    return id;
  }

  // --- plugin loading ------------------------------------------------------

  async load() {
    const part = async (name) => {
      const file = path.join(this.pluginDir, `${name}.js`);
      if (!fs.existsSync(file)) return null;
      const plugin = (await import(`${pathToFileURL(file).href}?g=${this.generation + 1}`)).default;
      if (!plugin || typeof plugin.id !== 'string' || typeof plugin.setup !== 'function') {
        throw new Error(`${file} does not export { id, setup } by default`);
      }
      return plugin;
    };
    this.serverPart = await part('server');
    if (!this.serverPart) throw new Error(`${this.pluginDir} has no server.js`);
    this.tuiPart = this.withTui ? await part('tui') : null;
    await this.setup();
  }

  // Runs setup again, as a hot reload does: every loaded instance and the TUI
  async setup() {
    await this.runCleanups();
    this.generation += 1;
    const dirs = this.instances.size > 0 ? [...this.instances.keys()] : [this.projectDir];
    // The strategies of the previous loads are disposed with them
    this.strategies = this.strategies.filter((s) => s.generation === this.generation);
    const tui = async () => {
      if (!this.tuiPart) return;
      this.tuiLoad += 1;
      try {
        this.keepCleanup('tui', await this.tuiPart.setup(this.tuiContext(this.tuiLoad)));
      } catch (error) {
        this.crash('tui setup', error);
      }
    };
    if (this.rpcLate) {
      // The TUI part loads first: its calls find no RPC until the server registers it
      for (const entry of this.rpc.values()) entry.handlers.clear();
      await tui();
      for (const dir of dirs) await this.setupServer(dir);
    } else {
      for (const dir of dirs) await this.setupServer(dir);
      await tui();
    }
    await this.settle();
  }

  async setupServer(dir) {
    const instance = { dir, hooks: { prompt: [], context: [], 'experimental.idle': [], compaction: [] }, tools: new Map(), generation: this.generation };
    this.instances.set(dir, instance);
    try {
      this.keepCleanup('server', await this.serverPart.setup(this.serverContext(instance)));
    } catch (error) {
      this.crash('server setup', error);
    }
    return instance;
  }

  // The instance of the server part for a directory, loading it the first time
  ensureInstance(dir) {
    if (this.instances.has(dir) && !this.loading.has(dir)) return Promise.resolve(this.instances.get(dir));
    if (!this.loading.has(dir)) {
      const loading = this.setupServer(dir).finally(() => this.loading.delete(dir));
      this.loading.set(dir, loading);
      this.track(loading);
    }
    return this.loading.get(dir);
  }

  keepCleanup(part, returned) {
    if (typeof returned === 'function') this.cleanups.push({ part, fn: returned });
  }

  // As OpenCode 2.3.2: the last registered first; a failure is a toast
  async runCleanups() {
    const cleanups = this.cleanups.splice(0).reverse();
    for (const { part, fn } of cleanups) {
      try {
        await fn();
      } catch (error) {
        this.out.toasts.push({ variant: 'error', title: 'Plugin', message: `${part}: cleanup failed: ${error?.message ?? error}` });
      }
    }
  }

  // Closes a TUI that runs its own server (--standalone)
  async close() {
    const original = console.error;
    console.error = (...args) => this.out.terminal.push(args.map((a) => (a instanceof Error ? a.stack : String(a))).join(' '));
    try {
      await this.runCleanups();
      await this.settle();
      for (const sub of this.subscriptions()) {
        this.out.terminal.push(`ClientError: Transport: ECONNRESET: The socket connection was closed unexpectedly (rpc.${sub.rpc}.${sub.event}, carga ${sub.load} de la TUI)`);
      }
    } finally {
      console.error = original;
    }
    this.closed = true;
  }

  // The TUI's event subscriptions still alive
  subscriptions() {
    const alive = [];
    for (const [rpc, entry] of this.rpc) {
      for (const [event, listeners] of entry.listeners) {
        for (const listener of listeners) alive.push({ rpc, event, load: listener.load });
      }
    }
    return alive;
  }

  rpcEntry(id) {
    if (!this.rpc.has(id)) this.rpc.set(id, { handlers: new Map(), listeners: new Map() });
    return this.rpc.get(id);
  }

  // The selected worktree strategy: the last one registered by a live load
  strategy() {
    return this.strategies.at(-1)?.strategy ?? null;
  }

  serverContext(instance) {
    const host = this;
    const dir = instance.dir;
    const op = (name, fn) => async (input) => {
      host.inject(name);
      return fn(input ?? {});
    };
    return {
      location: { directory: dir, workspaceID: undefined, project: { id: PROJECT_ID, directory: this.projectDir, canonical: this.projectDir } },
      options: clone(this.pluginOptions),
      rpc: {
        register: async (definition, handlers) => {
          const entry = host.rpcEntry(definition.id);
          entry.handlers.set(dir, handlers);
          return {
            events: {
              emit: (name, data) =>
                host.trackDelivery({ rpc: definition.id, event: name, blocked: false }, async () => {
                    if (host.tuiSilent) return;
                    for (const listener of [...(entry.listeners.get(name) ?? [])]) {
                      try {
                        await listener.fn({ type: `rpc.${definition.id}.${name}`, data: clone(data) });
                      } catch (error) {
                        host.crash(`rpc listener ${name}`, error);
                      }
                    }
                  }),
            },
            async dispose() {},
          };
        },
      },
      session: {
        hook: async (name, callback) => {
          if (!instance.hooks[name]) instance.hooks[name] = [];
          instance.hooks[name].push(callback);
          return { async dispose() {} };
        },
        create: op('session.create', ({ title = 'Nueva sesión', agent = 'build', metadata = {}, location }) => {
          const id = `ses_${String(++host.store.seq).padStart(4, '0')}`;
          const t = now();
          host.store.sessions[id] = { id, title, agent, projectID: PROJECT_ID, location: { directory: location?.directory ?? dir }, metadata: clone(metadata), time: { created: t, updated: t }, messages: [] };
          host.save();
          return host.info(host.store.sessions[id]);
        }),
        get: op('session.get', ({ sessionID }) => host.info(host.session(sessionID))),
        // { data, cursor } by pages, newest first, as OpenCode 2.3.2 (task 12.2);
        // the sessions of the whole project, every worktree included
        list: op('session.list', ({ archived, limit = 5, cursor } = {}) => {
          const all = Object.values(host.store.sessions)
            .filter((s) => archived === undefined || Boolean(s.time.archived) === archived)
            .sort((a, b) => b.time.created - a.time.created || b.id.localeCompare(a.id));
          const start = cursor ? Number(cursor) : 0;
          const size = Math.min(limit, 5);
          const data = all.slice(start, start + size).map((s) => host.info(s));
          return { data, cursor: start + size < all.length ? { next: String(start + size) } : {} };
        }),
        update: op('session.update', ({ sessionID, title, metadata }) => {
          // The server's ctx.session ignores `archived` (lesson 1)
          const session = host.session(sessionID);
          if (title !== undefined) session.title = title;
          if (metadata !== undefined) session.metadata = clone(metadata);
          session.time.updated = now();
          host.save();
          return host.info(session);
        }),
        prompt: op('session.prompt', ({ sessionID, text, skills = [], agent }) => {
          const session = host.session(sessionID);
          if (agent) session.agent = agent;
          host.startTurn(sessionID, { text, skills });
          return host.info(session);
        }),
        command: op('session.command', ({ sessionID, name, text = '' }) => {
          host.session(sessionID);
          host.startTurn(sessionID, { text: `/${name} ${text}`.trim(), command: name });
          return {};
        }),
        context: op('session.context', ({ sessionID }) => clone(host.session(sessionID).messages)),
        interrupt: op('session.interrupt', ({ sessionID }) => {
          host.interrupted.add(sessionID);
          return {};
        }),
      },
      tool: {
        transform: (fn) => {
          const editor = {
            add: (tool) => instance.tools.set(tool.name, tool),
            list: () => [...instance.tools.values()],
            get: (id) => instance.tools.get(id),
            update() {},
            remove: (id) => instance.tools.delete(id),
            namespace() {},
          };
          fn(editor);
          return { async dispose() {} };
        },
      },
      worktree: {
        transform: async (fn) => {
          const added = [];
          const editor = {
            // A strategy with the id of one already registered replaces it
            add: (strategy) => {
              const registration = { strategy, dir, generation: host.generation };
              host.strategies = host.strategies.filter((s) => s.strategy.id !== strategy.id);
              host.strategies.push(registration);
              added.push(registration);
            },
          };
          await fn(editor);
          return {
            async dispose() {
              host.strategies = host.strategies.filter((s) => !added.includes(s));
            },
          };
        },
        // The payload requires projectID, as in OpenCode 2.3.2
        create: op('worktree.create', async ({ projectID, name, branch } = {}) => {
          if (projectID !== PROJECT_ID) throw new Error(projectID === undefined ? 'Missing key\n  at ["projectID"]' : `unknown project ${projectID}`);
          return host.createWorktree({ name, branch, via: 'plugin' });
        }),
        remove: op('worktree.remove', async ({ directory, force } = {}) => host.removeWorktree({ directory, force })),
      },
    };
  }

  tuiContext(load) {
    const host = this;
    return {
      options: clone(this.pluginOptions),
      // It follows the TUI's screen (checked with OpenCode 2.3.2)
      location: {
        get directory() {
          return host.tuiLocation();
        },
      },
      renderer: {
        on: (name, fn) => host.focusListeners[name]?.add(fn),
        off: (name, fn) => host.focusListeners[name]?.delete(fn),
      },
      keymap: { dispatch: (name) => host.dispatch(name) },
      client: {
        rpc: (definition) => {
          const entry = host.rpcEntry(definition.id);
          const client = {
            events: {
              on(name, handler, options) {
                const signal = options?.signal;
                if (signal?.aborted) return () => {};
                if (!entry.listeners.has(name)) entry.listeners.set(name, []);
                const listener = { fn: handler, load };
                entry.listeners.get(name).push(listener);
                const off = () => entry.listeners.set(name, (entry.listeners.get(name) ?? []).filter((l) => l !== listener));
                signal?.addEventListener('abort', off, { once: true });
                return off;
              },
            },
          };
          for (const name of Object.keys(definition.methods ?? {})) {
            client[name] = (input, at) => {
              const dir = at?.location?.directory ?? host.projectDir;
              const call = (async () => {
                if (host.loading.has(dir)) await host.loading.get(dir);
                const handlers = entry.handlers.get(dir);
                host.out.rpcCalls.push({ method: name, directory: dir, ...(input?.route ? { route: clone(input.route) } : {}) });
                if (!handlers) throw Object.assign(new Error('RPC is unavailable: ' + definition.id), { type: 'rpc.unavailable' });
                return clone(await handlers[name](clone(input), { signal: new AbortController().signal, error: (type, data) => ({ type, data }) }));
              })();
              // A call in flight is work the scenario waits for
              host.pending.add(call);
              call.then(() => host.pending.delete(call), () => host.pending.delete(call));
              return call;
            };
          }
          return client;
        },
        session: {
          update: async ({ sessionID, archived, title }) => {
            host.inject('tui.session.update');
            const session = host.session(sessionID);
            if (archived === true) {
              session.time.archived = now();
              host.out.archives.push(sessionID);
            }
            if (archived === false) delete session.time.archived;
            if (title !== undefined) session.title = title;
            session.time.updated = now();
            host.save();
            return host.info(session);
          },
          get: async ({ sessionID }) => host.info(host.session(sessionID)),
        },
      },
      ui: {
        toast: { show: (toast) => host.out.toasts.push(clone(toast)) },
        router: {
          navigate: (destination) => {
            host.inject('tui.navigate');
            host.out.navigations.push(clone(destination));
            host.setRoute(destination);
          },
          current: () => clone(host.route),
        },
        dialog: {
          select: async (options) => {
            const shown = { title: options.title, options: options.options.map((o) => ({ title: o.title, value: o.value, description: o.description })), answer: null, open: true };
            host.out.dialogs.push(shown);
            let answer;
            if (host.dialogAnswers.length > 0) answer = host.dialogAnswers.shift();
            else if (host.dialogWait) {
              // Inside an RPC delivery, the open dialog is the user's to answer, not pending work.
              // A promise the listener detached keeps the context, but its delivery is no longer
              // tracked, so marking it changes nothing
              const delivery = host.delivery.getStore();
              if (delivery) delivery.blocked = true;
              try {
                answer = await new Promise((resolve) => host.openDialogs.push(resolve));
              } finally {
                if (delivery) delivery.blocked = false;
              }
            }
            else answer = { value: undefined };
            if (answer.delayMs) await new Promise((resolve) => setTimeout(resolve, answer.delayMs));
            // Enter chooses the highlighted (first) option; Esc closes without choosing;
            // `choose` picks the option with that title
            const value =
              answer.key === 'enter' ? options.options[0]?.value : answer.key === 'esc' ? undefined : answer.choose ? options.options.find((o) => o.title === answer.choose)?.value : answer.value;
            shown.answer = value ?? null;
            shown.key = answer.key ?? null;
            shown.open = false;
            return value;
          },
          alert: async (options) => {
            host.out.dialogs.push({ title: options?.title ?? options?.message ?? '', options: [], answer: null, open: false, alert: true });
          },
        },
      },
    };
  }

  // --- worktrees -----------------------------------------------------------

  // The name OpenCode generates (Slug.create()) when the user does not write one
  generatedName() {
    this.slugs += 1;
    return `rama-generada-${this.slugs}`;
  }

  // worktree.create, as the TUI, the web and ctx.worktree call it: the
  // selected strategy, or the bundled git one (`--detach` on the starting ref)
  async createWorktree({ name = null, branch = undefined, via = 'tui' } = {}) {
    const chosen = name || this.generatedName();
    let directory = path.join(this.worktreesDir, chosen);
    for (let i = 2; fs.existsSync(directory); i += 1) directory = path.join(this.worktreesDir, `${chosen}-${i}`);
    fs.mkdirSync(this.worktreesDir, { recursive: true });
    const strategy = this.strategy();
    const record = { via, name: chosen, branch: branch ?? null, strategy: strategy?.id ?? 'git', directory: null, error: null };
    this.out.worktrees.push(record);
    try {
      let result;
      if (strategy) {
        result = await wrapped(strategy.id, 'create', () => strategy.create({ sourceDirectory: this.projectDir, directory, ...(branch !== undefined ? { branch } : {}) }, { signal: new AbortController().signal }));
      } else {
        const added = spawnSync('git', ['worktree', 'add', '--detach', '--', directory, branch ?? 'HEAD'], { cwd: this.projectDir, encoding: 'utf8' });
        if (added.status !== 0) throw new Error(added.stderr.trim());
        result = { directory };
      }
      record.directory = result?.directory ?? directory;
      this.store.worktrees[record.directory] = { strategy: record.strategy };
      this.save();
      return { directory: record.directory, name: path.basename(record.directory), projectID: PROJECT_ID };
    } catch (error) {
      record.error = String(error?.message ?? error);
      throw error;
    }
  }

  // Removal uses the worktree's recorded strategy; a missing owner fails
  async removeWorktree({ directory, force = false }) {
    const owner = this.store.worktrees[directory]?.strategy ?? 'git';
    if (owner === 'git') {
      const removed = spawnSync('git', ['worktree', 'remove', ...(force ? ['--force'] : []), directory], { cwd: this.projectDir, encoding: 'utf8' });
      if (removed.status !== 0) throw new Error(removed.stderr.trim());
    } else {
      const registration = [...this.strategies].reverse().find((s) => s.strategy.id === owner);
      if (!registration) throw new Error(`the worktree strategy '${owner}' is not loaded`);
      // OpenCode 2.3.2 sends only { directory, force }
      await wrapped(owner, 'remove', () => registration.strategy.remove({ directory, force }, { signal: new AbortController().signal }));
    }
    delete this.store.worktrees[directory];
    this.save();
    return true;
  }

  // The TUI's keymap commands that the plugin may dispatch (design D4)
  dispatch(name) {
    this.out.keymap.push(name);
    if (name === 'session.move') {
      this.workspaces = { name: false, mounted: Date.now() + this.workspacesMountMs };
      this.out.dialogs.push({ title: 'Manage workspaces', options: [], answer: null, open: true, kind: 'workspaces' });
      return true;
    }
    if (name === 'dialog.move_session.new') {
      // Before «Manage workspaces» is mounted, the command does nothing
      if (!this.workspaces || Date.now() < this.workspaces.mounted) return false;
      for (const d of this.out.dialogs) if (d.kind === 'workspaces') d.open = false;
      this.workspaces.name = true;
      this.out.dialogs.push({ title: 'Name worktree', options: [], answer: null, open: true, kind: 'name-worktree' });
      return true;
    }
    return false;
  }

  // The user opens «Manage workspaces» and presses ctrl+a (New worktree)
  newWorktreeDialog() {
    this.workspaces = { name: true, mounted: 0 };
    this.out.dialogs.push({ title: 'Name worktree', options: [], answer: null, open: true, kind: 'name-worktree' });
  }

  // The user confirms «Name worktree» with a name, or generates it with tab.
  // From the home screen, the worktree stays pending until the first
  // message; from a session, the TUI creates it and opens its home screen
  async nameWorktree({ name = null }) {
    if (!this.workspaces?.name) throw new Error('the «Name worktree» dialog is not open');
    this.workspaces = null;
    for (const d of this.out.dialogs) if (d.kind === 'name-worktree') d.open = false;
    if (this.route.type === 'home') {
      this.pendingWorktree = { name: name || this.generatedName() };
      this.out.routes.push({ type: 'home', pending: this.pendingWorktree.name });
      return null;
    }
    try {
      const { directory } = await this.createWorktree({ name, via: 'tui' });
      this.setRoute({ type: 'home', location: { directory } });
      return directory;
    } catch (error) {
      this.out.toasts.push({ variant: 'error', message: String(error?.message ?? error) });
      return null;
    }
  }

  // --- execution -----------------------------------------------------------

  startTurn(sessionID, message) {
    const session = this.session(sessionID);
    // As OpenCode 2.3.2 (task 1.4 of autopilot-plan-explore): a message sent
    // while the turn goes on passes the `prompt` hook when it enters and joins
    // the same loop (delivery "steer"), with no idle in between
    if (this.running.has(sessionID)) {
      this.track(
        (async () => {
          const admitted = await this.admit(session, message);
          this.steering.get(sessionID).push(admitted);
        })()
      );
      return;
    }
    session.time.busy = now();
    delete session.outcome;
    this.save();
    this.running.add(sessionID);
    this.steering.set(sessionID, []);
    this.track(this.turn(sessionID, message).finally(() => {
      this.running.delete(sessionID);
      this.steering.delete(sessionID);
    }));
  }

  // The `prompt` hook of a message that enters a session; returns the message to store
  async admit(session, message) {
    const sessionID = session.id;
    this.store.messageSeq = (this.store.messageSeq ?? 0) + 1;
    const messageID = `msg_${String(this.store.messageSeq).padStart(4, '0')}`;
    const prompt = { sessionID, messageID, prompt: { text: message.text }, delivery: 'steer' };
    // The instance of the session's directory runs its hooks and tools
    await this.ensureInstance(this.dirOf(session));
    for (const hook of [...this.instanceOf(session).hooks.prompt]) {
      try {
        await hook(prompt);
      } catch (error) {
        this.crash('prompt hook', error);
      }
    }
    this.out.prompts.push({ sessionID, text: message.text, final: prompt.prompt.text });
    return { ...message, id: messageID, text: prompt.prompt.text };
  }

  // Messages that entered during the turn join it before its next request
  joinSteered(session) {
    const queue = this.steering.get(session.id) ?? [];
    if (queue.length === 0) return false;
    for (const m of queue.splice(0)) session.messages.push({ type: 'user', id: m.id, text: m.text });
    this.save();
    return true;
  }

  instanceOf(session) {
    return this.instances.get(this.dirOf(session)) ?? { hooks: { prompt: [], context: [], 'experimental.idle': [], compaction: [] }, tools: new Map() };
  }

  visibleTools(session) {
    return [...this.instanceOf(session).tools.values()].filter((tool) => tool.options?.codemode === false);
  }

  request(session) {
    const messages = [];
    // Each stored message carries its id (a user message, the messageID of its
    // `prompt` hook); a tool's result has none (task 1.4 of autopilot-plan-explore)
    const withId = (m, id) => (id ? { id, ...m } : m);
    session.messages.forEach((m, index) => {
      if (m.type === 'user' || m.type === 'synthetic') messages.push(withId({ role: 'user', content: [{ type: 'text', text: m.text }] }, m.id));
      if (m.type === 'assistant') {
        const id = m.id ?? `msg_a${index}`;
        for (const part of m.content) {
          if (part.type === 'text') messages.push(withId({ role: 'assistant', content: [{ type: 'text', text: part.text }] }, id));
          if (part.type === 'tool') {
            messages.push(withId({ role: 'assistant', content: [{ type: 'tool-call', name: part.name, input: part.state.input }] }, id));
            messages.push({ role: 'tool', content: [{ type: 'tool-result', name: part.name, result: { type: 'text', value: part.state.content?.[0]?.text ?? '' } }] });
          }
        }
      }
    });
    // As OpenCode 2.3.2 with the plan agent (task 1.1 of autopilot-plan-explore):
    // its reminder goes before the user's message in the first request of the
    // turn, and at the end, after the tool's result, in the next ones
    if (session.agent === 'plan') {
      // Without an id in the first request; already stored, with its own one, after a tool
      const reminder = { role: 'user', content: [{ type: 'text', text: PLAN_REMINDER }] };
      if (messages.at(-1)?.role === 'user') messages.splice(messages.length - 1, 0, reminder);
      else messages.push({ id: `msg_r${session.messages.length}`, ...reminder });
    }
    return {
      sessionID: session.id,
      agent: session.agent,
      model: { providerID: 'simulated', id: 'model' },
      system: [{ type: 'text', text: BASE_SYSTEM }],
      messages,
      options: {},
      tools: Object.fromEntries([...BUILTIN_TOOLS.map((name) => [name, { description: name, input: {} }]), ...this.visibleTools(session).map((t) => [t.name, { description: t.description, input: t.input }])]),
    };
  }

  scriptedResponse(session, input) {
    const step = session.metadata?.openspec?.step;
    for (const rule of this.script) {
      if (rule.responses.length === 0) continue;
      const m = rule.match ?? {};
      if (m.sessionID && m.sessionID !== session.id) continue;
      if (m.stepKind && step?.kind !== m.stepKind) continue;
      if (m.stepId !== undefined && String(step?.id) !== String(m.stepId)) continue;
      if (m.agent && session.agent !== m.agent) continue;
      if (m.directory && m.directory !== this.dirOf(session)) continue;
      if (m.afterTool !== undefined && m.afterTool !== (input.messages.at(-1)?.role === 'tool')) continue;
      return rule.responses.shift();
    }
    return input.messages.at(-1)?.role === 'tool' ? { text: 'hecho' } : { text: 'vale' };
  }

  async turn(sessionID, message) {
    const session = this.session(sessionID);
    message = await this.admit(session, message);
    session.messages.push({ type: 'user', id: message.id, text: message.text, ...(message.skills?.length ? { skills: message.skills } : {}), ...(message.command ? { command: message.command } : {}) });
    this.save();
    for (let i = 0; i < 20; i++) {
      this.joinSteered(session);
      const input = this.request(session);
      let failed = null;
      for (const hook of [...this.instanceOf(session).hooks.context]) {
        try {
          await hook(input);
        } catch (error) {
          failed = `context hook: ${error?.stack ?? error}`;
          break;
        }
      }
      const textOf = (content) => (typeof content === 'string' ? content : (content ?? []).map((p) => p.text ?? (p.type === 'tool-result' ? p.result?.value : p.type === 'tool-call' ? `[${p.name}]` : '')).join('\n'));
      this.out.requests.push({
        sessionID,
        agent: session.agent,
        failed,
        system: input.system.map((p) => p.text),
        messages: input.messages.map((m) => ({ role: m.role, text: textOf(m.content) })),
        skills: message.skills ?? [],
        tools: Object.keys(input.tools ?? {}),
      });
      if (failed) {
        session.outcome = 'failed';
        session.time.idle = now();
        this.save();
        return;
      }
      if (this.interrupted.delete(sessionID)) return this.interrupt(session);
      const response = this.scriptedResponse(session, input);
      if (response.delayMs) await new Promise((resolve) => setTimeout(resolve, response.delayMs));
      this.applyEffects(response, this.dirOf(session));
      if (response.tool) {
        const tool = this.instanceOf(session).tools.get(response.tool.name);
        const part = { type: 'tool', name: response.tool.name, state: { status: 'completed', input: clone(response.tool.input ?? {}), content: [] } };
        if (!tool || tool.options?.codemode !== false) {
          part.state.status = 'error';
          part.state.content = [{ type: 'text', text: `No tool named "${response.tool.name}" is currently available` }];
        } else {
          try {
            const result = await tool.execute(clone(response.tool.input ?? {}), { sessionID, agent: session.agent, messageID: `msg_${i}`, id: `call_${i}`, signal: new AbortController().signal, progress: async () => {} });
            const content = typeof result?.content === 'string' ? result.content : (result?.content ?? []).map((c) => c.text ?? '').join('\n');
            part.state.content = [{ type: 'text', text: content }];
          } catch (error) {
            this.out.toolErrors.push(`${response.tool.name}: ${error?.stack ?? error}`);
            part.state.status = 'error';
            part.state.content = [{ type: 'text', text: String(error?.message ?? error) }];
          }
        }
        session.messages.push({ type: 'assistant', agent: session.agent, content: [part] });
        this.save();
        if (this.interrupted.delete(sessionID)) return this.interrupt(session);
        continue;
      }
      session.messages.push({ type: 'assistant', agent: session.agent, content: [{ type: 'text', text: response.text ?? '' }] });
      // A message that entered meanwhile gets the next request, in the same loop
      if (this.joinSteered(session)) continue;
      session.messages.push({ type: 'idle', outcome: 'succeeded' });
      session.outcome = 'succeeded';
      session.time.idle = now();
      this.save();
      for (const hook of [...this.instanceOf(session).hooks['experimental.idle']]) {
        try {
          await hook({ sessionID, background: [] });
        } catch (error) {
          this.crash('experimental.idle hook', error);
        }
      }
      return;
    }
  }

  // What a scripted response does in the project before answering, in the session's directory
  applyEffects(response, dir = this.projectDir) {
    for (const [rel, content] of Object.entries(response.files ?? {})) {
      const file = path.join(dir, rel);
      if (content === null) fs.rmSync(file, { recursive: true, force: true });
      else {
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, content);
      }
    }
    for (const args of response.git ?? []) {
      const result = spawnSync('git', args, { cwd: dir, encoding: 'utf8' });
      if (result.status !== 0) this.crash('scripted git', new Error(`git ${args.join(' ')}: ${result.stderr}`));
    }
  }

  // --- the TUI's screen and the terminal's focus ---------------------------

  // The directory the TUI is in: its session's, or its home screen's
  tuiLocation() {
    if (this.route.type === 'session') {
      const session = this.store.sessions[this.route.sessionID];
      if (session) return this.dirOf(session);
    }
    return this.route.location?.directory ?? this.lastDir;
  }

  setRoute(route) {
    if (route?.type === 'session') this.route = { type: 'session', sessionID: route.sessionID };
    else this.route = { type: 'home', location: { directory: route?.location?.directory ?? this.tuiLocation() } };
    this.lastDir = this.tuiLocation();
    this.out.routes.push(clone(this.route));
    // Entering a directory loads its instance of the server part
    if (this.withTui) this.ensureInstance(this.lastDir);
  }

  focus(name) {
    for (const fn of [...this.focusListeners[name]]) {
      try {
        fn();
      } catch (error) {
        this.crash(`renderer ${name}`, error);
      }
    }
  }

  interrupt(session) {
    session.messages.push({ type: 'idle', outcome: 'interrupted' });
    session.outcome = 'interrupted';
    session.time.idle = now();
    this.save();
  }

  async compact(sessionID) {
    const session = this.session(sessionID);
    const input = { ...this.request(session), result: undefined };
    for (const hook of [...this.instanceOf(session).hooks.compaction]) {
      try {
        await hook(input);
      } catch (error) {
        this.crash('compaction hook', error);
      }
    }
    session.messages = [{ type: 'synthetic', text: input.result?.summary ?? 'Resumen de la conversación (simulado).' }];
    this.save();
  }

  // Answers the oldest open dialog, or queues the answer for the next one
  answer(answer) {
    const open = this.openDialogs.shift();
    if (open) open(answer);
    else this.dialogAnswers.push(answer);
  }

  state() {
    return clone({
      sessions: this.store.sessions,
      ...this.out,
      imported: [...new Set(globalThis[Symbol.for('opencode-sim.imported')] ?? [])],
      route: this.route,
      location: this.tuiLocation(),
      instances: [...this.instances.keys()],
      strategies: this.strategies.map((s) => ({ id: s.strategy.id, dir: s.dir, generation: s.generation })),
      generation: this.generation,
      tuiLoad: this.tuiLoad,
      subscriptions: this.subscriptions(),
      closed: this.closed,
    });
  }
}
