---
title: "VS Code: depurar Java adjuntándose a una JVM (Debugger for Java)"
source: "https://raw.githubusercontent.com/microsoft/vscode-docs/main/docs/java/java-debugging.md"
type: articles
ingested: 2026-11-22
tags: [vscode, java, depuracion, attach, jdwp, tasks]
summary: "Extracto de la documentación de depuración de Java en VS Code y de la guía de configuración de la extensión Debugger for Java: la depuración la aporta la extensión vscjava.vscode-java-debug (incluida en el Extension Pack for Java), una configuración attach de tipo java necesita hostName y port, projectName es obligatorio con varios proyectos Java, y una task en segundo plano con problemMatcher puede arrancar el proceso antes de adjuntarse (preLaunchTask)."
canonical_url: "https://github.com/microsoft/vscode-docs/blob/c077aa5dac6244f0759ea84a0a552ff09e6ec333/docs/java/java-debugging.md"
upstream_id: "microsoft/vscode-docs@c077aa5dac6244f0759ea84a0a552ff09e6ec333:docs/java/java-debugging.md; microsoft/vscode-java-debug@d54fa437b41b8f430de4f97ac79da455e748d4dc:Configuration.md"
upstream_type: git-file
revision: "c077aa5dac6244f0759ea84a0a552ff09e6ec333"
license: "no comprobada"
content_format: markdown
fetched: 2026-11-22
extraction_tool: "curl del raw de main y git ls-remote de HEAD en la misma sesión (vscode-docs c077aa5, vscode-java-debug d54fa43); extracto literal, con el nombre del producto de las variables de plantilla sustituido por «VS Code»"
---

# VS Code: adjuntarse a una JVM (extracto)

## La extensión (extracto literal de `java-debugging.md`)

> VS Code allows you to debug Java applications through the [Debugger for Java](https://marketplace.visualstudio.com/items?itemName=vscjava.vscode-java-debug) extension. It's a lightweight Java debugger based on Java Debug Server […]

> To get the complete Java language support in VS Code, you can install the [Extension Pack for Java](https://marketplace.visualstudio.com/items?itemName=vscjava.vscode-java-pack), which includes the Debugger for Java extension.

> Consult the documentation for the [Language Support for Java™ by Red Hat](https://marketplace.visualstudio.com/items?itemName=redhat.java) extension for help with setting up your project.

Entre las funciones que enumera: Launch/Attach, puntos de ruptura (condicionales, de datos, logpoints), evaluación de expresiones y Hot Code Replace.

## Opciones de una configuración attach (extracto literal)

> - `hostName` (required) - The host name or IP address of remote debuggee.
> - `port` (required) - The debug port of remote debuggee.
> - `processId` - Use process picker to select a process to attach, or Process ID as integer.
> - `timeout` - Time out value before reconnecting, in milliseconds (default to 30000 ms).
> - `sourcePaths` - The extra source directories of the program. The debugger looks for source code from project settings by default. This option allows the debugger to look for source code in extra directories.
> - `projectName` - The preferred project in which the debugger searches for classes. There could be duplicated class names in different projects. It is required when the workspace has multiple Java projects, otherwise the expression evaluation and conditional breakpoint may not work.
> - `stepFilters` - Skip specified classes or methods when stepping.

## Adjuntarse a un proceso (extracto literal de `Configuration.md` de `vscode-java-debug`)

> Before attaching to a debuggee, your debuggee program must be started with debug mode. The standard command line for debug mode is like `java -agentlib:jdwp=transport=dt_socket,server=y,suspend=y,address=5005 -cp bin MyApp`, and then the debug port of your debuggee is *5005*.

```json
{
    "type": "java",
    "name": "Debug (Attach)",
    "request": "attach",
    "hostName": "localhost",
    "port": 5005
}
```

> In some cases, you may want to start your program with the external builder and launcher, then you can configure these jobs in tasks.json and attach to it. For example, launching springboot application via mvn command, and then attach a debugger.

> 1) Configure your command in .vscode/tasks.json - The mvn task is a background task, you should use *problemMatcher* filter to tell VS Code it's ready.

```json
{
    "label": "mvnDebug",
    "type": "shell",
    "command": "mvn spring-boot:run -Dspring-boot.run.jvmArguments=\"-agentlib:jdwp=transport=dt_socket,server=y,suspend=y,address=5005\"",
    "isBackground": true,
    "problemMatcher": [{
        "pattern": [{ "regexp": "\\b\\B", "file": 1, "location": 2, "message": 3 }],
        "background": {
            "activeOnStart": true,
            "beginsPattern": "^.*Attaching agents:.*",
            "endsPattern": "^.*Listening for transport dt_socket at address.*"
        }
    }]
}
```

> 2) Configure `preLaunchTask` and the debug port in .vscode/launch.json.
>
> 3) **F5** will launch the mvn task, and attach the debugger.

La configuración del paso 2 es la attach de arriba con `"preLaunchTask": "mvnDebug"`.
