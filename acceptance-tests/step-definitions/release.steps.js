'use strict';

// Steps of the release artifacts that can be checked without Windows
// (windows-global-distro, design D5 and D7): what scripts/release/build.mjs
// builds from a tag of the project copy.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { Given, When, Then } = require('@cucumber/cucumber');
const { git } = require('../support/engine');
const { tagRelease, buildRelease, unzip, filesUnder, artifactNames } = require('../support/release');

// What the slim template leaves out of the full template's tree (slim-template)
const NOT_IN_SLIM = [
  /^openspec\/schemas\//,
  /^\.agents\//,
  /^\.opencode\//,
  /^\.claude\//,
  /^openspec\/changes\/./,
  // What describes or tests the full template: its specs, its suite (which
  // the slim template replaces with an empty one) and its release tools
  /^openspec\/specs\/./,
  /^acceptance-tests\//,
  /^scripts\/release\//,
  /^\.github\/workflows\/release\.yml$/,
  // The template's own wiki: a slim project starts with the wiki disabled,
  // and /toggle-wiki proposes its own initial ingest
  /^\.wiki\//,
];

function release(world, tag, { laterCommit = false } = {}) {
  const project = world.ensureProject();
  // The tag of a real release has the template's wiki, which the copy leaves out
  if (!fs.existsSync(project.path('.wiki'))) project.addCommittedWiki();
  tagRelease(project, tag);
  if (laterCommit) {
    // A commit after the tag, which the release must not carry
    fs.appendFileSync(project.path('README.md'), '\nDespués del tag.\n');
    git(project.dir, 'commit', '-q', '-am', 'después del tag');
  }
  world.release = { tag, version: tag.replace(/^v/, ''), outDir: path.join(world.workDir, 'release') };
  return world.release;
}

function build(world) {
  const { tag, outDir } = world.release;
  world.release.artifacts = buildRelease({ project: world.project, tag, outDir, engineUrl: world.engine?.url ?? null });
  return world.release.artifacts;
}

function slim(world) {
  const artifacts = world.release.artifacts ?? build(world);
  world.slimDir = world.slimDir ?? unzip(artifacts.slim, path.join(world.workDir, 'slim'));
  return world.slimDir;
}

// --- La variante adelgazada -------------------------------------------------------------

