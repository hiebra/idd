'use strict';

// Simulated machines for the session-bootstrap scenarios (design D9).
//
// The hook only sees the machine through its PATH and environment, so each
// condition is a PATH layout plus a few environment variables:
//   - npm spy: an npm wrapper first in PATH that logs every call (cwd + args)
//   - no npm: a directory holding only the system tools the hook uses
//   - Node 20: a fake `node` that reports v20.11.0 and delegates the rest
//   - global OpenSpec: a fake `openspec` that reports another version
//   - offline: npm pointed at a closed port, with an empty cache; when npm
//     fails, the spy adds a last line with quotes, backslashes, a tab and a
//     control character, so that the warning that quotes npm's log checks
//     how each agent adapter escapes it
//   - git spy: a git wrapper first in PATH that logs every call, so scenarios
//     can tell whether the wiki engine was cloned
//   - no user hub: HOME points at an empty directory (npm keeps its cache)
//   - ephemeral container: the variables of the cloud environment
//     (CLAUDE_CODE_CONTAINER_ID, CLAUDE_CODE_REMOTE), set only when the
//     scenario asks for them, whatever the machine that runs the suite is
//   - wiki disabled for the user: PROJECT_WIKI=off in the environment the
//     agent is launched from (design D4); Claude Code reads it from
//     .claude/settings.local.json instead, see its adapter

const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { EPHEMERAL_VARS, EPHEMERAL_ENV } = require('./branches');

const REAL_NODE = process.execPath;
const OLD_NODE_VERSION = '20.11.0';
const GLOBAL_OPENSPEC_VERSION = '0.9.0';
const NPM_FAILURE_LINE = 'npm-simulado: "comillas" \\barras\\ tab\tfin \\n literal y control \u0001 fin';
// System tools the hook needs besides node and npm
const HOOK_TOOLS = [
  'awk', 'bash', 'cat', 'dirname', 'git', 'grep', 'head', 'ln', 'mkdir', 'mktemp', 'mv', 'readlink', 'rm', 'sed',
  'sha256sum', 'sort', 'tail', 'timeout', 'wc',
];

function which(command, searchPath = process.env.PATH || '') {
  for (const dir of searchPath.split(path.delimiter)) {
    if (!dir) continue;
    const candidate = path.join(dir, command);
    try {
      fs.accessSync(candidate, fs.constants.X_OK);
      return candidate;
    } catch {
      // keep looking
    }
  }
  return null;
}

function writeExecutable(file, content) {
  fs.writeFileSync(file, content, { mode: 0o755 });
}

// npm runs package scripts with npm_* variables in the environment; they would
// steer the hook's own npm calls, so only network settings are passed through.
function cleanEnv() {
  const keep = /^npm_config_(https?_proxy|proxy|noproxy|cafile|userconfig)$/i;
  const env = {};
  for (const [key, value] of Object.entries(process.env)) {
    if (/^npm_/i.test(key) && !keep.test(key)) continue;
    if (EPHEMERAL_VARS.includes(key)) continue;
    if (['CLAUDE_ENV_FILE', 'CLAUDE_PROJECT_DIR', 'CLAUDE_PLUGIN_ROOT', 'PROJECT_WIKI', 'PROJECT_COMMENTS'].includes(key)) continue;
    // Git settings of the machine that runs the suite would steer the hook's git calls
    if (/^GIT_/.test(key)) continue;
    env[key] = value;
  }
  return env;
}

class Machine {
  constructor(workDir) {
    this.workDir = workDir;
    this.hasNpm = true;
    this.nodeVersion = null; // null: the real node
    this.globalOpenspec = false;
    this.offline = false;
    // false: the agent offers no way to adjust the session's PATH
    this.sessionPathAdjustable = true;
    // false: HOME is an empty directory, with no user hub
    this.hasUserHub = true;
    // true: the user disabled the wiki in the environment the agent starts from
    this.wikiDisabled = false;
    this.commentsDisabled = false;
    // true: the session runs in an ephemeral container (manage-git-discipline)
    this.ephemeral = false;

    const realNpm = which('npm');
    if (!realNpm) throw new Error('the acceptance suite needs npm on the machine that runs it');
    this.realNpm = realNpm;
    // Only node, npm and npx from the directory that holds them: it may also
    // hold global packages, such as a real global openspec
    this.nodeDir = path.join(workDir, 'bin', 'node');
    this.basePath = [this.nodeDir, '/usr/bin', '/bin'];
    this.spyLog = path.join(workDir, 'npm-calls.log');
    this.gitLog = path.join(workDir, 'git-calls.log');
    this.emptyHome = path.join(workDir, 'home-sin-hub');
    this.npmCache = process.env.npm_config_cache || path.join(os.homedir(), '.npm');
    this.#buildBins();
  }

  #buildBins() {
    const bin = (name) => {
      const dir = path.join(this.workDir, 'bin', name);
      fs.mkdirSync(dir, { recursive: true });
      return dir;
    };

    this.failureLineFile = path.join(this.workDir, 'npm-failure-line.txt');
    fs.writeFileSync(this.failureLineFile, NPM_FAILURE_LINE + '\n');
    this.spyDir = bin('npm-spy');
    writeExecutable(
      path.join(this.spyDir, 'npm'),
      '#!/bin/bash\n' +
        `echo "$PWD npm $*" >> "${this.spyLog}"\n` +
        `if [ -z "\${SIMULATED_OFFLINE:-}" ]; then exec "${this.realNpm}" "$@"; fi\n` +
        `"${this.realNpm}" "$@"\n` +
        'status=$?\n' +
        `if [ "$status" -ne 0 ]; then cat "${this.failureLineFile}" >&2; fi\n` +
        'exit "$status"\n'
    );

