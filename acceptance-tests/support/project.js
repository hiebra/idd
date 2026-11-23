'use strict';

// A disposable copy of the project under test (design D9): the repository as
// it is on disk, without node_modules, .git, acceptance-tests/ or the wiki
// engine's local install (design D1), as a fresh clone would be. Its
// .agents/wiki/engine.json points at the scenario's fake engine (design D7),
// and the copy is committed to a git repository of its own, so that scenarios
// can check what git shows as changed.

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { ENGINE_JSON, git } = require('./engine');
const { effectiveMode } = require('./wiki-modes');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const EXCLUDED_AT_ROOT = new Set(['.git', 'acceptance-tests', '.wiki']);
const STAMP = path.join('node_modules', '.session-start.sha256');
// What the session bootstrap installs for the wiki engine, ignored by git (design D1, D8)
const ENGINE_DIR = path.join('.agents', 'wiki-engine');
const ENGINE_LINKS = {
  wikiManager: path.join('.claude', 'skills', 'wiki-manager'),
  wikiCommands: path.join('.claude', 'commands', 'wiki'),
  wikiQuery: path.join('.opencode', 'skills', 'wiki-query'),
};
const LOCAL_ENGINE_PATHS = [ENGINE_DIR, ...Object.values(ENGINE_LINKS)];
const GUIDE = path.join('.agents', 'wiki', 'guide.md');
const CORE = path.join('.agents', 'hooks', 'session-bootstrap.sh');
const CONFIG = path.join('openspec', 'config.yaml');
const BLOCK_BEGIN = '# wiki:archive-guidance:begin';
const BLOCK_END = '# wiki:archive-guidance:end';
const REMINDER = path.join('.agents', 'wiki', 'reminder.md');

function isLocalEngineState(rel) {
  return LOCAL_ENGINE_PATHS.includes(rel) || rel.startsWith(`${ENGINE_DIR}.`);
}

class Project {
  constructor(dir, { engineUrl = null } = {}) {
    this.dir = dir;
    fs.cpSync(REPO_ROOT, dir, {
      recursive: true,
      verbatimSymlinks: true,
      filter: (src) => {
        const rel = path.relative(REPO_ROOT, src);
        if (rel === '') return true;
        if (EXCLUDED_AT_ROOT.has(rel.split(path.sep)[0])) return false;
        if (isLocalEngineState(rel)) return false;
        return path.basename(src) !== 'node_modules';
      },
    });
    if (engineUrl && this.hasEngineConfig()) this.writeEngineConfig({ ...this.engineConfig(), repo: engineUrl });
    git(dir, 'init', '-q', '-b', 'main');
    git(dir, 'add', '-A');
    git(dir, 'commit', '-q', '-m', 'clon del proyecto');
  }

  path(...parts) {
    return path.join(this.dir, ...parts);
  }

  get acceptanceDir() {
    return this.path('acceptance-tests');
  }

  readPackage(dir = this.dir) {
    return JSON.parse(fs.readFileSync(path.join(dir, 'package.json'), 'utf8'));
  }

  writePackage(pkg, dir = this.dir) {
    fs.writeFileSync(path.join(dir, 'package.json'), JSON.stringify(pkg, null, 2) + '\n');
  }

  pinnedOpenspecVersion() {
    return this.readPackage().devDependencies['@fission-ai/openspec'];
  }

  requiredNode() {
    return this.readPackage().engines?.node;
  }

  addDependency(name, version, dir = this.dir) {
    const pkg = this.readPackage(dir);
    pkg.dependencies = { ...pkg.dependencies, [name]: version };
    this.writePackage(pkg, dir);
  }

  // A minimal acceptance-tests/ project with one dependency of its own
  addAcceptanceProject() {
    fs.mkdirSync(this.acceptanceDir, { recursive: true });
    this.writePackage(
      { name: 'acceptance-tests', version: '0.0.0', private: true, devDependencies: { 'is-number': '7.0.0' } },
      this.acceptanceDir
    );
  }

  // A schema skill in .agents/skills/ without its .claude/skills/ symlink
  addUnlinkedSchemaSkill(id) {
    const dir = this.path('.agents', 'skills', id);
    fs.mkdirSync(dir, { recursive: true });
    fs.writeFileSync(path.join(dir, 'SKILL.md'), `---\nname: ${id}\ndescription: Skill del schema sin enlazar.\n---\n\n# ${id}\n`);
  }

