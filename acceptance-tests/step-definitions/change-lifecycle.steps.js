'use strict';

// Steps of openspec-change-lifecycle (add-openspec-autopilot, design D1, D2).
// What a branch's change is comes from .agents/openspec/branch-change.mjs of
// the project copy; the gates of the cycle are its `check` subcommand, which
// the openspec-git-discipline skill runs and obeys. The suite cannot run the
// workflows' model, so it checks the gate and that the skill uses it.

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { Given, When, Then } = require('@cucumber/cucumber');
const { git } = require('../support/engine');

const SKILL = path.join('.agents', 'skills', 'openspec-git-discipline', 'SKILL.md');
const TEMP_BRANCH = 'feature/cambio';

function readSkill(world) {
  return fs.readFileSync(world.lifecycleProject().path(SKILL), 'utf8');
}

// The part of the skill under a section marker (<!-- lifecycle:<id> -->)
function skillSection(world, id) {
  const text = readSkill(world);
  const marker = `<!-- lifecycle:${id} -->`;
  const at = text.indexOf(marker);
  assert.ok(at !== -1, `the openspec-git-discipline skill has no section ${marker}`);
  const next = text.indexOf('<!-- lifecycle:', at + marker.length);
  return text.slice(at + marker.length, next === -1 ? undefined : next);
}

function describeState(state) {
  return JSON.stringify(state);
}

// --- Ramas permanentes ----------------------------------------------------------

Given('un proyecto cuyo `openspec\\/config.yaml` no tiene la clave `x-main`', function () {
  this.branches.setPermanent(this.lifecycleProject(), null);
});

Given('un proyecto con `x-main: [main, develop]` en `openspec\\/config.yaml`', function () {
  const project = this.lifecycleProject();
  this.branches.setPermanent(project, ['main', 'develop']);
  git(project.dir, 'branch', 'develop');
});

When('se consultan las ramas permanentes del proyecto', function () {
  this.branchState = this.branches.branchChange(this.project);
});

Then('la única rama permanente es `main`', function () {
  assert.deepEqual(this.branchState.permanent, ['main'], describeState(this.branchState));
});

Then('las ramas permanentes son `main` y `develop`', function () {
  assert.deepEqual(this.branchState.permanent, ['main', 'develop'], describeState(this.branchState));
});

