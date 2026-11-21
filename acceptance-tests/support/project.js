'use strict';

// A disposable copy of the project under test (design D9): the repository as
// it is on disk, without node_modules, .git, acceptance-tests/ or the wiki
// engine's local install (design D1), as a fresh clone would be. Its
// .agents/wiki/engine.json points at the scenario's fake engine (design D7),
// and the copy is committed to a git repository of its own, so that scenarios
// can check what git shows as changed.

const fs = require('node:fs');
const path = require('node:path');
const { ENGINE_JSON, git } = require('./engine');

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
