'use strict';

// Project skill discovery rules of each supported agent (design D6), and the
// SKILL.md frontmatter they read. This is the only copy of these rules in the
// project: when an agent changes how it finds skills, update them here.
//
// - Claude Code: <project>/.claude/skills/<id>/SKILL.md, following symlinks.
// - OpenCode 2: the project sources .claude/skills, .agents/skills and
//   .opencode/skills, each as <source>/<id>/SKILL.md. When an id appears in
//   several sources, only the one with the highest precedence loads, in this
//   order: .claude/skills, .agents/skills, ~/.config/opencode/skills (global,
//   not a project source), .opencode/skills. It does not require the declared
//   name to match the directory.
//
// Claude Code commands: <project>/.claude/commands/<cmd>.md is /<cmd>, and
// <project>/.claude/commands/<ns>/<cmd>.md is /<ns>:<cmd>, following symlinks
// (checked with Claude Code 2.1.330: a symlinked commands/wiki/ gives
// /wiki:<cmd>). OpenCode 2 has no project commands from these paths.
//
// The wiki operations each agent has, and where they come from (design D1):
// read-only query and wiki management. And the instruction files each agent
// always loads, which the user cannot turn off.

const fs = require('node:fs');
const path = require('node:path');

const SCHEMA_SKILLS_DIR = path.join('.agents', 'skills');

const SOURCES = {
  'Claude Code': [path.join('.claude', 'skills')],
  OpenCode: [path.join('.claude', 'skills'), path.join('.agents', 'skills'), path.join('.opencode', 'skills')],
};

// Frontmatter of a SKILL.md: top-level `key: value` lines and one nested
// level (metadata), the subset of YAML the project's skills use
function readFrontmatter(file) {
  const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
  if (lines[0] !== '---') return {};
  const data = {};
  let parent = null;
  for (const line of lines.slice(1)) {
    if (line === '---') break;
    const nested = /^\s+([\w-]+):\s*(.*)$/.exec(line);
    if (nested && parent) {
      data[parent][nested[1]] = unquote(nested[2]);
      continue;
    }
    const top = /^([\w-]+):\s*(.*)$/.exec(line);
    if (!top) continue;
    if (top[2] === '') {
      parent = top[1];
      data[parent] = {};
    } else {
      parent = null;
      data[top[1]] = unquote(top[2]);
    }
  }
  return data;
}