    const realGit = which('git');
    if (!realGit) throw new Error('the acceptance suite needs git on the machine that runs it');
    writeExecutable(
      path.join(this.spyDir, 'git'),
      '#!/bin/bash\n' + `printf '%s\\n' "$*" >> "${this.gitLog}"\n` + `exec "${realGit}" "$@"\n`
    );

    this.oldNodeDir = bin('node-old');
    writeExecutable(
      path.join(this.oldNodeDir, 'node'),
      '#!/bin/bash\n' +
        `if [ "\${1:-}" = "--version" ] || [ "\${1:-}" = "-v" ]; then echo v${OLD_NODE_VERSION}; exit 0; fi\n` +
        `exec "${REAL_NODE}" "$@"\n`
    );

    this.globalOpenspecDir = bin('global-openspec');
    writeExecutable(path.join(this.globalOpenspecDir, 'openspec'), `#!/bin/bash\necho ${GLOBAL_OPENSPEC_VERSION}\n`);

    bin('node');
    fs.symlinkSync(REAL_NODE, path.join(this.nodeDir, 'node'));
    fs.symlinkSync(this.realNpm, path.join(this.nodeDir, 'npm'));
    const realNpx = which('npx');
    if (realNpx) fs.symlinkSync(realNpx, path.join(this.nodeDir, 'npx'));

    this.noNpmDir = bin('no-npm');
    // System directories first: the PATH of the machine that runs the suite
    // may hold wrappers of these tools that need the rest of that PATH
    const systemFirst = ['/usr/bin', '/bin', process.env.PATH || ''].join(path.delimiter);
    for (const tool of HOOK_TOOLS) {
      const target = which(tool, systemFirst);
      if (!target) throw new Error(`the acceptance suite needs '${tool}' on the machine that runs it`);
      fs.symlinkSync(target, path.join(this.noNpmDir, tool));
    }

    this.emptyCache = path.join(this.workDir, 'empty-npm-cache');
  }

  get oldNodeVersion() {
    return OLD_NODE_VERSION;
  }

  // The last line npm prints when it fails on the offline machine
  get npmFailureLine() {
    return NPM_FAILURE_LINE;
  }

  get globalOpenspecVersion() {
    return GLOBAL_OPENSPEC_VERSION;
  }

  path() {
    if (!this.hasNpm) return [this.spyGitOnlyDir(), this.noNpmDir].join(path.delimiter);
    const dirs = [];
    if (this.globalOpenspec) dirs.push(this.globalOpenspecDir);
    if (this.nodeVersion) dirs.push(this.oldNodeDir);
    dirs.push(this.spyDir, ...this.basePath);
    return dirs.join(path.delimiter);
  }

  // The git spy alone, for machines without npm
  spyGitOnlyDir() {
    const dir = path.join(this.workDir, 'bin', 'git-spy');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
      fs.symlinkSync(path.join(this.spyDir, 'git'), path.join(dir, 'git'));
    }
    return dir;
  }

  env(extra = {}) {
    const env = { ...cleanEnv(), PATH: this.path(), ...extra };
    if (!this.hasUserHub) {
      fs.mkdirSync(this.emptyHome, { recursive: true });
      Object.assign(env, { HOME: this.emptyHome, npm_config_cache: env.npm_config_cache ?? this.npmCache });
      delete env.XDG_CONFIG_HOME;
      delete env.XDG_DATA_HOME;
    }
    if (this.wikiDisabled) env.PROJECT_WIKI = 'off';
    if (this.commentsDisabled) env.PROJECT_COMMENTS = 'off';
    if (this.ephemeral) Object.assign(env, EPHEMERAL_ENV);
    if (this.offline) {
      fs.rmSync(this.emptyCache, { recursive: true, force: true });
      Object.assign(env, {
        SIMULATED_OFFLINE: '1',
        npm_config_registry: 'http://127.0.0.1:9/',
        npm_config_cache: this.emptyCache,
        npm_config_fetch_retries: '0',
        npm_config_fetch_timeout: '3000',
      });
    }
    return env;
  }

  // npm calls since the last reset, as { dir, args }
  npmCalls() {
    if (!fs.existsSync(this.spyLog)) return [];
    return fs
      .readFileSync(this.spyLog, 'utf8')
      .split('\n')
      .filter(Boolean)
      .map((line) => {
        const [dir, , ...args] = line.split(' ');
        return { dir, args };
      });
  }

  resetNpmCalls() {
    fs.rmSync(this.spyLog, { force: true });
  }

  // git calls since the last reset, as argument strings
  gitCalls() {
    if (!fs.existsSync(this.gitLog)) return [];
    return fs.readFileSync(this.gitLog, 'utf8').split('\n').filter(Boolean);
  }

  resetGitCalls() {
    fs.rmSync(this.gitLog, { force: true });
  }

  static tmpDir() {
    return fs.mkdtempSync(path.join(os.tmpdir(), 'session-bootstrap-'));
  }
}

module.exports = { Machine, which };
