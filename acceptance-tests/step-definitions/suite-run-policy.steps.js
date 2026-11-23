'use strict';

// Steps of suite-run-policy (run-full-suite-once-per-change): when the full
// acceptance suite runs, and when only part of it. The rules reach the model
// through the OpenSpec CLI, so the steps read what `openspec instructions`
// gives on a copy of the project, not config.yaml itself. The rules are free
// text: each step looks for the key terms of its rule, in one same rule.

const assert = require('node:assert/strict');
const { Given, When, Then } = require('@cucumber/cucumber');

const CHANGE = 'exportar-datos';

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
