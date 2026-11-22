'use strict';

// Steps of openspec-autopilot (add-openspec-autopilot, design D16;
// autopilot-sesion-operativa, design D15). The plugin runs in the simulated
// OpenCode with several sessions (support/agents/opencode-sim.mjs); the model
// is a script per scenario, and what a workflow writes in the project the
// model's scripted responses write (`files`) before answering. Reviews are
// reached as the plugin reaches them: a step produces something, the session
// goes idle and the plugin opens the review with the product in git's stage.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { Given, When, Then } = require('@cucumber/cucumber');
const ap = require('../support/autopilot');

const HANDOFF = 'openspec_handoff';
const OWNER_TITLE = 'Sesión operativa';
const CHANGES = { '`exportar-datos`': 'exportar-datos', '`importar-datos`': 'importar-datos' };
const CHANGE_DIR = path.join('openspec', 'changes', ap.CHANGE);
const CONCLUSIONS = 'Falta validar el formato de las fechas.';

function detail(world) {
  return ap.describeSessions(world);
}

const rel = (...parts) => path.join(CHANGE_DIR, ...parts).split(path.sep).join('/');

// What a workflow writes for each artifact (the same as support/branches.js)
const ARTIFACT_FILES = {
  proposal: () => ({
    [rel('proposal.md')]: '## Why\n\nPrueba de exportar-datos.\n\n## What Changes\n\n- Exportar los datos.\n\n## Capabilities\n\n### New Capabilities\n- `prueba-exportar-datos`: prueba.\n\n### Modified Capabilities\n\n## Impact\n\n- Ninguno.\n',
  }),
  specs: () => ({
    [rel('specs', 'prueba-exportar-datos', 'spec.md')]: '# prueba-exportar-datos\n\n## ADDED Requirements\n\n### Requirement: Prueba\nEl sistema DEBE probar.\n\n#### Scenario: Prueba\n\n- **WHEN** se prueba\n- **THEN** funciona\n',
  }),
  design: () => ({ [rel('design.md')]: '## Context\n\nPrueba.\n' }),
  adr: () => ({ [rel('adr.md')]: '# ADR Review Manifest\n\n- Status: completed\n' }),
  tasks: () => ({ [rel('tasks.md')]: '## 1. Prueba\n\n- [ ] 1 Tarea 1\n' }),
};

function tasksFile(tasks) {
  return { [rel('tasks.md')]: `## 1. Prueba\n\n${tasks.map((t) => `- [${t.done ? 'x' : ' '}] ${t.id} Tarea ${t.id}`).join('\n')}\n` };
}

// The step the real `openspec status` and the CLI's tasks of the copy give
function stepFromStatus(world) {
  const status = world.branches.openspecStatus(world.project, ap.CHANGE);
  if (!(status.isPlanningComplete ?? status.isComplete)) {
    return { kind: 'artifact', id: status.artifacts.find((a) => a.status === 'ready').id };
  }
  const apply = JSON.parse(world.branches.openspec(world.project, ['instructions', 'apply', '--change', ap.CHANGE, '--json']).stdout);
  const pending = apply.tasks.find((t) => !t.done);
  return pending ? { kind: 'task', id: String(pending.id), label: /^(\d+(?:\.\d+)*)/.exec(pending.description)?.[1] ?? String(pending.id) } : { kind: 'verify' };
}

function newOwnerAfter(world, previous) {
  const owner = ap.onlyOwner(world);
  assert.notEqual(owner.id, previous, `the owner is still the previous session:\n${detail(world)}`);
  return owner;
}

async function startMode(world, mode, options = {}) {
  world.mode = mode;
  world.pluginOptions = mode === 'auto' ? { auto: true } : {};
  await world.startOpenCode({ pluginOptions: world.pluginOptions, alreadyOpen: true, ...options });
}

// The model of a session answers the next message with these responses
async function script(world, sessionID, responses) {
  await world.opencodeCall('script', { rules: [{ match: { sessionID }, responses }] });
}

async function say(world, sessionID, text = 'Sigue.') {
  return world.opencodeCall('message', { sessionID, text });
}

// An operational session already doing a step (OpenCode already open)
async function seedOperational(world, step, meta = {}) {
  await ap.ensureOpenCode(world);
  world.owner = await ap.seed(world, { title: OWNER_TITLE, step, meta });
  return world.owner;
}

// The operational session produces with these files and goes idle; returns the review session
async function produce(world, files, { tool = null } = {}) {
  const responses = [];
  if (tool) responses.push({ files, tool: { name: HANDOFF, input: tool } }, { text: 'Hecho.' });
  else responses.push({ files, text: 'Hecho.' });
  await script(world, world.owner, responses);
  await say(world, world.owner);
}

const TASKS_1_2_DONE = [{ id: '1', done: true }, { id: '2', done: true }, { id: '3', done: false }, { id: '4', done: false }];

// A review reached by the plugin: the step produces, and the review opens with the product in the stage
async function reachReview(world, what) {
  if (!world.sim) await startMode(world, world.mode ?? 'normal');
  if (what === 'el artefacto `design`') {
    await ap.prepareChange(world, { artifacts: ['proposal', 'specs'] });
    await seedOperational(world, { kind: 'artifact', id: 'design' });
    await produce(world, ARTIFACT_FILES.design());
  } else if (what === 'la task 3') {
    await ap.prepareChange(world, { tasks: TASKS_1_2_DONE });
    await seedOperational(world, { kind: 'task', id: '3', label: '3' }, { zone: 'code' });
    await produce(world, { ...tasksFile([{ id: '1', done: true }, { id: '2', done: true }, { id: '3', done: true }, { id: '4', done: false }]), 'src/exportar.js': 'export const exportar = () => {};\n' });
  } else if (what === 'la última task') {
    await ap.prepareChange(world, { tasks: [{ id: '1', done: true }, { id: '2', done: true }, { id: '3', done: true }, { id: '4', done: false }] });
    await seedOperational(world, { kind: 'task', id: '4', label: '4' }, { zone: 'code' });
    await produce(world, { ...tasksFile([1, 2, 3, 4].map((id) => ({ id: String(id), done: true }))), 'src/ultima.js': 'export {};\n' });
  } else throw new Error(`unknown review: ${what}`);
  const review = newOwnerAfter(world, world.owner);
  assert.equal(ap.metaOf(review).step.kind, 'review', detail(world));
  world.stepSession = world.owner;
  world.owner = review.id;
  return review;
}

function toolResults(world, sessionID) {
  return ap.session(world, sessionID).messages.flatMap((m) => (m.content ?? []).filter((p) => p.type === 'tool').map((p) => p.state.content?.[0]?.text ?? ''));
}

// --- Dónde actúa -------------------------------------------------------------------

Given(/^un clon del proyecto en (la rama de origen|un commit con HEAD separado)$/, function (where) {
  const project = this.lifecycleProject();
  if (where === 'un commit con HEAD separado') this.branches.detach(project);
});

When('se abre una sesión de OpenCode en la TUI', async function () {
  if (!this.sim) await this.startOpenCode();
  const { sessionID } = await this.opencodeCall('open', { text: 'Hola, quiero exportar los datos' });
  this.opened = sessionID;
});

Then('el plugin no crea, archiva ni encadena ninguna sesión', function () {
  const all = ap.sessions(this);
  assert.equal(all.length, 1, detail(this));
  assert.equal(all[0].id, this.opened);
  assert.equal(ap.metaOf(all[0]), null, detail(this));
  assert.equal(Boolean(all[0].time.archived), false);
  assert.deepEqual(this.opencode.navigations, []);
  assert.deepEqual(ap.injected(this, this.opened), [], detail(this));
  assert.deepEqual(this.opencode.crashes, [], detail(this));
});

Given(/^una rama temporal con los changes en curso (`[^`]+`) e (`[^`]+`)$/, function (a, b) {
  const project = this.lifecycleProject();
  this.branches.branch(project, ap.BRANCH);
  for (const name of [a, b]) this.branches.addChange(project, CHANGES[name]);
});

Then(/^se avisa de que la rama tiene los changes (`[^`]+`) e (`[^`]+`)$/, function (a, b) {
  const shown = ap.toasts(this);
  for (const name of [a, b]) assert.match(shown, new RegExp(CHANGES[name]), detail(this));
});

Then('no hay ningún hook, skill ni comando del plugin', function () {
  const dir = this.project.path('.claude');
  const found = [];
  const walk = (current) => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const file = path.join(current, entry.name);
      if (entry.isSymbolicLink()) {
        const target = fs.readlinkSync(file);
        if (/openspec-autopilot/.test(target)) found.push(file);
        continue;
      }
      if (entry.isDirectory()) walk(file);
      else if (/openspec-autopilot|openspec_handoff|openspec_session|hello-request/.test(fs.readFileSync(file, 'utf8')) || /openspec-autopilot/.test(entry.name)) found.push(file);
    }
  };
  walk(dir);
  assert.deepEqual(found, [], `.claude/ has something of the plugin: ${found.join(', ')}`);
});

