'use strict';

// Steps of openspec-autopilot (add-openspec-autopilot, design D16). The
// plugin runs in the simulated OpenCode with several sessions
// (support/agents/opencode-sim.mjs); the model is a script per scenario, and
// what a workflow writes in the project the steps write themselves before the
// model calls the plugin's tool.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { Given, When, Then } = require('@cucumber/cucumber');
const ap = require('../support/autopilot');

const HANDOFF = 'openspec_handoff';
const OWNER_TITLE = 'Sesión dueña';
const CHANGES = { '`exportar-datos`': 'exportar-datos', '`importar-datos`': 'importar-datos' };

function detail(world) {
  return ap.describeSessions(world);
}

// The step the real `openspec status` and tasks.md of the copy give
function stepFromStatus(world) {
  const status = world.branches.openspecStatus(world.project, ap.CHANGE);
  const tasksFile = world.project.path('openspec', 'changes', ap.CHANGE, 'tasks.md');
  const tasks = fs.existsSync(tasksFile)
    ? fs.readFileSync(tasksFile, 'utf8').split('\n').map((l) => /^\s*-\s+\[([ xX])\]\s+(\S+)/.exec(l)).filter(Boolean).map((m) => ({ id: m[2], done: m[1] !== ' ' }))
    : [];
  if (!(status.isPlanningComplete ?? status.isComplete)) {
    return { kind: 'artifact', id: status.artifacts.find((a) => a.status === 'ready').id };
  }
  const pending = tasks.find((t) => !t.done);
  return pending ? { kind: 'task', id: pending.id } : { kind: 'verify' };
}

function assertNothingOrchestrated(world, opened) {
  const all = ap.sessions(world);
  assert.equal(all.length, 1, detail(world));
  assert.equal(all[0].id, opened);
  assert.equal(ap.metaOf(all[0]), null, detail(world));
  assert.equal(Boolean(all[0].time.archived), false);
  assert.deepEqual(world.opencode.navigations, []);
  assert.deepEqual(ap.injected(world, opened), [], detail(world));
  assert.deepEqual(world.opencode.crashes, [], detail(world));
}

function newOwnerAfter(world, previous) {
  const owner = ap.onlyOwner(world);
  assert.notEqual(owner.id, previous, `the owner is still the previous session:\n${detail(world)}`);
  return owner;
}

async function startMode(world, mode) {
  world.pluginOptions = mode === 'auto' ? { auto: true } : {};
  await world.startOpenCode({ pluginOptions: world.pluginOptions });
}

// The owner session finishes its step: the model calls the tool in reply to the user's message
async function finishStep(world, sessionID, input = {}, { wait = true } = {}) {
  await ap.scriptTool(world, sessionID, HANDOFF, input);
  if (wait) return world.opencodeCall('message', { sessionID, text: 'Ya está.' });
  await world.opencodeCall('dialogWait', { on: true });
  await world.opencodeCall('messageAsync', { sessionID, text: 'Ya está.' });
  return world.opencodeCall('waitDialog', {});
}

// --- Dónde actúa ---------------------------------------------------------------

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
  assertNothingOrchestrated(this, this.opened);
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

// --- El control del change -------------------------------------------------------

Given('una rama temporal cuyo change tiene una sesión dueña parada', async function () {
  await ap.prepareChange(this, { artifacts: ['proposal'] });
  this.owner = await ap.seed(this, { title: OWNER_TITLE, step: { kind: 'artifact', id: 'specs' } });
});

When('se cierra OpenCode y se vuelve a abrir en el proyecto', async function () {
  this.opencode = await this.sim.restart();
});

Then('esa sesión sigue siendo la dueña del change', async function () {
  const owner = ap.onlyOwner(this);
  assert.equal(owner.id, this.owner, detail(this));
  // The plugin, started again, sees it as the owner: a new session asks about it
  await this.opencodeCall('open', { text: 'hola' });
  assert.ok(this.opencode.dialogs.some((d) => d.title.includes(OWNER_TITLE)), detail(this));
});

