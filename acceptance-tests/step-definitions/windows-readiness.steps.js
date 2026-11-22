'use strict';

// windows-readiness: the Windows diagnostic on simulated machines
// (windows-support, design D4), see support/windows-readiness.js.

const assert = require('node:assert/strict');
const { Given, When, Then } = require('@cucumber/cucumber');
const { WindowsMachine, matches } = require('../support/windows-readiness');
const { git } = require('../support/engine');

// The components of the report, by the name the steps give them
const COMPONENTS = {
  'Node.js': 'node',
  'Python 3': 'python',
  'el motor del wiki': 'wiki-engine',
  'las dependencias npm de la raíz': 'npm-root',
  'las dependencias npm de `acceptance-tests`': 'npm-acceptance-tests',
  'los finales de línea del clon': 'line-endings',
  'el agente': 'agent',
};
const NAMES = Object.keys(COMPONENTS)
  .map((name) => name.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'))
  .join('|');

function windows(world) {
  if (!world.windows) world.windows = new WindowsMachine(world.workDir);
  return world.windows;
}

function component(world, id) {
  const found = world.report.resultados.find((r) => r.Id === id);
  assert.ok(found, `no component '${id}' in the report:\n${world.runLog}`);
  world.lastComponent = found;
  return found;
}

function detail(world) {
  return `${JSON.stringify(world.report.resultados, null, 2)}\n${world.runLog}`;
}

// --- Máquinas ---------------------------------------------------------------------

Given(/^una máquina Windows(?: x64)? con todo lo que necesita el proyecto$/, function () {
  windows(this);
});

Given('una máquina Windows sin Node.js', function () {
  const facts = windows(this).facts;
  facts.node.candidates = [];
  facts.npm.path = null;
  facts.npx.path = null;
});

Given('una máquina Windows con Node.js 20', function () {
  windows(this).facts.node.candidates = [{ path: 'C:\\Program Files\\nodejs\\node.exe', source: 'PATH', version: 'v20.11.0' }];
});

Given('el directorio de vendor del repositorio tiene un Node.js de la versión requerida', function () {
  const facts = windows(this).facts;
  facts.node.candidates.unshift({ path: 'C:\\proyecto\\vendor\\windows\\node\\node.exe', source: 'vendor', version: 'v22.12.0' });
  facts.npm.path = 'C:\\proyecto\\vendor\\windows\\node\\npm.cmd';
  facts.npx.path = 'C:\\proyecto\\vendor\\windows\\node\\npx.cmd';
});

// Installed on Linux x64 and copied: only the packages for linux-x64 are there
Given('las dependencias de `acceptance-tests\\/` se instalaron en Linux y se copiaron', function () {
  for (const p of windows(this).npmProject('acceptance-tests').packages) {
    p.installed = matches(p.os, 'linux') && matches(p.cpu, 'x64');
  }
});

Given('las dependencias de la raíz no están instaladas en el proyecto', function () {
  for (const p of windows(this).npmProject('raíz').packages) p.installed = false;
});

Given('la caché global de npm tiene todos sus paquetes', function () {
  for (const p of windows(this).npmProject('raíz').packages) p.inGlobalCache = true;
});

Given('npm no está configurado para trabajar sin red', function () {
  windows(this).facts.npm.offline = 'false';
});

Given('el motor del wiki no está instalado en el proyecto', function () {
  windows(this).engine.installedRef = null;
});

Given('`engine.json` apunta al repositorio del motor en GitHub', function () {
  Object.assign(windows(this).engine, { repo: 'nvk/llm-wiki', local: false, localHasRef: false });
});

Given('`engine.json` apunta a un bundle de git local con la versión fijada', function () {
  const engine = windows(this).engine;
  Object.assign(engine, { repo: `vendor/windows/llm-wiki-${engine.ref}.bundle`, local: true, localHasRef: true });
});

Given('el único Python de la máquina es el alias de la Microsoft Store', function () {
  windows(this).facts.python.candidates = [
    { path: 'C:\\Users\\usuario\\AppData\\Local\\Microsoft\\WindowsApps\\python3.exe', source: 'PATH', version: null, storeAlias: true },
  ];
});

Given('el clon tiene archivos de texto versionados con finales de línea CRLF', function () {
  windows(this).facts.lineEndings = { checked: true, crlf: ['.agents/hooks/session-bootstrap.mjs', 'package.json'] };
});

Given('el único agente de la máquina es Claude Code', function () {
  windows(this).facts.agents = { opencode: [], claude: [{ path: 'C:\\Users\\usuario\\.local\\bin\\claude.exe', version: '2.1.330 (Claude Code)' }] };
});

Given('el único agente de la máquina es OpenCode 1', function () {
  windows(this).facts.agents = { opencode: [{ path: 'C:\\Users\\usuario\\.opencode\\bin\\opencode.exe', version: '1.0.150' }], claude: [] };
});

// --- Diagnóstico ------------------------------------------------------------------

// The text report gives the exit code; the same facts as JSON give the components
When('se ejecuta el diagnóstico en el proyecto', function () {
  const machine = windows(this);
  machine.ensureProject();
  this.treeBefore = git(machine.project, 'status', '--porcelain', '--untracked-files=all');
  const text = machine.run();
  const json = machine.run({ json: true });
  this.runLog = `text run:\n${text.log}\njson run:\n${json.log}`;
  this.exitCode = text.exitCode;
  assert.equal(json.exitCode, text.exitCode, `the JSON run ended differently:\n${this.runLog}`);
  this.report = JSON.parse(json.stdout);
});

When('se ejecuta el diagnóstico en el proyecto pidiendo JSON', function () {
  const run = windows(this).run({ json: true });
  this.runLog = run.log;
  this.exitCode = run.exitCode;
  this.jsonOutput = run.stdout;
  this.report = JSON.parse(run.stdout);
});

// --- Informe ----------------------------------------------------------------------

Then('todos los componentes del informe están en estado OK', function () {
  const notOk = this.report.resultados.filter((r) => r.Estado !== 'OK').map((r) => `${r.Id}: ${r.Estado} (${r.Detalle})`);
  assert.deepEqual(notOk, [], detail(this));
});

// With the facts given, nothing is read from the machine; the same run
// collecting the facts of the machine that runs the suite must not change
// the project either
Then('el árbol de trabajo del proyecto no ha cambiado', function () {
  const machine = windows(this);
  const collected = machine.run({ json: true, facts: false });
  assert.ok([0, 1].includes(collected.exitCode), `the diagnostic failed while collecting facts:\n${collected.log}`);
  assert.equal(git(machine.project, 'status', '--porcelain', '--untracked-files=all'), this.treeBefore);
});

Then(new RegExp(`^el informe da (${NAMES}) en estado (OK \\(vendor\\)|OK|AVISO|FALTA)$`), function (name, state) {
  assert.equal(component(this, COMPONENTS[name]).Estado, state, detail(this));
});

Then('el informe dice qué incorporar al repositorio para Node.js', function () {
  assert.match(component(this, 'node').Repo, /vendor\\windows\\node/, detail(this));
});

Then('el informe da la instalación global de Node.js como alternativa', function () {
  assert.match(component(this, 'node').Global, /Instalador MSI de Node\.js/, detail(this));
});

Then('el informe dice cómo conseguir Node.js en una máquina con internet', function () {
  assert.match(component(this, 'node').Obtener, /nodejs\.org/, detail(this));
});

Then('el detalle de Node.js nombra la versión 20 encontrada y la que exige el proyecto', function () {
  const node = component(this, 'node');
  assert.match(node.Detalle, /20\.11\.0/, detail(this));
  assert.match(node.Detalle, />=22\.12/, detail(this));
});

Then(/^el detalle (no )?nombra el paquete `([^`]+)`$/, function (not, name) {
  const text = this.lastComponent.Detalle;
  if (not) assert.doesNotMatch(text, new RegExp(`${name.replace('/', '\\/')}@`), detail(this));
  else assert.match(text, new RegExp(`${name.replace('/', '\\/')}@`), detail(this));
});

Then('el informe da como alternativa global configurar npm para trabajar sin red', function () {
  assert.match(component(this, 'npm-root').Global, /npm config set offline true/, detail(this));
});

Then('el informe dice cómo volver a extraer los archivos con LF', function () {
  const le = component(this, 'line-endings');
  assert.match(le.Detalle, /git rm -r --cached -q \./, detail(this));
  assert.match(le.Global, /No hay alternativa global/, detail(this));
});

Then('el detalle del agente dice que en Windows solo se soporta OpenCode 2', function () {
  assert.match(component(this, 'agent').Detalle, /En Windows solo se soporta OpenCode 2/, detail(this));
  assert.match(component(this, 'agent').Detalle, /Claude Code .*no se soporta en Windows/, detail(this));
});

Then(/^el diagnóstico termina con (\d)$/, function (code) {
  assert.equal(this.exitCode, Number(code), this.runLog);
});

Then('la salida es un JSON con un objeto por componente', function () {
  const ids = this.report.resultados.map((r) => r.Id);
  assert.ok(ids.length > 0, this.runLog);
  assert.equal(new Set(ids).size, ids.length, `repeated components: ${ids.join(', ')}`);
  for (const r of this.report.resultados) {
    for (const key of ['Id', 'Componente', 'Tipo', 'Estado', 'Detalle', 'Repo', 'Global', 'Obtener']) {
      assert.ok(key in r, `component ${r.Id} has no ${key}`);
    }
  }
});

Then('el objeto de Node.js tiene el estado FALTA', function () {
  assert.equal(component(this, 'node').Estado, 'FALTA', detail(this));
});
