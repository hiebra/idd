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
  'Claude Code': { query: /`\/wiki:query --local`/, ingest: /\/wiki:ingest <url> --local/ },
  OpenCode: { query: /la skill `wiki-query`/, ingest: /ingiere la fuente/i },
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

// --- Estado del wiki del clon (design D7 de add-project-wiki-toggle) ------------

const fs = require('node:fs');
const STATE = '(habilitado|deshabilitado)';

function cloneWithWiki(world, state) {
  const project = world.ensureProject();
  assert.ok(project.hasEngineConfig(), 'the project does not pin a wiki engine (.agents/wiki/engine.json)');
  project.setWiki(state === 'habilitado');
  return project;
}

// A project with the wiki enabled has its wiki, versioned with the clone
Given(new RegExp(`^un (?:clon del )?proyecto con el wiki ${STATE}$`), function (state) {
  const project = cloneWithWiki(this, state);
  if (state === 'habilitado') project.addCommittedWiki();
});

Given('un clon del proyecto con el wiki deshabilitado y con `.wiki\\/`', function () {
  cloneWithWiki(this, 'deshabilitado').addCommittedWiki();
});

Given(new RegExp(`^un clon del proyecto con el wiki ${STATE} y sin \`\\.wiki/\`$`), function (state) {
  const project = cloneWithWiki(this, state);
  assert.equal(fs.existsSync(project.path('.wiki')), false);
});

Given('un clon del proyecto con el wiki habilitado y sin el motor del wiki instalado', function () {
  const project = cloneWithWiki(this, 'habilitado');
  assert.deepEqual(project.engineLocalPaths(), []);
});

Given(new RegExp(`^un clon del proyecto con el wiki ${STATE} en el que ya se ha abierto una sesión de ${AGENT}$`), function (state, agent) {
  cloneWithWiki(this, state);
  this.openSetupSession(agent);
});

Given('un clon del proyecto con el wiki habilitado en el que ya se han abierto sesiones de Claude Code y de OpenCode', function () {
  cloneWithWiki(this, 'habilitado');
  this.openSetupSession('Claude Code');
  this.openSetupSession('OpenCode');
});

Given('un clon del proyecto con el wiki habilitado que usa una versión del motor', function () {
  cloneWithWiki(this, 'habilitado');
  this.openSetupSession('Claude Code');
  this.openSetupSession('OpenCode');
  this.previousEngineRef = this.project.pinnedEngineRef();
});

Given(new RegExp(`^una sesión de ${AGENT} abierta en un proyecto con el wiki habilitado$`), function (agent) {
  cloneWithWiki(this, 'habilitado');
  this.openSetupSession(agent);
});

Given('el `openspec\\/config.yaml` de un proyecto con el wiki habilitado', function () {
  cloneWithWiki(this, 'habilitado');
});

// Someone else disabled the wiki and the clone pulled that commit: what a
// previous session installed is still there
Given('el wiki del proyecto se ha deshabilitado', function () {
  this.project.disableWikiInVersionedFiles();
});

Given(new RegExp(`^el motor del wiki está instalado y expuesto a ${AGENT}$`), function (agent) {
  cloneWithWiki(this, 'habilitado');
  this.openSetupSession(agent);
  assertEngineAt(this, agent, this.project.pinnedEngineRef());
});

Then(new RegExp(`^el motor del wiki no está disponible para ${AGENT}$`), function (agent) {
  const { operations } = this.loadWikiEngine(agent);
  assert.deepEqual(operations, { query: null, management: null }, `${agent}:\n${this.session.log}`);
  for (const link of Object.keys(require('../support/project').ENGINE_LINKS)) {
    assert.equal(fs.existsSync(this.project.engineLinkPath(link)), false, `${link} is still linked`);
  }
});

Then('no dispone de la consulta de solo lectura del wiki', function () {
  assert.equal(this.wikiEngine.operations.query, null, `${this.wikiEngine.agent}: ${JSON.stringify(this.wikiEngine)}`);
});