Then('el repositorio no tiene ningún archivo nuevo que lo registre', function () {
  assert.deepEqual(this.project.gitStatus(), []);
});

// --- Abrir una sesión a mano --------------------------------------------------------

Given(/^una rama temporal (sin change|con un change en curso sin sesión dueña|con un change en curso cuya dueña está trabajando|con un change archivado)$/, async function (state) {
  const project = this.lifecycleProject();
  if (state === 'sin change') {
    this.branches.branch(project, ap.BRANCH);
    return;
  }
  if (state === 'con un change archivado') {
    await ap.prepareChange(this, { tasks: [{ id: '1', done: true }] });
    this.branches.archiveChange(project, ap.CHANGE);
    this.branches.commitAll(project, 'archive');
    return;
  }
  await ap.prepareChange(this, { artifacts: ['proposal'] });
  if (state.includes('trabajando')) this.owner = await ap.seed(this, { title: OWNER_TITLE, step: { kind: 'artifact', id: 'specs' }, busy: true });
});

When(/^el usuario escribe el primer mensaje de una sesión nueva en la TUI( con el agente plan)?$/, async function (plan) {
  await ap.ensureOpenCode(this);
  const text = 'Quiero poder exportar los datos a CSV';
  if (this.waitForDialog) {
    await this.opencodeCall('dialogWait', { on: true });
    this.opened = await this.opencodeCall('openAsync', { text, agent: plan ? 'plan' : 'build' });
    await this.opencodeCall('waitDialog', {});
    return;
  }
  const { sessionID } = await this.opencodeCall('open', { text, agent: plan ? 'plan' : 'build' });
  this.opened = sessionID;
});

Then('la sesión toma el control y arranca `openspec-new-change`', function () {
  const owner = ap.onlyOwner(this);
  assert.equal(owner.id, this.opened, detail(this));
  assert.equal(ap.metaOf(owner).step.kind, 'new');
  const instruction = ap.instructionOf(this, owner.id);
  assert.match(instruction, /openspec-new-change/, detail(this));
  assert.match(instruction, /exportar los datos a CSV/, 'the user message is the description of the change');
});

Then('la sesión toma el control y sigue por el paso de `openspec status`', function () {
  const owner = ap.onlyOwner(this);
  assert.equal(owner.id, this.opened, detail(this));
  const expected = stepFromStatus(this);
  assert.deepEqual(ap.metaOf(owner).step, expected, detail(this));
  const instruction = ap.instructionOf(this, owner.id);
  assert.match(instruction, /openspec-continue-change/, detail(this));
  assert.match(instruction, new RegExp(`\`${expected.id}\``));
});

Then('la sesión queda libre y se avisa de qué sesión tiene el control', function () {
  const opened = ap.session(this, this.opened);
  assert.notEqual(ap.metaOf(opened)?.role, 'owner', detail(this));
  assert.deepEqual(ap.injected(this, this.opened), []);
  assert.equal(ap.onlyOwner(this).id, this.owner);
  assert.match(ap.toasts(this), new RegExp(OWNER_TITLE), detail(this));
});

Then('la sesión queda libre', function () {
  assertNothingOrchestrated(this, this.opened);
});

Given('una rama temporal con un change en curso cuya sesión dueña está parada sin haber terminado su paso', async function () {
  await ap.prepareChange(this, { artifacts: ['proposal'] });
  this.owner = await ap.seed(this, { title: OWNER_TITLE, step: { kind: 'artifact', id: 'specs' } });
  this.waitForDialog = true;
});

Then('se le pregunta si quiere ir a la sesión dueña o archivarla y seguir en la nueva', function () {
  const dialog = this.opencode.dialogs.at(-1);
  assert.ok(dialog?.open, detail(this));
  assert.match(dialog.title, new RegExp(OWNER_TITLE));
  assert.deepEqual(dialog.options.map((o) => o.value), ['go', 'take']);
});