  hasAcceptanceProject() {
    return fs.existsSync(path.join(this.acceptanceDir, 'package.json'));
  }

  declaredDependencies(dir = this.dir) {
    const pkg = this.readPackage(dir);
    return Object.keys({ ...pkg.dependencies, ...pkg.devDependencies });
  }

  missingDependencies(dir = this.dir) {
    return this.declaredDependencies(dir).filter(
      (name) => !fs.existsSync(path.join(dir, 'node_modules', name, 'package.json'))
    );
  }

  hasNodeModules(dir = this.dir) {
    return fs.existsSync(path.join(dir, 'node_modules'));
  }

  hasStamp(dir = this.dir) {
    return fs.existsSync(path.join(dir, STAMP));
  }

  // --- wiki ---

  hasEngineConfig() {
    return fs.existsSync(this.path(ENGINE_JSON));
  }

  engineConfig() {
    return JSON.parse(fs.readFileSync(this.path(ENGINE_JSON), 'utf8'));
  }

  writeEngineConfig(config) {
    fs.writeFileSync(this.path(ENGINE_JSON), JSON.stringify(config, null, 2) + '\n');
  }

  // The engine ref the project pins
  pinnedEngineRef() {
    return this.hasEngineConfig() ? this.engineConfig().ref : null;
  }

  // The project switch of the wiki (design D1 of add-project-wiki-toggle)
  wikiEnabled() {
    return this.hasEngineConfig() && this.engineConfig().enabled === true;
  }

  // The mode of the wiki the project declares, as written in engine.json
  // (design D1 of add-wiki-lite-mode): undefined when it declares none
  wikiMode() {
    return this.hasEngineConfig() ? this.engineConfig().mode : undefined;
  }

  // The mode the core uses: lite only when the clone declares exactly "lite"
  wikiEffectiveMode() {
    return effectiveMode(this.hasEngineConfig() ? this.engineConfig() : {});
  }

  // Declares the mode (any value, also one that is not a mode) or, with
  // undefined, removes it, and folds it into the clone's commit, as if the
  // project had always had it. Only "mode" changes: the switch stays
  setWikiMode(mode) {
    const config = { ...this.engineConfig() };
    if (mode === undefined) delete config.mode;
    else config.mode = mode;
    this.writeEngineConfig(config);
    if (git(this.dir, 'status', '--porcelain', '--untracked-files=no').trim()) {
      git(this.dir, 'commit', '-q', '-a', '--amend', '--no-edit');
    }
  }

  // Sets the switch alone and folds it into the clone's commit, as if the
  // project had always had it. The scenarios use setWiki, which also leaves
  // the archive steps as /toggle-wiki does
  setWikiEnabled(enabled) {
    this.writeEngineConfig({ enabled, ...this.engineConfig(), ...{ enabled } });
    git(this.dir, 'commit', '-q', '-a', '--amend', '--no-edit');
  }

  // The wiki of the clone as a committed /toggle-wiki leaves it (design D7):
  // the core's `wiki on|off` sets the switch and the archive steps of
  // config.yaml, and the result is folded into the clone's commit. What the
  // mode installs or links for the session is removed, so that the clone
  // starts as a fresh one
  setWiki(enabled) {
    const env = { ...process.env };
    delete env.PROJECT_WIKI;
    const result = spawnSync('bash', [this.path(CORE), 'wiki', enabled ? 'on' : 'off', this.dir], { encoding: 'utf8', env });
    if (result.status !== 0 || this.wikiEnabled() !== enabled) {
      throw new Error(`could not ${enabled ? 'enable' : 'disable'} the wiki of the clone:\n${result.stdout}\n${result.stderr}`);
    }
    this.removeEngineInstall();
    if (git(this.dir, 'status', '--porcelain', '--untracked-files=no').trim()) {
      git(this.dir, 'commit', '-q', '-a', '--amend', '--no-edit');
    }
  }

