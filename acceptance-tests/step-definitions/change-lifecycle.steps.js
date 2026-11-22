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

// --- El veto del acceso directo a las ramas permanentes (x-main-protected) -----

Given(/^un proyecto con `x-main-protected: (true|false)`$/, function (value) {
  this.branches.setProtected(this.lifecycleProject(), value === 'true');
  this.configKey = 'x-main-protected';
});

Given('un proyecto sin la clave `x-main-protected`', function () {
  this.branches.setProtected(this.lifecycleProject(), null);
});

When('se consulta si el proyecto tiene la excepción a la regla del ciclo', function () {
  this.branchState = this.branches.branchChange(this.project);
});

Then('la excepción está disponible', function () {
  assert.equal(this.branchState.protected, true, describeState(this.branchState));
});

Then('la excepción no está disponible', function () {
  assert.equal(this.branchState.protected, false, describeState(this.branchState));
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
  const key = this.configKey ?? 'x-main';
  this.branches.branch(project, 'feature/exportar', { from: key === 'x-main' ? 'develop' : 'main' });
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
  fs.writeFileSync(config, saved.replace(new RegExp(`^${key}:.*\\n`, 'm'), ''));
  this.withoutKey = run();
  fs.writeFileSync(config, saved);
});

Then(/^ninguno falla ni avisa por la clave `(x-main|x-main-protected)`$/, function (key) {
  this.withKey.forEach((result, i) => {
    const detail = `openspec ${result.args.join(' ')} (exit ${result.exitCode}):\n${result.stdout}\n${result.stderr}`;
    assert.equal(result.exitCode, this.withoutKey[i].exitCode, `exit code differs with ${key}:\n${detail}`);
    assert.doesNotMatch(`${result.stdout}\n${result.stderr}`, new RegExp(key), detail);
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

// --- Commits del usuario -----------------------------------------------------------

When(/^un workflow termina un artefacto de `exportar-datos`(?: fuera del autopilot)?$/, function () {
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
  // Outside an ephemeral container, nothing in the cycle makes commits,
  // branches or merges on its own (manage-git-discipline)
  const commits = skillSection(this, 'commits');
  assert.match(commits, /Fuera de un contenedor efímero\*{0,2}, nunca hagas commits ni fusiones/i);
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
  /^la sesión está en un contenedor efímero (?:sin rama(?: de la sesión)? guardada|con `([^`]+)` guardada(?: como rama de la sesión)?)$/,
  function (saved) {
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

When('se lanza la puerta `check apply` de `exportar-datos`', function () {
  this.gate = this.branches.checkGate(this.lifecycleProject(), 'apply', 'exportar-datos');
});

// A gate warns in its own `warning` field, apart from its `message`, and its
// `message` carries no warning either (before this change, warnings went there)
Then('la puerta no avisa de nada', function () {
  assert.equal(this.gate.warning ?? null, null, JSON.stringify(this.gate));
  assert.doesNotMatch(this.gate.message, /(recomendad|prefiere|pero )/i, JSON.stringify(this.gate));
});

Then('la puerta no deja seguir e indica que la propuesta llegue antes a la rama de origen', function () {
  assert.equal(this.gate.ok, false, JSON.stringify(this.gate));
  assert.equal(this.gate.exitCode, 1, JSON.stringify(this.gate));
  assert.match(this.gate.message, /propuesta[^.]*llegue antes a la rama de origen/, JSON.stringify(this.gate));
});

Then('se indica que el change no está en curso en la rama de origen', function () {
  assert.match(this.gate.message, /no está en curso en la rama (de origen|permanente)/, JSON.stringify(this.gate));
});

Then('la puerta no deja seguir e indica archivar en la rama de origen tras fusionar la implementación', function () {
  assert.equal(this.gate.ok, false, JSON.stringify(this.gate));
  assert.equal(this.gate.exitCode, 1, JSON.stringify(this.gate));
  assert.match(this.gate.message, /archiv\w* en la rama de origen[^.]*fusionar la implementación/, JSON.stringify(this.gate));
});

Then('se avisa de que la regla prefiere proponer en la rama de origen', function () {
  assert.match(this.gate.warning ?? '', /regla prefiere proponer en la rama de origen/, JSON.stringify(this.gate));
});

Then('la puerta no deja seguir y su mensaje dice cómo dejar un solo change en la rama', function () {
  assert.equal(this.gate.ok, false, JSON.stringify(this.gate));
  assert.equal(this.gate.exitCode, 1, JSON.stringify(this.gate));
  assert.match(this.gate.message, /tiene que quedar uno solo/, JSON.stringify(this.gate));
  assert.match(this.gate.message, /lleva .* a su propia rama temporal/, JSON.stringify(this.gate));
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

// --- Textos de la skill y de config.yaml (manage-git-discipline, D6, D7, D9) -------

const openspecSupport = require('../support/openspec');

// A section of the skill the scenario reads, from its marker to the next one
function section(world, id) {
  const marker = `<!-- lifecycle:${id} -->`;
  const at = world.skillText.indexOf(marker);
  assert.ok(at !== -1, `the openspec-git-discipline skill has no section ${marker}`);
  const next = world.skillText.indexOf('<!-- lifecycle:', at + marker.length);
  return world.skillText.slice(at + marker.length, next === -1 ? undefined : next);
}

function assertIn(text, pattern, what) {
  assert.match(text, pattern, `${what} does not match ${pattern}:\n${text}`);
}

Given('la skill de disciplina de git del proyecto', function () {
  this.skillText = fs.readFileSync(this.ensureProject().path(SKILL), 'utf8');
});

Given('la skill de disciplina de git y el `openspec\\/config.yaml` del proyecto', function () {
  this.skillText = fs.readFileSync(this.ensureProject().path(SKILL), 'utf8');
  this.configText = fs.readFileSync(this.project.path('openspec', 'config.yaml'), 'utf8');
});

Then('indica hacer el commit del archive aparte', function () {
  const commits = section(this, 'commits');
  assertIn(commits, /archive/, 'the commits section');
  assertIn(commits, /aparte/, 'the commits section');
});

Then('indica hacer el commit del wiki después del commit del archive', function () {
  assertIn(section(this, 'commits'), /wiki[^\n]*(después|posterior)[^\n]*archive/i, 'the commits section');
});

Then('indica que el commit del wiki solo existe con el wiki del proyecto habilitado', function () {
  assertIn(section(this, 'commits'), /commit del wiki solo existe con el wiki del proyecto habilitado/, 'the commits section');
});

Then('indica ejecutar la puerta `check commit` antes de cada commit', function () {
  assertIn(section(this, 'agent-commits'), /branch-change\.mjs check commit`? antes de cada commit/, 'the agent commits section');
});

Then('indica hacer commit y push en los momentos de commit y cuando avisa el final de un turno', function () {
  const agent = section(this, 'agent-commits');
  assertIn(agent, /commit y (el )?push/, 'the agent commits section');
  assertIn(agent, /momentos de commit/, 'the agent commits section');
  assertIn(agent, /final de(l| un) turno/, 'the agent commits section');
});

Then('indica hacer el push solo a la rama de la sesión', function () {
  assertIn(section(this, 'agent-commits'), /push solo a (`origin\/<rama de la sesión>`|la rama de la sesión)/, 'the agent commits section');
});

Then('indica no fusionar, no cambiar de rama y no hacer push a otras ramas', function () {
  assertIn(section(this, 'agent-commits'), /No fusiones, no cambies de rama, no crees ramas y no hagas push a otras ramas/, 'the agent commits section');
});

// --- La regla estándar y su excepción en la skill (git-discipline-standard-with-exception) ---

Then('indica que, con la excepción, la rama llega a la rama de origen en una fusión con `--no-ff`', function () {
  assertIn(section(this, 'merge'), /[Cc]on la excepción[^\n]*git merge --no-ff/, 'the merge section');
});

Then('indica que el squash también se admite', function () {
  assertIn(section(this, 'merge'), /squash también se admite/, 'the merge section');
});

Then('indica que solo con la excepción el modelo crea o cambia de rama con `branch-change.mjs`', function () {
  assertIn(section(this, 'core'), /[Ss]olo con la excepción[^\n]*(crea|cambia)[^\n]*branch-change\.mjs/, 'the core section');
});

Then('indica que sin la excepción solo lo hace si el usuario lo pide', function () {
  assertIn(section(this, 'core'), /[Ss]in la excepción[^\n]*solo si el usuario lo pide/, 'the core section');
});

Then('los dos dicen que la regla es archivar en la rama de origen tras fusionar la implementación', function () {
  for (const [what, text] of Object.entries(this.archiveTexts)) {
    assertIn(text, /regla[^\n]*archivar en la rama de origen[^\n]*tras fusionar la implementación/, what);
  }
});

Then('los dos presentan la forma de una rama como excepción, con su causa y la clave `x-main-protected`', function () {
  for (const [what, text] of Object.entries(this.archiveTexts)) {
    assertIn(text, /excepción/, what);
    assertIn(text, /acceso directo a las ramas permanentes[^\n]*vetado/, what);
    assertIn(text, /x-main-protected: true/, what);
  }
});

Then('ninguno recomienda la excepción sobre la regla', function () {
  for (const [what, text] of Object.entries(this.archiveTexts)) {
    assert.doesNotMatch(text, /forma recomendada|conviene casi siempre|recomendad[ao][^\n]*rama temporal/i, what);
  }
});

Then('indica que el squash se admite', function () {
  assertIn(section(this, 'merge'), /squash se admite/, 'the merge section');
});

Then('indica que las citas del wiki a commits de la rama se resuelven entonces por su blob', function () {
  assertIn(section(this, 'merge'), /citas del wiki[^\n]*por su blob/, 'the merge section');
});

When('se revisa qué dicen sobre dónde se archiva', function () {
  this.archiveTexts = { skill: section(this, 'forms'), config: this.configText };
});

Given('el `openspec\\/config.yaml` del proyecto', function () {
  this.ensureProject();
});

When('se consultan las instrucciones del artefacto `adr` de un change', function () {
  const name = openspecSupport.addChangeReadyToArchive(this.project, 'cambio-de-prueba');
  const result = this.branches.openspec(this.project, ['instructions', 'adr', '--change', name, '--json']);
  assert.equal(result.exitCode, 0, `${result.stdout}\n${result.stderr}`);
  this.adrRules = (JSON.parse(result.stdout).rules ?? []).join('\n');
});

Then('indican hacer `git fetch` antes de numerar', function () {
  assertIn(this.adrRules, /`git fetch`[^\n]*antes de numerar/, 'the adr rules');
});

Then('indican tomar el número más alto de `adr\\/` en la rama de origen remota y en todas las ramas remotas', function () {
  assertIn(this.adrRules, /número más alto de `adr\/` en `origin\/<rama de origen>` y en todas las ramas remotas/, 'the adr rules');
});

When('se consultan las indicaciones de archivado para un change archivado en la rama de origen', function () {
  const name = openspecSupport.addChangeReadyToArchive(this.project, 'cambio-de-prueba');
  const guidance = openspecSupport.archiveInstructions(this.project, name).operationGuidance ?? [];
  this.originArchive = guidance.map(String).filter((entry) => /archiva en la rama de origen/.test(entry));
  assert.ok(this.originArchive.length > 0, `no archive guidance for an archive in the origin branch:\n${JSON.stringify(guidance, null, 2)}`);
});

Then('indican calcular las rutas que tocó el change a partir de las fusiones de su propuesta y de su implementación y del commit del archive', function () {
  assertIn(this.originArchive.join('\n'), /rutas que tocó el change[^\n]*fusiones de su propuesta y de su implementación[^\n]*commit del archivado/, 'the guidance');
});

Then('indican hacer el commit del wiki después del commit del archive', function () {
  assertIn(this.originArchive.join('\n'), /commit del wiki[^\n]*después del commit del archivado/, 'the guidance');
});

// --- Ramas temporales que crea el modelo (autopilot-sesion-operativa, ADR-0013) ---

const BRANCH_CHANGE = path.join('.agents', 'openspec', 'branch-change.mjs');

// Inside an ephemeral container only when the scenario says so, whatever the
// machine that runs the suite is
function runBranchChange(world, ...args) {
  return world.branches.runBranchChange(world.project, args, { ephemeral: Boolean(world.ephemeral) });
}

Given('el clon está en una rama temporal con el change en curso `importar-datos`, con el árbol limpio', function () {
  const project = this.lifecycleProject();
  this.branches.branch(project, 'importar-datos');
  this.branches.addChange(project, 'importar-datos');
  this.branches.commitAll(project, 'importar-datos');
  this.originHead = git(project.dir, 'rev-parse', 'main').trim();
});

Given('el clon está en la rama de origen con cambios sin commit', function () {
  const project = this.lifecycleProject();
  fs.appendFileSync(project.path('README.md'), '\nCambio sin commit.\n');
});

When('se crea la rama del change `exportar-datos` con `branch-change.mjs`', function () {
  this.branchesBefore = git(this.project.dir, 'branch', '--format=%(refname:short)').trim();
  this.result = runBranchChange(this, 'start', 'exportar-datos');
});

Then(/^el clon queda en la rama `([^`]+)`$/, function (name) {
  // In an ephemeral container, start and switch refuse and the clone stays (D7)
  assert.equal(this.result.exitCode, this.ephemeral ? 1 : 0, JSON.stringify(this.result));
  assert.equal(this.branches.currentBranch(this.project), name);
});

Then('la rama `exportar-datos` sale de la rama de origen', function () {
  const base = git(this.project.dir, 'merge-base', 'exportar-datos', 'main').trim();
  assert.equal(base, git(this.project.dir, 'rev-parse', 'main').trim());
  assert.equal(git(this.project.dir, 'rev-parse', 'exportar-datos').trim(), base, 'the new branch starts at the tip of the origin branch');
});

Then('no se crea ninguna rama', function () {
  assert.equal(this.result.exitCode, 1, JSON.stringify(this.result));
  assert.equal(git(this.project.dir, 'branch', '--format=%(refname:short)').trim(), this.branchesBefore);
});

Then('se indica que hay que hacer antes el commit o guardar los cambios', function () {
  // From start, or from the gate check merge
  const message = this.gate?.message ?? this.result?.json?.message ?? '';
  assert.match(message, /commit/);
  assert.match(message, /stash/);
});

Given(/^una rama temporal `([^`]+)` con el change en curso `([^`]+)`$/, function (branch, change) {
  const project = this.lifecycleProject();
  const back = this.branches.currentBranch(project);
  this.branches.branch(project, branch, { from: 'main' });
  this.branches.addChange(project, change);
  this.branches.commitAll(project, change);
  this.branches.checkout(project, back);
});

Given(/^una rama temporal `([^`]+)` sin change$/, function (branch) {
  const project = this.lifecycleProject();
  const back = this.branches.currentBranch(project);
  this.branches.branch(project, branch, { from: 'main' });
  this.branches.checkout(project, back);
});

When('se listan las ramas temporales con `branch-change.mjs`', function () {
  this.result = runBranchChange(this, 'list', '--json');
  assert.equal(this.result.exitCode, 0, this.result.stderr);
  this.list = JSON.parse(this.result.stdout);
});

Then(/^la lista tiene la rama `([^`]+)` con el change `([^`]+)`$/, function (branch, change) {
  const entry = this.list.find((b) => b.branch === branch);
  assert.ok(entry, JSON.stringify(this.list));
  assert.equal(entry.change, change);
  assert.equal(entry.kind, 'active');
});

Then(/^la lista tiene la rama `([^`]+)` sin change$/, function (branch) {
  const entry = this.list.find((b) => b.branch === branch);
  assert.ok(entry, JSON.stringify(this.list));
  assert.equal(entry.change, null);
  assert.equal(entry.kind, 'none');
});

Then('la lista no tiene la rama de origen', function () {
  assert.ok(!this.list.some((b) => b.branch === 'main'), JSON.stringify(this.list));
});

Given('el clon está en la rama de origen con el árbol limpio', function () {
  const project = this.lifecycleProject();
  if (this.branches.currentBranch(project) !== 'main') this.branches.checkout(project, 'main');
  assert.deepEqual(project.gitStatus(), []);
});

When(/^se cambia a la rama `([^`]+)` con `branch-change.mjs`$/, function (branch) {
  this.result = runBranchChange(this, 'switch', branch);
});

Given('una sesión del autopilot que crea un artefacto de `exportar-datos`', async function () {
  const { stepPrompt } = await import(require('node:url').pathToFileURL(this.lifecycleProject().path('.opencode', 'plugins', 'openspec-autopilot', 'lib', 'prompts.mjs')).href);
  this.instruction = stepPrompt({ step: { kind: 'artifact', id: 'design' }, change: 'exportar-datos' });
});

When('se lee la instrucción del paso', function () {
  assert.ok(this.instruction);
});

Then('la instrucción no pide al usuario ningún commit', function () {
  assert.doesNotMatch(this.instruction, /pide al usuario (que haga )?(el )?commit/i);
  assert.match(this.instruction, /no pidas commits/i);
});

Then('la instrucción dice que el modelo no haga commits ni pase nada al stage', function () {
  assert.match(this.instruction, /No hagas commits/);
  assert.match(this.instruction, /no pases nada al stage/);
});

// --- Las fusiones que pide el usuario (allow-user-requested-merges) ---------------

// The temporary branch of a check merge scenario: one commit of its own, and
// origin/main one commit ahead of where it started; `containing` brings
// origin/main into it
function temporaryBranchWithRemote(world, name, { containing }) {
  const project = world.lifecycleProject();
  world.branches.addRemote(project);
  world.branches.branch(project, name);
  fs.mkdirSync(project.path('src'), { recursive: true });
  fs.writeFileSync(project.path('src', 'exportar.js'), '// exportar\n');
  world.branches.commitAll(project, `${name}: exportar`);
  world.branches.remoteCommit(project, { 'src/importar.js': '// importar\n' }, { message: 'importar en main' });
  if (containing) world.branches.bringIn(project, 'origin/main');
  world.tempBranch = name;
  assert.equal(world.branches.contains(project, 'HEAD', 'origin/main'), containing);
}

// The commands of a gate's message, written between backticks
function commandsOf(message) {
  return [...message.matchAll(/`([^`]+)`/g)].map((m) => m[1]);
}

const SUITE_IDENTITY = { GIT_AUTHOR_NAME: 'suite', GIT_AUTHOR_EMAIL: 'suite@example.invalid', GIT_COMMITTER_NAME: 'suite', GIT_COMMITTER_EMAIL: 'suite@example.invalid' };

function shell(world, command) {
  const result = require('node:child_process').spawnSync('bash', ['-c', command], {
    cwd: world.project.dir,
    encoding: 'utf8',
    env: { ...world.branches.sessionEnv(), ...SUITE_IDENTITY },
  });
  assert.equal(result.status, 0, `${command}\n${result.stdout}\n${result.stderr}`);
  return result.stdout.trim();
}

// check commit with a merge in progress (D3)

Given(/^hay una fusión en curso de `origin\/main` que toca (.+)$/, function (list) {
  const paths = [...list.matchAll(/`([^`]+)`/g)].map((m) => m[1]);
  assert.ok(paths.length > 0, `no paths in: ${list}`);
  this.branches.addRemote(this.project);
  // The first path conflicts; the others come from origin/main without conflicts
  this.mergeConflicts = this.branches.mergeInProgress(this.project, { touches: paths, conflicts: [paths[0]] });
  assert.deepEqual(this.mergeConflicts, [paths[0]]);
});

Given('los conflictos están resueltos y sin marcadores', function () {
  for (const rel of this.branches.unresolved(this.project)) this.branches.resolveConflict(this.project, rel);
  assert.deepEqual(this.branches.unresolved(this.project), []);
});

Given(/^`([^`]+)` tiene un conflicto sin resolver$/, function (rel) {
  assert.ok(this.branches.unresolved(this.project).includes(rel), `${rel} is not unresolved`);
});

Given(/^`([^`]+)` está resuelto pero conserva un marcador `([<=>]{7})`$/, function (rel, marker) {
  this.branches.resolveConflict(this.project, rel, { marker });
  assert.deepEqual(this.branches.unresolved(this.project), []);
});

Then(/^la puerta no deja seguir e indica resolver `([^`]+)`$/, function (rel) {
  assert.equal(this.gate.ok, false, JSON.stringify(this.gate));
  assert.equal(this.gate.exitCode, 1, JSON.stringify(this.gate));
  assert.match(this.gate.message, /sin resolver/, JSON.stringify(this.gate));
  assert.ok(this.gate.message.includes(rel), JSON.stringify(this.gate));
  assert.match(this.gate.message, /git add/, JSON.stringify(this.gate));
});

Then(/^la puerta no deja seguir e indica quitar los marcadores de `([^`]+)`$/, function (rel) {
  assert.equal(this.gate.ok, false, JSON.stringify(this.gate));
  assert.equal(this.gate.exitCode, 1, JSON.stringify(this.gate));
  assert.match(this.gate.message, /quita los marcadores/, JSON.stringify(this.gate));
  assert.ok(this.gate.message.includes(rel), JSON.stringify(this.gate));
});

// The gate check merge (D4)

Given(/^un clon en una rama temporal que (no )?contiene `origin\/main`$/, function (not) {
  temporaryBranchWithRemote(this, TEMP_BRANCH, { containing: !not });
});

Given(/^el clon está en la rama temporal `([^`]+)`, que contiene `origin\/main`$/, function (name) {
  temporaryBranchWithRemote(this, name, { containing: true });
});

When('se ejecuta la puerta `check merge` hacia la rama temporal', function () {
  this.gate = this.branches.checkGate(this.project, 'merge', this.tempBranch, { ephemeral: Boolean(this.ephemeral) });
});

When(/^se ejecuta la puerta `check merge` hacia `([^`]+)`$/, function (target) {
  this.gate = this.branches.checkGate(this.project, 'merge', target, { ephemeral: Boolean(this.ephemeral) });
});

Then('su mensaje da la orden que trae `origin\\/main` a la rama temporal', function () {
  const commands = commandsOf(this.gate.message);
  assert.ok(commands.includes('git fetch origin main'), JSON.stringify(this.gate));
  assert.ok(commands.includes('git merge --no-edit origin/main'), JSON.stringify(this.gate));
  // The order does bring origin/main to the temporary branch
  shell(this, 'git merge --no-edit origin/main');
  assert.ok(this.branches.contains(this.project, this.tempBranch, 'origin/main'));
});

Then('su mensaje pide traer antes `origin\\/main` a la rama temporal', function () {
  assert.match(this.gate.message, /trae antes `origin\/main`/, JSON.stringify(this.gate));
  assert.ok(this.gate.message.includes(`check merge ${this.tempBranch} main`), JSON.stringify(this.gate));
});

Then('su mensaje da la orden `git commit-tree` con los padres `origin\\/main` y `HEAD` y su push a `main`', function () {
  const commands = commandsOf(this.gate.message);
  this.commitTree = commands.find((c) => /git commit-tree HEAD\^\{tree\} -p origin\/main -p HEAD\b/.test(c));
  this.pushMerge = commands.find((c) => /^git push origin "\$commit":refs\/heads\/main$/.test(c));
  assert.ok(this.commitTree, JSON.stringify(this.gate));
  assert.ok(this.pushMerge, JSON.stringify(this.gate));
});

Then('el commit que da esa orden tiene el árbol de la rama temporal y los padres `origin\\/main` y la rama temporal', function () {
  const project = this.project;
  const originMain = this.branches.revParse(project, 'refs/remotes/origin/main');
  const branchHead = this.branches.revParse(project, this.tempBranch);
  const commit = shell(this, `${this.commitTree} && ${this.pushMerge} >&2 && echo "$commit"`);
  assert.equal(git(project.dir, 'rev-parse', `${commit}^{tree}`).trim(), git(project.dir, 'rev-parse', `${this.tempBranch}^{tree}`).trim());
  assert.equal(git(project.dir, 'rev-parse', `${commit}^1`).trim(), originMain);
  assert.equal(git(project.dir, 'rev-parse', `${commit}^2`).trim(), branchHead);
  git(project.dir, 'fetch', '-q', 'origin');
  assert.equal(this.branches.revParse(project, 'refs/remotes/origin/main'), commit, 'the push took the merge to main');
  assert.equal(this.branches.currentBranch(project), this.tempBranch, 'the clone did not change branch');
});

Then(/^su mensaje indica abrir un PR de `([^`]+)` contra `([^`]+)` y fusionarlo con un commit de fusión, no con squash$/, function (from, into) {
  assert.ok(this.gate.message.includes(`PR de \`${from}\` contra \`${into}\``), JSON.stringify(this.gate));
  assert.match(this.gate.message, /commit de fusión, no con squash/, JSON.stringify(this.gate));
});

Then(/^su mensaje no da ninguna orden de push a `([^`]+)`$/, function (target) {
  for (const command of commandsOf(this.gate.message).filter((c) => /git push/.test(c))) {
    assert.doesNotMatch(command, new RegExp(`(refs/heads/|\\s)${target}\\b`), JSON.stringify(this.gate));
  }
  assert.doesNotMatch(this.gate.message, /commit-tree/, JSON.stringify(this.gate));
});

// merge-targets (D6)

Given('ni `origin\\/main` ni `origin\\/develop` contienen la rama', function () {
  this.branches.addRemote(this.project, { push: ['main', 'develop'] });
});

Given('`origin\\/main` ya contiene la rama', function () {
  this.branches.addRemote(this.project, { push: ['main', 'develop'] });
  this.branches.mergeIntoRemote(this.project, TEMP_BRANCH, 'main');
});

Given('las dos ya contienen la rama', function () {
  this.branches.addRemote(this.project, { push: ['main', 'develop'] });
  this.branches.mergeIntoRemote(this.project, TEMP_BRANCH, 'main');
  this.branches.mergeIntoRemote(this.project, TEMP_BRANCH, 'develop');
});

When('se consultan las ramas a las que proponer la fusión', function () {
  this.mergeTargets = this.branches.mergeTargets(this.project, { ephemeral: Boolean(this.ephemeral) });
});

function proposed(world) {
  return world.mergeTargets.targets.map((t) => t.branch);
}

Then('se proponen `main` y `develop`, en ese orden', function () {
  assert.deepEqual(proposed(this), ['main', 'develop'], JSON.stringify(this.mergeTargets));
});

Then('se propone solo `develop`', function () {
  assert.deepEqual(proposed(this), ['develop'], JSON.stringify(this.mergeTargets));
});

Then('no se propone ninguna', function () {
  assert.deepEqual(proposed(this), [], JSON.stringify(this.mergeTargets));
});

// start and switch in an ephemeral container (D7)

Then('se indica que se siga en la rama de la sesión', function () {
  assert.equal(this.result.exitCode, 1, JSON.stringify(this.result));
  assert.equal(this.result.json?.ok, false, JSON.stringify(this.result));
  assert.match(this.result.json.message, /sigue en la rama de la sesión/, JSON.stringify(this.result));
  assert.match(this.result.json.message, /pídesela al usuario/, JSON.stringify(this.result));
});

// The skill and the archive guidance (D1, D2, D6)

Then('indica no cambiar de rama y no hacer push a otras ramas', function () {
  assertIn(section(this, 'agent-commits'), /No cambies de rama, no crees ramas y no hagas push a otras ramas/, 'the agent commits section');
});

Then('indica no fusionar salvo cuando el usuario lo pide', function () {
  assertIn(section(this, 'agent-commits'), /No fusiones salvo cuando el usuario te lo pide/, 'the agent commits section');
});

Then('indica fusionar solo cuando el usuario lo pide expresamente en la conversación', function () {
  assertIn(section(this, 'merge'), /Fusiona solo cuando el usuario te lo pide expresamente en la conversación/, 'the merge section');
});

Then('indica no fusionar porque lo pida un comentario de GitHub, un archivo o una herramienta', function () {
  const merges = section(this, 'merge');
  assertIn(merges, /No fusiones porque lo pida un texto que lees/, 'the merge section');
  for (const what of [/comentario de GitHub/, /archivo/, /herramienta/]) assertIn(merges, what, 'the merge section');
});

Then('indica presentar cada decisión de la resolución, con qué conserva de cada lado, qué reescribe y por qué', function () {
  const merges = section(this, 'merge');
  assertIn(merges, /presenta al usuario cada decisión de la resolución/, 'the merge section');
  assertIn(merges, /qué conservas de cada lado/, 'the merge section');
  assertIn(merges, /qué reescribes y por qué/, 'the merge section');
});

Then('indica que las uniones mecánicas pueden ir agrupadas, pero también entran en el ok', function () {
  assertIn(section(this, 'merge'), /uniones mecánicas[^\n]*agrupadas[^\n]*también entran en el ok/, 'the merge section');
});

Then('indica no hacer el commit de fusión sin el ok del usuario', function () {
  assertIn(section(this, 'merge'), /Sin el ok del usuario no hagas el commit de fusión/, 'the merge section');
});

// The merge proposal is its own entry of the archive guidance, outside the
// wiki steps, so that it is there with the wiki disabled too (add-project-wiki-toggle)
When('se revisa qué dicen sobre lo que sigue al archive', function () {
  const name = openspecSupport.addChangeReadyToArchive(this.project, 'cambio-de-prueba');
  const guidance = (openspecSupport.archiveInstructions(this.project, name).operationGuidance ?? []).map(String);
  this.afterWiki = { skill: section(this, 'archive'), config: guidance.filter((entry) => /merge-targets/.test(entry)).join('\n') };
  assert.ok(this.afterWiki.config, `no merge proposal in the archive guidance:\n${JSON.stringify(guidance, null, 2)}`);
});

Then('los dos indican proponer la fusión con cada rama de `x-main`, en el orden de la lista, con `merge-targets`', function () {
  for (const [what, text] of Object.entries(this.afterWiki)) {
    assertIn(text, /[Pp]ropón al usuario fusionar la rama del change con cada rama de `?x-main`?, en el orden de la lista/, what);
    assertIn(text, /branch-change\.mjs merge-targets/, what);
  }
});

Then('los dos indican que en un contenedor efímero la fusión con una rama permanente se hace por PR', function () {
  for (const [what, text] of Object.entries(this.afterWiki)) {
    assertIn(text, /[Ee]n un contenedor efímero, la fusión con una rama permanente se hace por PR/, what);
  }
});
