'use strict';

// Steps of suite-run-policy (run-full-suite-once-per-change): when the full
// acceptance suite runs, and when only part of it. The rules reach the model
// through the OpenSpec CLI, so the steps read what `openspec instructions`
// gives on a copy of the project, not config.yaml itself. The rules are free
// text: each step looks for the key terms of its rule, in one same rule.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const { Given, When, Then } = require('@cucumber/cucumber');

const CHANGE = 'exportar-datos';
const TASKS_TEMPLATE = ['.agents', 'skills', 'spec-as-source', 'references', 'tasks.md'];

// The artifact's rules, as the CLI gives them
function rulesOf(world) {
  assert.ok(world.suiteRules, 'the artifact instructions were not asked for');
  return world.suiteRules;
}

// One rule of the CLI that has all the terms
function assertRule(world, terms, what) {
  const rules = rulesOf(world);
  assert.ok(
    rules.some((rule) => terms.every((term) => term.test(rule))),
    `no rule asks for ${what} (${terms.join(' and ')}); the CLI gives:\n${rules.map((r) => `- ${r}`).join('\n')}`,
  );
}

Given('un change en curso `exportar-datos`', function () {
  this.branches.addChange(this.lifecycleProject(), CHANGE);
});

When('se piden las instrucciones del artefacto `tasks` con `openspec instructions tasks --change exportar-datos`', function () {
  const result = this.branches.openspec(this.lifecycleProject(), ['instructions', 'tasks', '--change', CHANGE, '--json']);
  assert.equal(result.exitCode, 0, result.stderr || result.stdout);
  this.suiteRules = (JSON.parse(result.stdout).rules ?? []).map(String);
});

Then('las reglas piden una sola task que lance la suite completa, la última', function () {
  assertRule(this, [/suite de aceptación completa/, /una sola vez/, /última/], 'one task that runs the full suite, the last');
});

Then('las reglas piden no incluir una task que la lance antes de implementar', function () {
  assertRule(this, [/suite de aceptación completa/, /ninguna/, /antes de implementar/], 'no task that runs it before implementing');
});

Then('las reglas piden hacer `git fetch` antes de esa pasada y proponer traer la rama de origen si ha avanzado', function () {
  assertRule(this, [/`git fetch`/, /rama de origen/, /avanzado/, /traer/], 'git fetch before that run and proposing to bring the origin branch');
});

Then('las reglas piden que cada task de implementación diga qué escenarios cubre', function () {
  assertRule(this, [/cada task de implementación/i, /escenarios[^.]*cubre/], 'each implementation task saying which scenarios it covers');
});

Then('las reglas piden ejecutar solo esos escenarios, con `--name`', function () {
  assertRule(this, [/solo esos/, /`--name`/], 'running only those scenarios, with --name');
});

Then('las reglas piden comprobar que se ejecutó el número de escenarios esperado', function () {
  assertRule(this, [/número de escenarios/, /esperado/, /`0 scenarios`|ninguno/], 'checking that the expected number of scenarios ran');
});

// What an apply guidance entry would say if it carried the suite rule
const SUITE_TERMS = /suite|aceptaci[oó]n|acceptance|cucumber|`--name`/i;

When('se piden las instrucciones de `apply` con `openspec instructions apply --change exportar-datos`', function () {
  const result = this.branches.openspec(this.lifecycleProject(), ['instructions', 'apply', '--change', CHANGE, '--json']);
  assert.equal(result.exitCode, 0, result.stderr || result.stdout);
  this.applyGuidance = (JSON.parse(result.stdout).operationGuidance ?? []).map(String);
});

Then('las indicaciones de apply no mencionan la suite de aceptación', function () {
  assert.ok(this.applyGuidance, 'the apply instructions were not asked for');
  const mentions = this.applyGuidance.filter((entry) => SUITE_TERMS.test(entry));
  assert.deepEqual(mentions, [], `the apply guidance mentions the acceptance suite:\n${mentions.join('\n')}`);
});

// The tasks template of the project's spec-as-source skill: the step
// definitions section (one task per pending step) and the completion one
function templateSection(world, heading) {
  const text = world.tasksTemplate;
  assert.ok(text, 'the tasks template was not read');
  const at = text.search(heading);
  assert.ok(at !== -1, `the tasks template has no section ${heading}:\n${text}`);
  const next = text.slice(at + 1).search(/^## /m);
  return next === -1 ? text.slice(at) : text.slice(at, at + 1 + next);
}

Given('la plantilla de tasks de la skill `spec-as-source` del proyecto', function () {
  this.tasksTemplate = fs.readFileSync(this.ensureProject().path(...TASKS_TEMPLATE), 'utf8');
});

Then('indica que cada task de implementación ejecuta solo sus escenarios, con `--name`', function () {
  const steps = templateSection(this, /^## 2\. /m);
  assert.match(steps, /`--name`/, `the step definitions section does not say --name:\n${steps}`);
  assert.match(steps, /only (its|the) scenarios|only that scenario/i, `the step definitions section does not run only the task's scenarios:\n${steps}`);
  assert.match(steps, /number of scenarios|`0 scenarios`/i, `the step definitions section does not check how many scenarios ran:\n${steps}`);
});

Then('indica que la suite completa se lanza una sola vez, en la task de cierre', function () {
  const completion = templateSection(this, /^## 3\. /m);
  assert.match(completion, /full suite/i, `the completion section does not run the full suite:\n${completion}`);
  assert.match(completion, /only (time|once)|once per change/i, `the completion section does not say it runs once:\n${completion}`);
  assert.match(completion, /`git fetch`/, `the completion section does not fetch before the run:\n${completion}`);
  const steps = templateSection(this, /^## 2\. /m);
  assert.doesNotMatch(steps, /full suite/i, `the step definitions section runs the full suite:\n${steps}`);
});
