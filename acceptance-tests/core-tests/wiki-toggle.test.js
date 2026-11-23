'use strict';

// Core test of the session bootstrap, outside the specs (design D2, D3 of
// add-project-wiki-toggle): the `wiki <status|on|off>` mode of the core.
//   - status reports the switch, whether .wiki/ exists and what the initial
//     ingest would take as sources and what it would leave out;
//   - on and off flip `enabled`, insert or remove the block between markers in
//     openspec/config.yaml keeping the rest byte for byte, create or remove
//     operations.archive.guidance when needed, stage engine.json and
//     config.yaml and never commit;
//   - with a malformed or repeated pair of markers they leave config.yaml
//     alone and warn;
//   - the mode always exits with 0.
// And the `mode <full|lite>` action and `mode=` of status (design D5 of
// add-wiki-lite-mode):
//   - mode writes only "mode" in engine.json, inserting the key or creating the
//     file when needed, and leaves enabled, config.yaml and the engine alone;
//   - it does not write when nothing changes, rewrites an invalid value, stages
//     only engine.json and never commits;
//   - any other argument writes nothing and warns with the modes that exist;
//   - status prints the effective mode and warns of an invalid value;
//   - on and off keep "mode".
//
// Run with: npm run test:core

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const YAML = require('../../node_modules/yaml');
const { Machine } = require('../support/machine');
const { FakeEngine, git } = require('../support/engine');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const CORE = path.join(REPO_ROOT, '.agents', 'hooks', 'session-bootstrap.sh');
const SOURCE = path.join(REPO_ROOT, '.agents', 'wiki', 'archive-guidance.yaml');
const BEGIN = '# wiki:archive-guidance:begin';
const END = '# wiki:archive-guidance:end';
const CONFIG = path.join('openspec', 'config.yaml');
const ENGINE_JSON = path.join('.agents', 'wiki', 'engine.json');

const WITH_GUIDANCE = `schema: intent-driven
stack: javascript

# Un comentario que debe sobrevivir
operations:
  apply:
    guidance:
      - "Paso de apply"
  archive:
    guidance:
      - "Primera indicación propia"   # comentario en línea
      - >-
        Segunda indicación propia,
        en varias líneas

# Comentario final
`;

const WITHOUT_OPERATIONS = `schema: intent-driven
# sin operaciones
rules:
  specs:
    - Must use spec-as-source skill
`;

const WITHOUT_GUIDANCE = `schema: intent-driven
operations:
  apply:
    guidance:
      - "Paso de apply"
  archive:
    # sin guidance todavía
rules:
  specs:
    - Regla
`;

function setUp(t, { config = WITH_GUIDANCE, enabled = false, wiki = false } = {}) {
  const workDir = Machine.tmpDir();
  t.after(() => fs.rmSync(workDir, { recursive: true, force: true }));
  const engine = new FakeEngine(workDir);
  const dir = path.join(workDir, 'project');
  const write = (rel, content) => {
    fs.mkdirSync(path.dirname(path.join(dir, rel)), { recursive: true });
    fs.writeFileSync(path.join(dir, rel), content);
  };
  write(ENGINE_JSON, JSON.stringify({ enabled, repo: engine.url, ref: 'v1.0.0' }, null, 2) + '\n');
  write(CONFIG, config);
  write('.gitignore', '.agents/wiki-engine/\n.agents/wiki-engine.*\n');
  write('src/app.js', 'console.log(1);\n');
  write('openspec/specs/app/spec.md', '# app\n');
  write('adr/0001-decision.md', '# ADR\n');
  write('package-lock.json', '{}\n');
  write('acceptance-tests/reports/cucumber-report.html', '<html></html>\n');
  write('acceptance-tests/.extracted/app.feature', 'Feature: app\n');
  write('vacio.txt', '');
  write('.agents/wiki-engine/README.md', 'motor\n');
  if (wiki) write('.wiki/index.md', '# Wiki\n');
  git(dir, 'init', '-q', '-b', 'main');
  git(dir, 'add', '-A');
  git(dir, 'add', '-f', '.agents/wiki-engine/README.md');
  git(dir, 'commit', '-q', '-m', 'inicio');
  return { dir, head: git(dir, 'rev-parse', 'HEAD').trim() };
}

function wiki(dir, action) {
  const env = { ...process.env };
  delete env.PROJECT_WIKI;
  const result = spawnSync('bash', [CORE, 'wiki', action, dir], { encoding: 'utf8', env });
  const lines = result.stdout.split('\n').filter(Boolean);
  return { status: result.status, stdout: result.stdout, stderr: result.stderr, lines };
}

