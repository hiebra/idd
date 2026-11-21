'use strict';

const assert = require('node:assert/strict');
const { Given, When, Then } = require('@cucumber/cucumber');

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

// --- Máquina ----------------------------------------------------------------

Given('una máquina con otra versión de OpenSpec instalada globalmente', function () {
  this.machine.globalOpenspec = true;
  assert.notEqual(this.machine.globalOpenspecVersion, this.ensureProject().pinnedOpenspecVersion());
});

Given('una versión de Claude Code que no permite ajustar el PATH de la sesión', function () {
  this.machine.supportsEnvFile = false;
});

Given('una máquina con Node.js 22.12 o superior y npm', function () {
  assert.ok(atLeast(process.versions.node, '22.12.0'), `this machine runs Node.js ${process.versions.node}`);
  assert.equal(this.machine.hasNpm, true);
});

// --- Sesión -----------------------------------------------------------------

When('se abre una sesión de Claude Code en el proyecto', function () {
  this.openSession();
});

Then('`openspec --version` en la sesión muestra la versión fijada por el proyecto', function () {
  assert.equal(this.openspecVersionInSession(), this.project.pinnedOpenspecVersion());
});
