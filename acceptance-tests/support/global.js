'use strict';

// The global install on a simulated machine (windows-global-distro): what the
// release's .bat leaves in <data> and <config>, in temporary directories of
// the scenario. Without Windows, it is laid out the way the .bat lays it out:
// <data>\openspec\schemas\intent-driven, <data>\idd\wiki-engine,
// <config>\opencode\skills and <config>\opencode\plugins.

const fs = require('node:fs');
const path = require('node:path');
const { REPO_ROOT } = require('./project');

const GIT_DISCIPLINE = 'openspec-git-discipline';
// The single line of the skill's SKILL.md that gives the script's path (design D4)
const SCRIPT_LINE = /^El script es: `([^`]+)`$/m;

class GlobalInstall {
  constructor(workDir) {
    this.root = path.join(workDir, 'global');
    this.data = path.join(this.root, 'data');
    this.config = path.join(this.root, 'config');
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
    return dir;
  }
}

// The script path that a SKILL.md of openspec-git-discipline gives, or null
function scriptPathIn(skillText) {
  return skillText.match(SCRIPT_LINE)?.[1] ?? null;
}

module.exports = { GlobalInstall, scriptPathIn, SCRIPT_LINE, GIT_DISCIPLINE };
