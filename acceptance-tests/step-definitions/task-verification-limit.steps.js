'use strict';

// Steps of task-verification-limit (limite-de-verificacion-y-mcp-de-depuracion,
// design D1 to D3). The limit is a rule of the `tasks` artifact in
// openspec/config.yaml; it reaches the model as the `rules` that the project's
// OpenSpec CLI gives with `openspec instructions tasks`, so that is what the
// steps read. The Given (`el openspec/config.yaml del proyecto`) is shared and
// lives in change-lifecycle.steps.js.

const assert = require('node:assert/strict');
const { When, Then } = require('@cucumber/cucumber');
const openspecSupport = require('../support/openspec');

function assertIn(text, pattern, what) {
  assert.match(text, pattern, `${what} does not match ${pattern}:\n${text}`);
}

When('se consultan las instrucciones del artefacto `tasks` de un change', function () {
  const name = openspecSupport.addChangeReadyToArchive(this.project, 'cambio-de-prueba');
  const result = this.branches.openspec(this.project, ['instructions', 'tasks', '--change', name, '--json']);
  assert.equal(result.exitCode, 0, `${result.stdout}\n${result.stderr}`);
  this.tasksRules = (JSON.parse(result.stdout).rules ?? []).join('\n');
});

Then('indican que verificar una task no debe llevar a una persona más de 15 minutos', function () {
  assertIn(this.tasksRules, /no debe llevar a una persona más de 15 minutos/, 'the tasks rules');
});

Then('indican qué cuenta como verificar una task', function () {
  assertIn(
    this.tasksRules,
    /leer su diff, recorrer y ejecutar los escenarios de aceptación que la cubren y, si quiere, depurarla/,
    'the tasks rules'
  );
});

Then('dan una referencia para estimar el tiempo de verificación', function () {
  assertIn(this.tasksRules, /1 minuto por cada 8 líneas de diff/, 'the tasks rules');
  assertIn(this.tasksRules, /2 minutos por cada escenario/, 'the tasks rules');
});

Then('indican escribir al final de cada task su estimación de verificación', function () {
  assertIn(this.tasksRules, /estimación al final de la línea de cada task, como «\(verificación: ~10 min\)»/, 'the tasks rules');
});

Then('indican dividir la task cuya estimación pase del límite', function () {
  assertIn(this.tasksRules, /estimación de una task pasa del límite, divídela/, 'the tasks rules');
});
