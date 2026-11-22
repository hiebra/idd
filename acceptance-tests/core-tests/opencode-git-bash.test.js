'use strict';

// Core test of the OpenCode bootstrap plugin on Windows, outside the specs
// (windows-support, design D5): how it finds Git for Windows' bash. Each case
// runs the plugin's server part in a child process that reports win32, with a
// fake `git` whose --exec-path names the case's install and a fake bash.exe
// that only logs its calls. The search is cached per process, so each case
// gets its own.
//
// Run with: npm run test:core

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const SERVER = path.join(REPO_ROOT, '.opencode', 'plugins', 'session-bootstrap', 'server.js');

// The child: reports win32, loads the server part, runs its setup with a
// minimal context and waits for the plugin's processes
const CHILD = `
Object.defineProperty(process, 'platform', { value: 'win32' });
const { pathToFileURL } = require('node:url');
(async () => {
  const plugin = (await import(pathToFileURL(process.argv[1]).href)).default;
  plugin.setup({
    location: { directory: process.argv[2] },
    rpc: { register: async () => ({ events: { emit() {} } }) },
    session: { hook: async () => ({ async dispose() {} }) },
    shell: { hook() { return { dispose() {} }; } },
  });
  setTimeout(() => {}, 1500);
})();
`;

function writeExecutable(file, content) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content, { mode: 0o755 });
}

// A machine with a git whose --exec-path is execPath, and a bash.exe at each of bashes
function run(t, { execPath, bashes = [], programFiles = null }) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'opencode-git-bash-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const log = path.join(dir, 'bash.log');
  const at = (rel) => path.join(dir, rel);
  for (const bash of bashes) writeExecutable(at(bash), `#!/bin/bash\necho "${at(bash)}" >> "${log}"\n`);
  writeExecutable(at('bin/git'), `#!/bin/bash\n[ "$1" = "--exec-path" ] && echo "${at(execPath)}"\n`);
  const project = at('proyecto');
  fs.mkdirSync(project);
  const env = { PATH: `${at('bin')}${path.delimiter}/usr/bin${path.delimiter}/bin`, HOME: dir };
  if (programFiles) env.ProgramFiles = at(programFiles);
  const child = spawnSync(process.execPath, ['-e', CHILD, SERVER, project], { env, encoding: 'utf8', timeout: 30000 });
  const calls = fs.existsSync(log) ? [...new Set(fs.readFileSync(log, 'utf8').split('\n').filter(Boolean))] : [];
  return { calls, stderr: child.stderr, at };
}

test('Git for Windows on mingw64: its bin/bash.exe', (t) => {
  const { calls, at } = run(t, { execPath: 'Git/mingw64/libexec/git-core', bashes: ['Git/bin/bash.exe'] });
  assert.deepEqual(calls, [at('Git/bin/bash.exe')]);
});

test('Git for Windows on mingw32: its bin/bash.exe', (t) => {
  const { calls, at } = run(t, { execPath: 'Git/mingw32/libexec/git-core', bashes: ['Git/bin/bash.exe'] });
  assert.deepEqual(calls, [at('Git/bin/bash.exe')]);
});

test('an install path with spaces', (t) => {
  const { calls, at } = run(t, { execPath: 'Program Files/Git/mingw64/libexec/git-core', bashes: ['Program Files/Git/bin/bash.exe'] });
  assert.deepEqual(calls, [at('Program Files/Git/bin/bash.exe')]);
});

test('a git in PATH that is not Git for Windows: the default install', (t) => {
  const { calls, at } = run(t, {
    execPath: 'usr/lib/git-core',
    bashes: ['ProgramFiles/Git/bin/bash.exe'],
    programFiles: 'ProgramFiles',
  });
  assert.deepEqual(calls, [at('ProgramFiles/Git/bin/bash.exe')]);
});

test('neither Git for Windows nor the default install: a warning, and no bash runs', (t) => {
  const { calls, stderr } = run(t, { execPath: 'usr/lib/git-core', programFiles: 'ProgramFiles' });
  assert.deepEqual(calls, []);
  assert.match(stderr, /necesita Git for Windows/);
});