Then('no dispone de la gestión del wiki', function () {
  assert.equal(this.wikiEngine.operations.management, null, `${this.wikiEngine.agent}: ${JSON.stringify(this.wikiEngine)}`);
});

Then('git no muestra como cambio nada de lo retirado', function () {
  assert.deepEqual(this.project.gitStatus(), [], `session:\n${this.session.log}`);
});

// Claude Code: in .claude/settings.local.json, the user's own and not
// versioned; OpenCode: in the environment it is launched from
Given(new RegExp(`^el usuario tiene \`PROJECT_WIKI=off\` en el entorno de ${AGENT}$`), function (agent) {
  if (agent === 'Claude Code') this.project.writeClaudeLocalSettings({ env: { PROJECT_WIKI: 'off' } });
  else this.machine.userEnv.PROJECT_WIKI = 'off';
});

Then('el agente recibe la guía del wiki', function () {
  assert.ok(deliveredContext(this).includes(this.guideAsDelivered()), `${this.session.agent}:\n${this.session.log}`);
});

// The archive guidance as `openspec instructions archive` gives it, for a
// change ready to archive
function archiveGuidanceOf(world) {
  const name = openspec.addChangeReadyToArchive(world.ensureProject(), 'cambio-de-prueba');
  return (openspec.archiveInstructions(world.project, name).operationGuidance ?? []).map(String);
}

function assertNoWiki(guidance) {
  const mentions = guidance.filter((entry) => /wiki/i.test(entry));
  assert.deepEqual(mentions, [], `the archive guidance mentions the wiki:\n${JSON.stringify(guidance, null, 2)}`);
}

Then('las indicaciones de archivado de OpenSpec no mencionan el wiki', function () {
  assertNoWiki(archiveGuidanceOf(this));
});

Then('no mencionan el wiki', function () {
  assertNoWiki(this.archiveGuidance.map(String));
});

// --- /toggle-wiki (design D4 de add-project-wiki-toggle) ------------------------

const { runToggleWiki, manifests } = require('../support/toggle-wiki');
const skillsSupport = require('../support/skills');
const YAML = require('../../node_modules/yaml');

// The files of a directory of the clone and their contents
function snapshot(dir) {
  const files = {};
  const walk = (current) => {
    if (!fs.existsSync(current)) return;
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const full = require('node:path').join(current, entry.name);
      if (entry.isDirectory()) walk(full);
      else files[full.slice(dir.length)] = fs.readFileSync(full, 'utf8');
    }
  };
  walk(dir);
  return files;
}

// file: the command to run, if it is not the project's (the global install's)
function toggleWiki(world, agent, file = undefined) {
  const project = world.ensureProject();
  if (world.session?.agent !== agent) world.openSetupSession(agent);
  world.beforeToggle = {
    config: project.readConfig(),
    wiki: snapshot(project.path('.wiki')),
    status: project.gitStatus(),
    head: require('../support/engine').git(project.dir, 'rev-parse', 'HEAD').trim(),
  };
  world.toggle = runToggleWiki(project, world.session, agent, file);
  return world.toggle;
}

When(new RegExp(`^el usuario ejecuta \`/toggle-wiki\` en ${AGENT}$`), function (agent) {
  toggleWiki(this, agent);
  assert.equal(this.toggle.proposal, null, `the command proposed an initial ingest: ${JSON.stringify(this.toggle.proposal)}`);
});

When('el usuario ejecuta `\\/toggle-wiki`', function () {
  toggleWiki(this, 'Claude Code');
});

// A slim project has no command of its own: the global install brings it
// (windows-global-distro)
When('el usuario ejecuta en OpenCode el `\\/toggle-wiki` de la instalación global', function () {
  assert.equal(fs.existsSync(this.project.path('.opencode')), false, 'the project has commands of its own');
  const found = skillsSupport.discoverCommands('OpenCode', this.project.dir, { globalConfigDir: require('node:path').dirname(this.global.commandsDir) });
  const command = found.find((c) => c.name === '/toggle-wiki');
  assert.ok(command, `OpenCode does not find /toggle-wiki: ${JSON.stringify(found)}`);
  toggleWiki(this, 'OpenCode', command.file);
});

