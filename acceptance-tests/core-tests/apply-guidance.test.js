'use strict';

// Core tests of lib/apply-guidance.mjs (tasks 1.1 and 1.2 of
// apply-one-task-per-session-in-normal-mode, design D1 to D4): the apply
// guidance block of «one task per session» is in openspec/config.yaml in the
// normal mode and not in the auto mode, and nothing else of the file changes.
//
// Run with: npm run test:core

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const { REPO_ROOT } = require('../support/project');

const MODULE = pathToFileURL(path.join(REPO_ROOT, '.opencode', 'plugins', 'openspec-autopilot', 'lib', 'apply-guidance.mjs')).href;
const load = () => import(MODULE);

// The project's config.yaml, without the block if it already has it
async function projectConfig() {
  const { adjust } = await load();
  const text = fs.readFileSync(path.join(REPO_ROOT, 'openspec', 'config.yaml'), 'utf8');
  return adjust(text, 'auto').text;
}

// The literal block of the spec (the yaml fence of the requirement), in the main
// spec once archived or in the change's delta until then
function specBlock() {
  const candidates = [
    path.join(REPO_ROOT, 'openspec', 'specs', 'openspec-autopilot', 'spec.md'),
    path.join(REPO_ROOT, 'openspec', 'changes', 'apply-one-task-per-session-in-normal-mode', 'specs', 'openspec-autopilot', 'spec.md'),
  ];
  for (const file of candidates) {
    if (!fs.existsSync(file)) continue;
    const m = /```yaml\noperations:\n {2}apply:\n {4}guidance:\n([\s\S]*?)```/.exec(fs.readFileSync(file, 'utf8'));
    if (m) return m[1].replace(/\n$/, '').split('\n');
  }
  return null;
}

test('the canonical block is the literal block of the spec', async () => {
  const { BLOCK } = await load();
  const block = specBlock();
  assert.ok(block, 'no yaml block in the openspec-autopilot spec');
  assert.deepEqual(BLOCK, block);
});

test('normal mode adds the block at the end of an existing apply guidance list', async () => {
  const { adjust, BLOCK } = await load();
  const text = 'schema: x\noperations:\n  apply:\n    guidance:\n      - Keep test summaries concise\n  archive:\n    guidance:\n      - "a"\n';
  const out = adjust(text, 'normal');
  assert.equal(out.changed, true);
  assert.equal(
    out.text,
    ['schema: x', 'operations:', '  apply:', '    guidance:', '      - Keep test summaries concise', ...BLOCK, '  archive:', '    guidance:', '      - "a"', ''].join('\n')
  );
  assert.equal(adjust(out.text, 'auto').text, text);
});

test('normal mode creates the missing keys and auto mode prunes them', async () => {
  const { adjust } = await load();
  const cases = [
    'schema: x\n',
    'schema: x',
    '',
    'schema: x\noperations:\n  archive:\n    guidance:\n      - "a"\n',
    'schema: x\noperations:\n  apply:\n    other: 1\n',
    '# head\nschema: x\n\n# Per-operation guidance\n#   operations:\n#     apply:\n#       guidance:\n#         - Keep test summaries concise\n',
  ];
  for (const text of cases) {
    const added = adjust(text, 'normal');
    assert.equal(added.changed, true, JSON.stringify(text));
    assert.notEqual(added.text, text);
    assert.equal(adjust(added.text, 'normal').changed, false, JSON.stringify(text));
    const removed = adjust(added.text, 'auto');
    assert.equal(removed.changed, true);
    assert.equal(removed.text, text, JSON.stringify(text));
  }
});

test('the project config.yaml keeps every other byte in both modes', async () => {
  const { adjust, BLOCK } = await load();
  const text = await projectConfig();
  const added = adjust(text, 'normal');
  assert.equal(added.changed, true);
  // Only the block lines (and the keys it needs) are new
  const before = text.split('\n');
  const after = added.text.split('\n');
  const extra = after.filter((l) => !before.includes(l));
  for (const line of extra) assert.ok(BLOCK.includes(line) || ['  apply:', '    guidance:'].includes(line), line);
  assert.equal(after.length, before.length + BLOCK.length + 2);
  assert.equal(adjust(added.text, 'auto').text, text);
  assert.equal(adjust(text, 'auto').changed, false);
});

test('nothing changes when the file is already as the mode asks', async () => {
  const { adjust } = await load();
  const text = await projectConfig();
  assert.deepEqual(adjust(text, 'auto'), { text, changed: false, similar: false });
  const added = adjust(text, 'normal').text;
  assert.deepEqual(adjust(added, 'normal'), { text: added, changed: false, similar: false });
});

test('a hand-reformatted block is not recognised and is reported', async () => {
  const { adjust, BLOCK } = await load();
  const text = 'operations:\n  apply:\n    guidance:\n      - "Standing instruction from the project owner: apply runs one tracked task per session."\n';
  const auto = adjust(text, 'auto');
  assert.equal(auto.changed, false);
  assert.equal(auto.similar, true);
  const normal = adjust(text, 'normal');
  assert.equal(normal.changed, true);
  assert.equal(normal.similar, true);
  assert.ok(normal.text.includes(BLOCK.join('\n')));
});

test('a guidance list at the same indentation as its key is kept', async () => {
  const { adjust, BLOCK } = await load();
  const text = 'operations:\n  apply:\n    guidance:\n    - Keep test summaries concise\n';
  const out = adjust(text, 'normal');
  assert.equal(out.text, ['operations:', '  apply:', '    guidance:', '    - Keep test summaries concise', ...BLOCK, ''].join('\n'));
  assert.equal(adjust(out.text, 'auto').text, text);
});
