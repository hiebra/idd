---
title: "VS Code: configuraciones de depuración (launch.json, compuestas, de workspace y globales)"
source: "https://raw.githubusercontent.com/microsoft/vscode-docs/main/docs/debugtest/debugging-configuration.md"
type: articles
ingested: 2026-11-22
tags: [vscode, depuracion, launch-json, tasks, workspace]
summary: "Extracto de la documentación de configuración de la depuración de VS Code: las configuraciones viven en .vscode/launch.json, en el ajuste de usuario launch (globales) o en la sección launch de un archivo de workspace; request es launch o attach; preLaunchTask ejecuta una task antes de la sesión; una configuración compuesta arranca varias a la vez; y serverReadyAction abre o depura una URI cuando el servidor avisa de que está listo."
canonical_url: "https://github.com/microsoft/vscode-docs/blob/c077aa5dac6244f0759ea84a0a552ff09e6ec333/docs/debugtest/debugging-configuration.md"
upstream_id: "microsoft/vscode-docs@c077aa5dac6244f0759ea84a0a552ff09e6ec333:docs/debugtest/debugging-configuration.md y docs/editing/workspaces/multi-root-workspaces.md"
upstream_type: git-file
revision: "c077aa5dac6244f0759ea84a0a552ff09e6ec333"
license: "no comprobada"
content_format: markdown
fetched: 2026-11-22
extraction_tool: "curl del raw de main y git ls-remote de HEAD (c077aa5) en la misma sesión; extracto literal de debugging-configuration.md y de las secciones Workspace launch configurations y Workspace task configuration de multi-root-workspaces.md, con las variables de plantilla de la documentación sustituidas (el nombre del producto por «VS Code» y setting(launch) por launch)"
---

# VS Code: configuraciones de depuración (extracto)

## Dónde viven (extracto literal)

> VS Code stores debug configurations in a `launch.json` file. For a project-specific configuration, place the file in the `.vscode` folder at the root of your workspace.

> **Global launch configuration.** To reuse a launch configuration across workspaces, add it to the `launch` user setting […]
>
> Use a workspace `launch.json` file when a configuration depends on project files, tasks, or shared environment details. Workspace configurations can be versioned with the project and used by other contributors.

De `multi-root-workspaces.md`:

> Workspace scoped launch configurations live in the `"launch"` section of the workspace configuration file […]
>
> In addition to `compounds`, the `launch` section of the workspace configuration file can contain regular launch configurations too. Make sure that all used variables are explicitly scoped to a specific folder because otherwise they are not valid for the workspace.

> Workspace scoped tasks live in the `"tasks"` section of the workspace configuration file […]. Only `"shell"` and `"process"` type tasks can be defined in the workspace configuration file.

## launch frente a attach (extracto literal)

> | Request | Behavior | Use when |
> | `launch` | Starts the application and attaches the debugger to the new process. | You want VS Code to manage application startup. |
> | `attach` | Connects the debugger to an application or process that is already running in debug mode. | Another tool starts the application, or you need to connect to a long-running or remote process. |

## Atributos (extracto literal)

> Every launch configuration has these properties:
>
> * `type`: the debugger to use. For example, the built-in Node.js debugger uses `node`. Debugger extensions contribute other values.
> * `request`: the connection mode. Most debuggers support `launch`, `attach`, or both.
> * `name`: the label shown in the configuration dropdown.
>
> These properties are available for all launch configurations:
>
> * `preLaunchTask`: run a task before the debug session starts. Set the value to a task label from `.vscode/tasks.json`, or use `${defaultBuildTask}`.
> * `postDebugTask`: run a task after the debug session ends.
> * `serverReadyAction`: perform an action when the application reports that a server is ready.

## Configuraciones compuestas (extracto literal)

> A compound starts two or more launch configurations together. Use one for applications with multiple processes, such as a client and a server.

> The compound appears in the configuration dropdown. When you start it, VS Code runs the optional `preLaunchTask` and starts the listed configurations in parallel. If `stopAll` is `true`, manually stopping one session stops all sessions in the compound.

## serverReadyAction (extracto literal)

> Use `serverReadyAction` to open or debug a URI after a server reports that it is ready. The action matches program output with a regular expression and uses a capture group to construct the URI

> Set `action` to `debugWithEdge` or `debugWithChrome` to start a browser debugging session. You can also set `webRoot`, which defaults to `${workspaceFolder}`.

> Set `action` to `startDebugging` to start another launch configuration after the pattern matches. Use `name` to reference a configuration in the same file or workspace folder. For configurations that require more control, use the `config` property to define the configuration inline.

## Diagnóstico de una configuración attach (extracto literal)

> For an attach configuration, confirm that the target process is already running in debug mode and that connection details such as the port match.