Then(/^la rama de origen es `([^`]+)`$/, function (origin) {
  assert.equal(this.branchState.origin, origin, describeState(this.branchState));
});

When(/^el clon está en (la rama `[^`]+`|un commit con HEAD separado)$/, function (position) {
  const project = this.project;
  const name = /`([^`]+)`/.exec(position)?.[1];
  if (!name) this.branches.detach(project);
  else if (this.branches.currentBranch(project) !== name) {
    const exists = git(project.dir, 'branch', '--list', name).trim() !== '';
    if (exists) this.branches.checkout(project, name);
    else this.branches.branch(project, name, { from: 'develop' });
  }
  this.position = name ?? null;
  this.branchState = this.branches.branchChange(project);
});

Then('no hay rama temporal', function () {
  assert.equal(this.branchState.kind, 'permanent', describeState(this.branchState));
});

Then('la rama temporal es la suya', function () {
  assert.notEqual(this.branchState.kind, 'permanent', describeState(this.branchState));
  assert.equal(this.branchState.branch, this.position, describeState(this.branchState));
});

// OpenSpec with and without the key: same exit codes, and nothing about it
When('se ejecutan `openspec list`, `openspec status`, `openspec instructions` y `openspec validate`', function () {
  const project = this.project;
  this.branches.branch(project, 'feature/exportar', { from: 'develop' });
  this.branches.addChange(project, 'exportar-datos', { planned: true });
  const commands = [
    ['list', '--json'],
    ['status', '--change', 'exportar-datos', '--json'],
    ['instructions', 'apply', '--change', 'exportar-datos', '--json'],
    ['validate', 'exportar-datos', '--type', 'change'],
  ];
  const run = () => commands.map((args) => ({ args, ...this.branches.openspec(project, args) }));
  this.withKey = run();
  const config = project.path('openspec', 'config.yaml');
  const saved = fs.readFileSync(config, 'utf8');
  fs.writeFileSync(config, saved.replace(/^x-main:.*\n/m, ''));
  this.withoutKey = run();
  fs.writeFileSync(config, saved);
});

Then('ninguno falla ni avisa por la clave `x-main`', function () {
  this.withKey.forEach((result, i) => {
    const detail = `openspec ${result.args.join(' ')} (exit ${result.exitCode}):\n${result.stdout}\n${result.stderr}`;
    assert.equal(result.exitCode, this.withoutKey[i].exitCode, `exit code differs with x-main:\n${detail}`);
    assert.doesNotMatch(`${result.stdout}\n${result.stderr}`, /x-main/, detail);
  });
  const [list, status, instructions] = this.withKey;
  for (const result of [list, status, instructions]) {
    assert.equal(result.exitCode, 0, `openspec ${result.args.join(' ')} failed:\n${result.stdout}\n${result.stderr}`);
  }
});

// --- El change de una rama temporal -------------------------------------------

Given('una rama temporal que sale de la rama de origen', function () {
  this.branches.branch(this.lifecycleProject(), TEMP_BRANCH);
});

const CONTENTS = {
  nada: () => {},
  '`exportar-datos/`, sin commit': (world) => world.branches.addChange(world.project, 'exportar-datos'),
  '`exportar-datos/`, con commit': (world) => {
    world.branches.addChange(world.project, 'exportar-datos');
    world.branches.commitAll(world.project, 'propuesta de exportar-datos');
  },
  '`archive/2026-11-21-exportar-datos/`': (world) => {
    world.branches.addChange(world.project, 'exportar-datos', { planned: true });
    world.branches.commitAll(world.project, 'exportar-datos');
    world.branches.archiveChange(world.project, 'exportar-datos', '2026-11-21');
  },
  '`exportar-datos/` y `importar-datos/`': (world) => {
    world.branches.addChange(world.project, 'exportar-datos');
    world.branches.addChange(world.project, 'importar-datos');
  },
};

Given(/^desde su merge-base ha cambiado en `openspec\/changes\/` (.+)$/, function (content) {
  assert.ok(CONTENTS[content], `unknown content: ${content}`);
  CONTENTS[content](this);
});

Given('una rama de origen con el change en curso `importar-datos`', function () {
  const project = this.lifecycleProject();
  this.branches.addChange(project, 'importar-datos');
  this.branches.commitAll(project, 'importar-datos en la rama de origen');
});

Given('una rama temporal que sale de ella después de ese change', function () {
  this.branches.branch(this.project, TEMP_BRANCH);
});

When(/^se consulta el change de la rama(?: temporal)?$/, function () {
  this.branchState = this.branches.branchChange(this.project);
});

Then(/^la rama está (sin change|con el change en curso `[^`]+`|con el change archivado `[^`]+`|con varios changes)$/, function (state) {
  const name = /`([^`]+)`/.exec(state)?.[1];
  const active = state.includes('en curso') ? name : null;
  const archived = state.includes('archivado') ? name : null;
  const detail = describeState(this.branchState);
  if (state === 'sin change') assert.equal(this.branchState.kind, 'none', detail);
  else if (active) {
    assert.equal(this.branchState.kind, 'active', detail);
    assert.equal(this.branchState.change, active, detail);
  } else if (archived) {
    assert.equal(this.branchState.kind, 'archived', detail);
    assert.equal(this.branchState.change, archived, detail);
  } else assert.equal(this.branchState.kind, 'several', detail);
});

// --- Una rama y una sola fusión -------------------------------------------------

