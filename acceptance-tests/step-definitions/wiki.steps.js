'use strict';

// Steps of llm-wiki, wiki-first-knowledge and the wiki scenarios of
// session-bootstrap. The suite cannot check how the model reasons (design
// D7): it checks what the template guarantees, through the agent adapters.

const assert = require('node:assert/strict');
const { Given, When, Then } = require('@cucumber/cucumber');

const AGENT = '(Claude Code|OpenCode)';
const REMINDER_MAX = 600;
// The guide takes context in every session (design D2): well under the
// 10,000 characters a Claude Code hook accepts
const GUIDE_MAX = 6000;

// How each agent names the engine operations in the reminder (design D2)
const REMINDER_OPERATIONS = {
  'Claude Code': { ll: /\/wiki:ll --local/, ingest: /\/wiki:ingest <url> --local/ },
  OpenCode: { ll: /lecciones aprendidas/i, ingest: /ingiere la fuente/i },
};

function shown(world) {
  return world.session.warnings.join('\n');
}

function deliveredContext(world) {
  return world.session.context.join('\n');
}

function assertEngineAt(world, agent, ref) {
  assert.ok(ref, 'the project does not pin a wiki engine (.agents/wiki/engine.json)');
  const { operations, refs, helperRef, helper } = world.loadWikiEngine(agent);
  const detail = `${agent}: ${JSON.stringify({ operations, refs, helperRef, helperStderr: helper?.stderr })}\n${world.session?.log ?? ''}`;
  assert.ok(operations.query, `${agent} has no read-only wiki query\n${detail}`);
  assert.ok(operations.management, `${agent} has no wiki management\n${detail}`);
  assert.equal(refs.query, ref, `query: ${detail}`);
  assert.equal(refs.management, ref, `management: ${detail}`);
  assert.equal(helperRef, ref, `the engine helper from a command of the session: ${detail}`);
}

// --- Clon y sesiones -----------------------------------------------------------

Given(new RegExp(`^un clon del proyecto en el que ya se ha abierto una sesión de ${AGENT}$`), function (agent) {
  this.ensureProject();
  this.openSetupSession(agent);
});

Given('un clon del proyecto en el que ya se han abierto sesiones de Claude Code y de OpenCode', function () {
  this.ensureProject();
  this.openSetupSession('Claude Code');
  this.openSetupSession('OpenCode');
});

Given(new RegExp(`^una sesión de ${AGENT} abierta en el proyecto$`), function (agent) {
  this.ensureProject();
  this.openSetupSession(agent);
});

// --- Motor del wiki ------------------------------------------------------------

Given('un clon del proyecto sin el motor del wiki instalado', function () {
  const project = this.ensureProject();
  assert.ok(project.hasEngineConfig(), 'the project does not pin a wiki engine (.agents/wiki/engine.json)');
  assert.deepEqual(project.engineLocalPaths(), []);
});

Given(new RegExp(`^el motor del wiki está instalado para ${AGENT} en la versión fijada por el proyecto$`), function (agent) {
  this.ensureProject();
  this.openSetupSession(agent);
  assertEngineAt(this, agent, this.project.pinnedEngineRef());
});

Given(new RegExp(`^el motor del wiki está instalado para ${AGENT} en una versión distinta de la fijada por el proyecto$`), function (agent) {
  const project = this.ensureProject();
  const pinned = project.pinnedEngineRef();
  project.setPinnedEngineRef(this.engine.otherRef);
  this.openSetupSession(agent);
  assertEngineAt(this, agent, this.engine.otherRef);
  project.setPinnedEngineRef(pinned);
});

Given('un clon del proyecto que usa una versión del motor', function () {
  this.ensureProject();
  this.openSetupSession('Claude Code');
  this.openSetupSession('OpenCode');
  this.previousEngineRef = this.project.pinnedEngineRef();
});

Given('después se cambia la versión fijada del motor', function () {
  this.project.setPinnedEngineRef(this.engine.otherRef);
  assert.notEqual(this.project.pinnedEngineRef(), this.previousEngineRef);
});

Given('la máquina no puede acceder al repositorio del motor del wiki', function () {
  this.engine.setAccessible(false);
});

Given('la máquina vuelve a tener acceso al repositorio del motor del wiki', function () {
  this.engine.setAccessible(true);
});

Given(new RegExp(`^la última instalación del motor del wiki para ${AGENT} falló$`), function (agent) {
  this.ensureProject();
  this.engine.setAccessible(false);
  const session = this.openSession(agent);
  this.engine.setAccessible(true);
  assert.equal(this.project.hasEngineInstall(), false, `the setup install did not fail:\n${session.log}`);
});

