'use strict';

// Core test of the session bootstrap, outside the specs (design D2 of
// add-quote-comment-rule, D1 and D2 of update-comment-closing-and-quotes, D1
// and D1b of update-comment-phrase-and-opencode-marker): the
// comments-reminder mode reads the user's message on stdin and prints the
// reminder of the comments rule only when the message is a comment or contains
// a closing word (p, procesa, procesar, r, reformula, reformular). A comment
// starts, after any leading HTML comments, with a string between doubled single
// quotes ('') or a Markdown quote, or it holds a quote from OpenCode's web
// (a "The user quoted the following from …:" line followed by "> " lines). PROJECT_COMMENTS=off turns it off, and it always exits
// with 0.
//
// Run with: npm run test:core

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..');
const { runCore } = require('../support/core');
const REMINDER = path.join(ROOT, '.agents', 'comments', 'reminder.md');

function commentsReminder(message, { agent = 'claude-code', env = {} } = {}) {
  const base = { ...process.env };
  delete base.PROJECT_COMMENTS;
  const result = runCore(['comments-reminder', agent, ROOT], {
    encoding: 'utf8',
    input: message,
    env: { ...base, ...env },
  });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout;
}

const WEB_QUOTE = '\nThe user quoted the following from la respuesta:\n> el segundo punto\n> y el tercero\n';

const ACTIVATE = [
  "''el segundo punto'' no lo entiendo",
  "   ''con espacios delante'' sobra",
  "''esto sobra''",
  "''p'' no",
  "<!-- attach -->\n''tras una marca''",
  '> el segundo punto',
  '>sin espacio',
  '<!-- attach -->\n> mensaje citado\n\nqué tal este?',
  '<!-- attach --> <!-- otra -->\n\n> cita tras dos marcas',
  '  > con espacios delante',
  WEB_QUOTE,
  `${WEB_QUOTE}\nThe user made the following comment regarding this quote: no lo entiendo`,
  `mira esto${WEB_QUOTE}\nThe user made the following comment regarding this quote: no lo entiendo`,
  'p',
  'R',
  'procesa',
  'Procesar los comentarios',
  'Reformula, por favor',
  'reformular',
  'vale, p.',
  'creo que\nr',
];

const IGNORE = [
  '"foo" no aparece en el log',
  'ya',
  'ya lo veo',
  'mayo empieza el lunes',
  '¿lo reformulamos mañana?',
  'el resultado es a > b',
  '<!-- attach -->',
  "'' vacío",
  "'''' vacío",
  "'el segundo punto' no lo entiendo",
  "'esto sobra'",
  "''sin cierre",
  "''a'b'' con una comilla dentro",
  '\nThe user quoted the following from la respuesta:\nsin cita debajo',
  'The user quoted the following from la respuesta: > en la misma línea',
  "sin comillas al principio 'aquí'",
  'pr',
  'reformulado',
  'procesado',
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
  assert.equal(commentsReminder("''el segundo punto'' no lo entiendo", { env: { PROJECT_COMMENTS: 'off' } }), '');
  const result = runCore(['comments-rule', 'claude-code', ROOT], {
    encoding: 'utf8',
    env: { ...process.env, PROJECT_COMMENTS: 'off' },
  });
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout, '');
});

test('an unknown agent or a missing project gives nothing and exits with 0', () => {
  for (const args of [['comments-reminder', 'otro', ROOT], ['comments-reminder', 'claude-code', '/no/existe']]) {
    const result = runCore(args, { encoding: 'utf8', input: 'ya' });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout, '');
  }
});
