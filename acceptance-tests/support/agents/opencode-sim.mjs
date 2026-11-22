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
//
// The model is a script per scenario: rules matched against the session,
// each with a queue of responses ({ text }, { tool: { name, input } }).

import fs from 'node:fs';
import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const BASE_SYSTEM = 'You are OpenCode (simulated system prompt).';
const BUILTIN_TOOLS = ['edit', 'glob', 'grep', 'question', 'read', 'shell', 'skill', 'subagent', 'write'];

let clock = 0;
// Strictly increasing times, so that busy/idle comparisons are exact
const now = () => {
  const t = Math.max(Date.now(), clock + 1);
  clock = t;
  return t;
};
const clone = (value) => (value === undefined ? undefined : JSON.parse(JSON.stringify(value)));

export class Host {
  constructor({ projectDir, plugin, pluginDir = null, dbFile, tui = true, pluginOptions = {}, failures = {}, tuiSilent = false, rpcLate = false, alreadyOpen = false }) {
    // OpenCode was already open: this process's TUI has presented itself
    // before, so loading the plugin is like a hot reload and not a start
    // (the registry the plugin keeps in globalThis, design D3 of
    // autopilot-sesion-operativa)
    if (alreadyOpen) globalThis[Symbol.for('openspec-autopilot.registry')] = { gens: {}, pids: { [projectDir]: [String(process.pid)] } };
    this.rpcLate = rpcLate;
    this.route = { type: 'home' };
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
    this.store = fs.existsSync(dbFile) ? JSON.parse(fs.readFileSync(dbFile, 'utf8')) : { seq: 0, sessions: {} };
    this.generation = 0;
    this.hooks = { prompt: [], context: [], 'experimental.idle': [], compaction: [] };
    this.tools = new Map();
    this.rpc = new Map(); // definition id -> { handlers, listeners: Map(name -> [{ fn, load }]) }
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
    this.out = { toasts: [], navigations: [], dialogs: [], archives: [], requests: [], crashes: [], toolErrors: [], logs: [], terminal: [], prompts: [], routes: [] };
    const original = console.error;
    console.error = (...args) => {
      this.out.logs.push(args.map((a) => (a instanceof Error ? a.stack : typeof a === 'string' ? a : JSON.stringify(a))).join(' '));
      original(...args);
    };
    this.pending = new Set();
    this.interrupted = new Set();
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

  crash(where, error) {
    this.out.crashes.push(`${where}: ${error?.stack ?? error}`);
  }

  // Waits until no turn, hook, tool or RPC delivery is still running
  async settle(limitMs = 20000) {
    const deadline = Date.now() + limitMs;
    for (;;) {
      await new Promise((resolve) => setTimeout(resolve, 10));
      if (this.pending.size === 0) {
        await new Promise((resolve) => setTimeout(resolve, 30));
        if (this.pending.size === 0) return;
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

  info(session) {
    const { messages, ...info } = session;
    return clone(info);
  }

  // A session as it is stored, without going through the plugin (scenario setup)
  seedSession({ title = 'Sesión', agent = 'build', metadata = {}, busy = false, archived = false, messages = [] } = {}) {
    const id = `ses_${String(++this.store.seq).padStart(4, '0')}`;
    const t = now();
    this.store.sessions[id] = {
      id,
      title,
      agent,
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

  // Runs setup again, as a hot reload does
  async setup() {
    await this.runCleanups();
    this.generation += 1;
    this.hooks = { prompt: [], context: [], 'experimental.idle': [], compaction: [] };
    this.tools = new Map();
    const server = async () => {
      try {
        this.keepCleanup('server', await this.serverPart.setup(this.serverContext()));
      } catch (error) {
        this.crash('server setup', error);
      }
    };
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
      for (const entry of this.rpc.values()) entry.handlers = null;
      await tui();
      await server();
    } else {
      await server();
      await tui();
    }
    await this.settle();
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
    if (!this.rpc.has(id)) this.rpc.set(id, { handlers: null, listeners: new Map() });
    return this.rpc.get(id);
  }

  serverContext() {
    const host = this;
    const op = (name, fn) => async (input) => {
      host.inject(name);
      return fn(input ?? {});
    };
    return {
      location: { directory: this.projectDir },
      options: clone(this.pluginOptions),
      rpc: {
        register: async (definition, handlers) => {
          const entry = host.rpcEntry(definition.id);
          entry.handlers = handlers;
          return {
            events: {
              emit: (name, data) =>
                host.track(
                  (async () => {
                    if (host.tuiSilent) return;
                    for (const listener of [...(entry.listeners.get(name) ?? [])]) {
                      try {
                        await listener.fn({ type: `rpc.${definition.id}.${name}`, data: clone(data) });
                      } catch (error) {
                        host.crash(`rpc listener ${name}`, error);
                      }
                    }
                  })()
                ),
            },
            async dispose() {},
          };
        },
      },
      session: {
        hook: async (name, callback) => {
          if (!host.hooks[name]) host.hooks[name] = [];
          host.hooks[name].push(callback);
          return { async dispose() {} };
        },
        create: op('session.create', ({ title = 'Nueva sesión', agent = 'build', metadata = {} }) => {
          const id = `ses_${String(++host.store.seq).padStart(4, '0')}`;
          const t = now();
          host.store.sessions[id] = { id, title, agent, metadata: clone(metadata), time: { created: t, updated: t }, messages: [] };
          host.save();
          return host.info(host.store.sessions[id]);
        }),
        get: op('session.get', ({ sessionID }) => host.info(host.session(sessionID))),
        // { data, cursor } by pages, newest first, as OpenCode 2.3.2 (task 12.2)
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
            add: (tool) => host.tools.set(tool.name, tool),
            list: () => [...host.tools.values()],
            get: (id) => host.tools.get(id),
            update() {},
            remove: (id) => host.tools.delete(id),
            namespace() {},
          };
          fn(editor);
          return { async dispose() {} };
        },
      },
    };
  }

  tuiContext(load) {
    const host = this;
    return {
      options: clone(this.pluginOptions),
      location: { directory: this.projectDir },
      renderer: {
        on: (name, fn) => host.focusListeners[name]?.add(fn),
        off: (name, fn) => host.focusListeners[name]?.delete(fn),
      },
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
            client[name] = (input) => {
              const call = (async () => {
                if (!entry.handlers) throw Object.assign(new Error('RPC is unavailable: ' + definition.id), { type: 'rpc.unavailable' });
                return clone(await entry.handlers[name](clone(input), { signal: new AbortController().signal, error: (type, data) => ({ type, data }) }));
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
            else if (host.dialogWait) answer = await new Promise((resolve) => host.openDialogs.push(resolve));
            else answer = { value: undefined };
            if (answer.delayMs) await new Promise((resolve) => setTimeout(resolve, answer.delayMs));
            // Enter chooses the highlighted (first) option; Esc closes without choosing
            const value = answer.key === 'enter' ? options.options[0]?.value : answer.key === 'esc' ? undefined : answer.value;
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

  // --- execution -----------------------------------------------------------

  startTurn(sessionID, message) {
    const session = this.session(sessionID);
    session.time.busy = now();
    delete session.outcome;
    this.save();
    this.track(this.turn(sessionID, message));
  }

  visibleTools() {
    return [...this.tools.values()].filter((tool) => tool.options?.codemode === false);
  }

  request(session) {
    const messages = [];
    for (const m of session.messages) {
      if (m.type === 'user' || m.type === 'synthetic') messages.push({ role: 'user', content: [{ type: 'text', text: m.text }] });
      if (m.type === 'assistant') {
        for (const part of m.content) {
          if (part.type === 'text') messages.push({ role: 'assistant', content: [{ type: 'text', text: part.text }] });
          if (part.type === 'tool') {
            messages.push({ role: 'assistant', content: [{ type: 'tool-call', name: part.name, input: part.state.input }] });
            messages.push({ role: 'tool', content: [{ type: 'tool-result', name: part.name, result: { type: 'text', value: part.state.content?.[0]?.text ?? '' } }] });
          }
        }
      }
    }
    return {
      sessionID: session.id,
      agent: session.agent,
      model: { providerID: 'simulated', id: 'model' },
      system: [{ type: 'text', text: BASE_SYSTEM }],
      messages,
      options: {},
      tools: Object.fromEntries([...BUILTIN_TOOLS.map((name) => [name, { description: name, input: {} }]), ...this.visibleTools().map((t) => [t.name, { description: t.description, input: t.input }])]),
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
      if (m.afterTool !== undefined && m.afterTool !== (input.messages.at(-1)?.role === 'tool')) continue;
      return rule.responses.shift();
    }
    return input.messages.at(-1)?.role === 'tool' ? { text: 'hecho' } : { text: 'vale' };
  }

  async turn(sessionID, message) {
    const session = this.session(sessionID);
    const prompt = { sessionID, messageID: `msg_${session.messages.length}`, prompt: { text: message.text }, delivery: 'steer' };
    for (const hook of [...this.hooks.prompt]) {
      try {
        await hook(prompt);
      } catch (error) {
        this.crash('prompt hook', error);
      }
    }
    this.out.prompts.push({ sessionID, text: message.text, final: prompt.prompt.text });
    message = { ...message, text: prompt.prompt.text };
    session.messages.push({ type: 'user', text: message.text, ...(message.skills?.length ? { skills: message.skills } : {}), ...(message.command ? { command: message.command } : {}) });
    this.save();
    for (let i = 0; i < 20; i++) {
      const input = this.request(session);
      let failed = null;
      for (const hook of [...this.hooks.context]) {
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
      this.applyEffects(response);
      if (response.tool) {
        const tool = this.tools.get(response.tool.name);
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
      session.messages.push({ type: 'idle', outcome: 'succeeded' });
      session.outcome = 'succeeded';
      session.time.idle = now();
      this.save();
      for (const hook of [...this.hooks['experimental.idle']]) {
        try {
          await hook({ sessionID, background: [] });
        } catch (error) {
          this.crash('experimental.idle hook', error);
        }
      }
      return;
    }
  }

  // What a scripted response does in the project before answering
  applyEffects(response) {
    for (const [rel, content] of Object.entries(response.files ?? {})) {
      const file = path.join(this.projectDir, rel);
      if (content === null) fs.rmSync(file, { recursive: true, force: true });
      else {
        fs.mkdirSync(path.dirname(file), { recursive: true });
        fs.writeFileSync(file, content);
      }
    }
    for (const args of response.git ?? []) {
      const result = spawnSync('git', args, { cwd: this.projectDir, encoding: 'utf8' });
      if (result.status !== 0) this.crash('scripted git', new Error(`git ${args.join(' ')}: ${result.stderr}`));
    }
  }

  // --- the TUI's screen and the terminal's focus ---------------------------

  setRoute(route) {
    this.route = route?.type === 'session' ? { type: 'session', sessionID: route.sessionID } : { type: 'home' };
    this.out.routes.push(clone(this.route));
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
    for (const hook of [...this.hooks.compaction]) {
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
    const imported = [...new Set(globalThis[Symbol.for('opencode-sim.imported')] ?? [])];
    return clone({ sessions: this.store.sessions, ...this.out, imported, route: this.route, generation: this.generation, tuiLoad: this.tuiLoad, subscriptions: this.subscriptions(), closed: this.closed });
  }
}