When(new RegExp('^(confirma|no confirma) la ingesta inicial que se le propone$'), function (answer) {
  assert.ok(this.toggle.answer, `the command did not propose an initial ingest: ${JSON.stringify(this.toggle.status)}`);
  assert.ok(this.toggle.proposal.sources.length > 0, 'the proposal lists no sources');
  assert.ok(this.toggle.proposal.excluded.length > 0, 'the proposal lists nothing left out');
  assert.equal(fs.existsSync(this.project.path('.wiki')), false, '.wiki/ exists before the user confirms');
  this.toggle.answer(answer === 'confirma');
});

Then(new RegExp(`^el wiki del proyecto (queda|sigue) ${STATE}$`), function (_, state) {
  assert.equal(this.project.wikiEnabled(), state === 'habilitado', `${JSON.stringify(this.toggle?.runs, null, 2)}`);
});

Then('las indicaciones de archivado de OpenSpec incluyen la resincronización del wiki', function () {
  // The project's source or, in a slim project, the one of the global install
  const own = this.project.path('.agents', 'wiki', 'archive-guidance.yaml');
  const file = fs.existsSync(own) ? own : require('node:path').join(this.global.pluginsDir, 'session-bootstrap', 'wiki', 'archive-guidance.yaml');
  const source = YAML.parse(fs.readFileSync(file, 'utf8'));
  const guidance = archiveGuidanceOf(this);
  for (const entry of source) assert.ok(guidance.includes(entry), `the archive guidance lacks: ${entry}\n${JSON.stringify(guidance, null, 2)}`);
});

Then('el resto de `openspec\\/config.yaml` no ha cambiado', function () {
  assert.equal(this.project.configWithoutWikiBlock(), this.project.configWithoutWikiBlock(this.beforeToggle.config));
});

Then('`.wiki\\/` se conserva sin cambios', function () {
  assert.ok(Object.keys(this.beforeToggle.wiki).length > 0, 'the clone had no .wiki/ to keep');
  assert.deepEqual(snapshot(this.project.path('.wiki')), this.beforeToggle.wiki);
});

Then('los cambios quedan en el stage de git, sin commit', function () {
  const { git } = require('../support/engine');
  assert.equal(git(this.project.dir, 'rev-parse', 'HEAD').trim(), this.beforeToggle.head, 'the command made a commit');
  const staged = this.project.stagedFiles();
  for (const file of ['.agents/wiki/engine.json', 'openspec/config.yaml']) assert.ok(staged.includes(file), `${file} is not staged: ${staged}`);
  assert.equal(git(this.project.dir, 'diff', '--name-only', '--', '.agents/wiki/engine.json', 'openspec/config.yaml').trim(), '', 'changes left unstaged');
});

Then('se informa de que el wiki queda habilitado y de qué vale desde la sesión siguiente', function () {
  assert.match(this.toggle.report, /queda habilitado/);
  assert.match(this.toggle.report, /sesión siguiente/);
});

Then('se informa de que el wiki queda deshabilitado', function () {
  assert.match(this.toggle.report, /queda deshabilitado/);
});

Then('el agente dispone del comando `\\/toggle-wiki`', function () {
  const commands = skillsSupport.discoverCommands(this.session.agent, this.project.dir).map((c) => c.name);
  assert.ok(commands.includes('/toggle-wiki'), `${this.session.agent}: ${commands}`);
});

Given('un clon del proyecto en el que se acaba de habilitar el wiki con `\\/toggle-wiki`', function () {
  cloneWithWiki(this, 'deshabilitado').addCommittedWiki();
  toggleWiki(this, 'Claude Code');
  assert.equal(this.project.wikiEnabled(), true, JSON.stringify(this.toggle.runs, null, 2));
});