  // Disables the wiki in the versioned files only, as a pulled commit of
  // /toggle-wiki does: what a previous session installed stays
  disableWikiInVersionedFiles() {
    this.writeEngineConfig({ ...this.engineConfig(), enabled: false });
    fs.writeFileSync(this.path(CONFIG), this.configWithoutWikiBlock());
    git(this.dir, 'commit', '-q', '-a', '-m', 'deshabilitar el wiki');
  }

  // openspec/config.yaml without the lines between the wiki markers, markers included
  configWithoutWikiBlock(text = this.readConfig()) {
    const lines = text.split('\n');
    const begin = lines.findIndex((l) => l.trim() === BLOCK_BEGIN);
    const end = lines.findIndex((l) => l.trim() === BLOCK_END);
    if (begin < 0 || end < begin) return text;
    return [...lines.slice(0, begin), ...lines.slice(end + 1)].join('\n');
  }

  readConfig() {
    return fs.readFileSync(this.path(CONFIG), 'utf8');
  }

  removeEngineInstall() {
    for (const rel of LOCAL_ENGINE_PATHS) fs.rmSync(this.path(rel), { recursive: true, force: true });
  }

  // Versioned files of the clone staged and not committed
  stagedFiles() {
    return git(this.dir, 'diff', '--cached', '--name-only').split('\n').filter(Boolean);
  }

  // A project wiki committed with the clone
  addCommittedWiki() {
    fs.mkdirSync(this.path('.wiki', 'wiki'), { recursive: true });
    fs.writeFileSync(this.path('.wiki', 'index.md'), '# Wiki del proyecto\n');
    fs.writeFileSync(this.path('.wiki', 'wiki', 'articulo.md'), '# Artículo\n');
    git(this.dir, 'add', '.wiki');
    git(this.dir, 'commit', '-q', '--amend', '--no-edit');
  }

  setPinnedEngineRef(ref) {
    this.writeEngineConfig({ ...this.engineConfig(), ref });
  }

  hasEngineInstall() {
    return fs.existsSync(this.path(ENGINE_DIR));
  }

  // The engine's local paths that exist (installed directory and links)
  engineLocalPaths() {
    return LOCAL_ENGINE_PATHS.filter((rel) => {
      try {
        fs.lstatSync(this.path(rel));
        return true;
      } catch {
        return false;
      }
    });
  }

  engineLinkPath(name) {
    return this.path(ENGINE_LINKS[name]);
  }

  // The single wiki guide of the project, as a file
  guideFile() {
    return this.path(GUIDE);
  }

  readGuide() {
    return fs.readFileSync(this.guideFile(), 'utf8');
  }

  // Makes the reminder impossible to generate: its file cannot be read
  breakReminder() {
    fs.rmSync(this.path(REMINDER), { force: true });
    fs.mkdirSync(this.path(REMINDER), { recursive: true });
  }

  // `git status --porcelain` of the clone, all files included
  gitStatus() {
    return git(this.dir, 'status', '--porcelain', '--untracked-files=all').split('\n').filter(Boolean);
  }

  // Versioned files changed since the clone: tracked only
  versionedChanges() {
    return git(this.dir, 'status', '--porcelain', '--untracked-files=no').split('\n').filter(Boolean);
  }

  // The files of a directory that git ignores
  ignoredFiles(rel) {
    return git(this.dir, 'ls-files', '--others', '--ignored', '--exclude-standard', '--', rel).split('\n').filter(Boolean);
  }

  // What the engine does when it initializes a project wiki in local mode:
  // creates .wiki/ and adds it to .gitignore
  simulateWikiInit() {
    fs.mkdirSync(this.path('.wiki', 'topics'), { recursive: true });
    fs.writeFileSync(this.path('.wiki', 'index.md'), '# Wiki del proyecto\n');
    fs.writeFileSync(this.path('.wiki', 'topics', 'ejemplo.md'), '# Ejemplo\n');
    fs.appendFileSync(this.path('.gitignore'), '.wiki/\n');
  }

  // Per-user settings of Claude Code, not versioned
  writeClaudeLocalSettings(settings) {
    fs.writeFileSync(this.path('.claude', 'settings.local.json'), JSON.stringify(settings, null, 2) + '\n');
  }
}

module.exports = { Project, REPO_ROOT, ENGINE_LINKS };