// --- Una sola sesión operativa ------------------------------------------------------

Given(/^una rama temporal cuyo change tiene una sesión (?:operativa|dueña) parada$/, async function () {
  await ap.prepareChange(this, { artifacts: ['proposal'] });
  await seedOperational(this, { kind: 'artifact', id: 'specs' });
});

When('se cierra OpenCode y se vuelve a abrir en el proyecto', async function () {
  this.opencode = await this.sim.restart();
  await this.opencodeCall('waitScreen');
});

Then(/^esa sesión sigue siendo la (?:operativa|dueña) del change$/, function () {
  const owner = ap.onlyOwner(this);
  assert.equal(owner.id, this.owner, detail(this));
  // Started again, the plugin sees it as the operational session: it creates no other
  assert.equal(ap.sessions(this).length, 1, detail(this));
});

Then('el repositorio no tiene ningún archivo nuevo que lo registre', function () {
  assert.deepEqual(this.project.gitStatus(), []);
});

Given('una rama temporal con el change en curso `exportar-datos` y su sesión operativa parada', async function () {
  await ap.prepareChange(this, { artifacts: ['proposal'] });
  await seedOperational(this, { kind: 'artifact', id: 'specs' });
});

When('el usuario escribe el primer mensaje de una sesión nueva', async function () {
  const { sessionID } = await this.opencodeCall('openHome', { text: 'Quiero poder exportar los datos a CSV' });
  this.opened = sessionID;
});

Then('la sesión operativa conserva el control', function () {
  assert.equal(ap.onlyOwner(this).id, this.owner, detail(this));
});

Then('la sesión nueva no toma el control', function () {
  assert.notEqual(ap.metaOf(ap.session(this, this.opened))?.role, 'owner', detail(this));
  assert.equal(ap.onlyOwner(this).id, this.owner, detail(this));
});

// --- Verificación por producto ---------------------------------------------------------

Given(/^una rama temporal con el change en curso `exportar-datos`, en modo (normal|auto)$/, async function (mode) {
  await ap.prepareChange(this, { tasks: TASKS_1_2_DONE });
  await startMode(this, mode);
});

Given(/^la sesión operativa está creando el artefacto `(design|specs|proposal|tasks)`$/, async function (artifact) {
  const before = { design: ['proposal', 'specs'], specs: ['proposal'], proposal: [], tasks: ['proposal', 'specs', 'design', 'adr'] }[artifact];
  await ap.prepareChange(this, { artifacts: before });
  await seedOperational(this, { kind: 'artifact', id: artifact }, { zone: 'specs' });
});

When('la sesión queda en reposo sin haber escrito el artefacto `design`', async function () {
  await ap.refresh(this);
  this.sessionsBefore = ap.sessions(this).length;
  await say(this, this.owner);
});

Then('no se crea ninguna sesión nueva', function () {
  assert.equal(ap.sessions(this).length, this.sessionsBefore ?? 1, detail(this));
});

When('el modelo llama a `openspec_handoff` sin haber escrito el artefacto `design`', async function () {
  await script(this, this.owner, [{ tool: { name: HANDOFF, input: {} } }, { text: 'Hecho.' }]);
  await say(this, this.owner);
});

Then('la tool responde que no hay producto evaluable', function () {
  assert.ok(toolResults(this, this.owner).some((t) => /No hay producto evaluable/.test(t)), detail(this));
  assert.equal(ap.onlyOwner(this).id, this.owner);
});

When(/^el modelo escribe el artefacto `(design|tasks)` y la sesión queda en reposo(?: sin llamar a `openspec_handoff`)?$/, async function (artifact) {
  this.stepSession = this.owner;
  await produce(this, ARTIFACT_FILES[artifact]());
});

Then(/^el artefacto `(design|tasks)` queda en el stage de git$/, function (artifact) {
  assert.ok(ap.staged(this).includes(rel(`${artifact}.md`)), `${ap.staged(this).join('\n')}\n${detail(this)}`);
});

Then(/^se crea una sesión de revisión del artefacto `(design|proposal)` con el control$/, function (artifact) {
  const owner = newOwnerAfter(this, this.stepSession ?? this.owner);
  assert.deepEqual(ap.metaOf(owner).step, { kind: 'review', id: artifact, of: 'artifact' }, detail(this));
  assert.equal(ap.metaOf(owner).phase, 'review');
  assert.equal(owner.agent, 'build');
  this.review = owner.id;
});

Given('una rama sin change, en modo normal', async function () {
  const project = this.lifecycleProject();
  this.branches.branch(project, ap.BRANCH);
  await startMode(this, 'normal');
});

Given('la sesión operativa está creando el change', async function () {
  await seedOperational(this, { kind: 'new' }, { change: null, snapshot: { change: null, artifacts: [], tasks: [], git: null } });
});

When('el modelo crea el change `exportar-datos` y escribe los artefactos `proposal` y `specs` en la misma respuesta', async function () {
  this.stepSession = this.owner;
  await produce(this, { [rel('.openspec.yaml')]: 'schema: intent-driven\ncreated: 2026-11-21\n', ...ARTIFACT_FILES.proposal(), ...ARTIFACT_FILES.specs() });
});

Then('la revisión del artefacto `specs` queda pendiente para después de la del `proposal`', function () {
  const queue = ap.metaOf(ap.session(this, this.review)).queue;
  assert.deepEqual(queue.map((q) => q.step), [{ kind: 'review', id: 'specs', of: 'artifact' }], detail(this));
  // Only the proposal is in the stage; the specs wait in the tree
  const staged = ap.staged(this);
  assert.ok(staged.includes(rel('proposal.md')), staged.join('\n'));
  assert.ok(!staged.some((f) => f.includes('/specs/')), staged.join('\n'));
});

When('el modelo escribe unas specs que `openspec validate` da por inválidas y la sesión queda en reposo', async function () {
  this.stepSession = this.owner;
  await produce(this, { [rel('specs', 'prueba-exportar-datos', 'spec.md')]: '# prueba-exportar-datos\n\n## ADDED Requirements\n\n### Requirement: Prueba sin escenarios\nEl sistema DEBE probar.\n' });
});

Then('la sesión de revisión del artefacto `specs` recibe los errores de `openspec validate`', function () {
  const review = newOwnerAfter(this, this.stepSession);
  assert.deepEqual(ap.metaOf(review).step, { kind: 'review', id: 'specs', of: 'artifact' }, detail(this));
  const instruction = ap.instructionOf(this, review.id);
  assert.match(instruction, /openspec validate/, instruction);
  assert.ok(ap.metaOf(review).review.errors.length > 0, detail(this));
});

// --- Arranque de la sesión operativa ----------------------------------------------------

Given(/^(una rama temporal sin change|la rama de origen|una rama temporal con el change en curso `exportar-datos`) sin sesión operativa$/, async function (where) {
  const project = this.lifecycleProject();
  if (where === 'una rama temporal sin change') this.branches.branch(project, ap.BRANCH);
  else if (where.includes('exportar-datos')) await ap.prepareChange(this, { artifacts: ['proposal'] });
  this.where = where;
});

When('el usuario abre OpenCode en la TUI', async function () {
  if (this.sim) this.opencode = await this.sim.restart();
  else await this.startOpenCode({ alreadyOpen: false });
  await this.opencodeCall('waitScreen');
});

Then(/^se crea una sesión operativa que arranca (`openspec-new-change`|el paso que indique `openspec status`) sin que el usuario escriba nada$/, function (what) {
  const owner = ap.onlyOwner(this);
  const m = ap.metaOf(owner);
  const instruction = ap.instructionOf(this, owner.id);
  if (what === '`openspec-new-change`') {
    assert.equal(m.step.kind, 'new', detail(this));
    assert.match(instruction, /openspec-new-change/);
  } else {
    assert.deepEqual(m.step, stepFromStatus(this), detail(this));
    assert.match(instruction, /openspec-continue-change/);
  }
  // The instruction is the session's first message, sent by the plugin
  assert.match(owner.messages.find((x) => x.type === 'user')?.text ?? '', /\[openspec-autopilot\]/, detail(this));
  this.created = owner.id;
});

// --- El CLI de OpenSpec del proyecto en cualquier sistema (windows-support) ----------------

// The project's dependencies: its own node_modules/ with the real OpenSpec
// package of the repository, and a .bin/openspec that is not an executable,
// as on Windows, where it is a shell script
Given('un proyecto con un change en la rama y sus dependencias instaladas', async function () {
  await ap.prepareChange(this, { artifacts: ['proposal'] });
  const modules = this.project.path('node_modules');
  fs.mkdirSync(path.join(modules, '.bin'), { recursive: true });
  fs.symlinkSync(path.join(require('../support/project').REPO_ROOT, 'node_modules', '@fission-ai'), path.join(modules, '@fission-ai'));
  fs.symlinkSync(path.join('..', '@fission-ai', 'openspec', 'bin', 'openspec.js'), path.join(modules, '.bin', 'openspec'));
});

