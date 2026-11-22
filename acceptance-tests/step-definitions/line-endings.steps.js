'use strict';

// session-bootstrap: LF in every clone (windows-support, design D2). Git for
// Windows checks out with core.autocrlf=true; the scenario extracts the copy
// again from its own repository with that setting.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { Given, Then } = require('@cucumber/cucumber');
const { git } = require('../support/engine');

// The bootstrap's scripts, which bash runs
const BOOTSTRAP_SCRIPTS = [
  path.join('.agents', 'hooks', 'session-bootstrap.sh'),
  path.join('.claude', 'hooks', 'session-start.sh'),
  path.join('.claude', 'hooks', 'user-prompt-submit.sh'),
  path.join('.claude', 'hooks', 'json.sh'),
];

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
