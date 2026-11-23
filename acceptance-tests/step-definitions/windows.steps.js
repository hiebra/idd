'use strict';

// Steps that run the release's .bat with cmd.exe (windows-scenarios.cjs):
// they only run on Windows, in the `windows` profile of the release
// workflow's Windows job (design D7 of windows-global-distro). Each release
// is a tag of the project copy, built with scripts/release/build.mjs and
// served by a local HTTP server in place of GitHub.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { Given, When, Then } = require('@cucumber/cucumber');
const { tagRelease, buildRelease, unzip, filesUnder, artifactNames } = require('../support/release');
const { GlobalInstall, scriptPathIn, corePathIn, GIT_DISCIPLINE } = require('../support/global');
const { WindowsProfile, ReleaseServer, runBat, onPath } = require('../support/windows');

const outDir = (world) => path.join(world.workDir, 'release');

async function releaseServer(world) {
  if (!world.releaseServer) world.releaseServer = await new ReleaseServer(outDir(world)).start();
  return world.releaseServer;
}

function profile(world, options) {
  world.win = world.win ?? new WindowsProfile(world.workDir, options);
  return world.win;
}

// A file that only one version of the release carries, in one of its skills,
// to check that an update leaves nothing of the version it replaces
const onlyIn = (world, version) => world.project.path('.agents', 'skills', 'grill-me', `solo-${version}.md`);

// Tags a version of the release on the project copy
function tagVersion(world, version) {
  const project = world.ensureProject();
  const dir = path.dirname(onlyIn(world, version));
  for (const name of fs.readdirSync(dir)) if (/^solo-.*\.md$/.test(name)) fs.rmSync(path.join(dir, name));
  fs.writeFileSync(onlyIn(world, version), `Solo en la versión ${version}.\n`);
  const tag = `v${version}`;
  tagRelease(project, tag);
  return tag;
}

// Builds the artifacts of a tag, with the URLs of the local server
async function buildTag(world, tag) {
  const server = await releaseServer(world);
  world.builds = world.builds ?? {};
  if (!world.builds[tag]) {
    world.builds[tag] = buildRelease({ project: world.ensureProject(), tag, outDir: outDir(world), engineUrl: world.engine?.url ?? null, baseUrl: server.url });
  }
  return world.builds[tag];
}

// Runs the .bat of a tag on the scenario's profile
async function runRelease(world, tag) {
  const artifacts = await buildTag(world, tag);
  const server = await releaseServer(world);
  const win = profile(world);
  world.requestsBefore = server.requests.length;
  world.snapshotBefore = win.snapshot();
  world.batRun = await runBat(artifacts.bat, win.env());
  world.batRun.log = `exit ${world.batRun.status}\nstdout:\n${world.batRun.stdout}\nstderr:\n${world.batRun.stderr}`;
  return world.batRun;
}

// Installs a version on the profile with its .bat, as the setup of a scenario
async function installVersion(world, version) {
  const tag = world.project && hasTag(world, `v${version}`) ? `v${version}` : tagVersion(world, version);
  const run = await runRelease(world, tag);
  assert.equal(run.status, 0, run.log);
  assert.equal(profile(world).installedVersion(), version, run.log);
}

function hasTag(world, tag) {
  return spawnSync('git', ['rev-parse', '-q', '--verify', `refs/tags/${tag}`], { cwd: world.project.dir }).status === 0;
}

// The global install that a real .bat left, for the steps that follow
async function installWithBat(world) {
  const win = profile(world, { xdg: true });
  const tag = tagVersion(world, '0.1.0');
  const run = await runRelease(world, tag);
  assert.equal(run.status, 0, run.log);
  world.global = new GlobalInstall(world.workDir, { data: win.data, config: win.config });
  world.machine.globalInstall = world.global;
}

// --- La release y su .bat -------------------------------------------------------------

When('se ejecuta su `.bat` en una máquina Windows sin instalación previa', async function () {
  assert.equal(profile(this).installedVersion(), null);
  await runRelease(this, this.release.tag);
});