Given('`node_modules\\/.bin\\/openspec` del proyecto no es un ejecutable', function () {
  const bin = this.project.path('node_modules', '.bin', 'openspec');
  fs.rmSync(bin, { force: true });
  fs.writeFileSync(bin, '#!/bin/sh\n# como en Windows: un script de shell que no se puede ejecutar directamente\nexit 1\n', { mode: 0o644 });
});

When('se abre OpenCode en el proyecto con la TUI', async function () {
  await this.startOpenCode({ alreadyOpen: false });
  await this.opencodeCall('waitScreen');
});

Then('la sesión operativa arranca con el paso que dice `openspec status`', function () {
  const owner = ap.onlyOwner(this);
  assert.deepEqual(ap.metaOf(owner).step, stepFromStatus(this), detail(this));
});

Then('la TUI pasa a esa sesión', function () {
  assert.deepEqual(this.opencode.route, { type: 'session', sessionID: this.created }, detail(this));
});

Given('OpenCode abierto en la TUI en una rama temporal sin change ni sesión operativa', async function () {
  const project = this.lifecycleProject();
  this.branches.branch(project, ap.BRANCH);
  await this.startOpenCode({ alreadyOpen: true });
});

When('OpenCode recarga el plugin', async function () {
  await this.opencodeCall('reload');
  await this.opencodeCall('waitScreen');
});

Then('no se crea ninguna sesión', function () {
  assert.equal(ap.sessions(this).length, 0, detail(this));
});

// --- Validación al volver a la sesión operativa -----------------------------------------------

Given('una rama temporal con el change en curso `exportar-datos` y su sesión operativa', async function () {
  await ap.prepareChange(this, { artifacts: ['proposal', 'specs'] });
  await startMode(this, 'normal');
  await seedOperational(this, { kind: 'artifact', id: 'design' });
});

Given('el usuario borra el change `exportar-datos` de la rama', function () {
  fs.rmSync(this.project.path(CHANGE_DIR), { recursive: true, force: true });
  this.branches.commitAll(this.project, 'borra el change');
});

When('la TUI recupera el foco en la sesión operativa', async function () {
  if (this.opencode.route?.sessionID !== this.owner) await this.opencodeCall('goto', { sessionID: this.owner });
  await this.opencodeCall('blur');
  await this.opencodeCall('focus');
});

Then('la sesión deja de ser la operativa y queda archivada', function () {
  const old = ap.session(this, this.owner);
  assert.notEqual(ap.metaOf(old).role, 'owner', detail(this));
  assert.ok(old.time.archived, detail(this));
});

Then('se crea una sesión operativa que arranca `openspec-new-change`', function () {
  const owner = newOwnerAfter(this, this.owner);
  assert.equal(ap.metaOf(owner).step.kind, 'new', detail(this));
  assert.match(ap.instructionOf(this, owner.id), /openspec-new-change/);
});

Given('una sesión operativa que espera el commit del usuario para empezar el artefacto `design` de `exportar-datos`', async function () {
  await ap.prepareChange(this, { artifacts: ['proposal', 'specs'] });
  await startMode(this, 'normal');
  fs.appendFileSync(this.project.path('README.md'), '\nCambio sin commit.\n');
  await seedOperational(this, { kind: 'artifact', id: 'design' }, { phase: 'waiting-commit' });
  await this.opencodeCall('goto', { sessionID: this.owner });
});

Given('el usuario hace el commit', function () {
  this.branches.commitAll(this.project, 'commit del usuario');
});

Then('la sesión empieza el artefacto `design` sin que el usuario escriba nada', function () {
  const owner = ap.session(this, this.owner);
  assert.equal(ap.metaOf(owner).phase, 'running', detail(this));
  const first = owner.messages.find((m) => m.type === 'user')?.text ?? '';
  assert.match(first, /\[openspec-autopilot\]/, detail(this));
  assert.match(first, /`design`/);
});

Given(/^una sesión operativa parada que hace el artefacto `(tasks|design)` de `exportar-datos`$/, async function (artifact) {
  await ap.prepareChange(this, { artifacts: artifact === 'tasks' ? ['proposal'] : ['proposal', 'specs'] });
  await startMode(this, 'normal');
  await seedOperational(this, { kind: 'artifact', id: artifact });
  await ap.refresh(this);
  this.sessionsBefore = ap.sessions(this).length;
});

Given('`openspec status` da como siguiente el artefacto `specs`', function () {
  assert.deepEqual(stepFromStatus(this), { kind: 'artifact', id: 'specs' });
});

Given('el artefacto `design` ya está escrito', function () {
  this.branches.writeArtifact(this.project, ap.CHANGE, 'design');
});

Then('se muestra un modal que explica que el paso de la sesión no encaja con `openspec status`', function () {
  const dialog = this.opencode.dialogs.at(-1);
  assert.ok(dialog, detail(this));
  assert.match(dialog.title, /no encaja con openspec status/, dialog.title);
  assert.equal(dialog.options.length, 1);
});

Then('no se crea ni se archiva ninguna sesión', function () {
  assert.equal(ap.sessions(this).length, this.sessionsBefore, detail(this));
  assert.deepEqual(this.opencode.archives, []);
});

Then('no se muestra ningún modal', function () {
  assert.deepEqual(this.opencode.dialogs, [], detail(this));
});

// --- Funcionamiento sin TUI ----------------------------------------------------------------------

Given('una rama temporal con el change en curso `exportar-datos`, en modo normal, sin ninguna TUI', async function () {
  await ap.prepareChange(this, { tasks: TASKS_1_2_DONE });
  await startMode(this, 'normal', { tui: false });
});

Then('la sesión anterior queda marcada para archivarse', function () {
  const old = ap.session(this, this.stepSession);
  assert.equal(ap.metaOf(old).archivePending, true, detail(this));
  assert.equal(Boolean(old.time.archived), false);
});

Given('una rama temporal con el change en curso `exportar-datos` y su sesión operativa, sin ninguna TUI', async function () {
  await ap.prepareChange(this, { artifacts: ['proposal', 'specs'] });
  await startMode(this, 'normal', { tui: false });
  await seedOperational(this, { kind: 'artifact', id: 'design' });
});

When('el usuario escribe en una sesión nueva', async function () {
  const { sessionID } = await this.opencodeCall('open', { text: 'Hola, ¿qué tal?' });
  this.opened = sessionID;
});

Then('el contexto del modelo dice que esa sesión no es la operativa y nombra la sesión operativa', function () {
  const notes = ap.injected(this, this.opened);
  assert.ok(notes.length > 0, detail(this));
  assert.match(notes[0], /no es la sesión operativa/);
  assert.ok(notes[0].includes(OWNER_TITLE) && notes[0].includes(this.owner), notes[0]);
});

Given('una rama temporal sin change ni sesión operativa, sin ninguna TUI', async function () {
  this.branches.branch(this.lifecycleProject(), ap.BRANCH);
  await this.startOpenCode({ tui: false });
});

When('el usuario escribe `autopilot` como primer mensaje de una sesión nueva', async function () {
  const { sessionID } = await this.opencodeCall('open', { text: 'autopilot' });
  this.opened = sessionID;
});

Then('la sesión pasa a ser la operativa y arranca `openspec-new-change`', function () {
  const owner = ap.onlyOwner(this);
  assert.equal(owner.id, this.opened, detail(this));
  assert.equal(ap.metaOf(owner).step.kind, 'new');
  assert.match(owner.messages.find((m) => m.type === 'user').text, /openspec-new-change/, detail(this));
});

Given('una sesión de un change marcada para archivarse mientras no había ninguna TUI', async function () {
  await ap.prepareChange(this, { artifacts: ['proposal'] });
  await seedOperational(this, { kind: 'artifact', id: 'specs' });
  this.marked = await ap.seed(this, { title: 'artefacto proposal', step: { kind: 'artifact', id: 'proposal' }, meta: { role: 'free', phase: 'done', archivePending: true } });
});

Then('esa sesión queda archivada', function () {
  assert.ok(ap.session(this, this.marked).time.archived, detail(this));
});

// --- La TUI se presenta sin errores ---------------------------------------------------------------

Given('OpenCode arranca la parte de TUI del plugin antes de que la parte de servidor registre su RPC', function () {
  this.branches.branch(this.lifecycleProject(), ap.BRANCH);
});

When('la parte de servidor registra su RPC', async function () {
  await this.startOpenCode({ rpcLate: true });
  await this.opencodeCall('waitScreen');
});

Then('la TUI queda presentada al servidor', function () {
  // Presented as a start: the plugin created the operational session and the TUI went to it
  const owner = ap.onlyOwner(this);
  assert.deepEqual(this.opencode.route, { type: 'session', sessionID: owner.id }, detail(this));
});

// --- Ventanas ajenas -------------------------------------------------------------------------------

