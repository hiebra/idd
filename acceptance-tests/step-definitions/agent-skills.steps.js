'use strict';

const assert = require('node:assert/strict');
const { Given, When, Then } = require('@cucumber/cucumber');

Given('un clon del proyecto', function () {
  this.ensureProject();
});

When(/^(Claude Code|OpenCode) busca las skills del proyecto$/, function (agent) {
  this.findSkills(agent);
});

Then('encuentra cada skill de `.agents\\/skills\\/`', function () {
  const { agent, skills } = this.foundSkills;
  const found = new Set(skills.map((skill) => skill.id));
  const expected = this.schemaSkillIds();
  assert.ok(expected.length > 0, 'the project has no schema skills in .agents/skills/');
  assert.deepEqual(
    expected.filter((id) => !found.has(id)),
    [],
    `${agent} does not find these schema skills`
  );
});

Then('cada una aparece una sola vez', function () {
  const { agent, skills } = this.foundSkills;
  const ids = skills.map((skill) => skill.id);
  assert.deepEqual(
    ids.filter((id, i) => ids.indexOf(id) !== i),
    [],
    `${agent} finds these skills more than once`
  );
});

Then('el nombre que declara cada skill coincide con el de su directorio', function () {
  const { agent, skills } = this.foundSkills;
  const mismatched = skills
    .filter((skill) => skill.frontmatter.name !== skill.id)
    .map((skill) => `${skill.source}/${skill.id} declares name '${skill.frontmatter.name}'`);
  assert.deepEqual(mismatched, [], `in ${agent}`);
});