const read = (dir, rel) => fs.readFileSync(path.join(dir, rel), 'utf8');
const enabledOf = (dir) => JSON.parse(read(dir, ENGINE_JSON)).enabled;
const staged = (dir) => git(dir, 'diff', '--cached', '--name-only').split('\n').filter(Boolean).sort();

// config.yaml without the lines between the markers, markers included
function withoutBlock(text) {
  const lines = text.split('\n');
  const begin = lines.findIndex((l) => l.trim() === BEGIN);
  const end = lines.findIndex((l) => l.trim() === END);
  assert.ok(begin >= 0 && end > begin, text);
  return [...lines.slice(0, begin), ...lines.slice(end + 1)].join('\n');
}

// The entries of the source, as YAML values
function sourceEntries() {
  return YAML.parse(fs.readFileSync(SOURCE, 'utf8'));
}

test('status reports the switch, .wiki/ and what the initial ingest would take', (t) => {
  const { dir } = setUp(t);
  const out = wiki(dir, 'status');
  assert.equal(out.status, 0, out.stderr);
  assert.ok(out.lines.includes('enabled=false'), out.stdout);
  assert.ok(out.lines.includes('wiki-dir=false'), out.stdout);
  const sources = out.lines.filter((l) => l.startsWith('source=')).map((l) => l.slice(7)).sort();
  assert.deepEqual(sources, ['.agents/wiki/engine.json', 'adr/0001-decision.md', 'openspec/config.yaml', 'openspec/specs/app/spec.md', 'src/app.js']);
  const excluded = out.lines.filter((l) => l.startsWith('excluded=')).map((l) => l.slice(9).split('|')[0]).sort();
  assert.deepEqual(excluded, [
    '.agents/wiki-engine/README.md',
    '.gitignore',
    'acceptance-tests/.extracted/app.feature',
    'acceptance-tests/reports/cucumber-report.html',
    'package-lock.json',
    'vacio.txt',
  ]);

  const { dir: other } = setUp(t, { enabled: true, wiki: true });
  const out2 = wiki(other, 'status');
  assert.ok(out2.lines.includes('enabled=true'), out2.stdout);
  assert.ok(out2.lines.includes('wiki-dir=true'), out2.stdout);
});

test('only the literal true enables the wiki', (t) => {
  for (const value of ['"true"', '1', 'null', 'TRUE']) {
    const { dir } = setUp(t);
    fs.writeFileSync(path.join(dir, ENGINE_JSON), `{ "enabled": ${value}, "repo": "x/y", "ref": "v1" }\n`);
    assert.ok(wiki(dir, 'status').lines.includes('enabled=false'), value);
  }
  const { dir } = setUp(t);
  fs.writeFileSync(path.join(dir, ENGINE_JSON), '{ "repo": "x/y", "ref": "v1" }\n');
  assert.ok(wiki(dir, 'status').lines.includes('enabled=false'));
});

for (const [name, config] of Object.entries({ 'with guidance': WITH_GUIDANCE, 'without operations': WITHOUT_OPERATIONS, 'without guidance': WITHOUT_GUIDANCE })) {
  test(`on and off round-trip config.yaml ${name}`, (t) => {
    const { dir, head } = setUp(t, { config, wiki: true });
    const wikiBefore = read(dir, '.wiki/index.md');

    const on = wiki(dir, 'on');
    assert.equal(on.status, 0, on.stderr);
    assert.equal(enabledOf(dir), true);
    const enabledConfig = read(dir, CONFIG);
    const parsed = YAML.parse(enabledConfig);
    const guidance = parsed.operations.archive.guidance;
    assert.deepEqual(guidance.slice(-sourceEntries().length), sourceEntries(), enabledConfig);
    if (config === WITH_GUIDANCE) {
      assert.equal(withoutBlock(enabledConfig), config);
      assert.deepEqual(parsed.operations.apply.guidance, ['Paso de apply']);
      assert.equal(guidance[0], 'Primera indicación propia');
    }
    assert.deepEqual(staged(dir), [ENGINE_JSON, CONFIG].sort());
    assert.equal(git(dir, 'rev-parse', 'HEAD').trim(), head, 'on must not commit');
    assert.ok(fs.lstatSync(path.join(dir, '.claude', 'skills', 'wiki-manager')).isSymbolicLink());

    const off = wiki(dir, 'off');
    assert.equal(off.status, 0, off.stderr);
    assert.equal(enabledOf(dir), false);
    assert.equal(read(dir, CONFIG), config);
    assert.doesNotMatch(read(dir, CONFIG), /wiki/i);
    // Both files are back to what HEAD has, so nothing is left to stage
    assert.deepEqual(staged(dir), []);
    assert.deepEqual(git(dir, 'status', '--porcelain', '--', ENGINE_JSON, CONFIG).trim(), '');
    assert.equal(git(dir, 'rev-parse', 'HEAD').trim(), head, 'off must not commit');
    assert.equal(read(dir, '.wiki/index.md'), wikiBefore);
    assert.equal(fs.existsSync(path.join(dir, '.claude', 'skills', 'wiki-manager')), false);
  });
}