const ENTER = {
  'muestra la pantalla de inicio tras `/new`': async (world) => {
    await world.opencodeCall('goto', { sessionID: world.owner });
    await world.opencodeCall('dialogWait', { on: true });
    await world.opencodeCall('home');
  },
  'salta a una sesión libre': async (world) => {
    const free = await ap.seed(world, { title: 'Sesión libre', step: null });
    await world.opencodeCall('dialogWait', { on: true });
    await world.opencodeCall('goto', { sessionID: free });
  },
  'recupera el foco en la pantalla de inicio': async (world) => {
    await world.opencodeCall('dialogWait', { on: true });
    await world.opencodeCall('blur');
    await world.opencodeCall('focus');
  },
  'entra en la sesión operativa': async (world) => {
    await world.opencodeCall('goto', { sessionID: world.owner });
  },
  'salta a una sesión archivada del change': async (world) => {
    const archived = await ap.seed(world, { title: 'artefacto specs', step: { kind: 'artifact', id: 'specs' }, archived: true, meta: { role: 'free', phase: 'done' } });
    await world.opencodeCall('goto', { sessionID: archived });
  },
  'pasa sola a la sesión del paso siguiente al encadenar': async (world) => {
    await world.opencodeCall('goto', { sessionID: world.owner });
    world.stepSession = world.owner;
    await produce(world, ARTIFACT_FILES.design());
    await world.opencodeCall('waitScreen');
    const review = newOwnerAfter(world, world.stepSession);
    assert.deepEqual(world.opencode.route, { type: 'session', sessionID: review.id }, detail(world));
  },
};

When(/^la TUI (muestra la pantalla de inicio tras `\/new`|salta a una sesión libre|recupera el foco en la pantalla de inicio|entra en la sesión operativa|salta a una sesión archivada del change|pasa sola a la sesión del paso siguiente al encadenar)$/, async function (how) {
  await ENTER[how](this);
});

Then('se muestra el modal de un solo botón que nombra `exportar-datos` y la sesión operativa', function () {
  const dialog = this.opencode.dialogs.at(-1);
  assert.ok(dialog?.open, detail(this));
  assert.match(dialog.title, /exportar-datos/);
  assert.ok(dialog.title.includes(OWNER_TITLE), dialog.title);
  assert.deepEqual(dialog.options.map((o) => o.title), ['Ir a la sesión del change']);
});

Then(/^al cerrarlo con (Enter|Esc), la TUI pasa a la sesión operativa$/, async function (key) {
  await this.opencodeCall('answers', { answers: [{ key: key.toLowerCase() }], settle: true });
  await this.opencodeCall('waitScreen');
  assert.deepEqual(this.opencode.route, { type: 'session', sessionID: this.owner }, detail(this));
  assert.equal(this.opencode.dialogs.filter((d) => d.open).length, 0);
});

Given('la TUI muestra el modal en la pantalla de inicio', async function () {
  await this.opencodeCall('fail', { failures: { 'tui.navigate': 100 } });
  await this.opencodeCall('dialogWait', { on: true });
  await this.opencodeCall('blur');
  await this.opencodeCall('focus');
  assert.equal(this.opencode.dialogs.filter((d) => d.open).length, 1, detail(this));
});

When('la TUI no consigue pasar a la sesión operativa al cerrar el modal', async function () {
  await this.opencodeCall('answers', { answers: [{ key: 'enter' }], settle: true });
  await this.opencodeCall('waitScreen');
  await this.opencodeCall('waitScreen');
});

Then('el modal no vuelve a abrirse hasta que la TUI cambie de ventana o recupere el foco', async function () {
  assert.equal(this.opencode.dialogs.length, 1, detail(this));
  assert.deepEqual(this.opencode.route, { type: 'home' });
  await this.opencodeCall('focus');
  assert.equal(this.opencode.dialogs.length, 2, detail(this));
});

// --- Revisión cerrada por git ------------------------------------------------------------------------

Given(/^una sesión de revisión de (el artefacto `design`|la task 3), con su producto en el stage$/, async function (what) {
  await reachReview(this, what);
  assert.ok(ap.staged(this).length > 0, detail(this));
});

const GIT_ACTIONS = {
  'hace el commit': (world) => ap.gitIn(world, 'commit', '-q', '-m', 'revisado'),
  'saca todo del stage': (world) => ap.gitIn(world, 'restore', '--staged', '.'),
};

When(/^el usuario (hace el commit|saca todo del stage) y envía un prompt$/, async function (action) {
  GIT_ACTIONS[action](this);
  this.reviewResult = action === 'hace el commit' ? 'ok' : 'ko';
  await say(this, this.owner, CONCLUSIONS);
});

Then(/^se crea una sesión nueva con el control para (el paso que indique `openspec status`|`openspec-update-change`, con el prompt como conclusiones|el archive|`openspec-verify-change`)$/, function (next) {
  const owner = newOwnerAfter(this, this.owner);
  const step = ap.metaOf(owner).step;
  const instruction = ap.instructionOf(this, owner.id);
  if (next === 'el paso que indique `openspec status`') {
    assert.deepEqual(step, stepFromStatus(this), detail(this));
  } else if (next.startsWith('`openspec-update-change`')) {
    assert.equal(step.kind, 'update', detail(this));
    assert.match(instruction, /openspec-update-change/);
    assert.ok(instruction.includes(CONCLUSIONS), instruction);
  } else if (next === 'el archive') {
    assert.equal(step.kind, 'archive', detail(this));
    assert.match(instruction, /openspec-archive-change/);
  } else {
    assert.equal(step.kind, 'verify', detail(this));
    assert.match(instruction, /openspec-verify-change/);
  }
  this.next = owner.id;
});

Then('la sesión de revisión queda archivada', function () {
  const review = ap.session(this, this.owner);
  assert.ok(review.time.archived, detail(this));
  assert.equal(ap.metaOf(review).review.result, this.reviewResult);
});

Given('una sesión de revisión del artefacto `design` de `exportar-datos`, con su producto en el stage', async function () {
  await startMode(this, 'normal');
  await reachReview(this, 'el artefacto `design`');
});

When('el usuario envía un prompt sin haber hecho el commit', async function () {
  await ap.refresh(this);
  this.sessionsBefore = ap.sessions(this).length;
  await say(this, this.owner, '¿Qué te parece la sección de contexto?');
});

Then('el prompt llega al modelo de la sesión de revisión', function () {
  const prompt = this.opencode.prompts.filter((p) => p.sessionID === this.owner).at(-1);
  assert.equal(prompt.final, prompt.text, JSON.stringify(prompt));
  assert.equal(ap.onlyOwner(this).id, this.owner, detail(this));
});

// The verify ends clean and the plugin opens its review, with the tree clean
async function reachVerifyReview(world) {
  await ap.prepareChange(world, { tasks: [1, 2, 3, 4].map((id) => ({ id: String(id), done: true })) });
  if (!world.sim) await startMode(world, 'normal');
  await seedOperational(world, { kind: 'verify' }, { zone: 'code' });
  world.stepSession = world.owner;
  await script(world, world.owner, [{ tool: { name: HANDOFF, input: { result: 'clean', conclusions: 'Sin problemas.' } } }, { text: 'Informe terminado.' }]);
  await say(world, world.owner);
  const review = newOwnerAfter(world, world.owner);
  assert.deepEqual(ap.metaOf(review).step, { kind: 'review', id: 'verify', of: 'verify' }, detail(world));
  assert.deepEqual(world.project.gitStatus(), []);
  world.owner = review.id;
  return review;
}

Given('una sesión de revisión del verify de `exportar-datos`, con el árbol limpio, en modo normal', async function () {
  await reachVerifyReview(this);
});

When('el usuario hace un commit y envía un prompt', async function () {
  ap.gitIn(this, 'commit', '-q', '--allow-empty', '-m', 'verify revisado');
  this.reviewResult = 'ok';
  await say(this, this.owner, 'Todo bien, adelante.');
});

Given('una sesión de `openspec-update-change` lanzada por una revisión no satisfactoria de la task 3', async function () {
  await startMode(this, 'normal');
  await reachReview(this, 'la task 3');
  GIT_ACTIONS['saca todo del stage'](this);
  await say(this, this.owner, CONCLUSIONS);
  const update = newOwnerAfter(this, this.owner);
  assert.equal(ap.metaOf(update).step.kind, 'update', detail(this));
  this.owner = update.id;
});

When('la sesión cambia el plan y queda en reposo', async function () {
  this.stepSession = this.owner;
  await produce(this, { [rel('design.md')]: '## Context\n\nPrueba, con el formato de las fechas.\n' });
});

Then('los cambios quedan en el stage de git', function () {
  assert.ok(ap.staged(this).includes(rel('design.md')), ap.staged(this).join('\n'));
});

Then('se crea una sesión de revisión de los cambios en el plan', function () {
  const owner = newOwnerAfter(this, this.stepSession);
  assert.deepEqual(ap.metaOf(owner).step, { kind: 'review', id: 'plan', of: 'plan' }, detail(this));
  assert.equal(owner.agent, 'build');
  assert.match(ap.instructionOf(this, owner.id), /los cambios en el plan/);
});

