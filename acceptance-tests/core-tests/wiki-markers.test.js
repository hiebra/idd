'use strict';

// Core test of the session bootstrap, outside the specs (design D1 of
// fix-wiki-flow-operations): the guide and the reminder name each engine
// operation through a marker, which the core replaces by how the operation is
// invoked in each agent. A text left with an unknown marker is not delivered.
//
// Run with: npm run test:core

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { Machine } = require('../support/machine');

const CORE = path.resolve(__dirname, '..', '..', '.agents', 'hooks', 'session-bootstrap.sh');

const OPERATIONS = {
  'claude-code': { query: '`/wiki:query --local`', ingest: '`/wiki:ingest <url> --local`' },
  opencode: { query: 'la skill `wiki-query`', ingest: 'ingiere la fuente' },
};

// A project with only what wiki_text reads: engine.json, the guide and the
// reminder, with a copy of the core next to them, because the core looks for
// the texts next to itself (design D8 of add-project-wiki-toggle)
function projectWith({ guide, reminder }) {
  const dir = Machine.tmpDir();
  const wiki = path.join(dir, '.agents', 'wiki');
  fs.mkdirSync(wiki, { recursive: true });
  fs.mkdirSync(path.join(dir, '.agents', 'hooks'), { recursive: true });
  fs.copyFileSync(CORE, path.join(dir, '.agents', 'hooks', 'session-bootstrap.sh'));
  fs.writeFileSync(path.join(wiki, 'engine.json'), '{ "enabled": true, "repo": "owner/engine", "ref": "v1.0.0" }\n');
  fs.writeFileSync(path.join(wiki, 'guide.md'), guide);
  fs.writeFileSync(path.join(wiki, 'reminder.md'), reminder);
  return dir;
}

function wikiText(mode, agent, dir) {
  const env = { ...process.env };
  delete env.PROJECT_WIKI;
  const result = spawnSync('bash', [path.join(dir, '.agents', 'hooks', 'session-bootstrap.sh'), mode, agent, dir], { encoding: 'utf8', env });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout;
}

for (const [agent, ops] of Object.entries(OPERATIONS)) {
  test(`${agent}: every marker is replaced in the guide and the reminder`, (t) => {
    const dir = projectWith({
      guide: '# Guía\n\n<!-- wiki-guide:consultar -->\nConsulta con {{query}}; ingiere con {{ingest}}.\n',
      reminder: 'Recordatorio: consulta con {{query}}; lo de internet, {{ingest}}.\n',
    });
    t.after(() => fs.rmSync(dir, { recursive: true, force: true }));

    const guide = wikiText('guide', agent, dir);
    assert.ok(guide.includes(`Consulta con ${ops.query}; ingiere con ${ops.ingest}.`), guide);
    assert.doesNotMatch(guide, /\{\{|wiki-guide:/, guide);

    const reminder = wikiText('reminder', agent, dir);
    assert.equal(reminder, `Recordatorio: consulta con ${ops.query}; lo de internet, ${ops.ingest}.\n`);
  });

  test(`${agent}: a guide or a reminder with an unknown marker is not delivered`, (t) => {
    const dir = projectWith({
      guide: '# Guía\n\nConsulta con {{query}} y {{desconocido}}.\n',
      reminder: 'Recordatorio: {{query}} y {{desconocido}}.\n',
    });
    t.after(() => fs.rmSync(dir, { recursive: true, force: true }));

    assert.equal(wikiText('guide', agent, dir), '');
    assert.equal(wikiText('reminder', agent, dir), '');
  });
}
