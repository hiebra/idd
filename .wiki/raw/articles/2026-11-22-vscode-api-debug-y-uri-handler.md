---
title: "API de extensiones de VS Code: iniciar la depuración, puntos de ruptura y manejador de URL"
source: "https://raw.githubusercontent.com/microsoft/vscode/main/src/vscode-dts/vscode.d.ts"
type: articles
ingested: 2026-11-22
tags: [vscode, api, extensiones, depuracion, uri-handler, mcp]
summary: "Extracto de vscode.d.ts, la definición de la API de extensiones de VS Code: una extensión puede iniciar una sesión de depuración por el nombre de una configuración o pasando la configuración entera (vscode.debug.startDebugging), añadir puntos de ruptura con condición (vscode.debug.addBreakpoints y SourceBreakpoint), atender URLs dirigidas a ella (vscode.window.registerUriHandler) y publicar servidores MCP para el editor (vscode.lm.registerMcpServerDefinitionProvider)."
canonical_url: "https://github.com/microsoft/vscode/blob/58a9245ffe53ec35991e7d5b08bf2e37f2acedb2/src/vscode-dts/vscode.d.ts"
upstream_id: "microsoft/vscode@58a9245ffe53ec35991e7d5b08bf2e37f2acedb2:src/vscode-dts/vscode.d.ts"
upstream_type: git-file
revision: "58a9245ffe53ec35991e7d5b08bf2e37f2acedb2"
license: "no comprobada"
content_format: markdown
fetched: 2026-11-22
extraction_tool: "curl del raw de main y git ls-remote de HEAD (58a9245) en la misma sesión; extracto literal de los comentarios y las firmas. La referencia publicada está en https://code.visualstudio.com/api/references/vscode-api"
---

# API de extensiones de VS Code: depuración y URLs (extracto)

Todo lo de esta ficha es API de **extensión**: se ejecuta dentro de VS Code. Desde fuera de VS Code solo se llega a ello a través de una extensión instalada (por ejemplo, por su manejador de URL).

## `vscode.debug.startDebugging` (extracto literal)

```ts
/**
 * Start debugging by using either a named launch or named compound configuration,
 * or by directly passing a {@link DebugConfiguration}.
 * The named configurations are looked up in '.vscode/launch.json' found in the given folder.
 * Before debugging starts, all unsaved files are saved and the launch configurations are brought up-to-date.
 * Folder specific variables used in the configuration (e.g. '${workspaceFolder}') are resolved against the given folder.
 * @param folder The {@link WorkspaceFolder workspace folder} for looking up named configurations and resolving variables or `undefined` for a non-folder setup.
 * @param nameOrConfiguration Either the name of a debug or compound configuration or a {@link DebugConfiguration} object.
 * @returns A thenable that resolves when debugging could be successfully started.
 */
export function startDebugging(folder: WorkspaceFolder | undefined, nameOrConfiguration: string | DebugConfiguration, parentSessionOrOptions?: DebugSession | DebugSessionOptions): Thenable<boolean>;
```

## Puntos de ruptura (extracto literal)

```ts
/**
 * Add breakpoints.
 * @param breakpoints The breakpoints to add.
 */
export function addBreakpoints(breakpoints: readonly Breakpoint[]): void;

/**
 * A breakpoint specified by a source location.
 */
export class SourceBreakpoint extends Breakpoint {
	readonly location: Location;
	constructor(location: Location, enabled?: boolean, condition?: string, hitCondition?: string, logMessage?: string);
}
```

## `vscode.window.registerUriHandler` (extracto literal)

```ts
/**
 * Registers a {@link UriHandler uri handler} capable of handling system-wide {@link Uri uris}.
 * In case there are multiple windows open, the topmost window will handle the uri.
 * A uri handler is scoped to the extension it is contributed from; it will only
 * be able to handle uris which are directed to the extension itself. A uri must respect
 * the following rules:
 *
 * - The uri-scheme must be `vscode.env.uriScheme`;
 * - The uri-authority must be the extension id (e.g. `my.extension`);
 * - The uri-path, -query and -fragment parts are arbitrary.
 *
 * An extension can only register a single uri handler in its entire activation lifetime.
 */
export function registerUriHandler(handler: UriHandler): Disposable;
```

## `vscode.lm.registerMcpServerDefinitionProvider` (extracto literal)

```ts
/**
 * Registers a provider that publishes Model Context Protocol servers for the editor to
 * consume. This allows MCP servers to be dynamically provided to the editor in
 * addition to those the user creates in their configuration files.
 *
 * Before calling this method, extensions must register the `contributes.mcpServerDefinitionProviders`
 * extension point with the corresponding {@link id}
 */
```

Esos servidores MCP los consume el propio editor (su chat); la ficha no dice nada de que otros agentes los vean.
