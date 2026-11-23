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