Then(/^queda instalada la versión `([^`]+)`$/, function (version) {
  assert.equal(this.batRun.status, 0, this.batRun.log);
  assert.equal(this.win.installedVersion(), version, this.batRun.log);
});

Given('una máquina Windows con `curl.exe` y `tar.exe` y sin git ni Node', function () {
  const root = process.env.SystemRoot || 'C:\\Windows';
  const searchPath = [path.join(root, 'System32'), root].join(path.delimiter);
  for (const command of ['curl', 'tar']) assert.ok(onPath(command, searchPath), `${command}.exe is not in ${searchPath}`);
  for (const command of ['git', 'node']) assert.ok(!onPath(command, searchPath), `${command} is in ${searchPath}`);
  profile(this, { path: searchPath });
});

Given(/^una máquina Windows con (`XDG_DATA_HOME` y `XDG_CONFIG_HOME` definidas|ninguna variable XDG definida)$/, function (variables) {
  profile(this, { xdg: variables.startsWith('`XDG') });
});

When('se ejecuta el `.bat` de una release', async function () {
  await runRelease(this, tagVersion(this, '0.1.0'));
});

Then('la instalación termina con éxito', function () {
  assert.equal(this.batRun.status, 0, this.batRun.log);
  assert.equal(this.win.installedVersion(), '0.1.0', this.batRun.log);
});

// --- Dónde queda cada cosa --------------------------------------------------------------

// A path of the scenario, expanded in the profile, and that the other
// location (with XDG or without it) has nothing of the install
function installedAt(world, text, inside) {
  assert.equal(world.batRun.status, 0, world.batRun.log);
  // The values of the Examples table bring their own backticks
  const dir = world.win.expand(text.replaceAll('`', ''));
  assert.ok(fs.existsSync(path.join(dir, ...inside)), `${path.join(dir, ...inside)} is missing\n${world.batRun.log}`);
  return dir;
}

Then(/^el schema `intent-driven` queda en `(.+)`$/, function (text) {
  installedAt(this, text, ['schema.yaml']);
  if (this.win.vars.XDG_DATA_HOME) assert.ok(!fs.existsSync(path.join(this.win.vars.LOCALAPPDATA, 'openspec')));
});

Then(/^el motor del wiki queda en `(.+)`$/, function (text) {
  installedAt(this, text, ['claude-plugin']);
});

Then(/^las skills quedan en `(.+)`$/, function (text) {
  const dir = installedAt(this, text, [GIT_DISCIPLINE, 'SKILL.md']);
  for (const id of ['wiki-query', 'wiki-manager']) assert.ok(fs.existsSync(path.join(dir, id, 'SKILL.md')), id);
  if (this.win.vars.XDG_CONFIG_HOME) assert.ok(!fs.existsSync(path.join(this.win.vars.USERPROFILE, '.config')));
});

Then(/^los plugins quedan en `(.+)`$/, function (text) {
  const dir = installedAt(this, text, ['session-bootstrap', 'server.js']);
  for (const name of ['openspec-autopilot', 'response-comments']) assert.ok(fs.existsSync(path.join(dir, name, 'server.js')), name);
});

// --- Instalar o actualizar --------------------------------------------------------------

