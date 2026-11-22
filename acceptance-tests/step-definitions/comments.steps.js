'use strict';

// Steps of response-comments (add-quote-comment-rule,
// update-comment-closing-and-quotes, update-comment-phrase-and-opencode-marker). As with the wiki guide,
// the suite cannot check that the model follows the rule: it checks what the
// template guarantees through the agent adapters (design D6).

const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { Given, When, Then } = require('@cucumber/cucumber');

const AGENT = '(Claude Code|OpenCode)';
const RULE = path.join('.agents', 'comments', 'rule.md');

// The rule as the agent receives it: the project's rule file without its
// section identifiers (design D1)
function ruleAsDelivered(world) {
  return fs
    .readFileSync(path.join(world.ensureProject().dir, RULE), 'utf8')
    .replace(/<!-- comments-rule:[a-z0-9-]+ -->\n/g, '')
    .trim();
}

function deliveredContext(world) {
  return world.session.context.join('\n');
}

// --- Entrega al empezar la sesión --------------------------------------------

Then('el contexto de la sesión incluye la regla de comentarios', function () {
  assert.ok(this.session.context.length > 0, `${this.session.agent} added nothing to the context:\n${this.session.log}`);
});

Then('esa regla procede del único archivo de la regla de comentarios del proyecto', function () {
  assert.ok(
    deliveredContext(this).includes(ruleAsDelivered(this)),
    `the context does not include the rule of ${RULE}:\n${deliveredContext(this).slice(0, 500)}`
  );
});

Then(new RegExp(`^el proyecto no tiene archivos de instrucciones que ${AGENT} cargue siempre con la regla de comentarios$`), function (agent) {
  const skills = require('../support/skills');
  assert.deepEqual(skills.alwaysLoadedInstructions(agent, this.project.dir), []);
});

// --- Contenido de la regla ----------------------------------------------------

const FIXED_REPLY = 'Añade más comentarios o pídeme que los procese (p) o reformule (r) en base a ellos';

// Each Then of the rule scenarios names one section of the rule, by its
// identifier, so that they do not depend on its wording (design D1)
const RULE_SECTIONS = {
  'indica que es un comentario sobre la intervención anterior del agente': 'es-comentario',
  'indica que una cita de Markdown al principio del mensaje también es una marca de comentario': 'es-comentario-cita',
  'indica que una cita de la web de OpenCode en el mensaje también lo convierte en un comentario': 'es-comentario-cita-web',
  'indica contestar solo con la frase fija': 'frase-fija',
  'indica contestar en el idioma del comentario': 'idioma',
  'indica acumular el comentario sin investigar ni modificar nada a raíz de él': 'acumular',
  'indica responder en un solo mensaje a todos los comentarios acumulados': 'procesar-responde-todos',
  'indica incluir entre ellos el propio mensaje si es un comentario': 'procesar-incluye-comentario',
  'indica repetir la intervención completa incorporando los comentarios acumulados': 'reformula-completa',
  'indica asumir que el usuario solo ha leído las partes que citó': 'reformula-solo-leido',
  'indica que la intervención reformulada no remite a la anterior': 'reformula-autonoma',
};

// The text of a section: from its identifier to the next one, or to the end
function ruleSection(ruleText, id) {
  const marker = `<!-- comments-rule:${id} -->`;
  const start = ruleText.indexOf(marker);
  if (start === -1) return null;
  const rest = ruleText.slice(start + marker.length);
  const next = rest.search(/<!-- comments-rule:[a-z0-9-]+ -->/);
  return (next === -1 ? rest : rest.slice(0, next)).trim();
}

Given('la regla de comentarios del proyecto', function () {
  this.commentsRule = fs.readFileSync(path.join(this.ensureProject().dir, RULE), 'utf8');
});

for (const [text, id] of Object.entries(RULE_SECTIONS)) {
  Then(text, function () {
    const section = ruleSection(this.commentsRule, id);
    assert.ok(section, `${RULE} has no section comments-rule:${id}`);
    if (id === 'frase-fija') assert.ok(section.includes(FIXED_REPLY), `comments-rule:frase-fija does not include the fixed reply:\n${section}`);
  });
}

// --- Recordatorio con los mensajes -------------------------------------------

const REMINDER = path.join('.agents', 'comments', 'reminder.md');

function commentsReminder(world) {
  return fs.readFileSync(path.join(world.ensureProject().dir, REMINDER), 'utf8').trim();
}

// OpenCode loads every local plugin it finds; without this one, the session
// has only the bootstrap (ADR-0018)
Given('un clon del proyecto sin el plugin de comentarios de OpenCode', function () {
  fs.rmSync(path.join(this.ensureProject().dir, '.opencode', 'plugins', 'response-comments'), { recursive: true, force: true });
});

// A quote from OpenCode's web reaches the context hook as text inside the
// user message (D1b of update-comment-phrase-and-opencode-marker)
When(/^el usuario cita "([^"]+)" desde la web de OpenCode con el comentario "([^"]+)"$/, function (fragment, comment) {
  this.sendMessage(
    `\nThe user quoted the following from la respuesta:\n> ${fragment}\n\nThe user made the following comment regarding this quote: ${comment}`
  );
});

// The rest of the line is the message: the examples carry single and double quotes
When(/^el usuario envía el mensaje (.+)$/, function (text) {
  this.sendMessage(text);
});

Then('el agente recibe el mensaje junto con el recordatorio de la regla de comentarios', function () {
  const sent = this.sentMessage.result;
  assert.equal(sent.delivered, true, sent.log);
  assert.deepEqual(sent.problems, [], sent.log);
  assert.ok(sent.messages.includes(this.sentMessage.text), sent.log);
  assert.ok(sent.reminders.some((text) => text.includes(commentsReminder(this))), `no comments reminder:\n${sent.log}`);
});

Then('el agente recibe el mensaje sin el recordatorio de la regla de comentarios', function () {
  const sent = this.sentMessage.result;
  assert.equal(sent.delivered, true, sent.log);
  assert.deepEqual(sent.problems, [], sent.log);
  assert.ok(sent.messages.includes(this.sentMessage.text), sent.log);
  assert.ok(!sent.reminders.some((text) => text.includes(commentsReminder(this))), `unexpected comments reminder:\n${sent.log}`);
});

// --- Desactivación en local --------------------------------------------------

// Claude Code: in .claude/settings.local.json, the user's own and not
// versioned; OpenCode: in the environment it is launched from (design D5)
Given(new RegExp(`^el usuario ha desactivado la regla de comentarios para sí mismo en ${AGENT}$`), function (agent) {
  this.ensureProject();
  if (agent === 'Claude Code') this.project.writeClaudeLocalSettings({ env: { PROJECT_COMMENTS: 'off' } });
  else this.machine.commentsDisabled = true;
});

Then('el agente no recibe la regla de comentarios', function () {
  const rule = ruleAsDelivered(this);
  assert.ok(!this.session.context.some((text) => text.includes(rule)), `${this.session.agent}:\n${this.session.log}`);
});

Then('el agente no recibe el recordatorio de la regla de comentarios con los mensajes', function () {
  const sent = this.sentMessage.result;
  assert.equal(sent.delivered, true, sent.log);
  assert.ok(!sent.reminders.some((text) => text.includes(commentsReminder(this))), `unexpected comments reminder:\n${sent.log}`);
});

module.exports = { ruleAsDelivered, FIXED_REPLY };
