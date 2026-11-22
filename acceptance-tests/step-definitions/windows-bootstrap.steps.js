'use strict';

// session-bootstrap on Windows (windows-support): the scenarios simulate on
// Linux what is different on Windows (design D8), see support/machine.js and
// the OpenCode adapter.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { Given, Then } = require('@cucumber/cucumber');
const { git } = require('../support/engine');
const { ENGINE_LINKS } = require('../support/project');

// The bootstrap's scripts, which bash runs
const BOOTSTRAP_SCRIPTS = [
  path.join('.agents', 'hooks', 'session-bootstrap.sh'),
  path.join('.claude', 'hooks', 'session-start.sh'),
  path.join('.claude', 'hooks', 'user-prompt-submit.sh'),
  path.join('.claude', 'hooks', 'json.sh'),
];

function shown(world) {
  return world.session.warnings.join('\n');
}

// --- Finales de línea ----------------------------------------------------------

// Git for Windows checks out with core.autocrlf=true: the copy is extracted
// again from its own repository with that setting
Given('un clon del proyecto extraído con `core.autocrlf=true`', function () {
  const project = this.ensureProject();
  git(project.dir, 'config', 'core.autocrlf', 'true');
  git(project.dir, 'rm', '-r', '-q', '--cached', '.');
  git(project.dir, 'reset', '-q', '--hard');
});

Then('los scripts del arranque de sesión del clon tienen finales de línea LF', function () {
  const crlf = BOOTSTRAP_SCRIPTS.filter((rel) => fs.readFileSync(this.project.path(rel), 'utf8').includes('\r'));
  assert.deepEqual(crlf, [], `scripts with CRLF:\n${crlf.join('\n')}`);
});

Then('la guía del wiki se entrega sin los identificadores de sección', function () {
  const guide = this.session.context.find((text) => text.includes('wiki'));
  assert.ok(guide, `no wiki guide was delivered:\n${this.session.log}`);
  assert.doesNotMatch(guide, /<!-- wiki-guide:/, 'the guide keeps its section identifiers');
  assert.doesNotMatch(guide, /\r/, 'the guide has CR characters');
});

// --- Enlaces del motor en Git Bash ---------------------------------------------

Given('una máquina con Git Bash, cuyo `ln -s` copia salvo que se pidan symlinks nativos', function () {
  this.machine.gitBashLn = true;
});

Given('una sesión anterior instaló el motor del wiki en el proyecto', function () {
  this.ensureProject();
  this.openSetupSession('OpenCode');
  assert.equal(this.project.hasEngineInstall(), true, this.session.log);
});

Then('los enlaces del motor del wiki son symlinks', function () {
  const notLinks = Object.values(ENGINE_LINKS).filter((rel) => {
    try {
      return !fs.lstatSync(this.project.path(rel)).isSymbolicLink();
    } catch {
      return true;
    }
  });
  assert.deepEqual(notLinks, [], `not symlinks:\n${notLinks.join('\n')}\n${this.session.log}`);
});

Then('no se avisa de que ya existe algo que no es del motor del wiki', function () {
  assert.doesNotMatch(shown(this), /no es del motor del wiki/, this.session.log);
});

// --- Rutas de la sesión ------------------------------------------------------------

// On Windows, OpenCode names the project C:\... and Git Bash /c/...: OpenCode
// opens the project through a symlink, and the fake Git Bash rewrites it
Given('bash ve el proyecto con una ruta distinta de la que usa OpenCode', function () {
  const project = this.ensureProject();
  const alias = path.join(this.workDir, 'ruta-de-opencode');
  if (!fs.existsSync(alias)) fs.symlinkSync(project.dir, alias);
  this.machine.windows = { gitForWindows: true, wslFirst: false, alias: { from: alias, to: project.dir } };
});

Then('el directorio de binarios del proyecto llega al PATH de la sesión con la ruta que usa OpenCode', function () {
  const alias = this.machine.windows.alias.from;
  const first = (this.session.env.PATH ?? '').split(path.delimiter)[0];
  assert.equal(first, path.join(alias, 'node_modules', '.bin'), this.session.log);
});

Then('`CLAUDE_PLUGIN_ROOT` en la sesión está bajo la ruta que usa OpenCode', function () {
  const alias = this.machine.windows.alias.from;
  const root = this.session.env.CLAUDE_PLUGIN_ROOT ?? '';
  assert.ok(root.startsWith(alias + path.sep), `CLAUDE_PLUGIN_ROOT is '${root}'\n${this.session.log}`);
});

// --- El bash de OpenCode en Windows --------------------------------------------------

Given(/^una máquina Windows (con|sin) Git for Windows$/, function (has) {
  this.machine.windows = { gitForWindows: has === 'con', wslFirst: false, alias: null };
});

Given('el primer bash del PATH es el de WSL', function () {
  this.machine.windows.wslFirst = true;
});

Then('el arranque de sesión se ejecuta con el bash de Git for Windows', function () {
  const core = (call) => call.includes('session-bootstrap.sh');
  assert.ok(this.machine.bashCalls('git').some(core), `Git Bash did not run the core:\n${this.session.log}`);
  assert.deepEqual(this.machine.bashCalls('wsl').filter(core), [], 'the WSL bash ran the core');
});

Then('se avisa de que el arranque de sesión necesita Git for Windows', function () {
  assert.match(shown(this), /necesita Git for Windows/, this.session.log);
});