When(new RegExp(`^${AGENT} carga las instrucciones, skills y plugins del proyecto$`), function (agent) {
  this.loadWikiEngine(agent);
});

When('se comprueba qué versión del motor usa cada agente', function () {
  this.engineRefsByAgent = {
    'Claude Code': this.engineRefsOf('Claude Code'),
    OpenCode: this.engineRefsOf('OpenCode'),
  };
});

Then('dispone de la consulta de solo lectura del wiki', function () {
  assert.ok(this.wikiEngine.operations.query, `${this.wikiEngine.agent}: ${JSON.stringify(this.wikiEngine)}`);
});

Then('dispone de la gestión del wiki', function () {
  assert.ok(this.wikiEngine.operations.management, `${this.wikiEngine.agent}: ${JSON.stringify(this.wikiEngine)}`);
});

Then('las dos corresponden a la versión del motor fijada por el proyecto', function () {
  assertEngineAt(this, this.wikiEngine.agent, this.project.pinnedEngineRef());
});

Then('los dos usan la versión fijada por el proyecto', function () {
  const pinned = this.project.pinnedEngineRef();
  assert.ok(pinned, 'the project does not pin a wiki engine (.agents/wiki/engine.json)');
  assert.deepEqual(this.engineRefsByAgent, { 'Claude Code': [pinned], OpenCode: [pinned] });
});

Then(new RegExp(`^${AGENT} usa la nueva versión fijada$`), function (agent) {
  assertEngineAt(this, agent, this.project.pinnedEngineRef());
});

Then(new RegExp(`^el motor del wiki queda disponible para ${AGENT} en la versión fijada por el proyecto$`), function (agent) {
  assertEngineAt(this, agent, this.project.pinnedEngineRef());
});

Then('git no muestra como cambio nada de lo instalado', function () {
  assert.deepEqual(this.project.gitStatus(), []);
});

Then('no se lanza ninguna instalación del motor del wiki', function () {
  assert.deepEqual(this.engineClones(), [], `session:\n${this.session.log}`);
});

Then('se avisa de que la instalación del motor del wiki falló', function () {
  assert.match(shown(this), /falló la instalación del motor del wiki/);
});

Then('el aviso indica cómo instalarlo a mano', function () {
  assert.match(shown(this), /git clone --depth 1 --branch \S+ \S+ \.agents\/wiki-engine/);
});

// --- Wiki del proyecto, hub y desactivación ------------------------------------

Given('un clon del proyecto sin wiki del proyecto', function () {
  this.ensureProject();
  assert.equal(require('node:fs').existsSync(this.project.path('.wiki')), false);
});

// The engine initializes the wiki during a session; the bootstrap checks it
// at the start of every session (design D5), so the next one is opened
When('el motor inicializa el wiki del proyecto', function () {
  this.openSetupSession();
  this.project.simulateWikiInit();
  this.openSetupSession();
});

Then('el wiki del proyecto queda en `.wiki\\/`', function () {
  assert.ok(require('node:fs').existsSync(this.project.path('.wiki', 'index.md')));
});

Then('git no ignora ningún archivo de `.wiki\\/`', function () {
  assert.deepEqual(this.project.ignoredFiles('.wiki'), [], `session:\n${this.session.log}`);
});

Given('una máquina sin hub del usuario', function () {
  this.machine.hasUserHub = false;
});

Then('no se avisa de nada relacionado con el hub', function () {
  assert.doesNotMatch(shown(this), /\bhub\b/i);
});

Then('el wiki del proyecto está disponible', function () {
  const { operations } = this.loadWikiEngine(this.session.agent);
  assert.ok(operations.query, `${this.session.agent} has no wiki query`);
  assert.ok(deliveredContext(this).includes(this.guideAsDelivered()), `${this.session.agent} has not received the wiki guide`);
});

// Claude Code: in .claude/settings.local.json, the user's own and not
// versioned; OpenCode: in the environment it is launched from (design D4)
Given(new RegExp(`^el usuario ha desactivado el wiki para sí mismo en ${AGENT}$`), function (agent) {
  assert.ok(this.ensureProject().hasEngineConfig(), 'the project does not pin a wiki engine (.agents/wiki/engine.json)');
  if (agent === 'Claude Code') this.project.writeClaudeLocalSettings({ env: { PROJECT_WIKI: 'off' } });
  else this.machine.wikiDisabled = true;
});

Then('no se instala el motor del wiki', function () {
  assert.deepEqual(this.engineClones(), []);
  assert.deepEqual(this.project.engineLocalPaths(), []);
});

Then('el agente no recibe la guía del wiki', function () {
  assert.deepEqual(this.session.context, []);
});

Then('el agente no recibe el recordatorio del wiki con los mensajes', function () {
  const sent = this.session.sendMessage('hola');
  assert.equal(sent.delivered, true, sent.log);
  assert.deepEqual(sent.reminders, [], sent.log);
});

