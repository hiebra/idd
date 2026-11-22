'use strict';

// Simulated Windows machines for the windows-readiness scenarios
// (windows-support, design D4). The diagnostic has two parts: one collects
// the facts of the machine, the other turns them into the report. The suite
// builds the facts of each machine here, in the format Get-ReadinessFacts
// returns, and runs the script with pwsh and -FactsFile, so the whole
// evaluation is tested outside Windows. Collecting the facts is checked by
// hand on a real Windows machine.
//
// A machine with everything the project needs is OpenCode 2, Node.js 22.12
// with npm, git, Python 3 and, installed in the project, the wiki engine at
// its pinned version and every npm dependency of the root and of
// acceptance-tests/, from the project's own lockfiles. Each `But` step
// changes one fact.

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { which } = require('./machine');
const { git } = require('./engine');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const SCRIPT = path.join(REPO_ROOT, 'scripts', 'windows', 'Test-OfflineInstall.ps1');
const VENDOR_REL = 'vendor\\windows';

function readJson(file) {
  return JSON.parse(fs.readFileSync(file, 'utf8'));
}

// Whether a package of the lockfile installs on a platform (its os/cpu fields)
function matches(values, current) {
  const list = (values ?? []).filter(Boolean);
  if (list.length === 0) return true;
  if (list.includes(`!${current}`)) return false;
  const positive = list.filter((v) => !v.startsWith('!'));
  return positive.length === 0 || positive.includes(current);
}

// The packages of a lockfile as Get-ReadinessFacts reports them
function lockPackages(file) {
  const lock = readJson(file);
  return Object.entries(lock.packages ?? {})
    .filter(([key, p]) => /(^|\/)node_modules\//.test(key) && !p.link && !p.inBundle)
    .map(([key, p]) => ({
      name: key.slice(key.lastIndexOf('node_modules/') + 'node_modules/'.length),
      version: p.version,
      os: p.os ?? [],
      cpu: p.cpu ?? [],
      installed: true,
      inVendorCache: false,
      inGlobalCache: false,
    }));
}

function fullFacts() {
  const engineFile = path.join(REPO_ROOT, '.agents', 'wiki', 'engine.json');
  const engine = fs.existsSync(engineFile) ? readJson(engineFile) : null;
  const projects = [
    { label: 'raíz', rel: '.', lock: path.join(REPO_ROOT, 'package-lock.json') },
    { label: 'acceptance-tests', rel: 'acceptance-tests', lock: path.join(REPO_ROOT, 'acceptance-tests', 'package-lock.json') },
  ].filter((p) => fs.existsSync(p.lock));
  return {
    version: 1,
    platform: { os: 'win32', cpu: 'x64' },
    vendorRel: VENDOR_REL,
    node: {
      required: readJson(path.join(REPO_ROOT, 'package.json')).engines?.node ?? null,
      candidates: [{ path: 'C:\\Program Files\\nodejs\\node.exe', source: 'PATH', version: 'v22.12.0' }],
    },
    npm: { path: 'C:\\Program Files\\nodejs\\npm.cmd', offline: 'false', globalCache: 'C:\\Users\\usuario\\AppData\\Local\\npm-cache' },
    npx: { path: 'C:\\Program Files\\nodejs\\npx.cmd' },
    git: { path: 'C:\\Program Files\\Git\\cmd\\git.exe', source: 'PATH', version: 'git version 2.47.1.windows.1' },
    python: { candidates: [{ path: 'C:\\Program Files\\Python312\\python.exe', source: 'PATH', version: 'Python 3.12.8', storeAlias: false }] },
    lineEndings: { checked: true, crlf: [] },
    engine: engine
      ? { configured: true, repo: engine.repo, ref: engine.ref, installedRef: `${engine.ref} ${engine.repo}`, local: false, localHasRef: false }
      : { configured: false },
    npmProjects: projects.map(({ label, rel, lock }) => ({ label, rel, packages: lockPackages(lock) })),
    agents: { opencode: [{ path: 'C:\\Users\\usuario\\.opencode\\bin\\opencode.exe', version: '2.3.2' }], claude: [] },
  };
}

class WindowsMachine {
  constructor(workDir) {
    this.workDir = workDir;
    this.facts = fullFacts();
    this.project = null;
  }

  npmProject(label) {
    const project = this.facts.npmProjects.find((p) => p.label === label);
    if (!project) throw new Error(`the project has no npm project '${label}'`);
    return project;
  }

  get engine() {
    return this.facts.engine;
  }

  // The project the diagnostic runs on: a small clone with the project's
  // package.json, so the steps can check that the diagnostic changes nothing
  ensureProject() {
    if (this.project) return this.project;
    const dir = path.join(this.workDir, 'proyecto-windows');
    fs.mkdirSync(dir, { recursive: true });
    fs.copyFileSync(path.join(REPO_ROOT, 'package.json'), path.join(dir, 'package.json'));
    git(dir, 'init', '-q', '-b', 'main');
    git(dir, 'add', '-A');
    git(dir, 'commit', '-q', '-m', 'clon');
    this.project = dir;
    return dir;
  }

  // Runs the diagnostic with pwsh: on these facts, or collecting the facts of
  // the machine that runs the suite (facts: false)
  run({ json = false, facts = true } = {}) {
    const pwsh = which('pwsh');
    if (!pwsh) {
      throw new Error('the windows-readiness scenarios need pwsh (PowerShell 7) on the machine that runs the suite; see acceptance-tests/README.md');
    }
    const project = this.ensureProject();
    const args = ['-NoProfile', '-NonInteractive', '-File', SCRIPT, '-ProjectDir', project];
    if (facts) {
      const file = path.join(this.workDir, `hechos-${Date.now()}.json`);
      fs.writeFileSync(file, JSON.stringify(this.facts, null, 2));
      args.push('-FactsFile', file);
    }
    if (json) args.push('-Json');
    const child = spawnSync(pwsh, args, { encoding: 'utf8', timeout: 120000 });
    return { exitCode: child.status, stdout: child.stdout ?? '', stderr: child.stderr ?? '', log: `exit ${child.status}\nstdout:\n${child.stdout}\nstderr:\n${child.stderr}` };
  }
}

module.exports = { WindowsMachine, matches };
