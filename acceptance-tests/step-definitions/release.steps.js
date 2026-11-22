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
const NOT_IN_SLIM = [/^openspec\/schemas\//, /^\.agents\//, /^\.opencode\//, /^\.claude\//, /^openspec\/changes\/archive\/./];

function release(world, tag, { laterCommit = false } = {}) {
  const project = world.ensureProject();
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
  assert.deepEqual(filesUnder(this.slimDir), expected);
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

When(/^se buscan en ella `openspec\/schemas\/`, `\.agents\/`, `\.opencode\/` y `\.claude\/`$/, function () {
  this.found = ['openspec/schemas', '.agents', '.opencode', '.claude'].filter((rel) => fs.existsSync(path.join(this.slimDir, rel)));
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
