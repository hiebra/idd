'use strict';

// Core test of the session bootstrap, outside the specs (design D8): if the
// project already has a skill or a command with the names the wiki engine
// uses, and it is not a symlink of the engine, the bootstrap does not
// overwrite it and warns. The rest of the engine is still linked.
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

function setUp() {
  const workDir = Machine.tmpDir();
  const machine = new Machine(workDir);
  // No npm: only the engine step of the bootstrap matters here, and it does not need Node
  machine.hasNpm = false;
  const engine = new FakeEngine(workDir);
  const project = new Project(path.join(workDir, 'project'), { engineUrl: engine.url });
  return { workDir, machine, project };
}

test('a project skill named like the engine skill is neither overwritten nor linked', (t) => {
  const { workDir, machine, project } = setUp();
  t.after(() => fs.rmSync(workDir, { recursive: true, force: true }));
  const own = project.engineLinkPath('wikiManager');
  fs.mkdirSync(own, { recursive: true });
  fs.writeFileSync(path.join(own, 'SKILL.md'), '---\nname: wiki-manager\ndescription: propia\n---\n');

  const session = new ClaudeCodeAgent().open({ machine, project, workDir });

  assert.equal(session.exitCode, 0, session.log);
  assert.equal(fs.lstatSync(own).isSymbolicLink(), false);
  assert.match(fs.readFileSync(path.join(own, 'SKILL.md'), 'utf8'), /description: propia/);
  assert.ok(
    session.warnings.some((w) => w.includes("'.claude/skills/wiki-manager'") && /no es del motor del wiki/.test(w)),
    JSON.stringify(session.warnings)
  );
  assert.equal(fs.lstatSync(project.engineLinkPath('wikiCommands')).isSymbolicLink(), true);
  assert.equal(fs.lstatSync(project.engineLinkPath('wikiQuery')).isSymbolicLink(), true);
});

test('a project command namespace named like the engine one is neither overwritten nor linked', (t) => {
  const { workDir, machine, project } = setUp();
  t.after(() => fs.rmSync(workDir, { recursive: true, force: true }));
  const own = project.engineLinkPath('wikiCommands');
  fs.mkdirSync(own, { recursive: true });
  fs.writeFileSync(path.join(own, 'propio.md'), 'comando propio\n');

  const session = new ClaudeCodeAgent().open({ machine, project, workDir });

  assert.equal(fs.lstatSync(own).isSymbolicLink(), false);
  assert.deepEqual(fs.readdirSync(own), ['propio.md']);
  assert.ok(session.warnings.some((w) => w.includes("'.claude/commands/wiki'")), JSON.stringify(session.warnings));
});

test('a stale symlink of the engine is replaced', (t) => {
  const { workDir, machine, project } = setUp();
  t.after(() => fs.rmSync(workDir, { recursive: true, force: true }));
  const link = project.engineLinkPath('wikiQuery');
  fs.mkdirSync(path.dirname(link), { recursive: true });
  fs.symlinkSync('../../.agents/wiki-engine/otra/ruta', link);

  const session = new ClaudeCodeAgent().open({ machine, project, workDir });

  assert.equal(fs.readlinkSync(link), '../../.agents/wiki-engine/plugins/llm-wiki-opencode/skills/wiki-query');
  assert.ok(!session.warnings.some((w) => w.includes('wiki-query')), JSON.stringify(session.warnings));
});