test('off from a committed enabled wiki stages both files and does not commit', (t) => {
  const { dir } = setUp(t);
  wiki(dir, 'on');
  git(dir, 'commit', '-q', '-m', 'wiki on');
  const head = git(dir, 'rev-parse', 'HEAD').trim();
  const off = wiki(dir, 'off');
  assert.equal(off.status, 0, off.stderr);
  assert.deepEqual(staged(dir), [ENGINE_JSON, CONFIG].sort());
  assert.equal(git(dir, 'rev-parse', 'HEAD').trim(), head);
});

test('on twice leaves a single block', (t) => {
  const { dir } = setUp(t);
  wiki(dir, 'on');
  const once = read(dir, CONFIG);
  wiki(dir, 'on');
  assert.equal(read(dir, CONFIG), once);
  assert.equal(once.split('\n').filter((l) => l.trim() === BEGIN).length, 1);
});

const MALFORMED = {
  'a begin without end': (c) => c.replace('  archive:\n    guidance:\n', `  archive:\n    guidance:\n      ${BEGIN}\n`),
  'an end before its begin': (c) => c.replace('  archive:\n    guidance:\n', `  archive:\n    guidance:\n      ${END}\n      ${BEGIN}\n`),
  'two pairs': (c) => c.replace('  archive:\n    guidance:\n', `  archive:\n    guidance:\n      ${BEGIN}\n      ${END}\n      ${BEGIN}\n      ${END}\n`),
};

for (const [name, corrupt] of Object.entries(MALFORMED)) {
  for (const action of ['on', 'off']) {
    test(`${action} with ${name} leaves config.yaml alone and warns`, (t) => {
      const config = corrupt(WITH_GUIDANCE);
      assert.notEqual(config, WITH_GUIDANCE);
      const { dir } = setUp(t, { config, enabled: action === 'off' });
      const out = wiki(dir, action);
      assert.equal(out.status, 0, out.stderr);
      assert.equal(read(dir, CONFIG), config);
      assert.match(out.stderr, /^session-start: .*marcas/m, out.stderr);
      assert.equal(enabledOf(dir), action === 'off', 'the switch is not flipped either');
      assert.deepEqual(staged(dir), []);
    });
  }
}

test('the wiki mode always exits with 0', (t) => {
  for (const args of [['wiki'], ['wiki', 'nada', '/no/existe'], ['wiki', 'on', '/no/existe'], ['wiki', 'status']]) {
    const result = spawnSync('bash', [CORE, ...args], { encoding: 'utf8' });
    assert.equal(result.status, 0, `${args.join(' ')}: ${result.stderr}`);
  }
});

test('the texts that travel with the distribution are read next to the core, not from the project', (t) => {
  const workDir = Machine.tmpDir();
  t.after(() => fs.rmSync(workDir, { recursive: true, force: true }));
  const dist = path.join(workDir, 'dist', '.agents');
  fs.mkdirSync(path.join(dist, 'hooks'), { recursive: true });
  fs.mkdirSync(path.join(dist, 'wiki'), { recursive: true });
  fs.copyFileSync(CORE, path.join(dist, 'hooks', 'session-bootstrap.sh'));
  fs.writeFileSync(path.join(dist, 'wiki', 'guide.md'), 'GUIA-DE-LA-DISTRIBUCION\n');
  const project = path.join(workDir, 'project', '.agents', 'wiki');
  fs.mkdirSync(project, { recursive: true });
  fs.writeFileSync(path.join(project, 'engine.json'), '{ "enabled": true }\n');
  fs.writeFileSync(path.join(project, 'guide.md'), 'GUIA-DEL-PROYECTO\n');
  const env = { ...process.env };
  delete env.PROJECT_WIKI;
  const result = spawnSync('bash', [path.join(dist, 'hooks', 'session-bootstrap.sh'), 'guide', 'claude-code', path.join(workDir, 'project')], { encoding: 'utf8', env });
  assert.equal(result.stdout, 'GUIA-DE-LA-DISTRIBUCION\n', result.stderr);
});