Given(/^una máquina Windows con la versión `([^`]+)` instalada$/, async function (version) {
  profile(this);
  await installVersion(this, version);
  // A skill of the user's own, which no install may touch
  this.ownSkill = path.join(this.win.config, 'opencode', 'skills', 'mia', 'SKILL.md');
  fs.mkdirSync(path.dirname(this.ownSkill), { recursive: true });
  fs.writeFileSync(this.ownSkill, '---\nname: mia\ndescription: Una skill del usuario.\n---\n');
});

When(/^se ejecuta el `\.bat` de la release `(v[^`]+)`$/, async function (tag) {
  const version = tag.slice(1);
  await runRelease(this, hasTag(this, tag) ? tag : tagVersion(this, version));
});

Then('no se descarga nada', function () {
  assert.deepEqual(this.releaseServer.requests.slice(this.requestsBefore), [], this.batRun.log);
});

Then('no cambia ningún archivo instalado', function () {
  assert.deepEqual(this.win.snapshot(), this.snapshotBefore, this.batRun.log);
});

Then(/^se indica que la versión `([^`]+)` ya está instalada$/, function (version) {
  assert.equal(this.batRun.status, 0, this.batRun.log);
  assert.match(this.batRun.stdout, new RegExp(`idd ${version.replace(/\./g, '\\.')} ya esta instalada`), this.batRun.log);
});

Then(/^no queda ningún archivo de la versión `([^`]+)` que la `([^`]+)` no traiga$/, function (old, current) {
  assert.ok(!fs.existsSync(path.join(this.win.config, 'opencode', 'skills', 'grill-me', `solo-${old}.md`)), this.batRun.log);
  // Each installed entry holds exactly what the zip of the new version brings
  const zip = path.join(outDir(this), artifactNames(current).global);
  const unpacked = unzip(zip, path.join(this.workDir, `unpacked-${current}`));
  const entries = fs.readFileSync(path.join(this.win.data, 'idd', 'installed.txt'), 'utf8').split(/\r?\n/).filter(Boolean);
  for (const entry of entries) {
    const [root, ...rest] = entry.split('\\');
    const target = path.join(root === 'data' ? this.win.data : this.win.config, ...rest);
    // The /toggle-wiki command is a file that the .bat writes from the pieces of the zip
    if (rest.at(-2) === 'commands') {
      assert.equal(corePathIn(fs.readFileSync(target, 'utf8')), path.join(this.win.config, 'opencode', 'plugins', 'session-bootstrap', 'session-bootstrap.mjs'), entry);
      continue;
    }
    const expected = filesUnder(path.join(unpacked, root, ...rest));
    if (rest.at(-1) === GIT_DISCIPLINE) expected.push('SKILL.md');
    assert.deepEqual(filesUnder(target), expected.sort(), entry);
  }
  // The user's own skill is still there
  assert.ok(fs.existsSync(this.ownSkill), this.batRun.log);
});

Given(/^la descarga de la release `(v[^`]+)` falla$/, async function (tag) {
  const built = await buildTag(this, hasTag(this, tag) ? tag : tagVersion(this, tag.slice(1)));
  this.releaseServer.fail(path.basename(built.global));
});

Then(/^sigue instalada la versión `([^`]+)`$/, function (version) {
  assert.equal(this.win.installedVersion(), version, this.batRun.log);
  assert.deepEqual(this.win.snapshot(), this.snapshotBefore, this.batRun.log);
});

Then('se indica que la instalación ha fallado', function () {
  assert.notEqual(this.batRun.status, 0, this.batRun.log);
  assert.match(`${this.batRun.stdout}${this.batRun.stderr}`, /ha fallado/, this.batRun.log);
});

// --- Un proyecto adelgazado ---------------------------------------------------------------

Then('la puerta `check propose` de `branch-change.mjs` responde sobre el proyecto', function () {
  const skill = fs.readFileSync(path.join(this.global.skillDir(GIT_DISCIPLINE), 'SKILL.md'), 'utf8');
  const script = scriptPathIn(skill);
  assert.ok(script && path.isAbsolute(script), skill);
  const result = spawnSync(process.execPath, [script, 'check', 'propose'], { cwd: this.project.dir, encoding: 'utf8', env: this.machine.env() });
  const gate = JSON.parse(result.stdout);
  assert.equal(typeof gate.ok, 'boolean', result.stdout);
  assert.equal(typeof gate.message, 'string', result.stdout);
  // It speaks of the project's branch
  const branch = spawnSync('git', ['symbolic-ref', '--short', 'HEAD'], { cwd: this.project.dir, encoding: 'utf8' }).stdout.trim();
  assert.match(gate.message, new RegExp(branch), result.stdout);
});

module.exports = { installWithBat };