Given(/^una release de la plantilla con el tag `(v[^`]+)`$/, function (tag) {
  release(this, tag, { laterCommit: true });
});

When('se genera su variante adelgazada', function () {
  slim(this);
});

Then(/^sale de la plantilla completa del tag `(v[^`]+)`$/, function (tag) {
  const tracked = git(this.project.dir, 'ls-tree', '-r', '--name-only', tag).split('\n').filter(Boolean);
  const expected = tracked.filter((file) => !NOT_IN_SLIM.some((re) => re.test(file))).sort();
  // The empty suite and the empty directories are not from the tag: their own scenarios check them
  const generated = (file) => file.startsWith('acceptance-tests/') || ['openspec/specs/.gitkeep', 'openspec/changes/archive/.gitkeep'].includes(file);
  assert.deepEqual(filesUnder(this.slimDir).filter((file) => !generated(file)), expected);
  for (const file of expected) {
    const atTag = git(this.project.dir, 'show', `${tag}:${file}`);
    assert.equal(fs.readFileSync(path.join(this.slimDir, file), 'utf8'), atTag, file);
  }
});

Then(/^se publica en la release `(v[^`]+)` junto al `\.bat`$/, function (tag) {
  const names = artifactNames(tag.replace(/^v/, ''));
  const out = fs.readdirSync(this.release.outDir).sort();
  for (const name of [names.slim, names.bat]) assert.ok(out.includes(name), `${name} is not among the release artifacts: ${out.join(', ')}`);
  assert.match(fs.readFileSync(path.join(this.release.outDir, names.bat), 'utf8'), new RegExp(`IDD_VERSION=${tag.replace(/^v/, '').replace(/\./g, '\\.')}\\b`));
});

Given('la variante adelgazada de una release', function () {
  release(this, 'v0.1.0');
  slim(this);
});

When(/^se buscan en ella `openspec\/schemas\/`, `\.agents\/`, `\.opencode\/`, `\.claude\/` y `\.wiki\/`$/, function () {
  this.found = ['openspec/schemas', '.agents', '.opencode', '.claude', '.wiki'].filter((rel) => fs.existsSync(path.join(this.slimDir, rel)));
});

Then('no está ninguno', function () {
  assert.deepEqual(this.found, []);
});

When(/^se lee su `openspec\/config\.yaml`$/, function () {
  this.slimConfig = fs.readFileSync(path.join(this.slimDir, 'openspec', 'config.yaml'), 'utf8');
});

Then('declara `schema: intent-driven`', function () {
  assert.match(this.slimConfig, /^schema:\s*intent-driven\s*$/m);
});

Then('el proyecto tiene un `package.json` con la versión de OpenSpec de la release', function () {
  const pkg = JSON.parse(fs.readFileSync(path.join(this.slimDir, 'package.json'), 'utf8'));
  const atTag = JSON.parse(git(this.project.dir, 'show', `${this.release.tag}:package.json`));
  assert.equal(pkg.devDependencies?.['@fission-ai/openspec'], atTag.devDependencies['@fission-ai/openspec']);
});

module.exports = { release, build, slim };

// --- Lo que instala el .bat, sin Windows -------------------------------------------------

const { GlobalInstall, scriptPathIn, corePathIn, GIT_DISCIPLINE } = require('../support/global');
const skills = require('../support/skills');

const SCHEMA_ORIGIN = JSON.parse(fs.readFileSync(path.join(__dirname, '..', '..', '.agents', 'release', 'origins.json'), 'utf8')).schema;

Given('una máquina Windows en la que se ha ejecutado el `.bat` de una release', function () {
  const { version } = release(this, 'v0.1.0');
  const artifacts = build(this);
  this.global = new GlobalInstall(this.workDir).installFromZip(artifacts.global, version);
  this.machine.globalInstall = this.global;
});

Then('OpenSpec resuelve el schema `intent-driven` instalado', function () {
  const result = this.session.run('openspec schema which intent-driven --json');
  const which = JSON.parse(result.stdout);
  assert.equal(which.source, 'user', result.stdout);
  assert.equal(which.path, this.global.schemaDir, result.stdout);
});

Then('OpenCode encuentra cada skill del `skills.txt` del schema una sola vez', function () {
  const ids = fs.readFileSync(path.join(this.global.schemaDir, 'skills.txt'), 'utf8').split('\n').map((l) => l.trim()).filter(Boolean);
  assert.ok(ids.length > 0);
  const project = skills.discoverSkills('OpenCode', this.project.dir).map((s) => s.id);
  const global = skills.discoverSkills('OpenCode', path.join(this.workDir, 'none'), { globalSkillsDir: this.global.skillsDir }).map((s) => s.id);
  for (const id of ids) {
    const copies = [...project, ...global].filter((found) => found === id).length;
    assert.equal(copies, 1, `OpenCode finds ${copies} copies of the skill '${id}'`);
  }
});

Then('OpenCode carga los plugins `openspec-autopilot`, `session-bootstrap` y `response-comments`', async function () {
  const { pathToFileURL } = require('node:url');
  for (const name of ['openspec-autopilot', 'session-bootstrap', 'response-comments']) {
    const server = path.join(this.global.pluginsDir, name, 'server.js');
    assert.ok(fs.existsSync(server), `${server} is missing`);
    const plugin = (await import(pathToFileURL(server).href)).default;
    assert.equal(typeof plugin?.setup, 'function', `${name} does not export { id, setup }`);
  }
  // The session ones did run: the bootstrap put the project's openspec in the PATH
  assert.equal(this.openspecVersionInSession(), this.project.pinnedOpenspecVersion(), this.session.log);
  // What OpenCode has of the wiki engine, for the steps of llm-wiki that follow;
  // the slim project has no skills, so they come from the global install
  this.loadWikiEngine('OpenCode');
});

When('se lee el `SKILL.md` de la skill `openspec-git-discipline` instalada', function () {
  this.installedSkill = fs.readFileSync(path.join(this.global.skillDir(GIT_DISCIPLINE), 'SKILL.md'), 'utf8');
});

Then('la ruta de `branch-change.mjs` que da es la del script instalado junto a la skill', function () {
  this.installedPath = scriptPathIn(this.installedSkill);
  assert.equal(this.installedPath, path.join(this.global.skillDir(GIT_DISCIPLINE), 'scripts', 'branch-change.mjs'));
  assert.ok(fs.existsSync(this.installedPath));
});

When('se lee el comando `\\/toggle-wiki` instalado', function () {
  this.installedCommand = fs.readFileSync(this.global.toggleWikiCommand, 'utf8');
});

Then('la ruta del núcleo del arranque que da es la del núcleo instalado con el plugin `session-bootstrap`', function () {
  this.installedPath = corePathIn(this.installedCommand);
  assert.equal(this.installedPath, this.global.bootstrapCore, this.installedCommand);
  assert.ok(fs.existsSync(this.installedPath));
});

Then('esa ruta es absoluta', function () {
  assert.ok(path.isAbsolute(this.installedPath), this.installedPath);
});

When('se compara el schema instalado con el del origen en la versión que fija la release', function () {
  const origin = path.join(this.workDir, 'schema-origin');
  fs.mkdirSync(origin);
  git(origin, 'init', '-q');
  git(origin, 'fetch', '-q', '--depth', '1', `https://github.com/${SCHEMA_ORIGIN.repo}.git`, SCHEMA_ORIGIN.commit);
  git(origin, '-c', 'advice.detachedHead=false', 'checkout', '-q', 'FETCH_HEAD');
  this.schemaOrigin = path.join(origin, ...SCHEMA_ORIGIN.path.split('/'));
});

