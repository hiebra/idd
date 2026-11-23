'use strict';

// The suite's scripted model for /toggle-wiki (design D7 of
// add-project-wiki-toggle). It follows the agent's command as written: it
// reads the step sections of the command file (marked with
// `<!-- toggle-wiki:<step> -->`), runs the bash of each step it takes in the
// session, and reports with the text the command gives in step 5.
//
// The only thing it does not take from the command is the engine's part of
// the initial ingest, which needs a real model and the real engine (section 10
// of the change's tasks): it stands in for it by simulating the engine's init
// and writing a manifest of the `source=` lines of `status`, pinned to HEAD.

const fs = require('node:fs');
const path = require('node:path');
const { git } = require('./engine');

const COMMAND_FILES = {
  'Claude Code': path.join('.claude', 'commands', 'toggle-wiki.md'),
  OpenCode: path.join('.opencode', 'commands', 'toggle-wiki.md'),
};
const MANIFEST_DIR = path.join('.wiki', 'raw', 'repos');

function commandFile(project, agent) {
  const rel = COMMAND_FILES[agent];
  if (!rel) throw new Error(`no /toggle-wiki command for agent '${agent}'`);
  return project.path(rel);
}

// The sections of the command, by the id of their marker
function sections(text) {
  const parts = text.split(/<!-- toggle-wiki:([a-z-]+) -->/);
  const found = {};
  for (let i = 1; i < parts.length; i += 2) found[parts[i]] = parts[i + 1];
  return found;
}

// The bash fences of a section, in order, without the indentation of a list item
function bashBlocks(section) {
  const blocks = [];
  for (const match of (section ?? '').matchAll(/^([ \t]*)```bash\n([\s\S]*?)^[ \t]*```/gm)) {
    const indent = match[1].length;
    blocks.push(match[2].split('\n').map((line) => line.slice(Math.min(indent, line.length - line.trimStart().length))).join('\n').trim());
  }
  return blocks;
}

// The text step 5 gives for a state: the quoted text of its list item
function reportText(section, label) {
  const match = new RegExp(`^- \\*\\*${label}\\*\\*: «([^»]+)»`, 'm').exec(section ?? '');
  if (!match) throw new Error(`the command does not say how to report the wiki ${label.toLowerCase()}:\n${section}`);
  return match[1];
}

function keyValues(stdout) {
  const lines = (stdout ?? '').split('\n').filter(Boolean);
  const value = (key) => lines.find((l) => l.startsWith(`${key}=`))?.slice(key.length + 1) ?? null;
  const all = (key) => lines.filter((l) => l.startsWith(`${key}=`)).map((l) => l.slice(key.length + 1));
  return { value, all };
}

// The engine's init and manifest-only ingest, as the scripted model's stand-in
function simulateIngest(project, sources) {
  project.simulateWikiInit();
  const head = git(project.dir, 'rev-parse', 'HEAD').trim();
  const rows = sources.map((file) => `| ${file} | ${git(project.dir, 'rev-parse', `HEAD:${file}`).trim()} |`);
  fs.mkdirSync(project.path(MANIFEST_DIR), { recursive: true });
  fs.writeFileSync(
    project.path(MANIFEST_DIR, `ingesta-inicial-${head.slice(0, 7)}.md`),
    ['---', 'type: collection', 'adapter: git', 'manifest_only: true', `revision: ${head}`, '---', '', '| path | blob |', '|---|---|', ...rows, ''].join('\n')
  );
}

// The manifests of the project wiki, as { revision, paths }
function manifests(project) {
  const dir = project.path(MANIFEST_DIR);
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir).map((name) => {
    const text = fs.readFileSync(path.join(dir, name), 'utf8');
    const revision = /^revision: (\S+)$/m.exec(text)?.[1] ?? null;
    const paths = [...text.matchAll(/^\| ([^|]+?) \| [0-9a-f]{40} \|$/gm)].map((m) => m[1]);
    return { name, revision, paths };
  });
}

// Runs /toggle-wiki in an open session. When the command stops to propose the
// initial ingest, the result has a `proposal` and `answer(confirmed)` goes on.
function runToggleWiki(project, session, agent) {
  const file = commandFile(project, agent);
  if (!fs.existsSync(file)) throw new Error(`${agent} has no /toggle-wiki command (${file})`);
  const steps = sections(fs.readFileSync(file, 'utf8'));
  const runs = [];
  const run = (command) => {
    const result = session.run(command);
    runs.push({ command, status: result.status, stdout: result.stdout, stderr: result.stderr });
    if (result.status !== 0) throw new Error(`${agent}: '${command}' exited with ${result.status}:\n${result.stdout}\n${result.stderr}`);
    return result;
  };
  const block = (id, index = 0) => {
    const command = bashBlocks(steps[id])[index];
    if (!command) throw new Error(`step '${id}' of the /toggle-wiki command of ${agent} has no bash block ${index + 1}`);
    return command;
  };
  const toggle = { agent, runs, report: null, proposal: null, answer: null };
  const status = keyValues(run(block('status')).stdout);
  toggle.status = { enabled: status.value('enabled'), wikiDir: status.value('wiki-dir') };
  if (toggle.status.enabled === 'true') {
    run(block('off'));
    toggle.report = reportText(steps.report, 'Deshabilitado');
  } else if (toggle.status.wikiDir === 'true') {
    run(block('on'));
    toggle.report = reportText(steps.report, 'Habilitado');
  } else {
    const sources = status.all('source');
    toggle.proposal = { sources, excluded: status.all('excluded').map((entry) => entry.split('|')[0]) };
    toggle.answer = (confirmed) => {
      toggle.answer = null;
      if (!confirmed) {
        toggle.report = 'El wiki del proyecto sigue deshabilitado.';
        return toggle;
      }
      run(block('ingest', 0));
      simulateIngest(project, sources);
      run(block('ingest', 1));
      toggle.report = reportText(steps.report, 'Habilitado');
      return toggle;
    };
  }
  return toggle;
}

module.exports = { runToggleWiki, manifests, COMMAND_FILES };