When('la revisión de la última task termina satisfactoria', async function () {
  await reachReview(this, 'la última task');
  GIT_ACTIONS['hace el commit'](this);
  await say(this, this.owner, 'Perfecto, adelante.');
});

// --- Índice de sesiones --------------------------------------------------------------------

const TRANSCRIPT = 'TRANSCRIPCION-QUE-NO-DEBE-LLEGAR';
const DESIGN_CONCLUSIONS = 'El design no dice cómo se nombran los archivos exportados.';

Given('la revisión del artefacto `design` fue no satisfactoria una vez antes', async function () {
  await ap.ensureOpenCode(this);
  const earlier = [
    { title: 'design', step: { kind: 'artifact', id: 'design' }, meta: {} },
    { title: 'Revisión design', step: { kind: 'review', id: 'design', of: 'artifact' }, meta: { review: { result: 'ko', conclusions: DESIGN_CONCLUSIONS } } },
    { title: 'Update', step: { kind: 'update', id: 'design', of: 'artifact' }, meta: {} },
    { title: 'Revisión plan', step: { kind: 'review', id: 'plan', of: 'plan' }, meta: { review: { result: 'ok', conclusions: '' } } },
  ];
  this.earlier = [];
  for (const [i, s] of earlier.entries()) {
    this.earlier.push(await ap.seed(this, { title: s.title, step: s.step, archived: true, meta: { role: 'free', phase: 'done', seq: i + 1, ...s.meta }, messages: [{ type: 'user', text: `${TRANSCRIPT} ${i}` }, { type: 'assistant', agent: 'build', content: [{ type: 'text', text: `${TRANSCRIPT} respuesta ${i}` }] }] }));
  }
});

When(/^el usuario cierra como no satisfactoria la revisión de la task 3 con el prompt "([^"]+)"$/, async function (text) {
  await ap.prepareChange(this, { tasks: TASKS_1_2_DONE });
  await seedOperational(this, { kind: 'task', id: '3', label: '3' }, { zone: 'code', seq: 5 });
  this.earlier.push(this.owner);
  this.stepSession = this.owner;
  await produce(this, { ...tasksFile([{ id: '1', done: true }, { id: '2', done: true }, { id: '3', done: true }, { id: '4', done: false }]), 'src/exportar.js': 'export {};\n' });
  const review = newOwnerAfter(this, this.owner);
  this.earlier.push(review.id);
  this.owner = review.id;
  GIT_ACTIONS['saca todo del stage'](this);
  await say(this, this.owner, text);
  this.update = newOwnerAfter(this, this.owner);
  this.updateText = ap.instructionOf(this, this.update.id);
});

Then(/^la sesión de `openspec-update-change` recibe como conclusiones "([^"]+)"$/, function (text) {
  assert.equal(ap.metaOf(this.update).step.kind, 'update', detail(this));
  assert.ok(this.updateText.includes(text), this.updateText);
});

Then('recibe un índice con cada sesión del change, su paso y el resultado de cada revisión', function () {
  for (const id of this.earlier) assert.ok(this.updateText.includes(id), `${id} is not in the index:\n${this.updateText}`);
  assert.match(this.updateText, /revisión del plan/);
  assert.match(this.updateText, /task 3/);
  assert.match(this.updateText, /— ok/);
  assert.match(this.updateText, /— no ok/);
});

Then('el índice incluye las conclusiones de la revisión no satisfactoria del artefacto `design`', function () {
  assert.ok(this.updateText.includes(DESIGN_CONCLUSIONS), this.updateText);
});

Then('no recibe la transcripción de ninguna sesión', function () {
  for (const r of ap.requestsOf(this, this.update.id)) {
    for (const m of r.messages) assert.ok(!m.text.includes(TRANSCRIPT), m.text);
  }
  assert.ok(!this.updateText.includes(TRANSCRIPT));
});

const MODEL_CONCLUSIONS = 'El modelo concluye que falta probar el caso sin datos.';

Given('una sesión de revisión de la task 3 de `exportar-datos` en la que el modelo ha dado sus conclusiones', async function () {
  await startMode(this, 'normal');
  await reachReview(this, 'la task 3');
  await script(this, this.owner, [{ tool: { name: HANDOFF, input: { conclusions: MODEL_CONCLUSIONS } } }, { text: 'Esas son mis conclusiones.' }]);
  await say(this, this.owner, '¿Qué opinas?');
  assert.equal(ap.onlyOwner(this).id, this.owner, detail(this));
});

When('el usuario saca todo del stage y envía el prompt "no"', async function () {
  GIT_ACTIONS['saca todo del stage'](this);
  await say(this, this.owner, 'no');
  this.update = newOwnerAfter(this, this.owner);
});

Then('la sesión de `openspec-update-change` recibe como conclusiones las del modelo', function () {
  assert.ok(ap.instructionOf(this, this.update.id).includes(MODEL_CONCLUSIONS), detail(this));
});

// --- Una sesión por paso ---------------------------------------------------------------

When('la sesión termina el artefacto `proposal`', async function () {
  this.stepSession = this.owner;
  await produce(this, ARTIFACT_FILES.proposal(), { tool: {} });
});

Given('la sesión operativa está creando la task 3', async function () {
  await ap.prepareChange(this, { tasks: TASKS_1_2_DONE });
  await seedOperational(this, { kind: 'task', id: '3', label: '3' }, { zone: 'code' });
});

When(/^la sesión termina (el artefacto `design`|la task 3)$/, async function (what) {
  this.stepSession = this.owner;
  if (what === 'el artefacto `design`') await produce(this, ARTIFACT_FILES.design());
  else await produce(this, { ...tasksFile([{ id: '1', done: true }, { id: '2', done: true }, { id: '3', done: true }, { id: '4', done: false }]), 'src/exportar.js': 'export const exportar = () => {};\n' });
});

// autopilot-plan-explore (D1): every session of the cycle, the reviews too, starts with build
Then('se crea la sesión siguiente con el agente build', function () {
  const owner = newOwnerAfter(this, this.stepSession);
  assert.equal(owner.agent, 'build', detail(this));
});

Then('se crea una sesión nueva con el control, para el siguiente artefacto que indique `openspec status`', function () {
  const owner = newOwnerAfter(this, this.owner);
  const expected = stepFromStatus(this);
  assert.equal(expected.kind, 'artifact');
  assert.deepEqual(ap.metaOf(owner).step, expected, detail(this));
  assert.match(ap.instructionOf(this, owner.id), /openspec-continue-change/);
  this.next = owner.id;
});

Then('la sesión anterior queda archivada', function () {
  assert.ok(ap.session(this, this.stepSession ?? this.owner).time.archived, detail(this));
});

Then('la sesión archivada conserva en su metadata que hizo el artefacto `proposal`', function () {
  assert.deepEqual(ap.metaOf(ap.session(this, this.stepSession)).step, { kind: 'artifact', id: 'proposal' });
});

Given('una sesión operativa que crea el artefacto `design` de `exportar-datos`', async function () {
  await ap.prepareChange(this, { artifacts: ['proposal', 'specs'] });
  await startMode(this, 'normal');
  await seedOperational(this, { kind: 'artifact', id: 'design' });
  await say(this, this.owner, 'Empieza.');
});

When('el usuario escribe un segundo mensaje en la sesión', async function () {
  await say(this, this.owner, '¿Cómo vas?');
});

Then('la petición al modelo incluye el recordatorio del paso', function () {
  const last = ap.requestsOf(this, this.owner).at(-1);
  const users = last.messages.filter((m) => m.role === 'user').map((m) => m.text);
  assert.ok(users.some((t) => /\[openspec-autopilot\] Recordatorio/.test(t) && t.includes('artefacto design')), JSON.stringify(users));
  // Right before the user's last message
  assert.equal(users.at(-1), '¿Cómo vas?');
  assert.match(users.at(-2), /Recordatorio/);
});

Given('una sesión operativa que trabaja con el agente build', async function () {
  await ap.prepareChange(this, { tasks: [{ id: '1', done: false }] });
  await seedOperational(this, { kind: 'task', id: '1', label: '1' });
});

When('el usuario cambia esa sesión al agente plan y después de vuelta a build', async function () {
  await this.opencodeCall('switchAgent', { sessionID: this.owner, agent: 'plan' });
  await say(this, this.owner, '¿Qué queda por hacer?');
  await this.opencodeCall('switchAgent', { sessionID: this.owner, agent: 'build' });
  await say(this, this.owner, 'Sigue.');
});

Then('el plugin no añade ningún mensaje ni instrucción a la sesión', function () {
  const requests = ap.requestsOf(this, this.owner);
  assert.equal(requests.length, 2, detail(this));
  // Only the reminder of the step, the same in every request, whatever the agent
  const reminders = requests.map((r) => r.messages.filter((m) => m.role === 'user' && m.text.includes('[openspec-autopilot]')).map((m) => m.text));
  for (const list of reminders) assert.equal(list.length, 1, JSON.stringify(reminders));
  assert.equal(reminders[0][0], reminders[1][0]);
  for (const request of requests) assert.deepEqual(request.system, ['You are OpenCode (simulated system prompt).'], JSON.stringify(request));
  assert.equal(ap.sessions(this).length, 1, detail(this));
});

