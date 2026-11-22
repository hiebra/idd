'use strict';

// The global install on a simulated machine (windows-global-distro): what the
// release's .bat leaves in <data> and <config>, in temporary directories of
// the scenario. Without Windows, it is laid out the way the .bat lays it out:
// <data>\openspec\schemas\intent-driven, <data>\idd\wiki-engine,
// <config>\opencode\skills and <config>\opencode\plugins.

const fs = require('node:fs');
const path = require('node:path');
const { REPO_ROOT } = require('./project');
const { git } = require('./engine');

// What the session-bootstrap plugin carries in the global install, besides
// its own server.js and tui.js: the core and the texts it prepares (design D5)
const SESSION_BOOTSTRAP_FILES = {
  'session-bootstrap.mjs': ['.agents', 'hooks', 'session-bootstrap.mjs'],
  'wiki/guide.md': ['.agents', 'wiki', 'guide.md'],
  'wiki/reminder.md': ['.agents', 'wiki', 'reminder.md'],
  'wiki/opencode-note.md': ['.agents', 'wiki', 'opencode-note.md'],
  'comments/rule.md': ['.agents', 'comments', 'rule.md'],
  'comments/reminder.md': ['.agents', 'comments', 'reminder.md'],
};

const GIT_DISCIPLINE = 'openspec-git-discipline';
// The single line of the skill's SKILL.md that gives the script's path (design D4)
const SCRIPT_LINE = /^El script es: `([^`]+)`$/m;

// The wiki engine's skills that OpenCode uses, and where they are in the engine
const ENGINE_SKILLS = {
  'wiki-query': ['plugins', 'llm-wiki-opencode', 'skills', 'wiki-query'],
  'wiki-manager': ['claude-plugin', 'skills', 'wiki-manager'],
};

class GlobalInstall {
  // dirs: the <data> and <config> where a real .bat installed it, on Windows
  constructor(workDir, dirs = null) {
    this.root = path.join(workDir, 'global');
    this.data = dirs?.data ?? path.join(this.root, 'data');
    this.config = dirs?.config ?? path.join(this.root, 'config');
  }

  get skillsDir() {
    return path.join(this.config, 'opencode', 'skills');
  }

  get pluginsDir() {
    return path.join(this.config, 'opencode', 'plugins');
  }

  skillDir(id) {
    return path.join(this.skillsDir, id);
  }

  // The skill openspec-git-discipline with its script, and in its SKILL.md
  // the absolute path of the installed script, as the .bat writes it
  installGitDiscipline() {
    const dir = this.skillDir(GIT_DISCIPLINE);
    fs.mkdirSync(path.dirname(dir), { recursive: true });
    fs.cpSync(path.join(REPO_ROOT, '.agents', 'skills', GIT_DISCIPLINE), dir, { recursive: true });
    const script = path.join(dir, 'scripts', 'branch-change.mjs');
    const skill = path.join(dir, 'SKILL.md');
    fs.writeFileSync(skill, fs.readFileSync(skill, 'utf8').replace(SCRIPT_LINE, `El script es: \`${script}\``));
    return dir;
  }

  // A plugin of the template, in <config>/opencode/plugins/<name>
  installPlugin(name) {
    const dir = path.join(this.pluginsDir, name);
    fs.mkdirSync(this.pluginsDir, { recursive: true });
    fs.cpSync(path.join(REPO_ROOT, '.opencode', 'plugins', name), dir, { recursive: true });
    if (name === 'session-bootstrap') {
      for (const [to, from] of Object.entries(SESSION_BOOTSTRAP_FILES)) {
        fs.mkdirSync(path.dirname(path.join(dir, to)), { recursive: true });
        fs.copyFileSync(path.join(REPO_ROOT, ...from), path.join(dir, to));
      }
    }
    return dir;
  }

  get engineDir() {
    return path.join(this.data, 'idd', 'wiki-engine');
  }

  // The wiki engine at a ref of a (fake) engine repository, in <data>\idd\wiki-engine
  installEngine(url, ref) {
    fs.mkdirSync(path.dirname(this.engineDir), { recursive: true });
    git(this.root, 'clone', '-q', '--depth', '1', '--branch', ref, url, this.engineDir);
    fs.rmSync(path.join(this.engineDir, '.git'), { recursive: true, force: true });
  }

  // The engine's skills that OpenCode uses: the read-only query and the management
  installEngineSkills() {
    for (const [id, rel] of Object.entries(ENGINE_SKILLS)) {
      fs.cpSync(path.join(this.engineDir, ...rel), this.skillDir(id), { recursive: true });
    }
  }

  // What the release's .bat installs, from its zip, without Windows: data/
  // into <data>, config/ into <config>, the SKILL.md of openspec-git-discipline
  // from its pieces with the absolute path of the installed script, and
  // installed.txt and version in <data>\idd (design D6)
  installFromZip(zip, version) {
    const { unzip } = require('./release');
    const unpacked = unzip(zip, path.join(this.root, 'unpacked'));
    for (const [from, to] of [['data', this.data], ['config', this.config]]) {
      fs.mkdirSync(to, { recursive: true });
      fs.cpSync(path.join(unpacked, from), to, { recursive: true });
    }
    const dir = this.skillDir(GIT_DISCIPLINE);
    const pieces = path.join(unpacked, 'pieces', GIT_DISCIPLINE);
    const script = path.join(dir, 'scripts', 'branch-change.mjs');
    fs.writeFileSync(
      path.join(dir, 'SKILL.md'),
      fs.readFileSync(path.join(pieces, 'SKILL.head.md'), 'utf8') +
        `El script es: \`${script}\`\n` +
        fs.readFileSync(path.join(pieces, 'SKILL.tail.md'), 'utf8')
    );
    const home = path.join(this.data, 'idd');
    fs.copyFileSync(path.join(unpacked, 'installed.txt'), path.join(home, 'installed.txt'));
    fs.writeFileSync(path.join(home, 'version'), `${version}\n`);
    fs.rmSync(unpacked, { recursive: true, force: true });
    return this;
  }

  get schemaDir() {
    return path.join(this.data, 'openspec', 'schemas', 'intent-driven');
  }

  // The session bootstrap and the comments rule, as the release installs them
  installSession({ engine }) {
    this.installPlugin('session-bootstrap');
    this.installPlugin('response-comments');
    this.installGitDiscipline();
    if (engine) {
      this.installEngine(engine.url, engine.pinnedRef);
      this.installEngineSkills();
    }
    return this;
  }
}

// The script path that a SKILL.md of openspec-git-discipline gives, or null
function scriptPathIn(skillText) {
  return skillText.match(SCRIPT_LINE)?.[1] ?? null;
}

module.exports = { GlobalInstall, scriptPathIn, SCRIPT_LINE, GIT_DISCIPLINE };