Then('son idénticos', function () {
  const installed = filesUnder(this.global.schemaDir);
  assert.deepEqual(installed, filesUnder(this.schemaOrigin));
  for (const file of installed) {
    assert.ok(fs.readFileSync(path.join(this.global.schemaDir, file)).equals(fs.readFileSync(path.join(this.schemaOrigin, file))), file);
  }
});

// --- Sin las specs ni la suite de la plantilla ----------------------------------------------

const { spawnSync } = require('node:child_process');

When('se buscan en ella las specs, los steps y las herramientas de release de la plantilla', function () {
  this.slimFiles = filesUnder(this.slimDir);
});

Then(/^no hay ninguna spec en `openspec\/specs\/`$/, function () {
  assert.deepEqual(this.slimFiles.filter((file) => file.startsWith('openspec/specs/') && file.endsWith('.md')), []);
});

Then('la suite de aceptación no tiene steps ni soporte', function () {
  const suite = this.slimFiles.filter((file) => file.startsWith('acceptance-tests/'));
  assert.ok(suite.includes('acceptance-tests/cucumber.cjs'), suite.join('\n'));
  assert.deepEqual(suite.filter((file) => /^acceptance-tests\/(step-definitions|support|core-tests|release-tests)\/.*\.(c|m)?js$/.test(file)), []);
  // The skill's copies, as they are in the skill
  const skill = path.join(__dirname, '..', '..', '.agents', 'skills', 'acceptance-test-authoring', 'references');
  for (const [copy, original] of [
    ['cucumber.cjs', 'javascript/cucumber.cjs'],
    ['extract-gherkin.cjs', 'javascript/extract-gherkin.cjs'],
    ['openspec-effective-paths.cjs', 'javascript/openspec-effective-paths.cjs'],
    ['.gplintrc', 'gplintrc.json'],
  ]) {
    assert.equal(fs.readFileSync(path.join(this.slimDir, 'acceptance-tests', copy), 'utf8'), fs.readFileSync(path.join(skill, ...original.split('/')), 'utf8'), copy);
  }
});

Then('no tiene el workflow ni los scripts de release de la plantilla', function () {
  assert.deepEqual(this.slimFiles.filter((file) => file.startsWith('scripts/release/') || file === '.github/workflows/release.yml'), []);
});

When('se pasan en ella la suite de aceptación y el lint de las specs', function () {
  const suite = path.join(this.slimDir, 'acceptance-tests');
  const npm = (...args) => spawnSync('npm', args, { cwd: suite, encoding: 'utf8', shell: process.platform === 'win32', env: { ...process.env, OPENSPEC_TELEMETRY: '0' } });
  const install = npm('ci', '--no-audit', '--no-fund');
  assert.equal(install.status, 0, `${install.stdout}\n${install.stderr}`);
  this.slimRuns = { test: npm('test'), lint: npm('run', 'lint:specs') };
});

Then('los dos terminan con éxito, sin ningún escenario', function () {
  for (const [name, run] of Object.entries(this.slimRuns)) assert.equal(run.status, 0, `${name}:\n${run.stdout}\n${run.stderr}`);
  assert.match(this.slimRuns.test.stdout, /^0 scenarios/m, this.slimRuns.test.stdout);
});
