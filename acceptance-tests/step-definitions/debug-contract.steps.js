'use strict';

// Steps of debug-mcp-contract (limite-de-verificacion-y-mcp-de-depuracion,
// design D5 to D14). They read .agents/debug/contract.json from the project
// copy through support/debug-contract.js; nothing here talks to an MCP server.

const assert = require('node:assert/strict');
const { Given, When, Then } = require('@cucumber/cucumber');
const { DebugContract, CONTRACT_PATH } = require('../support/debug-contract');

const TOOLS = ['debug_targets', 'debug_launch_plan'];

function contractOf(world) {
  assert.ok(world.debugContract.exists, `the project has no debug contract at ${CONTRACT_PATH}`);
  return world.debugContract;
}

Given('el contrato del MCP de depuración del proyecto', function () {
  this.debugContract = new DebugContract(this.ensureProject());
});

When('se lee como un conjunto de tools de MCP', function () {
  this.debugTools = contractOf(this).tools;
});

Then('declara la versión `1.0` del contrato', function () {
  assert.equal(this.debugContract.version, '1.0');
});

Then('declara las tools `debug_targets` y `debug_launch_plan`, y ninguna más', function () {
  assert.deepEqual(this.debugTools.map((t) => t.name).sort(), [...TOOLS].sort());
});

Then('cada tool tiene título, descripción y esquemas de entrada y de salida válidos', function () {
  for (const tool of this.debugTools) {
    for (const field of ['title', 'description']) {
      assert.ok(typeof tool[field] === 'string' && tool[field].trim(), `tool '${tool.name}' has no ${field}`);
    }
    for (const which of ['inputSchema', 'outputSchema']) {
      assert.doesNotThrow(() => this.debugContract.compile(tool.name, which), `the ${which} of '${tool.name}' is not valid`);
    }
  }
});

When('se lee la tool `{word}` del contrato', function (name) {
  this.debugTool = contractOf(this).tool(name);
});

Then('está anotada como de solo lectura y de mundo cerrado', function () {
  const annotations = this.debugTool.annotations ?? {};
  assert.equal(annotations.readOnlyHint, true, `'${this.debugTool.name}' is not annotated readOnlyHint: true`);
  assert.equal(annotations.openWorldHint, false, `'${this.debugTool.name}' is not annotated openWorldHint: false`);
});

Then(
  'su descripción dice que no arranca ni para procesos, no abre el IDE y no escribe en el árbol de trabajo',
  function () {
    assert.match(
      this.debugTool.description,
      /no arranca ni para procesos, no abre el IDE y no escribe en el árbol de trabajo/,
      `the description of '${this.debugTool.name}'`
    );
  }
);
