---
title: "DebugMCP (Microsoft): un servidor MCP que da a un agente el control del depurador de VS Code"
source: "https://raw.githubusercontent.com/microsoft/DebugMCP/main/README.md"
type: articles
ingested: 2026-11-22
tags: [mcp, vscode, depuracion, debugmcp, extension, antecedente]
summary: "Extracto del README de DebugMCP, una extensión de VS Code de Microsoft que expone un servidor MCP local (puerto 3001 por defecto) con el que un agente controla el depurador: iniciar y parar la sesión, puntos de ruptura, paso a paso, variables y expresiones. Es un antecedente de otro nivel que un MCP que solo informa de cómo lanzar la depuración: aquí depura el agente, no la persona."
canonical_url: "https://github.com/microsoft/DebugMCP/blob/d0b4a334a6a3d8d600c5aa75ec60d9de272af3c4/README.md"
upstream_id: "microsoft/DebugMCP@d0b4a334a6a3d8d600c5aa75ec60d9de272af3c4:README.md"
upstream_type: git-file
revision: "d0b4a334a6a3d8d600c5aa75ec60d9de272af3c4"
license: "no comprobada"
content_format: markdown
fetched: 2026-11-22
extraction_tool: "curl del raw de main y git ls-remote de HEAD (d0b4a33) en la misma sesión; extracto literal. No se ha instalado ni probado"
---

# DebugMCP (extracto)

## Qué es (extracto literal)

> Let AI agents debug your code inside VS Code - set breakpoints, step through execution, inspect variables, and evaluate expressions.

> DebugMCP is an MCP server that gives AI coding agents full control over the VS Code debugger. Instead of reading logs or guessing, your AI assistant can autonomously set breakpoints, launch debug sessions, step through code line by line, inspect variable values, and evaluate expressions — just like a human developer would. It runs 100% locally, requires zero configuration, and works out of the box with any MCP-compatible AI assistant.

## Tools (extracto literal de la tabla)

> | **start_debugging** | Start a debug session for a source code file | `fileFullPath` (required), `workingDirectory` (required), `testName` (optional), `configurationName` (optional) |
> | **stop_debugging** | Stop the current debug session | None |
> | **step_over** | Execute the next line (step over function calls) | None |
> | **step_into** | Step into function calls | None |
> | **step_out** | Step out of the current function | None |
> | **continue_execution** | Continue until next breakpoint | None |
> | **pause_execution** | Interrupt a freely-running program and stop at its current location (no breakpoint needed) | None |
> | **get_debug_status** | Read paused/running/no-session status, the active session ID, and selected-frame details when paused; optionally wait for a pause | `waitForPauseSeconds` (optional, 0-600; bounded by the operation timeout) |
> | **add_breakpoint** | Add a breakpoint at a specific line (optionally conditional) | `fileFullPath` (required), `line` (required, 1-based), `condition` (optional) |
> | **remove_breakpoint** | Remove a breakpoint from a specific line | `fileFullPath` (required), `line` (required) |
> | **clear_all_breakpoints** | Remove all breakpoints at once | None |
> | **list_breakpoints** | List all active breakpoints | None |
> | **list_variable_names** | List names and types of variables in scope, without reading any values | `scope` (optional: 'local', 'global', 'all') |
> | **get_variables_values** | Get the values of specifically named variables at the current execution point | `variableNames` (required), `scope` (optional) |
> | **evaluate_expression** | Evaluate an expression in debug context; expandable children are listed by name and type without their values | `expression` (required) |

La tabla incluye además `restart_debugging`, `get_debug_output` y `add_logpoint`.

## Instalación y alcance (extracto literal)

> - DebugMCP extension in your installed extensions
> - MCP server automatically running on port 3001 (configurable)
> - Debug tools available to connected AI assistants

> - **Local Operation**: The MCP server runs 100% locally with no external communications and requires no credentials

Lenguajes que declara soportados, con la extensión de VS Code de cada uno: Python, JavaScript/TypeScript (`.js`, `.ts`, `.jsx`, `.tsx`, con el depurador integrado), Java (Extension Pack for Java) y C/C++, entre otros.

Desde la versión 2.4, el README anuncia también un CLI independiente (`debugmcp`, en npm) que da acceso a adaptadores DAP sin VS Code.

## Otros antecedentes vistos en la búsqueda, sin contrastar

La búsqueda web del 2026-11-22 dio también `vscode-mcp-debugger` (un servidor MCP que habla con una extensión de VS Code por archivos temporales), Pointbreak y un plugin de depuración por MCP para los IDE de JetBrains. La documentación de JetBrains de su servidor MCP (`https://www.jetbrains.com/help/idea/mcp-server.html`) describe tools para listar y ejecutar configuraciones de ejecución (`get_run_configurations`, `execute_run_configuration`) y un conjunto de tools de depurador. Ninguno se ha leído a fondo ni probado.