Then('ningún archivo versionado del proyecto ha cambiado', function () {
  assert.deepEqual(this.project.versionedChanges(), []);
});

// --- Guía y recordatorio entregados por el arranque ----------------------------

Then('el contexto de la sesión incluye la guía del wiki', function () {
  assert.ok(this.session.context.length > 0, `${this.session.agent} added nothing to the context:\n${this.session.log}`);
});

Then('esa guía procede del único archivo de guía del proyecto', function () {
  const length = [...this.guideAsDelivered()].length;
  assert.ok(length < GUIDE_MAX, `the guide delivered has ${length} characters`);
  assert.ok(
    deliveredContext(this).includes(this.guideAsDelivered()),
    `the context is not the guide of ${this.project.guideFile()}:\n${deliveredContext(this).slice(0, 500)}`
  );
});

Then(new RegExp(`^el adaptador del arranque de ${AGENT} entrega la guía del wiki$`), function (agent) {
  assert.equal(this.session.agent, agent);
  assert.ok(deliveredContext(this).includes(this.guideAsDelivered()), `${agent}:\n${this.session.log}`);
});

Then(new RegExp(`^el proyecto no tiene archivos de instrucciones que ${AGENT} cargue siempre con la guía del wiki$`), function (agent) {
  const skills = require('../support/skills');
  assert.deepEqual(skills.alwaysLoadedInstructions(agent, this.project.dir), []);
});

When('el usuario envía un mensaje', function () {
  this.sendMessage();
});

Then('el agente recibe el mensaje junto con el recordatorio del flujo del wiki', function () {
  const sent = this.sentMessage.result;
  assert.equal(sent.delivered, true, sent.log);
  assert.deepEqual(sent.problems, [], sent.log);
  assert.ok(sent.messages.includes(this.sentMessage.text), sent.log);
  assert.equal(sent.reminders.length, 1, `expected one reminder:\n${sent.log}`);
  this.reminder = sent.reminders[0];
});

Then('el recordatorio recuerda consultar antes de responder y preguntar ante un hueco', function () {
  assert.match(this.reminder, /consult/i);
  assert.match(this.reminder, /pregunt/i);
});

Then(new RegExp(`^el recordatorio nombra las lecciones aprendidas y la ingesta de fuentes como se invocan en ${AGENT}$`), function (agent) {
  const ops = REMINDER_OPERATIONS[agent];
  assert.match(this.reminder, ops.ll);
  assert.match(this.reminder, ops.ingest);
  assert.doesNotMatch(this.reminder, /\{\{\w+\}\}/, 'a marker was not replaced');
  if (agent === 'OpenCode') assert.doesNotMatch(this.reminder, /\/wiki:/, 'OpenCode has no /wiki:* commands');
});

Then('el recordatorio remite a la guía del wiki', function () {
  assert.match(this.reminder, /guía del wiki/i);
});

Then(`el recordatorio no ocupa más de ${REMINDER_MAX} caracteres`, function () {
  assert.ok([...this.reminder].length <= REMINDER_MAX, `${[...this.reminder].length} characters`);
});

Given('el recordatorio del flujo del wiki no se puede generar', function () {
  this.breakReminder();
});

Then('el agente recibe el mensaje del usuario', function () {
  const sent = this.sentMessage.result;
  assert.ok(sent.hooks > 0, `no hook of the bootstrap runs with the message:\n${sent.log}`);
  assert.equal(sent.delivered, true, sent.log);
  assert.ok(sent.messages.includes(this.sentMessage.text), sent.log);
});

// --- Revisión de la guía -------------------------------------------------------

