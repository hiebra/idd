'use strict';

const assert = require('node:assert/strict');
const { Given, When, Then } = require('@cucumber/cucumber');
const { git } = require('../support/engine');

// Messages the opened session showed the user, as one text
function shownWarnings(world) {
  return world.session.warnings.join('\n');
}

function atLeast(version, minimum) {
  const a = version.split('.').map(Number);
  const b = minimum.split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if ((a[i] || 0) !== (b[i] || 0)) return (a[i] || 0) > (b[i] || 0);
  }
  return true;
}

// --- Proyecto ---------------------------------------------------------------

Given('un clon del proyecto sin dependencias instaladas', function () {
  const project = this.ensureProject();
  assert.equal(project.hasNodeModules(), false);
});

Given('un clon del proyecto con sus dependencias instaladas', function () {
  this.ensureProject();
  this.installProject();
});

Given('un proyecto creado desde la plantilla que declara dependencias propias además de OpenSpec', function () {
  this.ensureProject().addDependency('is-number', '7.0.0');
});

Given('un proyecto con un proyecto de tests de aceptación en `acceptance-tests\\/`', function () {
  this.ensureProject().addAcceptanceProject();
});

Given('las dependencias del proyecto se instalaron con éxito con los archivos actuales', function () {
  this.ensureProject();
  this.installProject();
});

Given('las dependencias del proyecto se instalaron con éxito', function () {
  this.ensureProject();
  this.installProject();
});

Given(
  /^las dependencias del proyecto se instalaron con éxito al abrir una sesión de (Claude Code|OpenCode)$/,
  function (agent) {
    this.ensureProject();
    this.installProject(agent);
  }
);

Given('después cambió la lista de dependencias del proyecto', function () {
  this.project.addDependency('is-number', '7.0.0');
});

Given('las dependencias del proyecto de tests de aceptación se instalaron con éxito', function () {
  this.ensureProject().addAcceptanceProject();
  this.installProject();
});

Given('después cambió la lista de dependencias de los tests de aceptación', function () {
  this.project.addDependency('is-odd', '3.0.1', this.project.acceptanceDir);
});

Given('la última instalación de dependencias falló', function () {
  this.ensureProject();
  this.machine.offline = true;
  const session = this.openSession();
  this.machine.offline = false;
  assert.equal(this.project.hasStamp(), false, `the setup install did not fail:\n${session.log}`);
});

Given('ninguna de sus dependencias está instalada', function () {
  assert.equal(this.project.hasNodeModules(), false);
  if (this.project.hasAcceptanceProject()) {
    assert.equal(this.project.hasNodeModules(this.project.acceptanceDir), false);
  }
});

// --- Máquina ----------------------------------------------------------------

Given('una máquina con otra versión de OpenSpec instalada globalmente', function () {
  this.machine.globalOpenspec = true;
  assert.notEqual(this.machine.globalOpenspecVersion, this.ensureProject().pinnedOpenspecVersion());
});

Given('una máquina sin npm', function () {
  this.machine.hasNpm = false;
});

Given('una máquina con Node.js 20', function () {
  this.machine.nodeVersion = this.machine.oldNodeVersion;
});

Given('el proyecto exige Node.js 22.12 o superior', function () {
  assert.equal(this.ensureProject().requiredNode(), '>=22.12');
});

Given('la máquina no puede acceder al registro de paquetes', function () {
  this.machine.offline = true;
});

Given('la máquina vuelve a tener acceso al registro de paquetes', function () {
  this.machine.offline = false;
});

Given(/^una versión de (?:Claude Code|OpenCode) que no permite ajustar el PATH de la sesión$/, function () {
  this.machine.sessionPathAdjustable = false;
});

Given('una máquina con Node.js 22.12 o superior y npm', function () {
  assert.ok(atLeast(process.versions.node, '22.12.0'), `this machine runs Node.js ${process.versions.node}`);
  assert.equal(this.machine.hasNpm, true);
});

// --- Sesión -----------------------------------------------------------------

When(/^se abre una sesión de (Claude Code|OpenCode) en el proyecto$/, function (agent) {
  this.openSession(agent);
});

// Scenarios of the agent-neutral core: the World opens a Claude Code session
When('se abre una sesión en el proyecto', function () {
  this.openSession();
});

Then('`openspec --version` en la sesión muestra la versión fijada por el proyecto', function () {
  assert.equal(this.openspecVersionInSession(), this.project.pinnedOpenspecVersion(), `session:\n${this.session.log}`);
});

Then('todas las dependencias declaradas por el proyecto quedan instaladas', function () {
  assert.deepEqual(this.project.missingDependencies(), []);
});

Then('las dependencias del proyecto de tests de aceptación quedan instaladas', function () {
  assert.deepEqual(this.project.missingDependencies(this.project.acceptanceDir), []);
});

Then('las dependencias del proyecto quedan instaladas', function () {
  assert.deepEqual(this.project.missingDependencies(), []);
  assert.equal(this.project.hasStamp(), true);
});

Then('no se lanza ninguna instalación', function () {
  assert.deepEqual(this.session.npmCalls.filter((call) => call.args[0] === 'install'), []);
  assert.equal(this.project.hasNodeModules() && !this.project.hasStamp(), false);
});