Given('una rama temporal con el change en curso `exportar-datos`', function () {
  const project = this.lifecycleProject();
  this.branches.branch(project, TEMP_BRANCH);
  this.branches.addChange(project, 'exportar-datos', { planned: true });
});

Given('la propuesta de `exportar-datos` tiene commit en la rama temporal y no está en la rama de origen', function () {
  const project = this.project;
  this.branches.commitAll(project, 'propuesta de exportar-datos');
  assert.equal(git(project.dir, 'ls-tree', '-d', '--name-only', 'main', 'openspec/changes/exportar-datos').trim(), '');
});

When('se lanza el apply de `exportar-datos`', function () {
  this.gate = this.branches.checkGate(this.project, 'apply', 'exportar-datos');
});

Then('el apply no se detiene porque la propuesta no esté en la rama de origen', function () {
  assert.equal(this.gate.ok, true, JSON.stringify(this.gate));
  assert.equal(this.gate.exitCode, 0);
  // The skill the workflows load runs the gate and no longer asks for the origin branch
  const apply = skillSection(this, 'apply');
  assert.match(apply, /branch-change\.mjs check apply/);
  assert.doesNotMatch(readSkill(this), /(merge|merged|fusiona\w*|commit\w*) .*(to|a|en|con) `?main`? before apply|reached `main`|antes del apply.*rama de origen/i);
});

Given('una rama temporal con el change `exportar-datos` implementado', function () {
  const project = this.lifecycleProject();
  this.branches.branch(project, TEMP_BRANCH);
  this.branches.addChange(project, 'exportar-datos', { planned: true, tasks: [{ id: '1.1', done: true }] });
  this.branches.commitAll(project, 'exportar-datos implementado');
});

Given('la implementación no está fusionada con la rama de origen', function () {
  const merged = git(this.project.dir, 'branch', '--merged', 'main', '--list', TEMP_BRANCH).trim();
  assert.equal(merged, '', 'the temporary branch is merged into main');
});

When('se lanza el archive de `exportar-datos` en la rama temporal', function () {
  const project = this.project;
  this.gate = this.branches.checkGate(project, 'archive', 'exportar-datos');
  assert.equal(this.gate.ok, true, JSON.stringify(this.gate));
  this.archived = this.branches.openspec(project, ['archive', 'exportar-datos', '--yes']);
  this.branchState = this.branches.branchChange(project);
});

Then('el change queda archivado en la rama temporal', function () {
  const detail = `${describeState(this.branchState)}\n${this.archived.stdout}\n${this.archived.stderr}`;
  assert.equal(this.archived.exitCode, 0, detail);
  assert.equal(this.branchState.branch, TEMP_BRANCH, detail);
  assert.equal(this.branchState.kind, 'archived', detail);
  assert.equal(this.branchState.change, 'exportar-datos', detail);
});

Then('la resincronización del wiki se hace en la rama temporal, después del commit del archive', function () {
  // The archive guidance of openspec/config.yaml, as `openspec instructions` gives it
  const config = fs.readFileSync(this.project.path('openspec', 'config.yaml'), 'utf8');
  assert.match(config, /rama temporal/);
  assert.doesNotMatch(config, /tras fusionarla/);
  assert.match(config, /después del commit del archivado/);
  const archive = skillSection(this, 'archive');
  assert.match(archive, /branch-change\.mjs check archive/);
  assert.match(archive, /rama temporal/);
  assert.match(skillSection(this, 'commits'), /wiki/);
});

Given('el clon está en la rama de origen', function () {
  this.branches.checkout(this.lifecycleProject(), 'main');
});

When('se lanza el archive de un change', function () {
  this.gate = this.branches.checkGate(this.project, 'archive', 'exportar-datos');
});

Then('el archive se detiene', function () {
  assert.equal(this.gate.ok, false, JSON.stringify(this.gate));
  assert.equal(this.gate.exitCode, 1);
  assert.match(skillSection(this, 'archive'), /(detente|no archives|para)/i);
});

