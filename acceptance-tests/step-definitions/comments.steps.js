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

module.exports = { ruleAsDelivered };
