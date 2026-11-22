'use strict';

// The spec lint for the spec-lint scenarios (replace-gherkin-lint-with-gplint,
// design D4). The scenarios cannot run `npm run lint:specs` as is: it rebuilds
// .extracted/, which is where cucumber-js reads the running suite from. So
// this runs the same two commands as the script, with other directories:
// the extractor over an openspec/ tree, then gplint with the pinned config.
// core-tests/spec-lint-script.test.js keeps the script and these two commands
// from drifting apart.

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const SUITE = path.resolve(__dirname, '..');
const EXTRACTOR = path.join(SUITE, 'extract-gherkin.cjs');
const LINTER = path.join(SUITE, 'node_modules', '.bin', 'gplint');
const CONFIG = path.join(SUITE, '.gplintrc');

// A spec with a single requirement whose scenario has one defect. The line of
// the defect is the one marked with DEFECT; the marker is removed.
const DEFECT_SPECS = {
  'un Scenario Outline sin Examples': [
    '#### Scenario Outline: Un escenario sin ejemplos DEFECT',
    '',
    '```gherkin',
    'Given un valor <x>',
    'Then se acepta',
    '```',
  ],
  'una tabla de Examples en un Scenario': [
    '#### Scenario: Un escenario con ejemplos DEFECT',
    '',
    '```gherkin',
    'Given un valor <x>',
    'Then se acepta',
    '',
    'Examples:',
    '  | x |',
    '  | 1 |',
    '```',
  ],
  'un espacio al final de un paso': [
    '#### Scenario: Un escenario con un espacio final',
    '',
    '```gherkin',
    'Given un valor DEFECT',
    'Then se acepta',
    '```',
  ],
};

// Writes <openspecDir>/specs/demo/spec.md with the defect and returns the
// path of the spec and the 1-based line of the defect
function writeDefectSpec(openspecDir, defect) {
  const body = DEFECT_SPECS[defect];
  if (!body) throw new Error(`no spec for the defect '${defect}'`);
  const lines = [
    '# demo',
    '',
    '## Purpose',
    'Una spec de prueba para el lint.',
    '',
    '## Requirements',
    '',
    '### Requirement: Un requisito',
    'El sistema DEBE aceptar el valor.',
    '',
    ...body,
    '',
  ];
  const at = lines.findIndex((line) => line.includes('DEFECT'));
  // The trailing-space defect keeps one space where the marker was
  lines[at] = lines[at].includes('Given') ? lines[at].replace('DEFECT', '') : lines[at].replace(' DEFECT', '');
  const spec = path.join(openspecDir, 'specs', 'demo', 'spec.md');
  fs.mkdirSync(path.dirname(spec), { recursive: true });
  fs.writeFileSync(spec, lines.join('\n'));
  return { spec, line: at + 1 };
}

// Extracts <openspecDir> into <outDir> and lints it. Returns the exit code of
// the linter and its errors, each with the spec.md it belongs to and its line
// (extraction keeps line N of the .feature as line N of the spec.md).
function lintSpecs(openspecDir, outDir) {
  const extract = spawnSync(process.execPath, [EXTRACTOR, openspecDir, outDir], { encoding: 'utf8' });
  if (extract.status !== 0) throw new Error(`extraction failed:\n${extract.stderr}`);
  const lint = spawnSync(LINTER, ['-c', CONFIG, '-f', 'json', outDir], { encoding: 'utf8', cwd: SUITE });
  let report;
  try {
    report = JSON.parse(lint.stdout);
  } catch {
    // gplint exits 0 without a report when it cannot lint (an unknown level)
    report = null;
  }
  const errors = (report ?? []).flatMap((file) =>
    file.errors.map((error) => ({
      spec: path.join(openspecDir, path.relative(outDir, file.filePath).replace(/spec\.feature$/, 'spec.md')),
      line: error.line,
      rule: error.rule,
      message: error.message,
    }))
  );
  return { exitCode: lint.status, report, errors, output: `${lint.stdout}${lint.stderr}` };
}

module.exports = { writeDefectSpec, lintSpecs, DEFECT_SPECS };
