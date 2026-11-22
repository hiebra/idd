'use strict';

// Core test of the session bootstrap, outside the specs (design D5): when a
// rule other than an exact `.wiki` or `.wiki/` line ignores files of .wiki/,
// the bootstrap does not touch .gitignore and only warns.
//
// Run with: npm run test:core

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { Machine } = require('../support/machine');
const { Project } = require('../support/project');
const { FakeEngine } = require('../support/engine');
const { ClaudeCodeAgent } = require('../support/agents/claude-code');

test('.wiki/ ignored by another rule: .gitignore is kept and the user is warned', (t) => {
  const workDir = Machine.tmpDir();
  t.after(() => fs.rmSync(workDir, { recursive: true, force: true }));
  const machine = new Machine(workDir);
  machine.hasNpm = false;
  const engine = new FakeEngine(workDir);
  const project = new Project(path.join(workDir, 'project'), { engineUrl: engine.url });
  project.setWikiEnabled(true);
  fs.mkdirSync(project.path('.wiki'), { recursive: true });
  fs.writeFileSync(project.path('.wiki', 'index.md'), '# Wiki\n');
  fs.appendFileSync(project.path('.gitignore'), '.wiki/*.md\n');
  const before = fs.readFileSync(project.path('.gitignore'), 'utf8');

  const session = new ClaudeCodeAgent().open({ machine, project, workDir });

  assert.equal(fs.readFileSync(project.path('.gitignore'), 'utf8'), before);
  assert.ok(session.warnings.some((w) => /ignora archivos de \.wiki\/ por otra regla/.test(w)), JSON.stringify(session.warnings));
});
