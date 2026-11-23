'use strict';

// Core test of the session bootstrap, outside the specs (design D1 of
// fix-wiki-flow-operations): the guide and the reminder name each engine
// operation through a marker, which the core replaces by how the operation is
// invoked in each agent. A text left with an unknown marker is not delivered.
//
// Run with: npm run test:core

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { Machine } = require('../support/machine');

const CORE = path.resolve(__dirname, '..', '..', '.agents', 'hooks', 'session-bootstrap.sh');

const OPERATIONS = {
  'claude-code': { query: '`/wiki:query --local`', ingest: '`/wiki:ingest <url> --local`' },
  opencode: { query: 'la skill `wiki-query`', ingest: 'ingiere la fuente' },
};

// A project with only what wiki_text reads: engine.json, the guide and the
// reminder, with a copy of the core next to them, because the core looks for
// the texts next to itself (design D8 of add-project-wiki-toggle)
function projectWith({ guide, reminder }) {
  const dir = Machine.tmpDir();
  const wiki = path.join(dir, '.agents', 'wiki');
  fs.mkdirSync(wiki, { recursive: true });
  fs.mkdirSync(path.join(dir, '.agents', 'hooks'), { recursive: true });
  fs.copyFileSync(CORE, path.join(dir, '.agents', 'hooks', 'session-bootstrap.sh'));
  fs.writeFileSync(path.join(wiki, 'engine.json'), '{ "enabled": true, "repo": "owner/engine", "ref": "v1.0.0" }\n');
  fs.writeFileSync(path.join(wiki, 'guide.md'), guide);
  fs.writeFileSync(path.join(wiki, 'reminder.md'), reminder);
  return dir;
}

function wikiText(mode, agent, dir) {
  const env = { ...process.env };
  delete env.PROJECT_WIKI;
  const result = spawnSync('bash', [path.join(dir, '.agents', 'hooks', 'session-bootstrap.sh'), mode, agent, dir], { encoding: 'utf8', env });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout;
}

