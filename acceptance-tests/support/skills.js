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

module.exports = { discoverSkills, schemaSkillIds, schemaSkillProblems, readFrontmatter, SUPPORTED_AGENTS: Object.keys(SOURCES) };
