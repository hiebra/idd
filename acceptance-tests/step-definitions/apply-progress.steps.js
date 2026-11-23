'use strict';

// Steps of apply-progress (apply-progress-mirror): the apply guidance item
// that asks to mirror the tracking file in the agent's todo list. The item is
// the literal one of the spec, read from the spec itself.

const assert = require('node:assert/strict');
const { When, Then } = require('@cucumber/cucumber');
const { progressItem } = require('./apply-guidance.steps');

// A guidance item as the CLI gives it: the folded scalar on one line
const folded = (item) => item.split('\n').slice(1).map((l) => l.trim()).join(' ');

When(/^se piden las instrucciones de apply de `([^`]+)`$/, function (change) {
  const result = this.branches.openspec(this.lifecycleProject(), ['instructions', 'apply', '--change', change, '--json']);
  assert.equal(result.exitCode, 0, result.stderr);
  const guidance = JSON.parse(result.stdout).operationGuidance ?? [];
  this.applyGuidance = guidance.map((g) => (typeof g === 'string' ? g : g.text ?? JSON.stringify(g)));
});

Then('la primera indicación de apply es la de la lista de tareas', function () {
  assert.ok(this.applyGuidance, 'no apply instructions were asked for');
  assert.equal(this.applyGuidance[0], folded(progressItem()), `CLI guidance:\n${this.applyGuidance.join('\n')}`);
});