Then('las dependencias se instalan de nuevo según la lista actual', function () {
  assert.equal(this.installsIn(this.project.dir).length, 1);
  assert.deepEqual(this.project.missingDependencies(), []);
});

Then('las dependencias de los tests de aceptación se instalan de nuevo según la lista actual', function () {
  assert.equal(this.installsIn(this.project.acceptanceDir).length, 1);
  assert.deepEqual(this.project.missingDependencies(this.project.acceptanceDir), []);
});

Then('las dependencias de la raíz no se instalan de nuevo', function () {
  assert.deepEqual(this.installsIn(this.project.dir), []);
});

Then('la sesión arranca con normalidad', function () {
  assert.equal(this.session.error, null, `${this.session.agent} failed to open the session: ${this.session.error}`);
  assert.equal(this.session.exitCode, 0);
  assert.deepEqual(this.session.startProblems, []);
});

Then('se avisa de que hace falta Node.js con npm', function () {
  assert.match(shownWarnings(this), /hace falta Node\.js con npm/);
});

Then('el aviso indica la versión requerida y la versión encontrada', function () {
  assert.match(shownWarnings(this), />=22\.12.*20\.11\.0/);
});

Then('se avisa de que la instalación de dependencias falló', function () {
  assert.match(shownWarnings(this), /falló la instalación de dependencias/);
  // The warning quotes npm's log verbatim, special characters included
  assert.ok(
    this.session.warnings.some((line) => line.endsWith(this.machine.npmFailureLine)),
    `npm's last log line is not in the warnings: ${JSON.stringify(this.session.warnings)}`
  );
});

Then('se avisa de que el PATH no se ha podido ajustar', function () {
  assert.match(shownWarnings(this), /no se ha podido ajustar el PATH/);
});

Then('el aviso indica que el CLI del proyecto se ejecuta con `npx openspec`', function () {
  assert.match(shownWarnings(this), /npx openspec/);
});

// --- Git al abrir sesión (manage-git-discipline, D5) --------------------------------

// What git shows of the clone before the session opens, to check that the
// bootstrap leaves the working tree and the checked-out branch alone
function rememberGit(world) {
  world.gitBefore = { status: world.project.gitStatus(), main: world.branches.revParse(world.project, 'refs/heads/main') };
}

Given(/^un clon superficial del proyecto( sin acceso a su remoto)?$/, function (unreachable) {
  this.branches.makeShallow(this.ensureProject(), { reachable: !unreachable });
  rememberGit(this);
});

Then('el clon deja de ser superficial', function () {
  assert.equal(this.branches.isShallow(this.project), false, `session:\n${this.session.log}`);
});

Then('se avisa de que no se pudo completar el clon', function () {
  assert.match(shownWarnings(this), /no se pudo completar el clon/);
});

Then('la sesión arranca', function () {
  assert.equal(this.session.error, null, `${this.session.agent} failed to open the session: ${this.session.error}`);
  assert.equal(this.session.exitCode, 0, this.session.log);
  assert.deepEqual(this.session.startProblems, []);
});

Given(/^un clon del proyecto en la rama (?:temporal |permanente )?`([^`]+)`$/, function (name) {
  const project = this.ensureProject();
  this.branches.addRemote(project);
  if (name !== 'main') this.branches.branch(project, name);
  rememberGit(this);
});

// A commit only on the local main, without checking it out
function localCommitOnMain(world) {
  const project = world.project;
  const tree = git(project.dir, 'rev-parse', 'main^{tree}').trim();
  const commit = git(project.dir, 'commit-tree', tree, '-p', 'main', '-m', 'commit solo en la rama local').trim();
  git(project.dir, 'update-ref', 'refs/heads/main', commit);
}

Given(/^(?:la rama permanente local )?`main` (está atrasada respecto a|está al día con|ha divergido de) `origin\/main`$/, function (state) {
  const project = this.project;
  if (state !== 'está al día con') this.branches.remoteCommit(project, { 'remoto.txt': 'remoto\n' }, { message: 'commit en el remoto' });
  if (state === 'ha divergido de') localCommitOnMain(this);
  rememberGit(this);
});

Then('`main` apunta al mismo commit que `origin\\/main`', function () {
  const project = this.project;
  assert.equal(this.branches.revParse(project, 'refs/heads/main'), this.branches.revParse(project, 'refs/remotes/origin/main'), this.session.log);
});

Then(/^`main` no cambia( y se avisa de que ha divergido)?$/, function (diverged) {
  assert.equal(this.branches.revParse(this.project, 'refs/heads/main'), this.gitBefore.main, this.session.log);
  if (diverged) assert.match(shownWarnings(this), /'main'.*divergido/);
});

Then('el árbol de trabajo no cambia', function () {
  assert.deepEqual(this.project.gitStatus(), this.gitBefore.status);
});

Then(/^la rama de la sesión guardada es `([^`]+)`$/, function (name) {
  assert.equal(this.branches.sessionBranch(this.project), name, this.session.log);
});

Then('no hay rama de la sesión guardada', function () {
  assert.equal(this.branches.sessionBranch(this.project), null, this.session.log);
});
