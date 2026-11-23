'use strict';

// Steps of apply-progress (apply-progress-mirror): the apply guidance item
// that asks to mirror the tracking file in the agent's todo list. The item is
// the literal one of the spec, read from the spec itself.

const assert = require('node:assert/strict');
const { Given, When, Then } = require('@cucumber/cucumber');
const { progressItem, specBlock, readConfig, writeConfig, CONFIG } = require('./apply-guidance.steps');
const fs = require('node:fs');

// A guidance item as the CLI gives it: the folded scalar on one line
const folded = (item) => item.split('\n').slice(1).map((l) => l.trim()).join(' ');

When(/^se piden las instrucciones de apply de `([^`]+)`$/, function (change) {
  const result = this.branches.openspec(this.lifecycleProject(), ['instructions', 'apply', '--change', change, '--json']);
  assert.equal(result.exitCode, 0, result.stderr);
  const guidance = JSON.parse(result.stdout).operationGuidance ?? [];
  this.applyGuidance = guidance.map((g) => (typeof g === 'string' ? g : g.text ?? JSON.stringify(g)));
});

// The items of operations.apply.guidance in the config.yaml, each one as the CLI gives it
function fileGuidance(text) {
  const m = /\n {2}apply:\n {4}guidance:\n((?: {6,}.*\n?)*)/.exec(text);
  if (!m) return [];
  return m[1].split(/\n(?= {6}- )/).filter((l) => l.trim()).map((item) => folded(item).trim());
}

Given('un clon del proyecto cuyo `openspec\\/config.yaml` tiene la indicación de la lista de tareas', function () {
  // The project's config.yaml as committed, with the block where the project has it
  const text = fs.readFileSync(this.lifecycleProject().path(CONFIG), 'utf8');
  assert.ok(fileGuidance(text).includes(folded(progressItem()).trim()), `the project config.yaml has no todo list item:\n${text}`);
  writeConfig(this, text);
  this.configBefore = readConfig(this);
});

// In the CLI output when the apply instructions were asked for; otherwise, in the config.yaml
Then('la primera indicación de apply es la de la lista de tareas', function () {
  const guidance = this.applyGuidance ?? fileGuidance(readConfig(this));
  assert.equal(guidance[0], folded(progressItem()), `apply guidance:\n${guidance.join('\n')}`);
});

Then(/^las indicaciones de una task por sesión (van después de ella|no están)$/, function (state) {
  const text = readConfig(this);
  const item = text.indexOf(progressItem());
  assert.notEqual(item, -1, `config.yaml without the todo list item:\n${text}`);
  if (state === 'no están') {
    assert.equal(text.includes(specBlock()), false, `config.yaml with the block:\n${text}`);
  } else {
    const block = text.indexOf(specBlock());
    assert.notEqual(block, -1, `config.yaml without the block:\n${text}`);
    assert.ok(block > item, `the block is before the todo list item:\n${text}`);
  }
});

// --- La lista de tareas no se activa desde el proyecto -----------------------

const path = require('node:path');
const { execFileSync } = require('node:child_process');
const { REPO_ROOT } = require('../support/project');

// Where each agent's project configuration lives, and the setting that turns
// its todo list tool on
const AGENT_CONFIGS = [
  { file: path.join('.claude', 'settings.json'), setting: ['env', 'CLAUDE_CODE_ENABLE_TODO_TOOLS'] },
  { file: 'opencode.json', setting: ['experimental', 'todo'] },
  { file: 'opencode.jsonc', setting: ['experimental', 'todo'] },
  { file: path.join('.opencode', 'opencode.json'), setting: ['experimental', 'todo'] },
  { file: path.join('.opencode', 'opencode.jsonc'), setting: ['experimental', 'todo'] },
];

// JSON with comments and trailing commas, as OpenCode reads it
function parseJsonc(text) {
  let out = '';
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      const end = /"(?:[^"\\]|\\.)*"/y;
      end.lastIndex = i;
      const m = end.exec(text);
      out += m[0];
      i += m[0].length - 1;
    } else if (c === '/' && text[i + 1] === '/') {
      while (i < text.length && text[i] !== '\n') i++;
      out += '\n';
    } else if (c === '/' && text[i + 1] === '*') {
      i = text.indexOf('*/', i + 2) + 1;
    } else {
      out += c;
    }
  }
  return JSON.parse(out.replace(/,(\s*[}\]])/g, '$1'));
}

// The files git tracks in the project; null if it is not a git checkout
function versionedFiles(root) {
  try {
    const out = execFileSync('git', ['ls-files', '-z'], { cwd: root, encoding: 'utf8' });
    return new Set(out.split('\0').filter(Boolean).map((f) => path.normalize(f)));
  } catch {
    return null;
  }
}

Given('el proyecto', function () {
  this.projectRoot = REPO_ROOT;
});

When('se leen sus archivos de configuración de los agentes', function () {
  const tracked = versionedFiles(this.projectRoot);
  this.agentConfigs = AGENT_CONFIGS
    .filter(({ file }) => fs.existsSync(path.join(this.projectRoot, file)))
    .filter(({ file }) => !tracked || tracked.has(file))
    .map((config) => ({ ...config, content: parseJsonc(fs.readFileSync(path.join(this.projectRoot, config.file), 'utf8')) }));
  assert.ok(this.agentConfigs.length > 0, 'the project has no agent configuration file');
});

Then('ninguno activa la herramienta de lista de tareas', function () {
  for (const { file, setting, content } of this.agentConfigs) {
    const parent = content?.[setting[0]];
    const set = parent != null && typeof parent === 'object' && Object.hasOwn(parent, setting[1]);
    assert.equal(set, false, `${file} sets ${setting.join('.')}: ${JSON.stringify(parent?.[setting[1]])}`);
  }
});