Then('`.wiki\\/` tiene como fuentes los productos del proyecto, fijados al commit actual', function () {
  const found = manifests(this.project);
  assert.equal(found.length, 1, JSON.stringify(found));
  const [manifest] = found;
  assert.equal(manifest.revision, this.beforeToggle.head);
  for (const product of ['README.md', '.agents/hooks/session-bootstrap.mjs', 'openspec/config.yaml']) {
    assert.ok(manifest.paths.includes(product), `${product} is not a source: ${manifest.paths}`);
  }
  for (const prefix of ['openspec/specs/', 'adr/']) {
    assert.ok(manifest.paths.some((p) => p.startsWith(prefix)), `no source under ${prefix}`);
  }
  assert.deepEqual(manifest.paths.sort(), [...this.toggle.proposal.sources].sort());
});

Then('las fuentes no incluyen lo generado ni la copia del motor', function () {
  const [manifest] = manifests(this.project);
  const wrong = manifest.paths.filter((p) => /(^|\/)(node_modules|\.extracted|reports)\/|(^|\/)package-lock\.json$|\.lock$|^\.agents\/wiki-engine(\/|\.)/.test(p));
  assert.deepEqual(wrong, []);
});

Then('no existe `.wiki\\/`', function () {
  assert.equal(fs.existsSync(this.project.path('.wiki')), false);
});

Then('ningún archivo del proyecto ha cambiado', function () {
  assert.deepEqual(this.project.gitStatus(), this.beforeToggle.status);
  assert.deepEqual(this.project.stagedFiles(), []);
});

Given('la plantilla del proyecto', function () {
  this.template = require('../support/project').REPO_ROOT;
});

When('se comprueba el ajuste del wiki del proyecto', function () {
  this.templateEngine = JSON.parse(fs.readFileSync(require('node:path').join(this.template, '.agents', 'wiki', 'engine.json'), 'utf8'));
});

