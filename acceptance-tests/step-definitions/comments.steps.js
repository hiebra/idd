'use strict';

// Steps of response-comments (add-quote-comment-rule). As with the wiki guide,
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

const FIXED_REPLY =
  'Puedes seguir comentando mi intervención, pedirme que conteste a todos tus comentarios introduciendo en el prompt la palabra "ya", o pedirme que reformule mi intervención introduciendo la palabra "reformula".';

// Each Then of the rule scenarios names one section of the rule, by its
// identifier, so that they do not depend on its wording (design D1)
const RULE_SECTIONS = {
  'indica que es un comentario sobre la intervención anterior del agente': 'es-comentario',
  'indica contestar solo con la frase fija': 'frase-fija',
  'indica acumular el comentario sin investigar ni modificar nada a raíz de él': 'acumular',
  'indica responder en un solo mensaje a todos los comentarios acumulados': 'ya-responde-todos',
  'indica incluir entre ellos el propio mensaje si es un comentario': 'ya-incluye-comentario',
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

module.exports = { ruleAsDelivered, FIXED_REPLY };