// The session start of the core, on a machine without npm: only git and the
// wiki matter here
const machines = new Map();
function sessionStart(dir) {
  if (!machines.has(dir)) {
    const machine = new Machine(fs.mkdtempSync(path.join(path.dirname(dir), 'machine-')));
    machine.hasNpm = false;
    machines.set(dir, machine);
  }
  const machine = machines.get(dir);
  const result = spawnSync('bash', [CORE, dir], { encoding: 'utf8', env: machine.env() });
  return { status: result.status, stderr: result.stderr };
}

const STALE = /no coinciden con su fuente/;

test('the session start warns of an out-of-date block only with the wiki enabled, and never rewrites config.yaml', (t) => {
  // Enabled, block equal to its source: no warning
  const { dir } = setUp(t);
  wiki(dir, 'on');
  const fresh = read(dir, CONFIG);
  let start = sessionStart(dir);
  assert.equal(start.status, 0, start.stderr);
  assert.doesNotMatch(start.stderr, STALE, start.stderr);
  assert.equal(read(dir, CONFIG), fresh);

  // Enabled, block edited by hand: warning, file untouched
  const stale = fresh.replace('5. Presenta al usuario', '5. Enséñale al usuario');
  assert.notEqual(stale, fresh);
  fs.writeFileSync(path.join(dir, CONFIG), stale);
  start = sessionStart(dir);
  assert.match(start.stderr, /^session-start: .*no coinciden con su fuente.*\/toggle-wiki dos veces/m, start.stderr);
  assert.equal(read(dir, CONFIG), stale);

  // Disabled, same edited block: no warning
  set(dir, false);
  start = sessionStart(dir);
  assert.doesNotMatch(start.stderr, STALE, start.stderr);
  assert.equal(read(dir, CONFIG), stale);
});

function set(dir, enabled) {
  const config = JSON.parse(read(dir, ENGINE_JSON));
  fs.writeFileSync(path.join(dir, ENGINE_JSON), JSON.stringify({ ...config, enabled }, null, 2) + '\n');
}

// ---- The mode of the wiki: `wiki mode <full|lite>` and `mode=` of status
// (design D5 of add-wiki-lite-mode)

function wikiMode(dir, value) {
  const env = { ...process.env };
  delete env.PROJECT_WIKI;
  const result = spawnSync('bash', [CORE, 'wiki', 'mode', value, dir], { encoding: 'utf8', env });
  const lines = result.stdout.split('\n').filter(Boolean);
  return { status: result.status, stdout: result.stdout, stderr: result.stderr, lines };
}

// engine.json with "mode" given as raw JSON text (or without it, when undefined)
function engineText(engineUrl, { enabled = true, mode } = {}) {
  const fields = [`  "enabled": ${enabled}`];
  if (mode !== undefined) fields.push(`  "mode": ${mode}`);
  fields.push(`  "repo": "${engineUrl}"`, '  "ref": "v1.0.0"');
  return `{\n${fields.join(',\n')}\n}\n`;
}

// A project whose committed engine.json declares `mode` as raw JSON text
function setUpMode(t, { enabled = true, mode, wiki: withWiki = false } = {}) {
  const project = setUp(t, { enabled, wiki: withWiki });
  const url = JSON.parse(read(project.dir, ENGINE_JSON)).repo;
  fs.writeFileSync(path.join(project.dir, ENGINE_JSON), engineText(url, { enabled, mode }));
  git(project.dir, 'commit', '-q', '--allow-empty', '-am', 'modo');
  return { ...project, url, head: git(project.dir, 'rev-parse', 'HEAD').trim() };
}

const modeOf = (dir) => JSON.parse(read(dir, ENGINE_JSON)).mode;
const linkExists = (dir) => {
  try {
    return fs.lstatSync(path.join(dir, '.claude', 'skills', 'wiki-manager')).isSymbolicLink();
  } catch {
    return false;
  }
};
// Every file of the engine copy, with its content (its .git aside)
function engineSnapshot(dir) {
  const root = path.join(dir, '.agents', 'wiki-engine');
  const files = {};
  const walk = (at) => {
    for (const entry of fs.readdirSync(at, { withFileTypes: true })) {
      const full = path.join(at, entry.name);
      if (entry.name === '.git') continue;
      if (entry.isDirectory()) walk(full);
      else files[path.relative(root, full)] = fs.readFileSync(full, 'utf8');
    }
  };
  if (fs.existsSync(root)) walk(root);
  return files;
}
const INVALID_MODES = ['"light"', '"Lite"', '""', 'lite', '3'];

