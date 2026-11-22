'use strict';

// The spec-lint scenarios run the same two commands as `npm run lint:specs`
// over other directories (support/spec-lint.js, design D4 of
// replace-gherkin-lint-with-gplint). These tests keep the script and those
// commands together, and keep the pinned config on levels gplint knows: on
// any other level it throws and still exits 0, linting nothing.

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const SUITE = path.resolve(__dirname, '..');

test('lint:specs extracts the specs and lints .extracted with gplint', () => {
  const pkg = JSON.parse(fs.readFileSync(path.join(SUITE, 'package.json'), 'utf8'));
  assert.equal(pkg.scripts['lint:specs'], 'node extract-gherkin.cjs && gplint .extracted');
});

test('.gplintrc only uses the levels "error" and "off"', () => {
  const text = fs.readFileSync(path.join(SUITE, '.gplintrc'), 'utf8').replace(/^\s*\/\/.*$/gm, '');
  const config = JSON.parse(text);
  for (const [rule, value] of Object.entries(config)) {
    const level = Array.isArray(value) ? value[0] : value;
    assert.ok(['error', 'off'].includes(level), `${rule} has the level ${JSON.stringify(level)}`);
  }
});

test('.gplintrc is the pinned config of the acceptance-test-authoring skill', () => {
  const skill = path.resolve(SUITE, '..', '.agents', 'skills', 'acceptance-test-authoring', 'references', 'gplintrc.json');
  assert.equal(fs.readFileSync(path.join(SUITE, '.gplintrc'), 'utf8'), fs.readFileSync(skill, 'utf8'));
});