const ANSWERS = { 'elige ir a la dueña': 'go', 'elige archivarla y seguir aquí': 'take', 'cierra la pregunta sin elegir': undefined };

Then(/^si (elige ir a la dueña|elige archivarla y seguir aquí|cierra la pregunta sin elegir), (.+)$/, async function (answer, result) {
  await this.opencodeCall('answers', { answers: [{ value: ANSWERS[answer] }], settle: true });
  const opened = ap.session(this, this.opened);
  const owner = ap.session(this, this.owner);
  if (result === 'la TUI pasa a la sesión dueña y la nueva queda libre') {
    assert.deepEqual(this.opencode.navigations.at(-1), { type: 'session', sessionID: this.owner }, detail(this));
    assert.notEqual(ap.metaOf(opened)?.role, 'owner');
    assert.equal(ap.onlyOwner(this).id, this.owner);
  } else if (result === 'la dueña queda archivada y la nueva toma el control') {
    assert.ok(owner.time.archived, detail(this));
    assert.equal(ap.onlyOwner(this).id, this.opened, detail(this));
    assert.match(ap.instructionOf(this, this.opened), /\[openspec-autopilot\]/);
  } else if (result === 'la dueña conserva el control y la nueva queda libre') {
    assert.equal(Boolean(owner.time.archived), false);
    assert.equal(ap.onlyOwner(this).id, this.owner, detail(this));
    assert.notEqual(ap.metaOf(opened)?.role, 'owner');
  } else throw new Error(`unknown result: ${result}`);
});

// --- Una sesión por paso -------------------------------------------------------------

Given(/^una rama temporal con el change en curso `exportar-datos`, en modo (normal|auto)$/, async function (mode) {
  this.mode = mode;
  await ap.prepareChange(this, { tasks: [{ id: '1', done: true }, { id: '2', done: true }, { id: '3', done: false }, { id: '4', done: false }] });
  await startMode(this, mode);
});

Given('la sesión dueña está creando el artefacto `proposal`', async function () {
  await ap.prepareChange(this, { artifacts: [] });
  this.owner = await ap.seed(this, { title: OWNER_TITLE, step: { kind: 'artifact', id: 'proposal' } });
});

When('la sesión termina el artefacto `proposal`', async function () {
  this.branches.writeArtifact(this.project, ap.CHANGE, 'proposal');
  await finishStep(this, this.owner);
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
  assert.ok(ap.session(this, this.owner).time.archived, detail(this));
});

Then('la sesión archivada conserva en su metadata que hizo el artefacto `proposal`', function () {
  assert.deepEqual(ap.metaOf(ap.session(this, this.owner)).step, { kind: 'artifact', id: 'proposal' });
});

Given('una sesión dueña que trabaja con el agente build', async function () {
  await ap.prepareChange(this, { tasks: [{ id: '1', done: false }] });
  this.owner = await ap.seed(this, { title: OWNER_TITLE, step: { kind: 'task', id: '1' } });
});

When('el usuario cambia esa sesión al agente plan y después de vuelta a build', async function () {
  await this.opencodeCall('switchAgent', { sessionID: this.owner, agent: 'plan' });
  await this.opencodeCall('message', { sessionID: this.owner, text: '¿Qué queda por hacer?' });
  await this.opencodeCall('switchAgent', { sessionID: this.owner, agent: 'build' });
  await this.opencodeCall('message', { sessionID: this.owner, text: 'Sigue.' });
});

Then('el plugin no añade ningún mensaje ni instrucción a la sesión', function () {
  const requests = ap.requestsOf(this, this.owner);
  assert.equal(requests.length, 2, detail(this));
  for (const request of requests) {
    assert.deepEqual(request.system, ['You are OpenCode (simulated system prompt).'], JSON.stringify(request));
    assert.deepEqual(request.messages.filter((m) => m.role === 'user').map((m) => m.text), ap.session(this, this.owner).messages.filter((m) => m.type === 'user').map((m) => m.text).slice(0, request.messages.filter((m) => m.role === 'user').length));
  }
  assert.equal(ap.sessions(this).length, 1, detail(this));
});