// The template declares it: a missing field would also leave it disabled,
// but the template says so explicitly
Then('el wiki está deshabilitado', function () {
  assert.strictEqual(this.templateEngine.enabled, false, JSON.stringify(this.templateEngine));
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

Then('no se instala el motor del wiki', function () {
  assert.deepEqual(this.engineClones(), []);
  assert.deepEqual(this.project.engineLocalPaths(), []);
});

// The context may carry other instructions of the project, such as the
// comments rule (ADR-0010), but not the guide
Then('el agente no recibe la guía del wiki', function () {
  const guide = this.guideAsDelivered();
  assert.ok(!this.session.context.some((text) => text.includes(guide)), `${this.session.agent}:\n${this.session.log}`);
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

Then(new RegExp(`^el recordatorio nombra la consulta y la ingesta de fuentes como se invocan en ${AGENT}$`), function (agent) {
  const ops = REMINDER_OPERATIONS[agent];
  assert.match(this.reminder, ops.query);
  assert.match(this.reminder, ops.ingest);
  assert.doesNotMatch(this.reminder, /\{\{\w+\}\}/, 'a marker was not replaced');
  if (agent === 'OpenCode') assert.doesNotMatch(this.reminder, /\/wiki:/, 'OpenCode has no /wiki:* commands');
});

Then('el recordatorio recuerda apuntar como candidato lo que se comprueba', function () {
  assert.match(this.reminder, /candidat/i);
});

// Lessons learned are proposed at a closing point, not with every message
Then('el recordatorio no nombra las lecciones aprendidas', function () {
  assert.doesNotMatch(this.reminder, /lecciones aprendidas/i);
  assert.doesNotMatch(this.reminder, /\/wiki:ll\b/);
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
  'indica modificarlo con la operación del motor que lo modifica': 'modificar-wiki',
  'indica hacerlo solo cuando el usuario confirma lo que el agente propone': 'modificar-con-confirmacion',
  'indica no usar esa operación para consultar': 'modificar-no-consultar',
  'indica apuntarlo como lección candidata mientras se trabaja, sin escribir nada': 'apuntar-candidatas',
  'indica proponer registrar las candidatas una sola vez, en un punto de cierre': 'registrar-en-cierre',
  'nombra como puntos de cierre el final de una tarea, antes de un commit, cuando el usuario da la sesión por terminada y el archive de un change':
    'puntos-de-cierre',
  'indica tomar el blob de la ruta en el manifiesto citado': 'cita-blob-manifiesto',
  'indica resolverlo con git por su blob': 'cita-resolver-blob',
  'indica no tratar la cita como rota': 'cita-no-rota',
};
const GAP_OPTIONS = {
  'responder con conocimiento interno, indicando su origen': 'hueco-conocimiento-interno',
  'investigar fuera y registrar lo encontrado en el wiki': 'hueco-investigar',
  'no hacer nada más': 'hueco-nada',
};
const DISCOVERY_OPERATIONS = {
  'comprobado al trabajar|lecciones aprendidas': 'registrar-en-cierre',
  'encontrado en internet|ingesta de la fuente': 'registrar-internet-ingesta',
};

function assertGuideSection(world, id) {
  const marker = `<!-- wiki-guide:${id} -->`;
  assert.ok(world.guideText.includes(marker), `the wiki guide has no section ${marker}`);
}

Given('la guía del wiki del proyecto', function () {
  this.guideText = this.ensureProject().readGuide();
});

When(/^se revisa (?:qué|cómo|cuándo) (?:indica|peticiones exigen) .+$/, function () {
  // The review reads the whole guide; each Then names what it looks for
});

for (const [text, id] of Object.entries(GUIDE_SECTIONS)) {
  Then(text, function () {
    assertGuideSection(this, id);
  });
}

// The text of a section of the guide file, from its identifier to the next one
function guideSection(guideText, id) {
  const marker = `<!-- wiki-guide:${id} -->`;
  const start = guideText.indexOf(marker);
  assert.ok(start >= 0, `the wiki guide has no section ${marker}`);
  const next = guideText.indexOf('<!-- wiki-guide:', start + marker.length);
  return guideText.slice(start + marker.length, next < 0 ? undefined : next);
}

// The guide as delivered strips the section identifiers, so the section is
// found in the source and what is delivered is checked as a whole
When('se revisa con qué operación indica la guía consultar el wiki', function () {
  this.guideText = this.project.readGuide();
  this.deliveredGuide = deliveredContext(this);
});

Then(/^nombra (`\/wiki:query --local`|la skill `wiki-query`)$/, function (operation) {
  assert.ok(this.deliveredGuide.includes(operation), `${this.session.agent}: the guide delivered does not name ${operation}`);
  assert.doesNotMatch(this.deliveredGuide, /\{\{\w+\}\}/, 'a marker was not replaced');
  assert.match(guideSection(this.guideText, 'consultar-con-lectura'), /\{\{query\}\}/);
});

Then('no nombra `wiki-manager` para consultar', function () {
  assert.doesNotMatch(guideSection(this.guideText, 'consultar-con-lectura'), /wiki-manager/);
});

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
  'refrescar sin escribir los artículos que citan lo que tocó el change': /\/wiki:refresh\b/,
  'extraer las lecciones aprendidas sin escribir': /\/wiki:ll\b.*--dry-run/,
  'revisar sin escribir los registros del inventario que el change completa o deja obsoletos': /\/wiki:inventory list\b/,
  'presentarlo al usuario y escribir solo lo que confirme: refresco, lecciones, compile, inventario':
    /confirm.*\/wiki:refresh\b.*\/wiki:ll\b.*\/wiki:compile\b.*\/wiki:inventory update\b/i,
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

Then('no incluyen la revisión con el librarian', function () {
  const librarian = this.archiveGuidance.map(String).filter((entry) => /\/wiki:librarian\b/.test(entry));
  assert.deepEqual(librarian, [], `the archive guidance still runs the librarian:\n${JSON.stringify(librarian, null, 2)}`);
});
