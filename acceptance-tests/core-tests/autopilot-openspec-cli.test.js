'use strict';

// Core test of the autopilot plugin, outside the specs (windows-support,
// design D6): which OpenSpec CLI it runs. With the project's package, its
// script with `node`, whatever node_modules/.bin/ holds; without it, the
// `openspec` of the PATH.
//
// Run with: npm run test:core

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { pathToFileURL } = require('node:url');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const PROJECT_LIB = path.join(REPO_ROOT, '.opencode', 'plugins', 'openspec-autopilot', 'lib', 'project.mjs');

function writeExecutable(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content, { mode: 0o755 });
}

// A project directory, and a PATH with node and a fake global openspec that answers { cli: "global" }
function setUp(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'autopilot-cli-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  writeExecutable(path.join(dir, 'bin', 'openspec'), '#!/bin/sh\necho \'{"cli":"global"}\'\n');
  const previous = process.env.PATH;
  process.env.PATH = [path.join(dir, 'bin'), path.dirname(process.execPath), previous].join(path.delimiter);
  t.after(() => (process.env.PATH = previous));
  const project = path.join(dir, 'proyecto');
  fs.mkdirSync(project);
  return project;
}

test('without the project CLI, the openspec of the PATH', async (t) => {
  const project = setUp(t);
  const { openspecStatus } = await import(pathToFileURL(PROJECT_LIB).href);
  assert.deepEqual(await openspecStatus(project, 'x'), { cli: 'global' });
});

test('with the project package, its script with node, even with no node_modules/.bin/', async (t) => {
  const project = setUp(t);
  const pkg = path.join(project, 'node_modules', '@fission-ai', 'openspec');
  fs.mkdirSync(path.join(pkg, 'bin'), { recursive: true });
  fs.writeFileSync(path.join(pkg, 'package.json'), JSON.stringify({ name: '@fission-ai/openspec', bin: { openspec: './bin/openspec.js' } }));
  fs.writeFileSync(path.join(pkg, 'bin', 'openspec.js'), "process.stdout.write(JSON.stringify({ cli: 'project', args: process.argv.slice(2) }));\n");
  const { openspecStatus } = await import(pathToFileURL(PROJECT_LIB).href);
  assert.deepEqual(await openspecStatus(project, 'x'), { cli: 'project', args: ['status', '--change', 'x', '--json'] });
});
