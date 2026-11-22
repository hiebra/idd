'use strict';

// Steps of spec-lint (replace-gherkin-lint-with-gplint). They run the same
// commands as `npm run lint:specs`, over other directories (design D4).

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { Given, When, Then } = require('@cucumber/cucumber');
const { writeDefectSpec, lintSpecs } = require('../support/spec-lint');

const PROJECT_OPENSPEC = path.resolve(__dirname, '..', '..', 'openspec');

Given(/^una spec con un requisito cuyo escenario tiene (.+)$/, function (defect) {
  this.lintOpenspec = path.join(this.workDir, 'openspec');
  this.defect = writeDefectSpec(this.lintOpenspec, defect);
});

Given('las specs vigentes y los deltas de los changes activos del proyecto', function () {
  assert.ok(fs.existsSync(path.join(PROJECT_OPENSPEC, 'specs')), `no openspec/specs/ at ${PROJECT_OPENSPEC}`);
  this.lintOpenspec = PROJECT_OPENSPEC;
});

When('se pasa el lint de las specs', function () {
  this.lint = lintSpecs(this.lintOpenspec, path.join(this.workDir, 'extracted'));
});

Then('el lint falla', function () {
  assert.notEqual(this.lint.exitCode, 0, `the lint passed:\n${this.lint.output}`);
});

Then('informa del defecto en la línea del spec.md en la que está', function () {
  const { spec, line } = this.defect;
  assert.deepEqual(
    this.lint.errors.map((error) => [error.spec, error.line]),
    [[spec, line]],
    `expected one error at ${spec}:${line}, got:\n${this.lint.output}`
  );
});

Then('el lint termina sin errores', function () {
  assert.ok(this.lint.report, `the lint gave no report, so it linted nothing:\n${this.lint.output}`);
  assert.deepEqual(this.lint.errors, [], `the lint reported errors:\n${this.lint.output}`);
  assert.equal(this.lint.exitCode, 0, this.lint.output);
});