// --- Lecciones candidatas -----------------------------------------------------------------

const LESSON = 'El CLI de exportación necesita la ruta absoluta del archivo de salida.';

Given('una sesión dueña que termina el artefacto `design` de `exportar-datos`', async function () {
  await ap.prepareChange(this, { artifacts: ['proposal', 'specs'] });
  await startMode(this, 'normal');
  await seedOperational(this, { kind: 'artifact', id: 'design' });
  this.branches.writeArtifact(this.project, ap.CHANGE, 'design');
  this.branches.commitAll(this.project, 'design');
});

When('pasa el control con una lección candidata', async function () {
  this.statusBefore = this.project.gitStatus();
  await script(this, this.owner, [{ tool: { name: HANDOFF, input: { lessons: [LESSON] } } }, { text: 'Hecho.' }]);
  await say(this, this.owner, 'Ya está.');
});

Then('la lección queda en la metadata de la sesión', function () {
  assert.deepEqual(ap.metaOf(ap.session(this, this.owner)).lessons, [LESSON], detail(this));
});

Then('el árbol de trabajo no tiene cambios nuevos', function () {
  assert.deepEqual(this.project.gitStatus(), this.statusBefore);
  const files = this.project.gitStatus().join('\n');
  assert.ok(!files.includes('lesson'), files);
});

const LESSONS = ['Lección candidata uno.', 'Lección candidata dos.', 'Lección candidata tres.'];

Given('un change `exportar-datos` de un proyecto con el wiki habilitado, cuyas sesiones dejaron tres lecciones candidatas', async function () {
  this.ensureProject().setWiki(true);
  await ap.prepareChange(this, { tasks: [{ id: '1', done: true }] });
  await startMode(this, 'normal');
  await ap.seed(this, { title: 'design', step: { kind: 'artifact', id: 'design' }, archived: true, meta: { role: 'free', phase: 'done', seq: 1, lessons: [LESSONS[0]] } });
  await ap.seed(this, { title: 'task 1', step: { kind: 'task', id: '1' }, archived: true, meta: { role: 'free', phase: 'done', seq: 2, lessons: [LESSONS[1], LESSONS[2]] } });
  await seedOperational(this, { kind: 'archive' }, { seq: 3 });
});

When('se crea la sesión que resincroniza el wiki tras el archive', async function () {
  this.branches.archiveChange(this.project, ap.CHANGE);
  this.branches.commitAll(this.project, 'archive');
  await script(this, this.owner, [{ tool: { name: HANDOFF, input: {} } }, { text: 'Archivado.' }]);
  await say(this, this.owner, 'Ya está.');
  this.wiki = newOwnerAfter(this, this.owner);
  this.wikiText = ap.instructionOf(this, this.wiki.id);
});

Then('la sesión recibe las tres lecciones candidatas', function () {
  assert.equal(ap.metaOf(this.wiki).step.kind, 'wiki', detail(this));
  for (const lesson of LESSONS) assert.ok(this.wikiText.includes(lesson), this.wikiText);
});

Then('el wiki solo registra las que el usuario confirma', function () {
  assert.match(this.wikiText, /registra solo las que confirme/);
  assert.match(this.wikiText, /indicaciones de archivado/);
});

// --- El paso del wiki según el ajuste del proyecto (design D5 de add-project-wiki-toggle) ---

Given(/^una rama temporal con el change `exportar-datos` en un proyecto con el wiki (habilitado|deshabilitado)$/, async function (state) {
  this.ensureProject().setWiki(state === 'habilitado');
  await ap.prepareChange(this, { tasks: [{ id: '1', done: true }] });
  await startMode(this, 'normal');
});

// The archive is written; the session hands off once the user has committed it
Given('la sesión operativa ha terminado el archive de `exportar-datos`', async function () {
  await seedOperational(this, { kind: 'archive' }, { seq: 3 });
  this.branches.archiveChange(this.project, ap.CHANGE);
});

When('el usuario hace el commit del archive', async function () {
  this.branches.commitAll(this.project, 'archive');
  await script(this, this.owner, [{ tool: { name: HANDOFF, input: {} } }, { text: 'Archivado.' }]);
  await say(this, this.owner, 'Ya está.');
});

Then('no se crea ninguna sesión para resincronizar el wiki', function () {
  const wiki = ap.sessions(this).filter((s) => ap.metaOf(s)?.step?.kind === 'wiki');
  assert.deepEqual(wiki.map((s) => s.id), [], detail(this));
});

Then('se avisa de que el ciclo de `exportar-datos` ha terminado y de que queda fusionar la rama', function () {
  assert.match(ap.toasts(this), /el ciclo de exportar-datos ha terminado[^\n]*fusionar la rama/, detail(this));
});

Then('el aviso no menciona el commit del wiki', function () {
  const end = ap.toasts(this).split('\n').filter((t) => /ha terminado/.test(t));
  assert.ok(end.length > 0, detail(this));
  for (const toast of end) assert.doesNotMatch(toast, /wiki/i);
});

Then('se crea una sesión nueva con el control para resincronizar el wiki', function () {
  const wiki = newOwnerAfter(this, this.owner);
  assert.equal(ap.metaOf(wiki).step.kind, 'wiki', detail(this));
  assert.match(ap.instructionOf(this, wiki.id), /resincronizar el wiki/);
});

// --- Árbol limpio ----------------------------------------------------------------------------

Given('el árbol de trabajo tiene cambios sin commit', function () {
  this.dirty = true;
});

const STARTS = {
  'el artefacto `design`, tras `specs`': async (world) => {
    await ap.prepareChange(world, { artifacts: ['proposal'] });
    await seedOperational(world, { kind: 'artifact', id: 'specs' }, { zone: 'specs' });
    return ARTIFACT_FILES.specs();
  },
  'la task 1, tras el plan': async (world) => {
    await ap.prepareChange(world, { artifacts: ['proposal', 'specs', 'design', 'adr'] });
    await seedOperational(world, { kind: 'artifact', id: 'tasks' }, { zone: 'specs' });
    return ARTIFACT_FILES.tasks();
  },
  '`openspec-update-change`, tras una revisión no satisfactoria': async (world) => {
    await reachReview(world, 'la task 3');
    GIT_ACTIONS['saca todo del stage'](world);
    return null;
  },
};

When(/^una sesión operativa empieza (el artefacto `design`, tras `specs`|la task 1, tras el plan|`openspec-update-change`, tras una revisión no satisfactoria)$/, async function (what) {
  const files = await STARTS[what](this);
  if (this.dirty) fs.appendFileSync(this.project.path('README.md'), '\nCambio sin commit.\n');
  if (files) await produce(this, files);
  else await say(this, this.owner, CONCLUSIONS);
  this.next = newOwnerAfter(this, this.owner);
});

Then(/^no empieza y espera a que el usuario haga el commit$/, function () {
  const next = ap.session(this, this.next.id);
  assert.equal(ap.metaOf(next).phase, 'waiting-commit', detail(this));
  assert.deepEqual(next.messages, [], 'the step started: it got a prompt');
  assert.match(next.title, /esperando commit/);
  assert.match(ap.toasts(this), /haz el commit/i);
});

Then('empieza', function () {
  const next = ap.session(this, this.next.id);
  assert.equal(ap.metaOf(next).phase, 'running', detail(this));
  assert.match(next.messages.find((m) => m.type === 'user')?.text ?? '', /\[openspec-autopilot\]/, detail(this));
});

// --- Modo auto -------------------------------------------------------------------------------

Given('un usuario sin la opción `auto` en su configuración de OpenCode', async function () {
  // The project does not declare the plugin in any opencode.json, nor sets the option
  for (const file of ['opencode.json', 'opencode.jsonc', path.join('.opencode', 'opencode.json'), path.join('.opencode', 'opencode.jsonc')]) {
    const full = this.lifecycleProject().path(file);
    if (fs.existsSync(full)) assert.doesNotMatch(fs.readFileSync(full, 'utf8'), /openspec-autopilot|"auto"/, file);
  }
  await ap.prepareChange(this, { artifacts: ['proposal', 'specs'] });
  await this.startOpenCode({ pluginOptions: {}, alreadyOpen: true });
});

When('el plugin decide el paso siguiente tras un artefacto', async function () {
  await seedOperational(this, { kind: 'artifact', id: 'design' });
  await produce(this, ARTIFACT_FILES.design());
});

Then('crea una sesión de revisión', function () {
  const owner = newOwnerAfter(this, this.owner);
  assert.deepEqual(ap.metaOf(owner).step, { kind: 'review', id: 'design', of: 'artifact' }, detail(this));
  assert.equal(owner.agent, 'build');
});