test('mode inserts "mode" without rewriting the rest of engine.json', (t) => {
  const { dir } = setUpMode(t);
  const before = read(dir, ENGINE_JSON);
  const out = wikiMode(dir, 'lite');
  assert.equal(out.status, 0, out.stderr);
  const after = read(dir, ENGINE_JSON);
  assert.equal(modeOf(dir), 'lite', after);
  const rest = after.split('\n').filter((l) => !/"mode"/.test(l)).join('\n');
  assert.equal(rest, before, after);

  // On a single-line file too
  const { dir: other } = setUp(t);
  fs.writeFileSync(path.join(other, ENGINE_JSON), '{ "enabled": true, "repo": "x/y", "ref": "v1" }\n');
  assert.equal(wikiMode(other, 'lite').status, 0);
  assert.deepEqual(JSON.parse(read(other, ENGINE_JSON)), { enabled: true, mode: 'lite', repo: 'x/y', ref: 'v1' });
});

test('mode changes a declared "mode" in place', (t) => {
  const { dir } = setUp(t);
  const before = '{ "enabled": true, "mode": "full", "repo": "x/y", "ref": "v1" }\n';
  fs.writeFileSync(path.join(dir, ENGINE_JSON), before);
  assert.equal(wikiMode(dir, 'lite').status, 0);
  assert.equal(read(dir, ENGINE_JSON), before.replace('"full"', '"lite"'));
});

test('mode creates engine.json with only "mode" when it is missing or empty, and the wiki stays disabled', (t) => {
  for (const content of [null, '']) {
    const { dir } = setUp(t);
    if (content === null) fs.rmSync(path.join(dir, ENGINE_JSON));
    else fs.writeFileSync(path.join(dir, ENGINE_JSON), content);
    const out = wikiMode(dir, 'lite');
    assert.equal(out.status, 0, out.stderr);
    assert.deepEqual(JSON.parse(read(dir, ENGINE_JSON)), { mode: 'lite' }, String(content));
    assert.ok(out.lines.includes('enabled=false'), out.stdout);
    assert.ok(wiki(dir, 'status').lines.includes('enabled=false'));
  }
});

for (const enabled of [true, false]) {
  test(`mode leaves enabled, config.yaml and the engine alone with the wiki ${enabled ? 'enabled' : 'disabled'}`, (t) => {
    const { dir } = setUp(t);
    if (enabled) {
      wiki(dir, 'on');
      git(dir, 'commit', '-q', '-m', 'wiki on');
    }
    const config = read(dir, CONFIG);
    const engineCopy = engineSnapshot(dir);
    assert.notDeepEqual(engineCopy, {});
    const link = linkExists(dir);
    assert.equal(link, enabled);

    const out = wikiMode(dir, 'lite');
    assert.equal(out.status, 0, out.stderr);
    assert.equal(modeOf(dir), 'lite');
    assert.equal(enabledOf(dir), enabled);
    assert.equal(read(dir, CONFIG), config);
    assert.deepEqual(engineSnapshot(dir), engineCopy);
    assert.equal(linkExists(dir), link);
    assert.ok(out.lines.includes('changed=true'), out.stdout);
    assert.ok(out.lines.includes('mode=lite'), out.stdout);
    assert.ok(out.lines.includes(`enabled=${enabled}`), out.stdout);
  });
}

test('mode stages only engine.json and does not commit', (t) => {
  const { dir, head } = setUpMode(t);
  // An unstaged change elsewhere must stay unstaged
  fs.appendFileSync(path.join(dir, CONFIG), '# cambio sin stage\n');
  const out = wikiMode(dir, 'lite');
  assert.equal(out.status, 0, out.stderr);
  assert.deepEqual(staged(dir), [ENGINE_JSON]);
  assert.ok(out.lines.includes(`staged=${ENGINE_JSON}`), out.stdout);
  assert.equal(git(dir, 'rev-parse', 'HEAD').trim(), head, 'mode must not commit');
});

