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
//   list (archived included unless filtered), update. `update({ metadata })`
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
//   last generation's hooks, tools and RPC handlers, while the TUI's earlier
//   event listeners stay alive (tasks 1.4 of add-openspec-autopilot, lesson 5).
// - Failures can be injected per operation (e.g. "session.create").
//
// The model is a script per scenario: rules matched against the session,
// each with a queue of responses ({ text }, { tool: { name, input } }).

import fs from 'node:fs';
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
  constructor({ projectDir, plugin, dbFile, tui = true, pluginOptions = {}, failures = {}, tuiSilent = false }) {
    // A TUI that never answers what the server asks it (its event listeners get nothing)
    this.tuiSilent = tuiSilent;
    this.projectDir = projectDir;
    this.pluginDir = path.join(projectDir, '.opencode', 'plugins', plugin);
    this.dbFile = dbFile;
    this.withTui = tui;
    this.pluginOptions = pluginOptions;
    this.failures = { ...failures };
    this.store = fs.existsSync(dbFile) ? JSON.parse(fs.readFileSync(dbFile, 'utf8')) : { seq: 0, sessions: {} };
    this.generation = 0;
    this.hooks = { context: [], 'experimental.idle': [], compaction: [] };
    this.tools = new Map();
    this.rpc = new Map(); // definition id -> { handlers, listeners: Map(name -> [fn]) }
    this.script = [];
    this.dialogAnswers = [];
    // With dialogWait, a dialog with no queued answer stays open until one arrives
    this.dialogWait = false;
    this.openDialogs = [];
    this.out = { toasts: [], navigations: [], dialogs: [], archives: [], requests: [], crashes: [], toolErrors: [], logs: [] };
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
    this.generation += 1;
    this.hooks = { context: [], 'experimental.idle': [], compaction: [] };
    this.tools = new Map();
    try {
      await this.serverPart.setup(this.serverContext());
    } catch (error) {
      this.crash('server setup', error);
    }
    if (this.tuiPart) {
      try {
        await this.tuiPart.setup(this.tuiContext());
      } catch (error) {
        this.crash('tui setup', error);
      }
    }
    await this.settle();
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
                        await listener({ type: `rpc.${definition.id}.${name}`, data: clone(data) });
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
        list: op('session.list', ({ archived } = {}) =>
          Object.values(host.store.sessions)
            .filter((s) => archived === undefined || Boolean(s.time.archived) === archived)
            .map((s) => host.info(s))
        ),
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

  tuiContext() {
    const host = this;
    return {
      options: clone(this.pluginOptions),
      location: { directory: this.projectDir },
      client: {
        rpc: (definition) => {
          const entry = host.rpcEntry(definition.id);
          const client = {
            events: {
              on(name, handler) {
                if (!entry.listeners.has(name)) entry.listeners.set(name, []);
                entry.listeners.get(name).push(handler);
                return () => {};
              },
            },
          };
          for (const name of Object.keys(definition.methods ?? {})) {
            client[name] = async (input) => {
              if (!entry.handlers) throw Object.assign(new Error('rpc unavailable'), { type: 'rpc.unavailable' });
              return clone(await entry.handlers[name](clone(input), { signal: new AbortController().signal, error: (type, data) => ({ type, data }) }));
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
          },
          current: () => host.out.navigations.at(-1) ?? { type: 'home' },
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
            shown.answer = answer.value ?? null;
            shown.open = false;
            return answer.value;
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
    return clone({ sessions: this.store.sessions, ...this.out, generation: this.generation });
  }
}