// Each part of the flow has a section identifier in the guide, an HTML
// comment `<!-- wiki-guide:<id> -->` (design D2), so these steps check what
// the guide covers without depending on its wording.
const GUIDE_SECTIONS = {
  'indica consultar el wiki en modo de solo lectura antes de usar el conocimiento interno': 'consultar-antes',
  'indica consultar primero el wiki del proyecto y después el hub del usuario, si existe': 'orden-de-consulta',
  'incluye las peticiones sobre dominio, decisiones técnicas, herramientas y hechos externos': 'peticiones-con-conocimiento',
  'excluye las operaciones sobre el código que no requieren conocimiento': 'operaciones-sin-conocimiento',
  'indica que el agente discierne en cada caso': 'discernir-peticiones',
  'indica preguntar al usuario antes de seguir': 'preguntar-ante-hueco',
  'asigna al wiki del proyecto lo específico del proyecto y lo externo que le concierne': 'ambito-proyecto',
  'asigna al hub del usuario el conocimiento general del usuario': 'ambito-hub',
  'indica preguntar cuando no está claro qué ámbito corresponde': 'ambito-preguntar',
  'indica pasar conocimiento del hub al proyecto incorporándolo o mediante un checkpoint': 'hub-a-proyecto',
  'indica proponer registrarlo cuando servirá en otra ocasión': 'proponer-registrar',
  'lo aplica a lo comprobado empíricamente y a lo encontrado en internet': 'descubrimientos',
  'indica que el agente discierne cuándo procede': 'discernir-registro',
  'indica incorporarlos como fuentes fijadas a un commit sin copiar su contenido': 'fuentes-fijadas',
  'indica que los artículos citan la versión exacta de la fuente': 'citar-version',
  'indica hacer una ingesta inicial del repositorio al crear el wiki del proyecto': 'ingesta-inicial',
  'indica excluir de esa ingesta lo generado y lo que no aporta conocimiento': 'ingesta-inicial-exclusiones',
};
const GAP_OPTIONS = {
  'responder con conocimiento interno, indicando su origen': 'hueco-conocimiento-interno',
  'investigar fuera y registrar lo encontrado en el wiki': 'hueco-investigar',
  'no hacer nada más': 'hueco-nada',
};
const DISCOVERY_OPERATIONS = {
  'comprobado al trabajar|lecciones aprendidas': 'registrar-comprobado-ll',
  'encontrado en internet|ingesta de la fuente': 'registrar-internet-ingesta',
};

function assertGuideSection(world, id) {
  const marker = `<!-- wiki-guide:${id} -->`;
  assert.ok(world.guideText.includes(marker), `the wiki guide has no section ${marker}`);
}

Given('la guía del wiki del proyecto', function () {
  this.guideText = this.ensureProject().readGuide();
});

When(/^se revisa (?:qué|cómo) (?:indica|peticiones exigen) .+$/, function () {
  // The review reads the whole guide; each Then names what it looks for
});

for (const [text, id] of Object.entries(GUIDE_SECTIONS)) {
  Then(text, function () {
    assertGuideSection(this, id);
  });
}

Then('ofrece estas opciones:', function (table) {
  for (const { opción } of table.hashes()) {
    const id = GAP_OPTIONS[opción];
    assert.ok(id, `no guide section is defined for the option '${opción}'`);
    assertGuideSection(this, id);
  }
});

Then('asigna estas operaciones del motor:', function (table) {
  for (const { descubrimiento, operación } of table.hashes()) {
    const id = DISCOVERY_OPERATIONS[`${descubrimiento}|${operación}`];
    assert.ok(id, `no guide section is defined for '${descubrimiento}' with '${operación}'`);
    assertGuideSection(this, id);
  }
});


// --- Indicaciones de archivado -------------------------------------------------

const openspec = require('../support/openspec');

// Each step of the resync, as the engine operation or action that does it
// (design D6), so that the check does not depend on the guidance's wording
const RESYNC_STEPS = {
  'fijar como fuentes, en el commit del archivado, el código, specs y ADRs que tocó': /\/wiki:ingest-collection\b.*--manifest-only/,
  'refrescar los artículos cuyas fuentes cambiaron y compilar las fuentes nuevas': /\/wiki:refresh\b.*\/wiki:compile\b/,
  'revisar con el librarian, sin modificar, lo que quedó obsoleto o contradicho': /\/wiki:librarian scan\b/,
  'extraer las lecciones aprendidas sin escribir': /\/wiki:ll\b.*--dry-run/,
  'presentarlo al usuario y escribir solo lo que confirme': /confirm/i,
  'pasar el lint del wiki hasta dejarlo sin errores': /\/wiki:lint\b/,
  'hacer el commit del wiki después del commit del archivado': /commit del wiki.*después del commit del archivado/i,
};

Given('un change del proyecto listo para archivar', function () {
  this.archiveChange = openspec.addChangeReadyToArchive(this.ensureProject(), 'cambio-de-prueba');
});

When('se consultan las indicaciones de archivado de OpenSpec para ese change', function () {
  this.archiveGuidance = openspec.archiveInstructions(this.project, this.archiveChange).operationGuidance ?? [];
});

Then('incluyen resincronizar el wiki del proyecto con estos pasos, en este orden:', function (table) {
  const guidance = this.archiveGuidance.map(String);
  let last = -1;
  for (const { paso } of table.hashes()) {
    const pattern = RESYNC_STEPS[paso];
    assert.ok(pattern, `no engine operation is defined for the step '${paso}'`);
    const at = guidance.findIndex((entry, i) => i > last && pattern.test(entry));
    assert.ok(at > last, `the archive guidance has no '${paso}' after the previous step:\n${JSON.stringify(guidance, null, 2)}`);
    last = at;
  }
});
