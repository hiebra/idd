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

module.exports = { DebugContract, CONTRACT_PATH: CONTRACT.join('/') };
