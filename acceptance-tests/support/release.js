'use strict';

// The release artifacts on a scenario's project copy (windows-global-distro,
// design D5): the copy is a git repository, so a release is a tag on it, and
// scripts/release/build.mjs builds the three artifacts of that tag, with the
// scenario's fake wiki engine. A zip is unpacked with the zip reader of the
// machine (unzip), as tar.exe unpacks it on Windows.

const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { git } = require('./engine');
const { REPO_ROOT } = require('./project');

const BUILD = path.join(REPO_ROOT, 'scripts', 'release', 'build.mjs');

const artifactNames = (version) => ({
  global: `idd-global-${version}.zip`,
  bat: `idd-${version}.bat`,
  slim: `idd-slim-${version}.zip`,
});

// Tags the project copy's HEAD as a release
function tagRelease(project, tag) {
  git(project.dir, 'add', '-A');
  if (git(project.dir, 'status', '--porcelain').trim() !== '') git(project.dir, 'commit', '-q', '-m', 'release');
  git(project.dir, 'tag', tag);
}

// Builds the artifacts of a tag of the copy into outDir; returns their paths
function buildRelease({ project, tag, outDir, engineUrl = null, baseUrl = 'http://127.0.0.1:9/releases' }) {
  const args = [BUILD, '--repo', project.dir, '--tag', tag, '--out', outDir, '--base-url', baseUrl];
  if (engineUrl) args.push('--engine', engineUrl);
  const result = spawnSync(process.execPath, args, { encoding: 'utf8' });
  if (result.status !== 0) throw new Error(`build.mjs failed (${result.status}):\n${result.stdout}\n${result.stderr}`);
  const names = artifactNames(tag.replace(/^v/, ''));
  return Object.fromEntries(Object.entries(names).map(([kind, name]) => [kind, path.join(outDir, name)]));
}

// On Windows, with tar.exe, as the .bat does
function unzip(zip, dir) {
  fs.mkdirSync(dir, { recursive: true });
  const [command, args] = process.platform === 'win32' ? ['tar.exe', ['-xf', zip, '-C', dir]] : ['unzip', ['-q', '-o', zip, '-d', dir]];
  const result = spawnSync(command, args, { encoding: 'utf8' });
  if (result.status !== 0) throw new Error(`unzip ${zip} failed (${result.status}):\n${result.stderr}`);
  return dir;
}

// Every file under a directory, as relative paths with /
function filesUnder(dir, rel = '') {
  const out = [];
  for (const entry of fs.readdirSync(path.join(dir, rel), { withFileTypes: true })) {
    const child = rel ? `${rel}/${entry.name}` : entry.name;
    if (entry.isDirectory()) out.push(...filesUnder(dir, child));
    else out.push(child);
  }
  return out.sort();
}

module.exports = { tagRelease, buildRelease, unzip, filesUnder, artifactNames, BUILD };
