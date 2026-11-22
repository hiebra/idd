'use strict';

// Core test of the Claude Code hooks, outside the specs (design D3 of
// add-quote-comment-rule): json_field, in .claude/hooks/json.sh, extracts a
// top-level text field from a JSON with bash only, undoing JSON escapes. A
// missing field or a JSON it does not understand gives an empty string.
//
// Run with: npm run test:core

const test = require('node:test');
const assert = require('node:assert/strict');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const JSON_SH = path.resolve(__dirname, '..', '..', '.claude', 'hooks', 'json.sh');

function jsonField(name, json) {
  const result = spawnSync('bash', ['-c', 'source "$1"; json_field "$2" "$3"', 'json-field', JSON_SH, name, json], { encoding: 'utf8' });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout;
}

const PROMPTS = [
  "'el segundo punto' no lo entiendo",
  'dice "hola" y se va',
  'una barra \\ y otra /',
  'dos\nlíneas\tcon tabulador',
  'acentos: ñandú, camión, ¿qué?',
  'emoji 😀 y comillas \' sueltas',
  '',
];

for (const prompt of PROMPTS) {
  test(`the prompt ${JSON.stringify(prompt)} comes back as it was`, () => {
    const json = JSON.stringify({ session_id: 'abc', transcript_path: '/tmp/x.jsonl', cwd: '/p', hook_event_name: 'UserPromptSubmit', prompt });
    assert.equal(jsonField('prompt', json), prompt);
  });
}

test('\\uXXXX escapes are undone', () => {
  assert.equal(jsonField('prompt', '{"prompt":"cami\\u00f3n \\u0027ya\\u0027"}'), "camión 'ya'");
});

test('a field after another one that mentions its name', () => {
  assert.equal(jsonField('prompt', '{"cwd":"/a/\\"prompt\\":\\"no\\"","prompt":"sí"}'), 'sí');
});

test('a missing field or a JSON it does not understand gives nothing', () => {
  assert.equal(jsonField('prompt', '{"cwd":"/p"}'), '');
  assert.equal(jsonField('prompt', '{"prompt":"sin cerrar'), '');
  assert.equal(jsonField('prompt', '{"prompt":"escape raro \\q"}'), '');
  assert.equal(jsonField('prompt', 'no es json'), '');
  assert.equal(jsonField('prompt', ''), '');
});