for (const [agent, ops] of Object.entries(OPERATIONS)) {
  test(`${agent}: every marker is replaced in the guide and the reminder`, (t) => {
    const dir = projectWith({
      guide: '# Guía\n\n<!-- wiki-guide:consultar -->\nConsulta con {{query}}; ingiere con {{ingest}}.\n',
      reminder: 'Recordatorio: consulta con {{query}}; lo de internet, {{ingest}}.\n',
    });
    t.after(() => fs.rmSync(dir, { recursive: true, force: true }));

    const guide = wikiText('guide', agent, dir);
    assert.ok(guide.includes(`Consulta con ${ops.query}; ingiere con ${ops.ingest}.`), guide);
    assert.doesNotMatch(guide, /\{\{|wiki-guide:/, guide);

    const reminder = wikiText('reminder', agent, dir);
    assert.equal(reminder, `Recordatorio: consulta con ${ops.query}; lo de internet, ${ops.ingest}.\n`);
  });

  test(`${agent}: a guide or a reminder with an unknown marker is not delivered`, (t) => {
    const dir = projectWith({
      guide: '# Guía\n\nConsulta con {{query}} y {{desconocido}}.\n',
      reminder: 'Recordatorio: {{query}} y {{desconocido}}.\n',
    });
    t.after(() => fs.rmSync(dir, { recursive: true, force: true }));

    assert.equal(wikiText('guide', agent, dir), '');
    assert.equal(wikiText('reminder', agent, dir), '');
  });
}

// --- The mode of the wiki (design D1 and D2 of add-wiki-lite-mode) ---

const REPO_ROOT = path.resolve(__dirname, '..', '..');
// The guide and the reminder before add-wiki-lite-mode (task 1.1): the texts
// of the mode full must not change
const BEFORE_CHANGE = '22b779a';
const MODES = ['full', 'lite'];

// The value of "mode" as written in engine.json (null: the key is missing),
// the mode it gives and whether it is a mode (design D1)
const MODE_TABLE = [
  { field: null, mode: 'full', valid: true },
  { field: '"full"', mode: 'full', valid: true },
  { field: '"lite"', mode: 'lite', valid: true },
  { field: '"light"', mode: 'full', valid: false },
  { field: '"Lite"', mode: 'full', valid: false },
  { field: '""', mode: 'full', valid: false },
  { field: 'lite', mode: 'full', valid: false },
  { field: '1', mode: 'full', valid: false },
];

// engine.json with the switch and the mode. The engine repository does not
// exist, so that the main mode fails to fetch it at once, without the network
function engineJson({ enabled = true, field = null, dir }) {
  const lines = [`  "enabled": ${enabled}`, `  "repo": "${path.join(dir, 'no-engine')}"`, '  "ref": "v1.0.0"'];
  if (field !== null) lines.push(`  "mode": ${field}`);
  return `{\n${lines.join(',\n')}\n}\n`;
}

// A guide and a reminder with a common line and a block of each mode
const BLOCK_GUIDE = [
  '# Guía',
  '',
  '<!-- wiki-guide:comun -->',
  'Común.',
  '<!-- wiki-mode:full -->',
  '',
  '<!-- wiki-guide:solo-full -->',
  'Solo full, con {{query}}.',
  '<!-- wiki-mode:end -->',
  '<!-- wiki-mode:lite -->',
  '',
  '<!-- wiki-guide:solo-lite -->',
  'Solo lite, con {{query}}.',
  '<!-- wiki-mode:end -->',
  '',
  'Final común.',
  '',
].join('\n');
const BLOCK_REMINDER = [
  'Recordatorio común.',
  '<!-- wiki-mode:full -->',
  'Solo full, con {{query}}.',
  '<!-- wiki-mode:end -->',
  '<!-- wiki-mode:lite -->',
  'Solo lite, con {{query}}.',
  '<!-- wiki-mode:end -->',
  'Final común.',
  '',
].join('\n');

function blockGuideFor(mode, ops) {
  return ['# Guía', '', 'Común.', '', `Solo ${mode}, con ${ops.query}.`, '', 'Final común.', ''].join('\n');
}

function blockReminderFor(mode, ops) {
  return `Recordatorio común. Solo ${mode}, con ${ops.query}. Final común.\n`;
}

function setEngine(dir, options) {
  fs.writeFileSync(path.join(dir, '.agents', 'wiki', 'engine.json'), engineJson({ dir, ...options }));
}

function run(args, env) {
  const result = spawnSync('bash', args, { encoding: 'utf8', env });
  assert.equal(result.status, 0, result.stderr);
  return result;
}

function wikiRun(mode, agent, dir) {
  const env = { ...process.env };
  delete env.PROJECT_WIKI;
  return run([path.join(dir, '.agents', 'hooks', 'session-bootstrap.sh'), mode, agent, dir], env);
}

// The main mode of the core (the one of the session), on a machine without
// npm, so that it installs nothing; the project is not a git repository
function mainRun(t, dir) {
  const workDir = Machine.tmpDir();
  t.after(() => fs.rmSync(workDir, { recursive: true, force: true }));
  const machine = new Machine(workDir);
  machine.hasNpm = false;
  return run([path.join(dir, '.agents', 'hooks', 'session-bootstrap.sh'), dir], machine.env());
}

// The warning of a value of "mode" that is not a mode: it names both modes
function modeWarnings(stderr) {
  return stderr.split('\n').filter((line) => /\bfull\b/.test(line) && /\blite\b/.test(line));
}

for (const { field, mode, valid } of MODE_TABLE) {
  const label = field === null ? 'no "mode"' : `"mode": ${field}`;

  for (const [agent, ops] of Object.entries(OPERATIONS)) {
    test(`${agent}, ${label}: the guide and the reminder of the mode ${mode} are delivered, without warning`, (t) => {
      const dir = projectWith({ guide: BLOCK_GUIDE, reminder: BLOCK_REMINDER });
      t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
      setEngine(dir, { field });

      const guide = wikiRun('guide', agent, dir);
      assert.equal(guide.stdout, blockGuideFor(mode, ops));
      assert.equal(guide.stderr, '');

      const reminder = wikiRun('reminder', agent, dir);
      assert.equal(reminder.stdout, blockReminderFor(mode, ops));
      assert.equal(reminder.stderr, '');
    });

    test(`${agent}, ${label}, wiki disabled: no guide nor reminder is delivered, without warning`, (t) => {
      const dir = projectWith({ guide: BLOCK_GUIDE, reminder: BLOCK_REMINDER });
      t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
      setEngine(dir, { enabled: false, field });

      for (const text of ['guide', 'reminder']) {
        const result = wikiRun(text, agent, dir);
        assert.equal(result.stdout, '');
        assert.equal(result.stderr, '');
      }
    });
  }

  test(`main mode, ${label}: ${valid ? 'no warning about the mode' : 'warns of a mode that does not exist'}`, (t) => {
    const dir = projectWith({ guide: BLOCK_GUIDE, reminder: BLOCK_REMINDER });
    t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
    setEngine(dir, { field });

    const warnings = modeWarnings(mainRun(t, dir).stderr);
    if (valid) {
      assert.deepEqual(warnings, []);
      return;
    }
    assert.equal(warnings.length, 1, JSON.stringify(warnings));
    const [warning] = warnings;
    assert.match(warning, /^session-start: /);
    assert.ok(warning.includes(field), `the warning names the value received (${field}): ${warning}`);
    assert.ok(warning.includes('/toggle-wiki'), `the warning says how to correct it: ${warning}`);
  });

  test(`main mode, ${label}, wiki disabled: no warning about the mode`, (t) => {
    const dir = projectWith({ guide: BLOCK_GUIDE, reminder: BLOCK_REMINDER });
    t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
    setEngine(dir, { enabled: false, field });

    assert.deepEqual(modeWarnings(mainRun(t, dir).stderr), []);
  });
}

// A project with the guide, the reminder and the OpenCode note of a commit, or
// of the working tree (null), next to the core of that same version
function projectAt(commit) {
  const dir = Machine.tmpDir();
  const files = ['.agents/hooks/session-bootstrap.sh', '.agents/wiki/guide.md', '.agents/wiki/reminder.md', '.agents/wiki/opencode-note.md'];
  for (const file of files) {
    const target = path.join(dir, file);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    if (commit === null) {
      fs.copyFileSync(path.join(REPO_ROOT, file), target);
    } else {
      const result = spawnSync('git', ['-C', REPO_ROOT, 'show', `${commit}:${file}`], { encoding: 'utf8' });
      assert.equal(result.status, 0, result.stderr);
      fs.writeFileSync(target, result.stdout);
    }
  }
  return dir;
}

for (const agent of Object.keys(OPERATIONS)) {
  for (const field of [null, '"full"']) {
    const label = field === null ? 'no "mode"' : `"mode": ${field}`;

    test(`${agent}, ${label}: the guide and the reminder are those before add-wiki-lite-mode, character by character`, (t) => {
      const before = projectAt(BEFORE_CHANGE);
      const now = projectAt(null);
      t.after(() => {
        fs.rmSync(before, { recursive: true, force: true });
        fs.rmSync(now, { recursive: true, force: true });
      });
      setEngine(before, {});
      setEngine(now, { field });

      for (const text of ['guide', 'reminder']) {
        const expected = wikiRun(text, agent, before).stdout;
        assert.notEqual(expected, '', `the ${text} before the change is delivered`);
        assert.equal(wikiRun(text, agent, now).stdout, expected, `the ${text} of the mode full`);
      }
    });
  }
}

// Malformed mode blocks: the text is not delivered (design D2)
const MALFORMED = {
  'a block that is not closed': ['Común.', '<!-- wiki-mode:full -->', 'Solo full.', 'Final común.', ''],
  'a block of a mode that does not exist': ['Común.', '<!-- wiki-mode:light -->', 'Solo light.', '<!-- wiki-mode:end -->', 'Final común.', ''],
  'a block inside another': [
    'Común.',
    '<!-- wiki-mode:lite -->',
    'Solo lite.',
    '<!-- wiki-mode:full -->',
    'Solo full.',
    '<!-- wiki-mode:end -->',
    '<!-- wiki-mode:end -->',
    'Final común.',
    '',
  ],
};

for (const [agent] of Object.entries(OPERATIONS)) {
  for (const [label, lines] of Object.entries(MALFORMED)) {
    for (const mode of MODES) {
      test(`${agent}, mode ${mode}: a guide or a reminder with ${label} is not delivered`, (t) => {
        const text = lines.join('\n');
        const dir = projectWith({ guide: `# Guía\n\n${text}`, reminder: text });
        t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
        setEngine(dir, { field: `"${mode}"` });

        assert.equal(wikiText('guide', agent, dir), '');
        assert.equal(wikiText('reminder', agent, dir), '');
      });
    }
  }
}
