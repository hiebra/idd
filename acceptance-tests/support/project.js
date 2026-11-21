'use strict';

// A disposable copy of the project under test (design D9): the repository as
// it is on disk, without node_modules, .git or acceptance-tests/.

const fs = require('node:fs');
const path = require('node:path');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const EXCLUDED_AT_ROOT = new Set(['.git', 'acceptance-tests']);
const STAMP = path.join('node_modules', '.session-start.sha256');

class Project {
  constructor(dir) {
    this.dir = dir;
    fs.cpSync(REPO_ROOT, dir, {
      recursive: true,
      verbatimSymlinks: true,
      filter: (src) => {
        const rel = path.relative(REPO_ROOT, src);
        if (rel === '') return true;
        if (EXCLUDED_AT_ROOT.has(rel.split(path.sep)[0])) return false;
        return path.basename(src) !== 'node_modules';
      },
    });
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
}

module.exports = { Project, REPO_ROOT };
