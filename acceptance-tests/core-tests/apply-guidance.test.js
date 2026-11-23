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
  // Without the block, what adjust gives is the file as it was, except for the
  // keys the block needs if the file has no apply guidance
  const before = text.split('\n');
  const after = added.text.split('\n');
  const at = after.findIndex((_, i) => BLOCK.every((l, k) => after[i + k] === l));
  assert.ok(at >= 0, 'the block is not in the output of adjust');
  const keys = before.includes('  apply:') ? 0 : 2;
  if (keys) assert.deepEqual(after.slice(at - keys, at), ['  apply:', '    guidance:']);
  assert.deepEqual([...after.slice(0, at - keys), ...after.slice(at + BLOCK.length)], before);
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

// --- syncApplyGuidance (task 1.2, design D4) ---

function tempProject(config) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'apply-guidance-'));
  if (config !== undefined) {
    fs.mkdirSync(path.join(dir, 'openspec'));
    fs.writeFileSync(path.join(dir, 'openspec', 'config.yaml'), config);
  }
  return dir;
}

test('syncApplyGuidance writes only when the mode asks for a change', async () => {
  const { syncApplyGuidance, BLOCK } = await load();
  const config = 'schema: x\n';
  const dir = tempProject(config);
  const file = path.join(dir, 'openspec', 'config.yaml');
  try {
    assert.deepEqual(await syncApplyGuidance(dir, 'auto'), { written: false, missing: false, similar: false, error: null });
    const first = await syncApplyGuidance(dir, 'normal');
    assert.equal(first.written, true);
    assert.ok(fs.readFileSync(file, 'utf8').includes(BLOCK.join('\n')));
    const mtime = fs.statSync(file).mtimeMs;
    fs.utimesSync(file, new Date(0), new Date(0));
    assert.equal((await syncApplyGuidance(dir, 'normal')).written, false);
    assert.equal(fs.statSync(file).mtimeMs, 0, `rewritten (was ${mtime})`);
    assert.equal((await syncApplyGuidance(dir, 'auto')).written, true);
    assert.equal(fs.readFileSync(file, 'utf8'), config);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('syncApplyGuidance does not create a missing config.yaml', async () => {
  const { syncApplyGuidance } = await load();
  const dir = tempProject(undefined);
  try {
    assert.deepEqual(await syncApplyGuidance(dir, 'normal'), { written: false, missing: true, similar: false, error: null });
    assert.equal(fs.existsSync(path.join(dir, 'openspec')), false);
  } finally {
    fs.rmSync(dir, { recursive: true, force: true });
  }
});

test('syncApplyGuidance returns read and write errors without throwing', async () => {
  const { syncApplyGuidance } = await load();
  // Unreadable: config.yaml is a directory
  const unreadable = tempProject(undefined);
  fs.mkdirSync(path.join(unreadable, 'openspec', 'config.yaml'), { recursive: true });
  // Unwritable: read-only file (skipped as root, who can write it anyway)
  const unwritable = tempProject('schema: x\n');
  const file = path.join(unwritable, 'openspec', 'config.yaml');
  fs.chmodSync(file, 0o444);
  try {
    const read = await syncApplyGuidance(unreadable, 'normal');
    assert.equal(read.written, false);
    assert.ok(read.error);
    if (process.getuid?.() !== 0) {
      const write = await syncApplyGuidance(unwritable, 'normal');
      assert.equal(write.written, false);
      assert.ok(write.error);
    }
  } finally {
    fs.chmodSync(file, 0o644);
    fs.rmSync(unreadable, { recursive: true, force: true });
    fs.rmSync(unwritable, { recursive: true, force: true });
  }
});

// Design D4: the plugin stops waiting for a hung adjustment and starts anyway
test('withTimeout gives the result in time and stops waiting after the limit', async () => {
  const { withTimeout } = await load();
  assert.deepEqual(await withTimeout(Promise.resolve({ written: true }), 1000), { written: true });
  const hung = new Promise(() => {});
  // The limit's timer is unref'd, as in the plugin, where OpenCode keeps the loop alive
  const alive = setInterval(() => {}, 1000);
  try {
    const started = Date.now();
    assert.deepEqual(await withTimeout(hung, 50), { timedOut: true });
    assert.ok(Date.now() - started < 1000, 'withTimeout waited too long');
  } finally {
    clearInterval(alive);
  }
});