Then('se indica que el archive se hace en la rama temporal del change', function () {
  assert.match(this.gate.message, /rama temporal del change/, JSON.stringify(this.gate));
});

// --- Commits del usuario -----------------------------------------------------------

When('un workflow termina un artefacto de `exportar-datos`', function () {
  const project = this.project;
  this.branches.commitAll(project, 'exportar-datos');
  const before = git(project.dir, 'rev-parse', 'HEAD').trim();
  fs.appendFileSync(project.path('openspec', 'changes', 'exportar-datos', 'design.md'), '\nDecisión nueva.\n');
  this.headBefore = before;
});

Then('el artefacto queda sin commit', function () {
  const project = this.project;
  assert.equal(git(project.dir, 'rev-parse', 'HEAD').trim(), this.headBefore);
  assert.ok(project.gitStatus().some((line) => line.includes('openspec/changes/exportar-datos/design.md')), project.gitStatus().join('\n'));
  // Nothing in the cycle makes commits, branches or merges on its own
  const commits = skillSection(this, 'commits');
  assert.match(commits, /nunca (hagas|hace)s? (tú )?commits?, ramas ni fusiones/i);
});

Then('se pide al usuario que haga el commit', function () {
  const commits = skillSection(this, 'commits');
  for (const moment of [/artefacto/, /task/, /archive/, /wiki/]) assert.match(commits, moment);
  assert.match(commits, /pide al usuario (que haga )?el commit/i);
});

// --- La referencia de origen (manage-git-discipline, D1, D2) ------------------------

Given('una rama de origen remota con el change archivado `importar-datos`', function () {
  const project = this.lifecycleProject();
  this.branches.remoteCommit(project, {
    'openspec/changes/archive/2026-11-21-importar-datos/proposal.md': '## Why\n\nPrueba de importar-datos.\n',
  }, { message: 'archiva importar-datos' });
});

Given('la rama de origen local está atrasada y no tiene ese change', function () {
  const project = this.project;
  assert.notEqual(this.branches.revParse(project, 'refs/heads/main'), this.branches.revParse(project, 'refs/remotes/origin/main'));
  assert.equal(git(project.dir, 'ls-tree', '-d', '--name-only', 'main', 'openspec/changes/archive/2026-11-21-importar-datos').trim(), '');
});

Given('una rama temporal que sale de la rama de origen remota', function () {
  this.branches.branch(this.project, TEMP_BRANCH, { from: 'origin/main' });
});

Given('la rama de origen local y la remota han divergido', function () {
  const project = this.lifecycleProject();
  this.branches.remoteCommit(project, { 'remoto.txt': 'remoto\n' }, { message: 'commit solo en el remoto' });
  fs.writeFileSync(project.path('local.txt'), 'local\n');
  this.branches.commitAll(project, 'commit solo en la rama local');
});

Given('una rama temporal que sale de la rama de origen local', function () {
  this.branches.branch(this.project, TEMP_BRANCH, { from: 'main' });
});

Then('el merge-base se calcula contra la rama de origen local', function () {
  assert.equal(this.branchState.originRef, 'refs/heads/main', describeState(this.branchState));
});

Then('se avisa de que la rama de origen local y la remota han divergido', function () {
  assert.match(this.branchState.warnings.join('\n'), /divergido/, describeState(this.branchState));
});

Given('una rama temporal con el change archivado `exportar-datos`', function () {
  const project = this.lifecycleProject();
  this.branches.branch(project, TEMP_BRANCH);
  this.branches.addChange(project, 'exportar-datos', { planned: true, tasks: [{ id: '1.1', done: true }] });
  this.branches.commitAll(project, 'exportar-datos');
  this.branches.archiveChange(project, 'exportar-datos');
  this.branches.commitAll(project, 'archiva exportar-datos');
});

Given('la rama temporal se ha fusionado con squash con la rama de origen', function () {
  this.branches.squashMerge(this.project, TEMP_BRANCH, 'main');
});

