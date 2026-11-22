'use strict';

// Release test (design D5 of windows-global-distro): the intent-driven schema
// and the skills that the template does not keep as its own are identical to
// their origin at the commit that .agents/release/origins.json pins. The
// origins have no tags, so the commit is what "unmodified" is checked against.
//
// It needs network access to GitHub, so it is not part of test:core nor of the
// default profile: it runs in the release workflow's Linux job.
//
// Run with: npm run test:release
// RELEASE_TREE: the tree to check (default: this repository)

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { execFileSync } = require('node:child_process');

const TREE = path.resolve(process.env.RELEASE_TREE || path.join(__dirname, '..', '..'));
const ORIGINS = JSON.parse(fs.readFileSync(path.join(TREE, '.agents', 'release', 'origins.json'), 'utf8'));

// The origin repository at the pinned commit, in a temporary directory
function checkout(t, { repo, commit }) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'origin-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const git = (...args) => execFileSync('git', args, { cwd: dir, stdio: ['ignore', 'pipe', 'pipe'], env: { ...process.env, GIT_TERMINAL_PROMPT: '0' } });
  git('init', '-q');
  git('fetch', '-q', '--depth', '1', `https://github.com/${repo}.git`, commit);
  git('-c', 'advice.detachedHead=false', 'checkout', '-q', 'FETCH_HEAD');
  return dir;
}

// Every file under a directory, as relative paths with /
function files(dir, rel = '') {
  const out = [];
  for (const entry of fs.readdirSync(path.join(dir, rel), { withFileTypes: true })) {
    const child = rel ? `${rel}/${entry.name}` : entry.name;
    if (entry.isDirectory()) out.push(...files(dir, child));
    else out.push(child);
  }
  return out.sort();
}

function assertSameTree(local, origin, what) {
  assert.deepEqual(files(local), files(origin), `${what}: the files differ from the origin`);
  for (const file of files(local)) {
    assert.ok(fs.readFileSync(path.join(local, file)).equals(fs.readFileSync(path.join(origin, file))), `${what}: ${file} differs from the origin`);
  }
}

test('the intent-driven schema is the origin one at the pinned commit', (t) => {
  const { schema } = ORIGINS;
  const origin = checkout(t, schema);
  assertSameTree(path.join(TREE, schema.local), path.join(origin, schema.path), `schema (${schema.repo}@${schema.commit})`);
});

test('the skills the template does not keep as its own are the origin ones at the pinned commit', (t) => {
  const { skills } = ORIGINS;
  const origin = checkout(t, skills);
  const ids = fs.readdirSync(path.join(TREE, skills.local)).filter((id) => !skills.own.includes(id));
  assert.ok(ids.length > 0, 'no skills to check');
  for (const id of ids) {
    assertSameTree(path.join(TREE, skills.local, id), path.join(origin, skills.path, id), `skill ${id} (${skills.repo}@${skills.commit})`);
  }
  // The skills the template keeps as its own exist
  for (const id of skills.own) assert.ok(fs.existsSync(path.join(TREE, skills.local, id, 'SKILL.md')), `own skill ${id} is missing`);
});
