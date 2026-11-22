'use strict';

// Fake wiki engine (design D7): a local git repository that stands in for the
// engine's repository (nvk/llm-wiki), with the paths design D1 uses, so the
// session bootstrap can install it without network access. The project copy's
// .agents/wiki/engine.json points at it.
//
// It has two tags: the ref the project pins (read from the real engine.json)
// and another one. Every file of a tag carries the line
// `fake-engine-ref: <tag>`, and the helper prints it, so the suite can tell
// which version each agent sees without relying on the bootstrap's own stamp.
//
// An inaccessible repository is simulated by renaming it away: its URL then
// points at a path that does not exist.

const fs = require('node:fs');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const REPO_ROOT = path.resolve(__dirname, '..', '..');
const ENGINE_JSON = path.join('.agents', 'wiki', 'engine.json');
const OTHER_REF = 'v9.9.9-otra';
const MARKER = /fake-engine-ref: (\S+)/;

// The engine's paths used by design D1, per tag
const SKILL_MANAGER = path.join('claude-plugin', 'skills', 'wiki-manager', 'SKILL.md');
const COMMANDS_DIR = path.join('claude-plugin', 'commands');
const COMMANDS = ['query', 'ingest', 'll', 'compile', 'refresh', 'inventory', 'lint', 'ingest-collection'];
const HELPER = path.join('claude-plugin', 'bin', 'llm-wiki');
const SKILL_QUERY = path.join('plugins', 'llm-wiki-opencode', 'skills', 'wiki-query', 'SKILL.md');

function git(cwd, ...args) {
  return execFileSync('git', ['-c', 'user.name=suite', '-c', 'user.email=suite@example.invalid', ...args], {
    cwd,
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  });
}

function write(file, content, mode) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  fs.writeFileSync(file, content, mode ? { mode } : undefined);
}

// The ref and repository the real project pins
function pinnedEngine() {
  return JSON.parse(fs.readFileSync(path.join(REPO_ROOT, ENGINE_JSON), 'utf8'));
}

function hasPinnedEngine() {
  return fs.existsSync(path.join(REPO_ROOT, ENGINE_JSON));
}

// The fake engine files of one tag
function writeTag(dir, ref) {
  const mark = `fake-engine-ref: ${ref}`;
  write(
    path.join(dir, SKILL_MANAGER),
    `---\nname: wiki-manager\ndescription: Motor falso del wiki (gestión).\ntools:\n  - Read\n---\n\n# wiki-manager\n\n${mark}\n`
  );
  for (const command of COMMANDS) {
    write(path.join(dir, COMMANDS_DIR, `${command}.md`), `---\ndescription: /wiki:${command} del motor falso\n---\n\n${mark}\n`);
  }
  write(path.join(dir, HELPER), `#!/bin/bash\necho "${mark}"\n`, 0o755);
  write(
    path.join(dir, SKILL_QUERY),
    `---\nname: wiki-query\ndescription: Motor falso del wiki (consulta de solo lectura).\n---\n\n# wiki-query\n\n${mark}\n`
  );
}

class FakeEngine {
  constructor(workDir) {
    this.dir = path.join(workDir, 'fake-engine.git');
    this.offDir = `${this.dir}.inaccesible`;
    this.pinnedRef = pinnedEngine().ref;
    this.otherRef = OTHER_REF;
    fs.mkdirSync(this.dir, { recursive: true });
    git(this.dir, 'init', '-q', '-b', 'main');
    for (const ref of [this.otherRef, this.pinnedRef]) {
      writeTag(this.dir, ref);
      git(this.dir, 'add', '-A');
      git(this.dir, 'commit', '-q', '-m', ref);
      git(this.dir, 'tag', ref);
    }
  }

  // A file:// URL, also with a Windows path
  get url() {
    return require('node:url').pathToFileURL(this.dir).href;
  }

  // The machine cannot reach the engine's repository
  setAccessible(accessible) {
    if (accessible && fs.existsSync(this.offDir)) fs.renameSync(this.offDir, this.dir);
    if (!accessible && fs.existsSync(this.dir)) fs.renameSync(this.dir, this.offDir);
  }

  get accessible() {
    return fs.existsSync(this.dir);
  }
}

// The engine ref a file of the fake engine belongs to, or null
function refIn(file) {
  try {
    return MARKER.exec(fs.readFileSync(file, 'utf8'))?.[1] ?? null;
  } catch {
    return null;
  }
}

function refInText(text) {
  return MARKER.exec(text ?? '')?.[1] ?? null;
}

module.exports = { FakeEngine, refIn, refInText, pinnedEngine, hasPinnedEngine, ENGINE_JSON, git };