When(/^la sesión de verify termina con la tool y el veredicto (sin problemas críticos|con problemas críticos)$/, async function (verdict) {
  await ap.prepareChange(this, { tasks: [{ id: '1', done: true }] });
  await seedOperational(this, { kind: 'verify' }, { zone: 'code' });
  await script(this, this.owner, [{ tool: { name: HANDOFF, input: { result: verdict === 'con problemas críticos' ? 'critical' : 'clean', conclusions: 'Informe del verify.' } } }, { text: 'Informe terminado.' }]);
  await say(this, this.owner, 'Ya está.');
});

Then('la sesión de verify queda parada esperando al usuario', function () {
  const owner = ap.onlyOwner(this);
  assert.equal(owner.id, this.owner, detail(this));
  assert.equal(Boolean(owner.time.archived), false);
  assert.equal(ap.metaOf(owner).step.kind, 'review');
  assert.equal(ap.metaOf(owner).phase, 'review');
  assert.equal(ap.sessions(this).length, 1);
  assert.equal(this.opencode.dialogs.length, 0);
});

Then('la sesión de la task 1 espera a que el usuario haga el commit', function () {
  const next = newOwnerAfter(this, this.stepSession);
  assert.equal(ap.metaOf(next).step.kind, 'task', detail(this));
  assert.equal(ap.metaOf(next).phase, 'waiting-commit', detail(this));
  assert.deepEqual(next.messages, []);
});

// --- El agente plan explora en la sesión operativa (autopilot-plan-explore) ---------------

// What the plugin injected into the last request of the session the scenario looks at
function lastInjected(world) {
  const id = world.opened ?? world.owner;
  const last = ap.requestsOf(world, id).at(-1);
  assert.ok(last, `no request in ${id}:\n${detail(world)}`);
  return last.messages.filter((m) => m.role === 'user' && m.text.includes(ap.MARK)).map((m) => m.text);
}
const EXPLORE_FULL = /compañero de pensamiento/;
const STEP_REMINDER = /Recordatorio: esta sesión (hace solo el paso|es la revisión)/;

async function toAgent(world, agent, text) {
  await world.opencodeCall('switchAgent', { sessionID: world.owner, agent });
  await say(world, world.owner, text);
}

Given('una sesión operativa de `exportar-datos` que hace el artefacto `design`, con el agente build', async function () {
  await ap.prepareChange(this, { artifacts: ['proposal', 'specs'] });
  await startMode(this, 'normal');
  await seedOperational(this, { kind: 'artifact', id: 'design' });
  await say(this, this.owner, 'Empieza.');
});

Given('una sesión operativa de `exportar-datos` que hace la revisión de la task {int}, con el agente build', async function (task) {
  assert.equal(task, 3);
  await reachReview(this, 'la task 3');
});

When('el usuario cambia la sesión al agente plan y escribe un mensaje', async function () {
  await toAgent(this, 'plan', '¿Qué alternativas hay?');
});

When('el usuario cambia otra vez la sesión al agente plan y escribe un mensaje', async function () {
  await toAgent(this, 'plan', '¿Y si lo hacemos de otra forma?');
});

When('el usuario cambia la sesión al agente build y escribe un mensaje', async function () {
  await toAgent(this, 'build', 'Sigue con el paso.');
});

Given('el usuario ya ha escrito un mensaje en ella con el agente plan', async function () {
  await toAgent(this, 'plan', 'Pensemos antes de seguir.');
});

Given('el usuario ha pasado por el agente plan y ha vuelto a build', async function () {
  await toAgent(this, 'plan', 'Pensemos antes de seguir.');
  await toAgent(this, 'build', 'Sigue.');
});

When('el usuario escribe otro mensaje con el agente plan', async function () {
  await say(this, this.owner, '¿Y los formatos de fecha?');
});

When('el usuario escribe con el agente plan en una sesión que no es la operativa', async function () {
  const { sessionID } = await this.opencodeCall('openHome', { text: '¿Qué opciones hay?', agent: 'plan' });
  this.opened = sessionID;
});

Then('la petición al modelo incluye la instrucción de seguir `openspec-explore` sobre el artefacto `design`', function () {
  const texts = lastInjected(this);
  assert.ok(texts.some((t) => t.includes('`openspec-explore`') && EXPLORE_FULL.test(t) && t.includes('artefacto design de exportar-datos')), JSON.stringify(texts));
});

Then('la petición al modelo incluye la instrucción de seguir `openspec-explore` sobre la revisión de la task {int}', function (task) {
  const texts = lastInjected(this);
  assert.ok(texts.some((t) => t.includes('`openspec-explore`') && EXPLORE_FULL.test(t) && t.includes(`revisión de la task ${task} de exportar-datos`)), JSON.stringify(texts));
});

Then('la petición al modelo incluye la instrucción completa de `openspec-explore`', function () {
  const texts = lastInjected(this);
  assert.ok(texts.some((t) => t.includes('`openspec-explore`') && EXPLORE_FULL.test(t)), JSON.stringify(texts));
});

Then('la petición al modelo incluye el recordatorio de la exploración', function () {
  const texts = lastInjected(this);
  assert.ok(texts.some((t) => /Recordatorio: estás explorando/.test(t) && t.includes('artefacto design')), JSON.stringify(texts));
});

Then('la petición al modelo incluye el recordatorio del paso del artefacto `design`, que dice que se vuelve de explorar', function () {
  const texts = lastInjected(this);
  assert.ok(texts.some((t) => /Vuelves de explorar/.test(t) && t.includes('artefacto design de exportar-datos')), JSON.stringify(texts));
});

Then('la petición no incluye el recordatorio del paso', function () {
  const texts = lastInjected(this);
  assert.ok(!texts.some((t) => STEP_REMINDER.test(t)), JSON.stringify(texts));
});

Then('la petición no incluye la instrucción completa de `openspec-explore`', function () {
  const texts = lastInjected(this);
  assert.ok(!texts.some((t) => EXPLORE_FULL.test(t)), JSON.stringify(texts));
});

Then('la petición no incluye ninguna instrucción de `openspec-explore`', function () {
  const texts = lastInjected(this);
  assert.ok(!texts.some((t) => t.includes('openspec-explore')), JSON.stringify(texts));
});

Then('el plugin no añade ningún mensaje a la sesión', function () {
  // What the plugin injects stays out of the history: every stored message is the user's
  const stored = ap.session(this, this.owner).messages.filter((m) => m.type === 'user');
  assert.ok(stored.length > 0);
  for (const m of stored) assert.ok(!m.text.includes(ap.MARK), JSON.stringify(stored));
});

// --- Aviso de lo modificado con el agente plan (autopilot-plan-explore) ---------------------

const PLAN_NOTICE = /con el agente plan se han hecho modificaciones/i;

// The model, with the plan agent, answers the next message after writing these files
async function planTurn(world, files, text = 'Hazlo.') {
  await world.opencodeCall('switchAgent', { sessionID: world.owner, agent: 'plan' });
  await ap.refresh(world).then((state) => (world.opencode = state));
  world.sessionsBefore = ap.sessions(world).length;
  world.stepSession = world.owner;
  await script(world, world.owner, files ? [{ files, text: 'Hecho.' }] : [{ text: 'Lo pienso contigo.' }]);
  await say(world, world.owner, text);
}

// The TUI keeps each dialog open until the scenario closes it
async function keepDialogsOpen(world) {
  await world.opencodeCall('dialogWait', { on: true });
}

function planNoticeDialog(world) {
  const shown = world.opencode.dialogs.filter((d) => PLAN_NOTICE.test(d.title ?? ''));
  assert.equal(shown.length, 1, detail(world));
  return shown[0];
}

Given('una rama temporal con el change en curso `exportar-datos`, en modo normal, en la TUI', async function () {
  await ap.prepareChange(this, { tasks: TASKS_1_2_DONE });
  await startMode(this, 'normal');
  await keepDialogsOpen(this);
});

Given('una sesión operativa que crea el artefacto `design` de `exportar-datos`, en la TUI', async function () {
  await ap.prepareChange(this, { artifacts: ['proposal', 'specs'] });
  await startMode(this, 'normal');
  await keepDialogsOpen(this);
  await seedOperational(this, { kind: 'artifact', id: 'design' }, { zone: 'specs' });
  await say(this, this.owner, 'Empieza.');
});

Given('una sesión operativa de `exportar-datos` con el aviso de lo modificado con el agente plan en pantalla', async function () {
  await ap.prepareChange(this, { artifacts: ['proposal', 'specs'] });
  await startMode(this, 'normal');
  await keepDialogsOpen(this);
  await seedOperational(this, { kind: 'artifact', id: 'design' }, { zone: 'specs' });
});

Given('el turno en plan dejó escrito el artefacto `design`', async function () {
  await planTurn(this, ARTIFACT_FILES.design(), 'Escribe el design.');
  assert.equal(planNoticeDialog(this).open, true);
  assert.equal(ap.metaOf(ap.session(this, this.owner)).phase, 'plan-notice', detail(this));
});

When('el usuario, con el agente plan, pide al modelo que escriba el artefacto `design` y la sesión queda en reposo', async function () {
  await planTurn(this, ARTIFACT_FILES.design(), 'Escribe el design.');
});

