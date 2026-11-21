'use strict';

// OpenSpec on the project copy, with the CLI the project pins (the one the
// suite's machine installed in the repository's node_modules/.bin).

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { REPO_ROOT } = require('./project');

const CLI = path.join(REPO_ROOT, 'node_modules', '.bin', 'openspec');

// A change with every planning artifact and every task done
function addChangeReadyToArchive(project, name) {
  const dir = project.path('openspec', 'changes', name);
  fs.mkdirSync(path.join(dir, 'specs', 'prueba'), { recursive: true });
  fs.writeFileSync(path.join(dir, '.openspec.yaml'), 'schema: intent-driven\ncreated: 2026-01-01\n');
  fs.writeFileSync(path.join(dir, 'proposal.md'), '## Why\n\nPrueba.\n\n## What Changes\n\n- Nada.\n');
  fs.writeFileSync(path.join(dir, 'design.md'), '## Context\n\nPrueba.\n');
  fs.writeFileSync(path.join(dir, 'adr.md'), '# ADR Review Manifest\n\n- Status: completed\n');
  fs.writeFileSync(
    path.join(dir, 'specs', 'prueba', 'spec.md'),
    '# prueba\n\n## ADDED Requirements\n\n### Requirement: Prueba\nEl sistema DEBE probar.\n\n#### Scenario: Prueba\n\n- **WHEN** se prueba\n- **THEN** funciona\n'
  );
  fs.writeFileSync(path.join(dir, 'tasks.md'), '## 1. Prueba\n\n- [x] 1.1 Probar\n');
  return name;
}

// `openspec instructions archive --change <name> --json` on the project
function archiveInstructions(project, name) {
  if (!fs.existsSync(CLI)) throw new Error(`the project's OpenSpec CLI is not installed: ${CLI}`);
  const result = spawnSync(CLI, ['instructions', 'archive', '--change', name, '--json'], {
    cwd: project.dir,
    encoding: 'utf8',
  });
  let json = null;
  try {
    json = JSON.parse(result.stdout);
  } catch {
    // reported below
  }
  if (!json) throw new Error(`openspec instructions archive failed (exit ${result.status}):\n${result.stdout}\n${result.stderr}`);
  return json;
}

module.exports = { addChangeReadyToArchive, archiveInstructions };