for (const [declared, requested] of [['"lite"', 'lite'], ['"full"', 'full'], [undefined, 'full']]) {
  test(`mode ${requested} with ${declared === undefined ? 'no mode declared' : `"mode": ${declared}`} changes nothing`, (t) => {
    const { dir } = setUpMode(t, { mode: declared });
    const before = read(dir, ENGINE_JSON);
    const out = wikiMode(dir, requested);
    assert.equal(out.status, 0, out.stderr);
    assert.equal(read(dir, ENGINE_JSON), before);
    assert.deepEqual(staged(dir), []);
    assert.ok(out.lines.includes('changed=false'), out.stdout);
    assert.ok(out.lines.includes(`mode=${requested}`), out.stdout);
    assert.ok(out.lines.includes('enabled=true'), out.stdout);
    assert.ok(!out.lines.some((l) => l.startsWith('staged=')), out.stdout);
  });
}

for (const invalid of INVALID_MODES) {
  test(`mode rewrites an invalid "mode": ${invalid}`, (t) => {
    for (const requested of ['full', 'lite']) {
      const { dir } = setUpMode(t, { mode: invalid });
      const before = read(dir, ENGINE_JSON);
      const out = wikiMode(dir, requested);
      assert.equal(out.status, 0, out.stderr);
      const after = read(dir, ENGINE_JSON);
      assert.equal(modeOf(dir), requested, after);
      assert.equal(after, before.replace(`"mode": ${invalid}`, `"mode": "${requested}"`));
      assert.ok(out.lines.includes('changed=true'), out.stdout);
      assert.deepEqual(staged(dir), [ENGINE_JSON]);
    }
  });
}

test('mode with any other argument writes nothing, warns with the modes that exist and exits with 0', (t) => {
  for (const value of ['light', 'Lite', 'FULL', '', 'lite extra']) {
    const { dir } = setUpMode(t);
    const before = read(dir, ENGINE_JSON);
    const out = wikiMode(dir, value);
    assert.equal(out.status, 0, `${value}: ${out.stderr}`);
    assert.equal(read(dir, ENGINE_JSON), before, value);
    assert.deepEqual(staged(dir), [], value);
    assert.match(out.stderr, /^session-start: .*\bfull\b.*\blite\b/m, `${value}: ${out.stderr}`);
  }
  for (const args of [['wiki', 'mode'], ['wiki', 'mode', 'lite'], ['wiki', 'mode', 'lite', '/no/existe']]) {
    const result = spawnSync('bash', [CORE, ...args], { encoding: 'utf8' });
    assert.equal(result.status, 0, `${args.join(' ')}: ${result.stderr}`);
  }
});

test('status prints the effective mode and warns of an invalid value', (t) => {
  for (const [declared, effective] of [[undefined, 'full'], ['"full"', 'full'], ['"lite"', 'lite']]) {
    const { dir } = setUpMode(t, { mode: declared });
    const out = wiki(dir, 'status');
    assert.equal(out.status, 0, out.stderr);
    assert.ok(out.lines.includes(`mode=${effective}`), `${declared}: ${out.stdout}`);
    assert.doesNotMatch(out.stderr, /modo del wiki/, out.stderr);
  }
  for (const invalid of INVALID_MODES) {
    const { dir } = setUpMode(t, { mode: invalid });
    const out = wiki(dir, 'status');
    assert.equal(out.status, 0, out.stderr);
    assert.ok(out.lines.includes('mode=full'), `${invalid}: ${out.stdout}`);
    assert.match(out.stderr, /^session-start: .*modo del wiki.*\bfull\b.*\blite\b/m, `${invalid}: ${out.stderr}`);
    assert.ok(out.stderr.includes(invalid), `${invalid}: ${out.stderr}`);

    // With the wiki disabled, the mode does not matter: no warning
    const { dir: off } = setUpMode(t, { enabled: false, mode: invalid });
    assert.doesNotMatch(wiki(off, 'status').stderr, /modo del wiki/, invalid);
  }
});

for (const declared of ['lite', 'full']) {
  test(`on and off keep "mode": "${declared}"`, (t) => {
    const { dir } = setUpMode(t, { enabled: false, mode: `"${declared}"` });
    assert.equal(wiki(dir, 'on').status, 0);
    assert.equal(enabledOf(dir), true);
    assert.equal(modeOf(dir), declared);
    assert.equal(wiki(dir, 'off').status, 0);
    assert.equal(enabledOf(dir), false);
    assert.equal(modeOf(dir), declared);
  });
}