Given('en la rama temporal se crea después el change `importar-datos`', function () {
  assert.equal(this.branches.currentBranch(this.project), TEMP_BRANCH);
  this.branches.addChange(this.project, 'importar-datos');
});

// --- La puerta check commit (manage-git-discipline, D4) ---------------------------

const SESSION_BRANCH = 'claude/exportar';

function writePending(project, rel) {
  const file = project.path(rel);
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.appendFileSync(file, 'Cambio pendiente.\n');
}

// Whether the session runs in an ephemeral container: for the gates the suite
// runs, and for the machine the session bootstrap opens on
function setEphemeral(world, ephemeral, saved) {
  world.ephemeral = ephemeral;
  world.machine.ephemeral = ephemeral;
  if (saved !== undefined) world.branches.setSessionBranch(world.ensureProject(), saved);
}

Given('un clon en la rama temporal `claude\\/exportar` con cambios pendientes en una sola zona', function () {
  const project = this.lifecycleProject();
  this.branches.branch(project, SESSION_BRANCH);
  writePending(project, 'src/exportar.js');
});

Given(
  /^la sesión está en un contenedor efímero (sin rama(?: de la sesión)? guardada|con `([^`]+)` guardada(?: como rama de la sesión)?)$/,
  function (_, saved) {
    setEphemeral(this, true, saved ?? null);
  }
);

Given(/^(?:la sesión no está|una sesión que no está) en un contenedor efímero$/, function () {
  setEphemeral(this, false);
});

Given(/^un contenedor efímero con `([^`]+)` guardada como rama de la sesión$/, function (saved) {
  this.lifecycleProject();
  setEphemeral(this, true, saved);
});

Given('el clon está en la rama `main` con cambios pendientes', function () {
  assert.equal(this.branches.currentBranch(this.project), 'main');
  writePending(this.project, 'src/exportar.js');
});

Given('el clon está en la rama temporal `claude\\/exportar`', function () {
  this.branches.branch(this.project, SESSION_BRANCH);
});

Given(/^hay cambios pendientes en (.+)$/, function (list) {
  const paths = [...list.matchAll(/`([^`]+)`/g)].map((m) => m[1]);
  assert.ok(paths.length > 0, `no paths in: ${list}`);
  for (const rel of paths) writePending(this.project, rel);
});

When(/^se ejecuta la puerta `check (commit|propose)`$/, function (gate) {
  this.gate = this.branches.checkGate(this.lifecycleProject(), gate, null, { ephemeral: Boolean(this.ephemeral) });
});

Then('la puerta deja seguir', function () {
  assert.equal(this.gate.ok, true, JSON.stringify(this.gate));
  assert.equal(this.gate.exitCode, 0, JSON.stringify(this.gate));
});

Then('la puerta no deja seguir', function () {
  assert.equal(this.gate.ok, false, JSON.stringify(this.gate));
  assert.equal(this.gate.exitCode, 1, JSON.stringify(this.gate));
});

Then('se indica que los commits del agente van solo a una rama temporal', function () {
  assert.match(this.gate.message, /commits del agente van solo a una rama temporal/, JSON.stringify(this.gate));
});

Then('se indica que los commits los hace el usuario', function () {
  assert.match(this.gate.message, /los commits los hace el usuario/, JSON.stringify(this.gate));
});

// --- Las dos formas del ciclo en las puertas (manage-git-discipline, D3) ----------

Given('la rama de origen no tiene ningún change en curso', function () {
  const project = this.project;
  const active = git(project.dir, 'ls-tree', '-d', '--name-only', 'main:openspec/changes/').split('\n').filter((d) => d && d !== 'archive');
  assert.deepEqual(active, []);
});

Then('se avisa de que la forma recomendada es proponer en una rama temporal', function () {
  assert.match(this.gate.message, /forma recomendada es proponer en una rama temporal/, JSON.stringify(this.gate));
});

Then('su mensaje dice cómo dejar un solo change en la rama', function () {
  assert.match(this.gate.message, /tiene que quedar uno solo/, JSON.stringify(this.gate));
  assert.match(this.gate.message, /lleva .* a su propia rama temporal/, JSON.stringify(this.gate));
});

Given('una rama de origen con el change en curso `exportar-datos` sin tasks hechas', function () {
  const project = this.lifecycleProject();
  this.branches.addChange(project, 'exportar-datos', { planned: true, tasks: [{ id: '1.1', done: false }, { id: '1.2', done: false }] });
  this.branches.commitAll(project, 'propuesta de exportar-datos fusionada');
});

When('se lanza el apply de `exportar-datos` en la rama temporal', function () {
  this.gate = this.branches.checkGate(this.project, 'apply', 'exportar-datos');
});

Then('el apply no se detiene', function () {
  assert.equal(this.gate.ok, true, JSON.stringify(this.gate));
  assert.equal(this.gate.exitCode, 0);
});

Given(/^la rama de origen tiene el change en curso `exportar-datos` con (todas las tasks hechas|tasks sin hacer)$/, function (tasks) {
  const project = this.project;
  const done = tasks === 'todas las tasks hechas';
  this.branches.addChange(project, 'exportar-datos', { planned: true, tasks: [{ id: '1.1', done: true }, { id: '1.2', done }] });
  this.branches.commitAll(project, 'implementación de exportar-datos fusionada');
});

Given('la rama de origen no tiene el change en curso `exportar-datos`', function () {
  assert.equal(fs.existsSync(this.project.path('openspec', 'changes', 'exportar-datos')), false);
});

When('se lanza la puerta `check archive` de `exportar-datos`', function () {
  this.gate = this.branches.checkGate(this.project, 'archive', 'exportar-datos');
});

Then('la puerta no deja seguir e indica que faltan tasks por hacer', function () {
  assert.equal(this.gate.ok, false, JSON.stringify(this.gate));
  assert.equal(this.gate.exitCode, 1);
  assert.match(this.gate.message, /faltan tasks por hacer/, JSON.stringify(this.gate));
});

// --- Números de ADR (manage-git-discipline, D6) ---------------------------------

const ADR_FILE = /^(\d{4})-.*\.md$/;

Given(/^la rama temporal añade el ADR `(adr\/\d{4}-[a-z0-9-]+\.md)`$/, function (rel) {
  const project = this.project;
  fs.writeFileSync(project.path(rel), `# ${path.basename(rel, '.md')}\n\n- Status: accepted\n`);
  this.branches.commitAll(project, `añade ${rel}`);
});

// The origin branch's adr/ ends at the given ADR (any other with that number
// or a higher one is removed), and the temporary branch brings it in
Given(/^la rama de origen tiene (hasta )?`adr\/(\d{4})-([a-z0-9-]+)\.md`$/, function (_, number, slug) {
  const project = this.project;
  const back = this.branches.currentBranch(project);
  this.branches.checkout(project, 'main');
  for (const file of fs.readdirSync(project.path('adr'))) {
    const m = ADR_FILE.exec(file);
    if (m && m[1] >= number) fs.rmSync(project.path('adr', file));
  }
  fs.writeFileSync(project.path('adr', `${number}-${slug}.md`), `# ${number}-${slug}\n\n- Status: accepted\n`);
  this.branches.commitAll(project, `adr/ de la rama de origen hasta ${number}`);
  this.branches.checkout(project, back);
  git(project.dir, 'merge', '-q', '--no-edit', 'main');
});

Then(/^la puerta no deja seguir e indica renumerar `(\d{4})`$/, function (number) {
  assert.equal(this.gate.ok, false, JSON.stringify(this.gate));
  assert.equal(this.gate.exitCode, 1);
  assert.match(this.gate.message, new RegExp(`renumera.*${number}`), JSON.stringify(this.gate));
});