When('el modelo, con el agente plan, escribe el artefacto `design` y la sesión queda en reposo', async function () {
  await planTurn(this, ARTIFACT_FILES.design(), 'Escribe el design.');
});

When('el modelo, con el agente plan, modifica el README y la sesión queda en reposo', async function () {
  await planTurn(this, { 'README.md': '# Proyecto\n\nCambiado en plan.\n' }, 'Arregla el README.');
});

When('el usuario conversa con el agente plan sin que cambie nada en git y la sesión queda en reposo', async function () {
  await planTurn(this, null, '¿Qué opinas del formato?');
});

When('el usuario cierra el modal', async function () {
  await this.opencodeCall('answers', { answers: [{ key: 'enter' }], settle: true });
});

Then('se muestra un modal de un solo botón que avisa de que con el agente plan se han hecho modificaciones', function () {
  const shown = planNoticeDialog(this);
  assert.equal(shown.open, true);
  assert.deepEqual(shown.options.map((o) => o.title), ['Entendido']);
});

Then('se muestra el modal que avisa de que con el agente plan se han hecho modificaciones', function () {
  assert.equal(planNoticeDialog(this).open, true);
});

Then('la sesión sigue siendo la operativa del artefacto `design`', function () {
  const owner = ap.onlyOwner(this);
  assert.equal(owner.id, this.owner, detail(this));
  assert.deepEqual(ap.metaOf(owner).step, { kind: 'artifact', id: 'design' });
});

Then('el mensaje con el que arranca la revisión avisa de que con el agente plan se han hecho modificaciones', function () {
  assert.match(ap.instructionOf(this, this.review), PLAN_NOTICE, detail(this));
});

// --- Compactación y fallos ---------------------------------------------------------------------

Given('una sesión dueña que aplica la task 3 de `exportar-datos`', async function () {
  await ap.prepareChange(this, { tasks: [{ id: '1', done: true }, { id: '2', done: true }, { id: '3', done: false }] });
  await seedOperational(this, { kind: 'task', id: '3', label: '3' });
});

When('la sesión se compacta', async function () {
  await this.opencodeCall('compact', { sessionID: this.owner });
});

Then('se avisa al usuario de que estaba aplicando `exportar-datos`', function () {
  assert.match(ap.toasts(this), /aplicando `exportar-datos`/, detail(this));
});

Then('el aviso indica el comando para retomarlo', function () {
  assert.match(ap.toasts(this), /\/openspec-apply-change exportar-datos/, detail(this));
  // Nothing is injected again into the session
  assert.deepEqual(ap.injected(this, this.owner), []);
});

Given('una sesión dueña que termina su paso', async function () {
  await ap.prepareChange(this, { artifacts: ['proposal'] });
  await seedOperational(this, { kind: 'artifact', id: 'specs' });
  this.branches.writeArtifact(this.project, ap.CHANGE, 'specs');
  this.branches.commitAll(this.project, 'specs');
});

Given('OpenCode rechaza la creación de la sesión siguiente', async function () {
  await this.opencodeCall('fail', { failures: { 'session.create': 1 } });
});

When('el plugin intenta encadenar la sesión siguiente', async function () {
  await script(this, this.owner, [{ tool: { name: HANDOFF, input: {} } }, { text: 'Hecho.' }]);
  await say(this, this.owner, 'Ya está.');
});

Then('se avisa al usuario en la TUI de que no se ha podido crear la sesión', function () {
  assert.match(ap.toasts(this), /no se ha podido crear la sesión/, detail(this));
  assert.equal(ap.sessions(this).length, 1, detail(this));
});

Then('la sesión actual sigue respondiendo al usuario', async function () {
  const before = ap.session(this, this.owner).messages.length;
  await say(this, this.owner, '¿Sigues ahí?');
  const session = ap.session(this, this.owner);
  assert.ok(session.messages.length > before);
  assert.equal(session.messages.at(-1).outcome, 'succeeded', detail(this));
  assert.notEqual(ap.metaOf(session).role, 'owner', 'the session should be left free');
  assert.deepEqual(this.opencode.crashes, [], detail(this));
  assert.deepEqual(this.opencode.toolErrors, [], detail(this));
});

// --- Suscripciones de la parte de TUI (fix-tui-subscription-cleanup) -------------

// In the simulated OpenCode, closing the TUI is always closing its own server (--standalone)
Given(/^OpenCode abierto en la TUI(?: con su propio servidor,)? en una rama temporal$/, async function () {
  const project = this.lifecycleProject();
  if (this.branches.currentBranch(project) !== ap.BRANCH) this.branches.branch(project, ap.BRANCH);
  await this.startOpenCode({ alreadyOpen: true });
});

async function reloadPlugin(world, times) {
  for (let i = 0; i < times; i += 1) await world.opencodeCall('reload');
}

When('OpenCode recarga el plugin dos veces', async function () {
  await reloadPlugin(this, 2);
});

Given(/^OpenCode ha recargado el plugin (ninguna vez|dos veces)$/, async function (times) {
  await reloadPlugin(this, times === 'dos veces' ? 2 : 0);
});

Then('solo la última carga de la parte de TUI del plugin recibe sus eventos', function () {
  const { subscriptions, tuiLoad } = this.opencode;
  const loads = [...new Set(subscriptions.map((s) => s.load))].sort();
  assert.ok(subscriptions.length > 0, 'the last load of the TUI part has no subscription');
  assert.deepEqual(loads, [tuiLoad], `TUI loads still subscribed: ${JSON.stringify(subscriptions)}`);
});

// Shared with session-bootstrap: there the simulated host runs the session
// again, with its reloads and its event, and closes it
When('el usuario cierra la TUI', async function () {
  if (this.sim) await this.opencodeCall('close');
  else this.tuiResult = this.session.replay({ ...this.tuiRun, close: true });
});

Then('el terminal no muestra ningún error del plugin', function () {
  assert.deepEqual(this.opencode.terminal, [], `traces in the terminal:\n${this.opencode.terminal.join('\n')}`);
  assert.deepEqual(this.opencode.crashes, [], detail(this));
  assert.equal(ap.toasts(this).match(/cleanup failed/) ?? null, null, ap.toasts(this));
  // Nor in the TUI's log: no RPC call of the plugin failed
  const errors = (this.opencode.logs ?? []).filter((l) => /\[openspec-autopilot\] (hello|screen|reply|rpc|modal|notice):/.test(l));
  assert.deepEqual(errors, [], errors.join('\n'));
});

// --- Revisión guiada con los tests de aceptación --------------------------------------

// A ko review of the task 3 leads to an update-change whose plan changes get their own review
async function reachPlanReview(world) {
  await reachReview(world, 'la task 3');
  GIT_ACTIONS['saca todo del stage'](world);
  await say(world, world.owner, CONCLUSIONS);
  const update = newOwnerAfter(world, world.owner);
  assert.equal(ap.metaOf(update).step.kind, 'update', detail(world));
  world.owner = update.id;
  await produce(world, { [rel('design.md')]: '## Context\n\nPrueba, con el formato de las fechas.\n' });
  const review = newOwnerAfter(world, update.id);
  assert.deepEqual(ap.metaOf(review).step, { kind: 'review', id: 'plan', of: 'plan' }, detail(world));
  return review;
}

When(/^el plugin abre la revisión (?:de |del )(la task 3|el verify|artefacto `design`|los cambios en el plan)$/, async function (what) {
  const reach = {
    'la task 3': () => reachReview(this, 'la task 3'),
    'el verify': () => reachVerifyReview(this),
    'artefacto `design`': () => reachReview(this, 'el artefacto `design`'),
    'los cambios en el plan': () => reachPlanReview(this),
  }[what];
  const review = await reach();
  this.reviewInstruction = ap.instructionOf(this, review.id);
});

Then('la instrucción de la revisión pide guiar la verificación con los escenarios de aceptación del change y ejecutarlos', function () {
  const text = this.reviewInstruction;
  assert.match(text, /escenarios de aceptación/, text);
  assert.ok(text.includes(`openspec/changes/${ap.CHANGE}/specs/`), text);
  assert.match(text, /ejecútalos/i, text);
});

Then('la instrucción pide que las ejecuciones no dejen archivos que git no ignore', function () {
  assert.match(this.reviewInstruction, /no dejen .*archivos que git no ignore/, this.reviewInstruction);
});

Then('la instrucción pide ofrecer al usuario la orden para ejecutar en modo depuración el código generado, si lo hay', function () {
  const text = this.reviewInstruction;
  assert.match(text, /modo depuración/, text);
  assert.match(text, /código fuente que se puede ejecutar/, text);
  assert.match(text, /la ejecuta el usuario/, text);
});

Then('la instrucción de la revisión no pide ejecutar los tests de aceptación ni el código', function () {
  const text = this.reviewInstruction;
  assert.doesNotMatch(text, /escenarios de aceptación|modo depuración|ejecútalos/i, text);
});
