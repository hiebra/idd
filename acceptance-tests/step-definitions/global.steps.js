'use strict';

// Steps of the global install on a machine, without Windows
// (windows-global-distro): the session bootstrap, the comments rule and the
// autopilot installed in <config>/opencode/plugins/, which OpenCode loads in
// every project, and the projects they act on.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { Given, Then } = require('@cucumber/cucumber');
const { GlobalInstall } = require('../support/global');

function globalInstall(world) {
  world.global = world.global ?? new GlobalInstall(world.workDir);
  world.machine.globalInstall = world.global;
  return world.global;
}

// --- La instalación global --------------------------------------------------------

Given('el arranque de sesión instalado de forma global', function () {
  globalInstall(this).installSession({ engine: this.engine });
});

// --- Proyectos ------------------------------------------------------------------------

Given(/^un proyecto (sin `openspec\/config\.yaml`|con `schema: spec-driven` en `openspec\/config\.yaml`)$/, function (situation) {
  const project = this.ensureProject().slim();
  const config = project.path('openspec', 'config.yaml');
  if (situation.startsWith('sin')) fs.rmSync(config);
  else fs.writeFileSync(config, fs.readFileSync(config, 'utf8').replace(/^schema:.*$/m, 'schema: spec-driven'));
  this.branches.commitAll(project, 'otro proyecto');
});

Given('un proyecto creado desde la variante adelgazada, sin dependencias instaladas', function () {
  const project = this.ensureProject().slim();
  assert.equal(project.hasNodeModules(), false);
});

Given('un clon de la plantilla completa, con su propio arranque de sesión', function () {
  const project = this.ensureProject();
  assert.ok(fs.existsSync(project.path('.opencode', 'plugins', 'session-bootstrap', 'server.js')));
});

// --- Lo que hace el arranque global ---------------------------------------------------

Then('el arranque no instala nada ni cambia el entorno de la sesión', function () {
  const { session } = this;
  assert.deepEqual(session.npmCalls, [], session.log);
  assert.deepEqual(session.gitCalls.filter((call) => /^(clone|fetch)\b/.test(call)), [], session.log);
  assert.deepEqual(this.project.gitStatus(), [], session.log);
  const before = this.machine.env();
  assert.equal(session.env.PATH, before.PATH, session.log);
  assert.equal(session.env.CLAUDE_PLUGIN_ROOT, before.CLAUDE_PLUGIN_ROOT, session.log);
});

Then('la sesión no recibe la guía del wiki ni la regla de comentarios', function () {
  assert.deepEqual(this.session.context, [], this.session.log);
});

Then('no se muestra ningún aviso del arranque', function () {
  assert.deepEqual(this.session.warnings, [], this.session.log);
});

Then('el arranque se ejecuta una sola vez', function () {
  assert.equal(this.session.shellHooks, 1, this.session.log);
  const guides = this.session.context.filter((text) => text.includes(this.guideAsDelivered('OpenCode')));
  assert.equal(guides.length, 1, this.session.log);
});

Then('es el del proyecto', function () {
  const engine = this.session.env.CLAUDE_PLUGIN_ROOT;
  assert.equal(engine, this.project.path('.agents', 'wiki-engine', 'claude-plugin'), this.session.log);
  assert.ok(!engine.startsWith(this.global.root), this.session.log);
});

module.exports = { globalInstall };

// --- El motor del wiki de la instalación global -----------------------------------------

Given('una máquina Windows con la instalación global de una release', function () {
  globalInstall(this).installSession({ engine: this.engine });
});

Given('un proyecto creado desde la variante adelgazada de esa release', function () {
  this.ensureProject().slim();
});

Then('no se descarga ningún motor del wiki', function () {
  assert.deepEqual(this.engineClones(), [], this.session.log);
  assert.equal(this.project.hasEngineInstall(), false, this.session.log);
});

Then('las operaciones del wiki usan el motor de la instalación global', function () {
  const { operations, refs, helperRef, helper } = this.loadWikiEngine('OpenCode');
  for (const [kind, operation] of Object.entries(operations)) {
    assert.ok(operation, `OpenCode has no wiki ${kind}`);
    assert.ok(operation.file.startsWith(this.global.skillsDir), `${kind}: ${operation.file}`);
    assert.equal(refs[kind], this.engine.pinnedRef, kind);
  }
  assert.equal(this.session.env.CLAUDE_PLUGIN_ROOT, path.join(this.global.engineDir, 'claude-plugin'), this.session.log);
  assert.equal(helperRef, this.engine.pinnedRef, `${helper?.stdout}\n${helper?.stderr}\n${this.session.log}`);
});