// --- Revisión humana guiada -------------------------------------------------------------

const REVIEWED = {
  'el artefacto `design`': { step: { kind: 'review', id: 'design', of: 'artifact' }, artifacts: ['proposal', 'specs', 'design'] },
  'la task 3': { step: { kind: 'review', id: '3', of: 'task' }, tasks: [{ id: '1', done: true }, { id: '2', done: true }, { id: '3', done: true }, { id: '4', done: false }] },
  'el verify': { step: { kind: 'review', id: 'verify', of: 'verify' }, tasks: [{ id: '1', done: true }, { id: '2', done: true }, { id: '3', done: true }, { id: '4', done: true }] },
};

async function seedReview(world, what) {
  const reviewed = REVIEWED[what];
  assert.ok(reviewed, `unknown review: ${what}`);
  await ap.prepareChange(world, { ...(reviewed.artifacts ? { artifacts: reviewed.artifacts } : {}), ...(reviewed.tasks ? { tasks: reviewed.tasks } : {}) });
  world.owner = await ap.seed(world, { title: 'Revisión', step: reviewed.step, agent: 'plan' });
}

Given(/^una sesión de revisión de (el artefacto `design`|la task 3|el verify)$/, async function (what) {
  await seedReview(this, what);
});

const RESULTS = { satisfactoria: 'ok', 'no satisfactoria': 'no ok' };
const CONCLUSIONS = 'Falta validar el formato de las fechas.';

When(/^la revisión termina con la tool y el resultado (satisfactoria|no satisfactoria)$/, async function (result) {
  this.reviewResult = RESULTS[result];
  await finishStep(this, this.owner, { result: this.reviewResult, ...(this.reviewResult === 'no ok' ? { conclusions: CONCLUSIONS } : {}) }, { wait: false });
});

When('el usuario confirma el cierre en la TUI', async function () {
  await this.opencodeCall('answers', { answers: [{ value: 'confirm' }], settle: true });
});

