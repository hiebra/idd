---
title: "Liberty Tools for Visual Studio Code: modo dev y depuración"
source: "https://raw.githubusercontent.com/OpenLiberty/liberty-tools-vscode/main/docs/user-guide.md"
type: articles
ingested: 2026-11-22
tags: [liberty, wlp, vscode, depuracion, extension, dev-mode]
summary: "Extracto de la guía de usuario de la extensión Liberty Tools for Visual Studio Code (Open-Liberty.liberty-dev-vscode-ext): arranca la aplicación en modo dev en un terminal de VS Code, y su comando Start in debug mode arranca el servidor con el agente de depuración y adjunta solo el depurador de Java de VS Code cuando el servidor está listo (180 segundos de espera por defecto); el puerto por defecto es el 7777 y se cambia con WLP_DEBUG_ADDRESS en server.env o con libertyDebugPort en el pom.xml. Pide Java 21 o superior."
canonical_url: "https://github.com/OpenLiberty/liberty-tools-vscode/blob/9a7795b66164a22ff8609a87999dc3a70d5dd640/docs/user-guide.md"
upstream_id: "OpenLiberty/liberty-tools-vscode@9a7795b66164a22ff8609a87999dc3a70d5dd640:docs/user-guide.md y README.md"
upstream_type: git-file
revision: "9a7795b66164a22ff8609a87999dc3a70d5dd640"
license: "EPL-2.0"
content_format: markdown
fetched: 2026-11-22
extraction_tool: "curl del raw de main y git ls-remote de HEAD (9a7795b) en la misma sesión; extracto literal"
---

# Liberty Tools for Visual Studio Code: modo dev y depuración (extracto)

Extensión `Open-Liberty.liberty-dev-vscode-ext` del Marketplace de VS Code.

## Qué hace (extracto literal del README)

> - View supported Liberty projects in the Liberty dashboard.
> - Start/Stop dev mode.
> - Start dev mode with custom parameters.
> - Start dev mode in a container.
> - Attach the debugger.
> - Run tests.

> Liberty Tools for Visual Studio Code depends on the Tools for MicroProfile Visual Studio Code extension.

## Requisitos (extracto literal de la guía)

> - **Visual Studio Code 1.78.0** or later.
> - **Java 21** or later is required by Liberty Tools for Visual Studio Code.

> Projects that are already properly configured to run on Liberty and use Liberty dev mode are automatically added to Liberty Tools when it opens.

## Arrancar en modo dev (extracto literal)

> To start your application in dev mode, select the **Start** command for your application in Liberty Tools.
>
> A new terminal tab opens to run the application in dev mode.

## Arrancar en modo debug (extracto literal)

> To start your application in dev mode and have the debugger attach automatically, select the **Start in debug mode** command for your application in Liberty Tools or run **Liberty: Start in debug mode** from the command palette.
>
> Liberty Tools starts the server with the Java debug agent enabled and waits for the server to reach a ready state before attaching the VS Code Java debugger. If the server does not reach a ready state within the timeout period, a warning message is shown and you can attach the debugger manually using the **Attach debugger** command.
>
> The default timeout is **180 seconds (3 minutes)**. If your server consistently takes longer to start, you can increase the timeout by setting `liberty.dev.debugStartTimeout` (in seconds) in your VS Code settings

## Cambiar el puerto de depuración (extracto literal)

> By default, the server listens for the debugger on port **7777**. You can use a different port in any of the following ways:
>
> - **`server.env` (Maven and Gradle):** Add `WLP_DEBUG_ADDRESS=<port>` to `src/main/liberty/config/server.env`. **Start in debug mode** starts the server on that port and attaches the debugger to it.
>
>   Liberty Tools reads only `src/main/liberty/config/server.env`. If your project uses a different `configDirectory`, the `server.env` file in that directory is not read, and **Start in debug mode** uses port 7777.
>
> - **Maven build configuration:** Set `libertyDebugPort` in the `liberty-maven-plugin` configuration in your `pom.xml`. The parameter name is `libertyDebugPort`, not `debugPort`. A value set in the `pom.xml` takes precedence over the `-DdebugPort` command-line parameter.
>
> - **Custom parameters:** Use the **Start...** command and enter a custom parameter, then attach with the **Attach debugger** command.
>   - Maven: `-DdebugPort=<port>`
>   - Gradle: `--libertyDebugPort=<port>`

## Adjuntar el depurador a mano (extracto literal)

> To attach the debugger, you must have a running server. Once the server is running, click the **Attach debugger** command or select the **Liberty: Attach debugger** command in the command palette, followed by your application.

## Parar (extracto literal)

> To stop your application, select the **Stop** command for your application in Liberty Tools.
