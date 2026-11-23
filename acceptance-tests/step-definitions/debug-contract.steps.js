'use strict';

// Steps of debug-mcp-contract (limite-de-verificacion-y-mcp-de-depuracion,
// design D5 to D14). They read .agents/debug/contract.json from the project
// copy through support/debug-contract.js; nothing here talks to an MCP server.

const assert = require('node:assert/strict');
const { Given, When, Then } = require('@cucumber/cucumber');
const { DebugContract, CONTRACT_PATH, EXAMPLES_PATH, responseVariant } = require('../support/debug-contract');

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

Then('acepta el parámetro opcional `workspace`', function () {
  const schema = this.debugTool.inputSchema ?? {};
  assert.ok(schema.properties?.workspace, `'${this.debugTool.name}' has no 'workspace' parameter`);
  assert.ok(!(schema.required ?? []).includes('workspace'), `'workspace' is required in '${this.debugTool.name}'`);
});

function assertRequired(tool, expected) {
  assert.deepEqual([...(tool.inputSchema?.required ?? [])].sort(), expected, `the required parameters of '${tool.name}'`);
}

Then('sus parámetros obligatorios son ninguno', function () {
  assertRequired(this.debugTool, []);
});

Then('sus parámetros obligatorios son solo `{word}`', function (name) {
  assertRequired(this.debugTool, [name]);
});

Then('su descripción dice que un paso de `agent` termina solo y enseguida', function () {
  assert.match(this.debugTool.description, /un paso de `agent` termina solo y enseguida/i, `the description of '${this.debugTool.name}'`);
});

Then('su descripción dice que seguir un plan no deja archivos que git no ignore', function () {
  assert.match(
    this.debugTool.description,
    /seguir un plan no deja (en el árbol de trabajo )?archivos que git no ignore/i,
    `the description of '${this.debugTool.name}'`
  );
});

When('se leen los errores de ejecución del contrato', function () {
  this.debugErrors = contractOf(this).errors;
});

Then('están `invalid-workspace`, `unknown-target` e `ide-unavailable`, cada uno con cuándo se da', function () {
  const codes = this.debugErrors.codes ?? [];
  for (const code of ['invalid-workspace', 'unknown-target', 'ide-unavailable']) {
    const entry = codes.find((c) => c.code === code);
    assert.ok(entry, `the debug contract does not list the error '${code}'`);
    assert.ok(typeof entry.when === 'string' && entry.when.trim(), `the error '${code}' does not say when it happens`);
  }
});

Then('el contrato dice que se devuelven con `isError` y un texto que empieza por el código', function () {
  const description = this.debugErrors.description ?? '';
  assert.match(description, /`isError(: true)?`/, 'the errors description does not mention isError');
  assert.match(description, /texto que empieza por el código/, 'the errors description does not say the text starts with the code');
});

// «sin objetivos», «con un objetivo sin identificador»…: the variant names one
// change on the valid response of the tool in support/debug-contract.js
When(/^se valida una respuesta de `(\w+)` (.+)$/, function (tool, variant) {
  const contract = contractOf(this);
  const { valid, response } = responseVariant(tool, variant);
  const validate = contract.compile(tool, 'outputSchema');
  this.debugValidation = {
    tool,
    variant,
    baseValid: validate(valid),
    valid: validate(response),
    errors: validate.errors,
  };
});

Then('la respuesta cumple el contrato', function () {
  const { tool, variant, valid, errors } = this.debugValidation;
  assert.ok(valid, `the response of '${tool}' ${variant} does not meet the contract: ${JSON.stringify(errors)}`);
});

Then('la respuesta no cumple el contrato', function () {
  const { tool, variant, baseValid, valid } = this.debugValidation;
  assert.ok(baseValid, `the valid response of '${tool}' in the support does not meet the contract`);
  assert.ok(!valid, `the response of '${tool}' ${variant} meets the contract`);
});

// The examples of the contract: each call's arguments are validated with the
// tool's inputSchema and its result with the outputSchema
Given('el ejemplo `{word}` del contrato del MCP de depuración', function (name) {
  this.debugContract = new DebugContract(this.ensureProject());
  const example = contractOf(this).example(name);
  assert.ok(example, `the project has no debug contract example at ${EXAMPLES_PATH}/${name}.json`);
  this.debugExample = { name, ...example };
});

When('se validan sus llamadas y sus respuestas con los esquemas del contrato', function () {
  const calls = this.debugExample.calls ?? [];
  assert.ok(calls.length, `the example '${this.debugExample.name}' has no calls`);
  this.debugExampleResults = calls.flatMap((call, i) =>
    [
      ['inputSchema', 'arguments'],
      ['outputSchema', 'result'],
    ].map(([which, field]) => {
      const validate = this.debugContract.compile(call.tool, which);
      return { call: i, tool: call.tool, field, valid: validate(call[field]), errors: validate.errors };
    })
  );
});

Then('todas cumplen el contrato', function () {
  const tools = new Set(this.debugExampleResults.map((r) => r.tool));
  assert.deepEqual([...tools].sort(), [...TOOLS].sort(), `the example '${this.debugExample.name}' does not call each tool`);
  for (const r of this.debugExampleResults) {
    assert.ok(r.valid, `call ${r.call} (${r.tool}) of '${this.debugExample.name}': its ${r.field} does not meet the contract: ${JSON.stringify(r.errors)}`);
  }
});

function launchPlanOf(example) {
  const call = (example.calls ?? []).find((c) => c.tool === 'debug_launch_plan');
  assert.ok(call?.result, `the example '${example.name}' has no debug_launch_plan response`);
  return call.result;
}

Then('el plan del ejemplo es para el IDE `{word}`', function (ide) {
  assert.equal(launchPlanOf(this.debugExample).ide, ide);
});

Then('el plan del ejemplo tiene pasos de `agent` y pasos de `user`', function () {
  const actors = new Set((launchPlanOf(this.debugExample).steps ?? []).map((s) => s.actor));
  for (const actor of ['agent', 'user']) {
    assert.ok(actors.has(actor), `the plan of '${this.debugExample.name}' has no '${actor}' step`);
  }
});