Then(/^se crea una sesión nueva con el control para (el paso que indique `openspec status`|`openspec-update-change`, con las conclusiones de la revisión|el archive|`openspec-verify-change`)$/, function (next) {
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
    // In auto mode, the verdict without critical problems asks for no confirmation
    if (this.mode === 'auto') assert.equal(this.opencode.dialogs.length, 0, detail(this));
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

Given('una sesión de revisión del artefacto `design` de `exportar-datos`, en modo normal', async function () {
  await startMode(this, 'normal');
  await seedReview(this, 'el artefacto `design`');
});

When('el LLM llama a la tool con el resultado satisfactoria', async function () {
  await finishStep(this, this.owner, { result: 'ok', conclusions: 'El design está bien.' }, { wait: false });
});

Then('se pide al usuario en la TUI que confirme el cierre, con el resultado y las conclusiones', function () {
  const dialog = this.opencode.dialogs.at(-1);
  assert.ok(dialog?.open, detail(this));
  assert.match(dialog.title, /ok/);
  assert.match(dialog.title, /El design está bien\./);
  assert.deepEqual(dialog.options.map((o) => o.value), ['confirm', 'continue']);
});

Then('si el usuario no lo confirma, la sesión de revisión conserva el control', async function () {
  await this.opencodeCall('answers', { answers: [{ value: 'continue' }], settle: true });
  const owner = ap.onlyOwner(this);
  assert.equal(owner.id, this.owner, detail(this));
  assert.equal(ap.metaOf(owner).phase, 'running');
});

Then('el LLM recibe que el usuario no ha dado por terminada la revisión', function () {
  const results = ap.session(this, this.owner).messages.flatMap((m) => (m.content ?? []).filter((p) => p.type === 'tool').map((p) => p.state.content?.[0]?.text ?? ''));
  assert.ok(results.some((t) => /no ha dado por terminada la revisión/.test(t)), detail(this));
});

Then('no se crea ninguna sesión nueva', function () {
  assert.equal(ap.sessions(this).length, 1, detail(this));
});

Given('una sesión de `openspec-update-change` lanzada por una revisión no satisfactoria de la task 3', async function () {
  await ap.prepareChange(this, { tasks: [{ id: '1', done: true }, { id: '2', done: true }, { id: '3', done: true }, { id: '4', done: false }] });
  await startMode(this, 'normal');
  await ap.seed(this, { title: 'Revisión task 3', step: { kind: 'review', id: '3', of: 'task' }, archived: true, meta: { role: 'free', phase: 'done', seq: 1, review: { result: 'no ok', conclusions: CONCLUSIONS } } });
  this.owner = await ap.seed(this, { title: 'Update', step: { kind: 'update', id: '3', of: 'task' }, meta: { seq: 2, conclusions: CONCLUSIONS } });
});

When('la sesión termina', async function () {
  await finishStep(this, this.owner);
});

Then('se crea una sesión de revisión de los cambios en el plan', function () {
  const owner = newOwnerAfter(this, this.owner);
  assert.deepEqual(ap.metaOf(owner).step, { kind: 'review', id: 'plan', of: 'plan' }, detail(this));
  assert.equal(owner.agent, 'plan');
  assert.match(ap.instructionOf(this, owner.id), /los cambios en el plan/);
});

When('la revisión de la última task termina satisfactoria', async function () {
  await ap.prepareChange(this, { tasks: [{ id: '1', done: true }, { id: '2', done: true }, { id: '3', done: true }, { id: '4', done: true }] });
  this.owner = await ap.seed(this, { title: 'Revisión task 4', step: { kind: 'review', id: '4', of: 'task' }, agent: 'plan' });
  await this.opencodeCall('answers', { answers: [{ value: 'confirm' }] });
  await finishStep(this, this.owner, { result: 'ok' });
});

// --- Índice de sesiones --------------------------------------------------------------

const TRANSCRIPT = 'TRANSCRIPCION-QUE-NO-DEBE-LLEGAR';
const DESIGN_CONCLUSIONS = 'El design no dice cómo se nombran los archivos exportados.';

Given('la revisión del artefacto `design` fue no satisfactoria una vez antes', async function () {
  const earlier = [
    { title: 'design', step: { kind: 'artifact', id: 'design' }, meta: {} },
    { title: 'Revisión design', step: { kind: 'review', id: 'design', of: 'artifact' }, meta: { review: { result: 'no ok', conclusions: DESIGN_CONCLUSIONS } } },
    { title: 'Update', step: { kind: 'update', id: 'design', of: 'artifact' }, meta: {} },
    { title: 'Revisión plan', step: { kind: 'review', id: 'plan', of: 'plan' }, meta: { review: { result: 'ok', conclusions: '' } } },
    { title: 'task 3', step: { kind: 'task', id: '3' }, meta: {} },
  ];
  this.earlier = [];
  for (const [i, s] of earlier.entries()) {
    this.earlier.push(await ap.seed(this, { title: s.title, step: s.step, archived: true, meta: { role: 'free', phase: 'done', seq: i + 1, ...s.meta }, messages: [{ type: 'user', text: `${TRANSCRIPT} ${i}` }, { type: 'assistant', agent: 'build', content: [{ type: 'text', text: `${TRANSCRIPT} respuesta ${i}` }] }] }));
  }
});

When('una revisión no satisfactoria de la task 3 lanza `openspec-update-change`', async function () {
  this.owner = await ap.seed(this, { title: 'Revisión task 3', step: { kind: 'review', id: '3', of: 'task' }, agent: 'plan', meta: { seq: 6 } });
  this.earlier.push(this.owner);
  await this.opencodeCall('answers', { answers: [{ value: 'confirm' }] });
  await finishStep(this, this.owner, { result: 'no ok', conclusions: CONCLUSIONS });
  this.update = newOwnerAfter(this, this.owner);
  this.updateText = ap.instructionOf(this, this.update.id);
});

Then('la sesión de `openspec-update-change` recibe las conclusiones de la revisión de la task 3', function () {
  assert.equal(ap.metaOf(this.update).step.kind, 'update', detail(this));
  assert.ok(this.updateText.includes(CONCLUSIONS), this.updateText);
});

Then('recibe un índice con cada sesión del change, su paso y el resultado de cada revisión', function () {
  for (const id of this.earlier) assert.ok(this.updateText.includes(id), `${id} is not in the index:\n${this.updateText}`);
  assert.match(this.updateText, /revisión de el plan|revisión del plan|revisión de .*plan/);
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

// --- Lecciones candidatas -----------------------------------------------------------------

const LESSON = 'El CLI de exportación necesita la ruta absoluta del archivo de salida.';

Given('una sesión dueña que termina el artefacto `design` de `exportar-datos`', async function () {
  await ap.prepareChange(this, { artifacts: ['proposal', 'specs'] });
  await startMode(this, 'normal');
  this.owner = await ap.seed(this, { title: OWNER_TITLE, step: { kind: 'artifact', id: 'design' } });
  this.branches.writeArtifact(this.project, ap.CHANGE, 'design');
  this.branches.commitAll(this.project, 'design');
});

When('pasa el control con una lección candidata', async function () {
  this.statusBefore = this.project.gitStatus();
  await finishStep(this, this.owner, { lessons: [LESSON] });
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

Given('un change `exportar-datos` cuyas sesiones dejaron tres lecciones candidatas', async function () {
  await ap.prepareChange(this, { tasks: [{ id: '1', done: true }] });
  await startMode(this, 'normal');
  await ap.seed(this, { title: 'design', step: { kind: 'artifact', id: 'design' }, archived: true, meta: { role: 'free', phase: 'done', seq: 1, lessons: [LESSONS[0]] } });
  await ap.seed(this, { title: 'task 1', step: { kind: 'task', id: '1' }, archived: true, meta: { role: 'free', phase: 'done', seq: 2, lessons: [LESSONS[1], LESSONS[2]] } });
  this.owner = await ap.seed(this, { title: 'archive', step: { kind: 'archive' }, meta: { seq: 3 } });
});

When('se crea la sesión que resincroniza el wiki tras el archive', async function () {
  this.branches.archiveChange(this.project, ap.CHANGE);
  this.branches.commitAll(this.project, 'archive');
  await finishStep(this, this.owner);
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

// --- Árbol limpio --------------------------------------------------------------------------

Given('el árbol de trabajo tiene cambios sin commit', function () {
  this.dirty = true;
});

const STARTS = {
  'el artefacto `design`': async (world) => {
    await ap.prepareChange(world, { artifacts: ['proposal', 'specs'] });
    world.owner = await ap.seed(world, { title: 'Revisión specs', step: { kind: 'review', id: 'specs', of: 'artifact' }, agent: 'plan', meta: { zone: 'specs' } });
    await world.opencodeCall('answers', { answers: [{ value: 'confirm' }] });
    return { result: 'ok' };
  },
  'el artefacto `design`, tras `specs`': async (world) => {
    await ap.prepareChange(world, { artifacts: ['proposal'] });
    world.owner = await ap.seed(world, { title: 'specs', step: { kind: 'artifact', id: 'specs' }, meta: { zone: 'specs' } });
    world.branches.writeArtifact(world.project, ap.CHANGE, 'specs');
    return {};
  },
  'la task 1, tras el plan': async (world) => {
    await ap.prepareChange(world, { artifacts: ['proposal', 'specs', 'design', 'adr'] });
    world.owner = await ap.seed(world, { title: 'tasks', step: { kind: 'artifact', id: 'tasks' }, meta: { zone: 'specs' } });
    world.branches.writeTasks(world.project, ap.CHANGE, [{ id: '1', done: false }]);
    return {};
  },
};

When(/^una sesión dueña empieza (el artefacto `design`|el artefacto `design`, tras `specs`|la task 1, tras el plan)$/, async function (what) {
  const input = await STARTS[what](this);
  if (this.dirty) fs.appendFileSync(this.project.path('README.md'), '\nCambio sin commit.\n');
  await finishStep(this, this.owner, input);
  this.next = newOwnerAfter(this, this.owner);
});

Then('no empieza y pide al usuario que haga el commit', function () {
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
  await this.startOpenCode({ pluginOptions: {} });
});

When('el plugin decide el paso siguiente tras un artefacto', async function () {
  this.owner = await ap.seed(this, { title: 'design', step: { kind: 'artifact', id: 'design' } });
  this.branches.writeArtifact(this.project, ap.CHANGE, 'design');
  this.branches.commitAll(this.project, 'design');
  await finishStep(this, this.owner);
});

Then('crea una sesión de revisión', function () {
  const owner = newOwnerAfter(this, this.owner);
  assert.deepEqual(ap.metaOf(owner).step, { kind: 'review', id: 'design', of: 'artifact' }, detail(this));
  assert.equal(owner.agent, 'plan');
});

When(/^la sesión de verify termina con la tool y el veredicto (sin problemas críticos|con problemas críticos)$/, async function (verdict) {
  await ap.prepareChange(this, { tasks: [{ id: '1', done: true }] });
  this.owner = await ap.seed(this, { title: 'verify', step: { kind: 'verify' }, meta: { zone: 'code' } });
  await finishStep(this, this.owner, { result: verdict === 'con problemas críticos' ? 'critical' : 'clean', conclusions: 'Informe del verify.' });
});


Then('la sesión de verify queda parada esperando al usuario', function () {
  const owner = ap.onlyOwner(this);
  assert.equal(owner.id, this.owner, detail(this));
  assert.equal(Boolean(owner.time.archived), false);
  assert.equal(ap.metaOf(owner).step.kind, 'review');
  assert.equal(ap.sessions(this).length, 1);
  assert.equal(this.opencode.dialogs.length, 0);
});

// --- Compactación y fallos ---------------------------------------------------------------------

Given('una sesión dueña que aplica la task 3 de `exportar-datos`', async function () {
  await ap.prepareChange(this, { tasks: [{ id: '1', done: true }, { id: '2', done: true }, { id: '3', done: false }] });
  this.owner = await ap.seed(this, { title: OWNER_TITLE, step: { kind: 'task', id: '3' } });
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
  this.owner = await ap.seed(this, { title: OWNER_TITLE, step: { kind: 'artifact', id: 'specs' } });
  this.branches.writeArtifact(this.project, ap.CHANGE, 'specs');
  this.branches.commitAll(this.project, 'specs');
});

Given('OpenCode rechaza la creación de la sesión siguiente', async function () {
  await this.opencodeCall('fail', { failures: { 'session.create': 1 } });
});

When('el plugin intenta encadenar la sesión siguiente', async function () {
  await finishStep(this, this.owner);
});

Then('se avisa al usuario en la TUI de que no se ha podido crear la sesión', function () {
  assert.match(ap.toasts(this), /no se ha podido crear la sesión/, detail(this));
  assert.equal(ap.sessions(this).length, 1, detail(this));
});

Then('la sesión actual sigue respondiendo al usuario', async function () {
  const before = ap.session(this, this.owner).messages.length;
  await this.opencodeCall('message', { sessionID: this.owner, text: '¿Sigues ahí?' });
  const session = ap.session(this, this.owner);
  assert.ok(session.messages.length > before);
  assert.equal(session.messages.at(-1).outcome, 'succeeded', detail(this));
  assert.notEqual(ap.metaOf(session).role, 'owner', 'the session should be left free');
  assert.deepEqual(this.opencode.crashes, [], detail(this));
  assert.deepEqual(this.opencode.toolErrors, [], detail(this));
});
