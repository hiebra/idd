'use strict';

// The debug MCP contract (limite-de-verificacion-y-mcp-de-depuracion, design
// D5 to D11 and D14): .agents/debug/contract.json as it is in the project copy.
// The schemas of each tool are compiled with ajv as JSON Schema 2020-12 in
// strict mode, so a schema that ajv would only warn about is an error here.

const fs = require('node:fs');
const Ajv2020 = require('ajv/dist/2020');

const CONTRACT = ['.agents', 'debug', 'contract.json'];

class DebugContract {
  constructor(project) {
    this.file = project.path(...CONTRACT);
    this.contract = fs.existsSync(this.file) ? JSON.parse(fs.readFileSync(this.file, 'utf8')) : null;
  }

  get exists() {
    return this.contract !== null;
  }

  get version() {
    return this.contract.contractVersion;
  }

  get tools() {
    return this.contract.tools ?? [];
  }

  get errors() {
    return this.contract.errors ?? {};
  }

  tool(name) {
    const tool = this.tools.find((t) => t.name === name);
    if (!tool) throw new Error(`the debug contract declares no tool '${name}'`);
    return tool;
  }

  // Compiles a schema of a tool (`inputSchema` or `outputSchema`); throws if it
  // is not a valid JSON Schema 2020-12 under ajv's strict mode
  compile(name, which) {
    const schema = this.tool(name)[which];
    if (!schema || typeof schema !== 'object') throw new Error(`tool '${name}' has no ${which}`);
    return new Ajv2020({ strict: true, allErrors: true }).compile(schema);
  }
}

// A valid response of each tool, and the variants the specs validate: each one
// is a change applied to a fresh copy of that valid response
const VALID_RESPONSES = {
  debug_targets: {
    contractVersion: '1.0',
    workspace: '/home/ana/pedidos',
    ides: [{ id: 'vscode', name: 'Visual Studio Code', available: true }],
    targets: [
      {
        id: 'backend',
        title: 'API de pedidos (Java sobre WLP)',
        technology: 'java-liberty',
        sources: ['backend/src/main/java/**'],
        files: ['backend/src/main/java/com/acme/pedidos/ExportarPedidos.java'],
        ides: ['vscode'],
        state: 'stopped',
      },
    ],
    unmatchedFiles: ['README.md'],
  },
  debug_launch_plan: {
    contractVersion: '1.0',
    workspace: '/home/ana/pedidos',
    ide: 'vscode',
    targets: ['backend'],
    steps: [
      {
        id: 'open-ide',
        title: 'Abrir el proyecto en VS Code',
        actor: 'agent',
        command: { argv: ['code', '/home/ana/pedidos'] },
      },
      {
        id: 'start-debug',
        title: 'Arrancar Liberty en modo depuración',
        actor: 'user',
        instruction: 'En VS Code, ejecuta «Liberty: Start in debug mode» y elige `backend`.',
        longRunning: true,
      },
    ],
    cleanup: [
      {
        id: 'stop-debug',
        title: 'Parar la depuración y Liberty',
        actor: 'user',
        instruction: 'En VS Code, para la sesión de depuración y la aplicación.',
      },
    ],
    breakpoints: [{ file: 'backend/src/main/java/com/acme/pedidos/ExportarPedidos.java', line: 42, status: 'planned' }],
  },
};

const VARIANTS = {
  debug_targets: {
    'sin objetivos': (r) => {
      r.targets = [];
      r.unmatchedFiles = [];
    },
    'con un objetivo sin identificador': (r) => {
      delete r.targets[0].id;
    },
    'con un objetivo sin estado': (r) => {
      delete r.targets[0].state;
    },
    'con un estado que no es del contrato': (r) => {
      r.targets[0].state = 'paused';
    },
  },
  // steps[0] is the `agent` step and steps[1] the `user` one. A plan may have
  // no cleanup steps (design D7), so «sin pasos de limpieza» drops `cleanup`
  debug_launch_plan: {
    'con un plan sin pasos': (r) => {
      r.steps = [];
    },
    'con un plan sin pasos de limpieza': (r) => {
      delete r.cleanup;
    },
    'con un punto de ruptura sin decir si se ha planificado': (r) => {
      delete r.breakpoints[0].status;
    },
    'con un paso de `agent` sin orden': (r) => {
      delete r.steps[0].command;
    },
    'con un paso de `agent` de larga duración': (r) => {
      r.steps[0].longRunning = true;
    },
    'con un paso de `user` sin instrucción': (r) => {
      delete r.steps[1].instruction;
    },
    'con un paso sin decir quién lo hace': (r) => {
      delete r.steps[0].actor;
    },
  },
};

// The valid response of a tool and the one the variant turns it into; throws
// if the support has no such variant, so an unknown one never passes silently
function responseVariant(tool, variant) {
  const valid = VALID_RESPONSES[tool];
  if (!valid) throw new Error(`the debug contract support has no valid response of '${tool}'`);
  const change = VARIANTS[tool]?.[variant];
  if (!change) throw new Error(`the debug contract support has no response of '${tool}' «${variant}»`);
  const response = structuredClone(valid);
  change(response);
  return { valid: structuredClone(valid), response };
}

module.exports = { DebugContract, CONTRACT_PATH: CONTRACT.join('/'), responseVariant };
