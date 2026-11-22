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
const { CORE, runCore } = require('../support/core');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
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
  const result = runCore(['wiki', action, dir], { encoding: 'utf8', env });
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
    const result = runCore(args, { encoding: 'utf8' });
    assert.equal(result.status, 0, `${args.join(' ')}: ${result.stderr}`);
  }
});

test('the texts that travel with the distribution are read next to the core, not from the project', (t) => {
  const workDir = Machine.tmpDir();
  t.after(() => fs.rmSync(workDir, { recursive: true, force: true }));
  const dist = path.join(workDir, 'dist', '.agents');
  fs.mkdirSync(path.join(dist, 'hooks'), { recursive: true });
  fs.mkdirSync(path.join(dist, 'wiki'), { recursive: true });
  fs.copyFileSync(CORE, path.join(dist, 'hooks', 'session-bootstrap.mjs'));
  fs.writeFileSync(path.join(dist, 'wiki', 'guide.md'), 'GUIA-DE-LA-DISTRIBUCION\n');
  const project = path.join(workDir, 'project', '.agents', 'wiki');
  fs.mkdirSync(project, { recursive: true });
  fs.writeFileSync(path.join(project, 'engine.json'), '{ "enabled": true }\n');
  fs.writeFileSync(path.join(project, 'guide.md'), 'GUIA-DEL-PROYECTO\n');
  const env = { ...process.env };
  delete env.PROJECT_WIKI;
  const result = runCore(['guide', 'claude-code', path.join(workDir, 'project')], { encoding: 'utf8', env }, path.join(dist, 'hooks', 'session-bootstrap.mjs'));
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
  const result = runCore([dir], { encoding: 'utf8', env: machine.env() });
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
