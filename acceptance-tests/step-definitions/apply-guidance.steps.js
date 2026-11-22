'use strict';

// Steps of «Indicaciones de apply según el modo» and «El ajuste de config.yaml
// no toca nada más» (openspec-autopilot, apply-one-task-per-session-in-normal-mode).
// The plugin's server part loads in the simulated OpenCode with the user's
// mode; loading it again with another option is OpenCode's reload when the
// option changes. The block is the literal one of the spec, read from the spec
// itself, so these steps do not depend on the plugin's copy of it.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { Given, When, Then } = require('@cucumber/cucumber');
const { REPO_ROOT } = require('../support/project');
const ap = require('../support/autopilot');

const CONFIG = path.join('openspec', 'config.yaml');
const FIRST_WORDS = 'Standing instruction from the project owner';

// The four guidance items of the spec, as lines under `    guidance:`
function specBlock() {
  const candidates = [
    path.join(REPO_ROOT, 'openspec', 'specs', 'openspec-autopilot', 'spec.md'),
    path.join(REPO_ROOT, 'openspec', 'changes', 'apply-one-task-per-session-in-normal-mode', 'specs', 'openspec-autopilot', 'spec.md'),
  ];
  for (const file of candidates) {
    if (!fs.existsSync(file)) continue;
    const m = /```yaml\noperations:\n {2}apply:\n {4}guidance:\n([\s\S]*?)```/.exec(fs.readFileSync(file, 'utf8'));
    if (m) return m[1].replace(/\n$/, '');
  }
  throw new Error('no yaml block in the openspec-autopilot spec');
}

const configFile = (world) => world.lifecycleProject().path(CONFIG);
const readConfig = (world) => fs.readFileSync(configFile(world), 'utf8');

function writeConfig(world, text) {
  fs.writeFileSync(configFile(world), text);
  world.configWritten = fs.statSync(configFile(world)).mtimeMs;
}

// The config.yaml without the block, as the project has it
function withoutBlock(text) {
  const block = specBlock();
  return text
    .replace(`\n${block}`, '')
    .replace(/\noperations:\n {2}apply:\n {4}guidance:(?=\n|$)/, '\noperations:')
    .replace(/\n {2}apply:\n {4}guidance:(?=\n|$)/, '');
}

// The config.yaml with the block where the plugin puts it: at the end of
// operations.apply.guidance, or in the keys it creates
function withBlock(text) {
  const block = specBlock();
  const guidance = /(\n {2}apply:\n {4}guidance:\n(?: {6,}.*\n)*)/;
  if (guidance.test(text)) return text.replace(guidance, `$1${block}\n`);
  if (/^operations:$/m.test(text)) return text.replace(/^operations:\n/m, `operations:\n  apply:\n    guidance:\n${block}\n`);
  return `${text.replace(/\n?$/, '\n')}operations:\n  apply:\n    guidance:\n${block}\n`;
}

const hasBlock = (text) => text.includes(specBlock());

async function loadPlugin(world) {
  await world.startOpenCode({ pluginOptions: world.pluginOptions ?? {}, alreadyOpen: true });
  await world.opencodeCall('state');
}

Given(/^un clon del proyecto cuyo `openspec\/config.yaml` (tiene|no tiene) las indicaciones de una task por sesión$/, function (state) {
  const project = this.lifecycleProject();
  const base = withoutBlock(fs.readFileSync(project.path(CONFIG), 'utf8'));
  writeConfig(this, state === 'tiene' ? withBlock(base) : base);
  this.configBefore = readConfig(this);
});

Given(/^un usuario con el plugin en modo (normal|auto)$/, function (mode) {
  this.pluginOptions = mode === 'auto' ? { auto: true } : {};
});

When('se carga el plugin', async function () {
  await loadPlugin(this);
});

Then(/^`openspec\/config.yaml` (tiene|no tiene) las indicaciones de una task por sesión$/, function (state) {
  const text = readConfig(this);
  if (state === 'tiene') {
    assert.ok(hasBlock(text), `config.yaml without the block:\n${text}\n${ap.toasts(this)}`);
    assert.equal(text.split(FIRST_WORDS).length - 1, 1, 'the block is there more than once');
  } else {
    assert.equal(text.includes(FIRST_WORDS), false, `config.yaml with the block:\n${text}`);
  }
});

Then('el resto de `openspec\\/config.yaml` no cambia', function () {
  assert.equal(withoutBlock(readConfig(this)), withoutBlock(this.configBefore));
});

module.exports = { specBlock, withBlock, withoutBlock, readConfig, writeConfig, loadPlugin, CONFIG };
