'use strict';

// The real .bat on Windows (windows-scenarios.cjs, design D7 of
// windows-global-distro): a user profile in a temporary directory, with spaces
// in its path, where %LOCALAPPDATA%, %USERPROFILE% and %TEMP% point, and
// optionally %XDG_DATA_HOME% and %XDG_CONFIG_HOME%; a local HTTP server that
// serves the release artifacts in place of GitHub, and counts and can refuse
// downloads; and the .bat run with cmd.exe, without blocking the server.

const crypto = require('node:crypto');
const fs = require('node:fs');
const http = require('node:http');
const path = require('node:path');
const { spawn } = require('node:child_process');

// Sets a variable of a copy of the environment, whatever the case of its name
function setVar(env, name, value) {
  for (const key of Object.keys(env)) if (key.toUpperCase() === name.toUpperCase()) delete env[key];
  if (value !== null) env[name] = value;
}

function getVar(env, name) {
  const key = Object.keys(env).find((k) => k.toUpperCase() === name.toUpperCase());
  return key === undefined ? undefined : env[key];
}

class WindowsProfile {
  // xdg: define XDG_DATA_HOME and XDG_CONFIG_HOME; path: the PATH of the machine
  constructor(workDir, { xdg = false, path: searchPath = null } = {}) {
    this.root = path.join(workDir, 'Perfil de prueba');
    this.vars = {
      USERPROFILE: this.root,
      LOCALAPPDATA: path.join(this.root, 'AppData', 'Local'),
      TEMP: path.join(this.root, 'AppData', 'Local', 'Temp'),
      TMP: path.join(this.root, 'AppData', 'Local', 'Temp'),
      XDG_DATA_HOME: xdg ? path.join(this.root, 'xdg datos') : null,
      XDG_CONFIG_HOME: xdg ? path.join(this.root, 'xdg config') : null,
    };
    for (const dir of [this.vars.LOCALAPPDATA, this.vars.TEMP]) fs.mkdirSync(dir, { recursive: true });
    this.searchPath = searchPath;
  }

  env() {
    const env = { ...process.env };
    for (const [name, value] of Object.entries(this.vars)) setVar(env, name, value);
    if (this.searchPath !== null) setVar(env, 'PATH', this.searchPath);
    return env;
  }

  // <data> and <config>, as the .bat computes them
  get data() {
    return this.vars.XDG_DATA_HOME ?? this.vars.LOCALAPPDATA;
  }

  get config() {
    return this.vars.XDG_CONFIG_HOME ?? path.join(this.vars.USERPROFILE, '.config');
  }

  // A path of a step, with %VARIABLE% as cmd expands it in this profile
  expand(text) {
    const env = this.env();
    return text.replace(/%(\w+)%/g, (whole, name) => getVar(env, name) ?? whole);
  }

  installedVersion() {
    try {
      return fs.readFileSync(path.join(this.data, 'idd', 'version'), 'utf8').trim();
    } catch {
      return null;
    }
  }

  // Every file under <data> and <config>, with its size, time and content hash
  snapshot() {
    const out = {};
    const walk = (dir, label) => {
      if (!fs.existsSync(dir)) return;
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        const file = path.join(dir, entry.name);
        if (entry.isDirectory()) walk(file, `${label}/${entry.name}`);
        else {
          const stat = fs.statSync(file);
          const hash = crypto.createHash('sha1').update(fs.readFileSync(file)).digest('hex');
          out[`${label}/${entry.name}`] = `${stat.size}:${stat.mtimeMs}:${hash}`;
        }
      }
    };
    walk(this.data, 'data');
    walk(this.config, 'config');
    return out;
  }
}

// Serves the files of a directory at <url>/<name>
class ReleaseServer {
  constructor(dir) {
    this.dir = dir;
    this.requests = [];
    this.failing = new Set();
    this.server = null;
  }

  async start() {
    fs.mkdirSync(this.dir, { recursive: true });
    this.server = http.createServer((req, res) => {
      const name = decodeURIComponent(req.url.split('?')[0].split('/').pop());
      this.requests.push(name);
      const file = path.join(this.dir, name);
      if (this.failing.has(name) || !fs.existsSync(file)) {
        res.statusCode = 404;
        res.end('not found');
        return;
      }
      res.setHeader('Content-Type', 'application/zip');
      fs.createReadStream(file).pipe(res);
    });
    await new Promise((resolve) => this.server.listen(0, '127.0.0.1', resolve));
    this.url = `http://127.0.0.1:${this.server.address().port}/releases`;
    return this;
  }

  fail(name) {
    this.failing.add(name);
  }

  stop() {
    this.server?.close();
    this.server = null;
  }
}

// Runs a .bat with cmd.exe; resolves with { status, stdout, stderr }
function runBat(bat, env) {
  return new Promise((resolve) => {
    let stdout = '';
    let stderr = '';
    const child = spawn(process.env.ComSpec || 'cmd.exe', ['/d', '/c', bat], { env, windowsHide: true });
    child.stdout.on('data', (chunk) => (stdout += chunk));
    child.stderr.on('data', (chunk) => (stderr += chunk));
    child.on('error', (error) => resolve({ status: null, stdout, stderr: `${stderr}${error.message}` }));
    child.on('close', (status) => resolve({ status, stdout, stderr }));
  });
}

// Whether a command is found in a PATH, as cmd's where finds it
function onPath(command, searchPath) {
  const exts = (process.env.PATHEXT || '.COM;.EXE;.BAT;.CMD').split(';');
  return searchPath
    .split(path.delimiter)
    .filter(Boolean)
    .some((dir) => exts.some((ext) => fs.existsSync(path.join(dir, `${command}${ext}`))));
}

module.exports = { WindowsProfile, ReleaseServer, runBat, onPath, setVar, getVar };
