'use strict';

// The session bootstrap core, for the tests that run it directly
// (core-tests/): its path in the repository and how to launch it. It is the
// only place that names the core, so that the core can change without
// touching each test.

const path = require('node:path');
const { spawnSync } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const CORE = path.join(REPO_ROOT, '.agents', 'hooks', 'session-bootstrap.mjs');

// The command line that runs the core with the given arguments
function coreCommand(args, core = CORE) {
  return core.endsWith('.mjs') ? [process.execPath, [core, ...args]] : ['bash', [core, ...args]];
}

// Runs the core as spawnSync does, with the same options
function runCore(args, options = {}, core = CORE) {
  const [command, argv] = coreCommand(args, core);
  return spawnSync(command, argv, options);
}

module.exports = { CORE, coreCommand, runCore };
