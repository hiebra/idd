'use strict';

// Core test of the session bootstrap, outside the specs (design D2 of
// add-quote-comment-rule): the comments-reminder mode reads the user's message
// on stdin and prints the reminder of the comments rule only when the message
// is a comment (it starts with a string between single quotes) or contains a
// closing word ("ya" or "reformula") outside that string. PROJECT_COMMENTS=off
// turns it off, and it always exits with 0.
//
// Run with: npm run test:core

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');

const ROOT = path.resolve(__dirname, '..', '..');
const CORE = path.join(ROOT, '.agents', 'hooks', 'session-bootstrap.sh');
const REMINDER = path.join(ROOT, '.agents', 'comments', 'reminder.md');

function commentsReminder(message, { agent = 'claude-code', env = {} } = {}) {
  const base = { ...process.env };
  delete base.PROJECT_COMMENTS;
  const result = spawnSync('bash', [CORE, 'comments-reminder', agent, ROOT], {
    encoding: 'utf8',
    input: message,
    env: { ...base, ...env },
  });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout;
}

const ACTIVATE = [
  "'el segundo punto' no lo entiendo",
  'ya',
  'Reformula, por favor',
  "   'con espacios delante' sobra",
  'YA',
  'vale, ya.',
  "'ya está bien' sobra",
  "'esto sobra'",
  'creo que\nya',
  "'ya' no",
];

const IGNORE = [
  '"foo" no aparece en el log',
  'mayo empieza el lunes',
  '¿lo reformulamos mañana?',
  "'' vacío",
  "sin comillas al principio 'aquí'",
  'yate',
  'ayá',
  '',
];

for (const agent of ['claude-code', 'opencode']) {
  for (const message of ACTIVATE) {
    test(`${agent}: ${JSON.stringify(message)} gets the reminder`, () => {
      const reminder = fs.readFileSync(REMINDER, 'utf8').trim();
      assert.equal(commentsReminder(message, { agent }).trim(), reminder);
    });
  }

  for (const message of IGNORE) {
    test(`${agent}: ${JSON.stringify(message)} gets no reminder`, () => {
      assert.equal(commentsReminder(message, { agent }), '');
    });
  }
}

test('PROJECT_COMMENTS=off: no reminder and no rule', () => {
  assert.equal(commentsReminder("'el segundo punto' no lo entiendo", { env: { PROJECT_COMMENTS: 'off' } }), '');
  const result = spawnSync('bash', [CORE, 'comments-rule', 'claude-code', ROOT], {
    encoding: 'utf8',
    env: { ...process.env, PROJECT_COMMENTS: 'off' },
  });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, '');
});

test('an unknown agent or a missing project gives nothing and exits with 0', () => {
  for (const args of [['comments-reminder', 'otro', ROOT], ['comments-reminder', 'claude-code', '/no/existe']]) {
    const result = spawnSync('bash', [CORE, ...args], { encoding: 'utf8', input: 'ya' });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout, '');
  }
});