function unquote(value) {
  const m = /^(["'])(.*)\1$/.exec(value.trim());
  return m ? m[2] : value.trim();
}

// The skills <source>/<id>/SKILL.md in one source, following symlinks
function skillsIn(projectDir, source) {
  const dir = path.join(projectDir, source);
  if (!fs.existsSync(dir)) return [];
  return fs
    .readdirSync(dir)
    .sort()
    .filter((id) => {
      try {
        return fs.statSync(path.join(dir, id, 'SKILL.md')).isFile();
      } catch {
        return false; // no SKILL.md, or a broken symlink
      }
    })
    .map((id) => {
      const file = path.join(dir, id, 'SKILL.md');
      return { id, source, file, frontmatter: readFrontmatter(file) };
    });
}

// The project skills an agent finds, in the order it loads them
function discoverSkills(agent, projectDir) {
  const sources = SOURCES[agent];
  if (!sources) throw new Error(`no skill discovery rules for agent '${agent}'`);
  const found = new Map();
  for (const source of sources) {
    for (const skill of skillsIn(projectDir, source)) {
      if (!found.has(skill.id)) found.set(skill.id, skill);
    }
  }
  return [...found.values()];
}

// The schema skills the project ships, by directory name
function schemaSkillIds(projectDir) {
  return skillsIn(projectDir, SCHEMA_SKILLS_DIR).map((skill) => skill.id);
}

// What keeps the schema skills from being available in each supported agent:
// one message per missing skill and agent; empty when all are available
function schemaSkillProblems(projectDir) {
  const problems = [];
  for (const agent of Object.keys(SOURCES)) {
    const found = new Set(discoverSkills(agent, projectDir).map((skill) => skill.id));
    for (const id of schemaSkillIds(projectDir)) {
      if (!found.has(id)) problems.push(`${agent} does not find the schema skill '${id}' of ${SCHEMA_SKILLS_DIR}/`);
    }
  }
  return problems;
}

// The Claude Code commands of the project, as { name, file }
// OpenCode 2.3.2 loads project commands from .opencode/command/ and
// .opencode/commands/ (task 1.3 of add-project-wiki-toggle), as /<file>
function discoverOpenCodeCommands(projectDir) {
  const commands = [];
  for (const dir of ['command', 'commands']) {
    const root = path.join(projectDir, '.opencode', dir);
    if (!fs.existsSync(root)) continue;
    for (const entry of fs.readdirSync(root).sort()) {
      const file = path.join(root, entry);
      if (entry.endsWith('.md') && fs.statSync(file).isFile()) commands.push({ name: `/${entry.slice(0, -3)}`, file });
    }
  }
  return commands;
}

function discoverCommands(agent, projectDir) {
  if (agent === 'OpenCode') return discoverOpenCodeCommands(projectDir);
  if (agent !== 'Claude Code') return [];
  const root = path.join(projectDir, '.claude', 'commands');
  if (!fs.existsSync(root)) return [];
  const commands = [];
  const isFile = (file) => {
    try {
      return fs.statSync(file).isFile();
    } catch {
      return false;
    }
  };
  const isDir = (dir) => {
    try {
      return fs.statSync(dir).isDirectory();
    } catch {
      return false;
    }
  };
  for (const entry of fs.readdirSync(root).sort()) {
    const full = path.join(root, entry);
    if (entry.endsWith('.md') && isFile(full)) {
      commands.push({ name: `/${entry.slice(0, -3)}`, file: full });
    } else if (isDir(full)) {
      for (const cmd of fs.readdirSync(full).sort()) {
        const file = path.join(full, cmd);
        if (cmd.endsWith('.md') && isFile(file)) commands.push({ name: `/${entry}:${cmd.slice(0, -3)}`, file });
      }
    }
  }
  return commands;
}

// The wiki operations an agent offers, by kind: each one names how the agent
// offers it and the file it comes from
const WIKI_OPERATIONS = {
  'Claude Code': { query: { command: '/wiki:query' }, management: { skill: 'wiki-manager' } },
  OpenCode: { query: { skill: 'wiki-query' }, management: { skill: 'wiki-manager' } },
};

function wikiOperations(agent, projectDir) {
  const spec = WIKI_OPERATIONS[agent];
  if (!spec) throw new Error(`no wiki operations for agent '${agent}'`);
  const skills = discoverSkills(agent, projectDir);
  const commands = discoverCommands(agent, projectDir);
  const operations = {};
  for (const [kind, { skill, command }] of Object.entries(spec)) {
    const found = skill ? skills.find((s) => s.id === skill) : commands.find((c) => c.name === command);
    operations[kind] = found ? { name: skill ?? command, file: found.file } : null;
  }
  return operations;
}

// Instruction files an agent always loads from the project
const ALWAYS_LOADED = {
  'Claude Code': ['CLAUDE.md', path.join('.claude', 'CLAUDE.md')],
  // OpenCode reads AGENTS.md, CLAUDE.md as a fallback, and the instructions of opencode.json
  OpenCode: ['AGENTS.md', 'CLAUDE.md'],
};

function alwaysLoadedInstructions(agent, projectDir) {
  const files = ALWAYS_LOADED[agent].filter((rel) => fs.existsSync(path.join(projectDir, rel)));
  if (agent === 'OpenCode') {
    for (const config of ['opencode.json', 'opencode.jsonc', path.join('.opencode', 'opencode.json')]) {
      const file = path.join(projectDir, config);
      if (!fs.existsSync(file)) continue;
      const text = fs.readFileSync(file, 'utf8');
      if (/"instructions"\s*:/.test(text)) files.push(`${config} (instructions)`);
    }
  }
  return files;
}

module.exports = { discoverCommands, wikiOperations, alwaysLoadedInstructions, discoverSkills, schemaSkillIds, schemaSkillProblems, readFrontmatter, SUPPORTED_AGENTS: Object.keys(SOURCES) };
