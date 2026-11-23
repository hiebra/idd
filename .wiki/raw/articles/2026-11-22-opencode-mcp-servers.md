---
title: "OpenCode: servidores MCP (configuración, nombres de las tools, Code Mode y versión del protocolo)"
source: "https://opencode.ai/docs/mcp-servers/"
type: articles
ingested: 2026-11-22
tags: [opencode, mcp, model-context-protocol, tools, code-mode, configuracion]
summary: "Extracto de la documentación de OpenCode sobre servidores MCP: se configuran bajo mcp.servers; un servidor local es un comando que OpenCode arranca por stdio en la carpeta de cada directorio abierto; cada tool se llama <server>_<tool>, pero por defecto se usa a través de Code Mode (tools.<server>.<tool>(…)) salvo codemode: false; OpenCode habla por defecto el protocolo anterior a 2026-07-28 (protocol: legacy); y añade al system prompt las instrucciones que devuelve el servidor."
canonical_url: "https://opencode.ai/docs/mcp-servers/"
upstream_id: "opencode.ai/docs/mcp-servers"
upstream_type: web-page
revision: "consultada el 2026-11-22"
license: "no comprobada"
content_format: markdown
fetched: 2026-11-22
extraction_tool: "curl de la página HTML (sha256 451915ebff99f1fb…) y extracción del texto de <main>; extracto literal. La página no dice a qué versión de OpenCode corresponde: no se ha contrastado con OpenCode 2.3.2, la versión con la que se ha probado esta plantilla"
---

# OpenCode: servidores MCP (extracto)

## Configuración (extracto literal)

> To configure a server by hand, give it a unique name under mcp.servers. V2 does not place server names directly under mcp.

```jsonc
{
  "$schema": "https://opencode.ai/config.json",
  "mcp": {
    "servers": {
      "my-server": {
        "type": "local",
        "command": ["npx", "-y", "example-mcp-server"],
      },
    },
  },
}
```

> A local server is a command that OpenCode starts over the MCP stdio transport. Add one with a command after --:
>
> `opencode mcp add everything -- npx -y @modelcontextprotocol/server-everything`

Campos de un servidor local (tabla, literal):

> | type | Yes | Must be "local". |
> | command | Yes | Executable followed by its arguments. |
> | cwd | No | Process directory. Relative paths resolve from the workspace, which is also the default. |
> | environment | No | String variables added to OpenCode's inherited process environment. |
> | disabled | No | Prevents connection when true. Defaults to false. |
> | codemode | No | Set to false to expose tools directly instead of through Code Mode. Defaults to true. |
> | timeout | No | Per-server timeout overrides. |
> | protocol | No | legacy (default), auto, or 2026-07-28. See Protocol version. |
> | pool | No | Share one connection across directories. Defaults to false. See Shared connections. |

`opencode mcp add … ` escribe el servidor en la configuración del proyecto, y con `--global`, en la global. `/mcps` lista, conecta y desconecta los servidores.

## Nombres de las tools y Code Mode (extracto literal)

> OpenCode names a tool <server>_<tool>. It replaces characters other than letters, numbers, _, and - with _:
>
> ```
> server: context 7
> tool:   resolve.library/id
> name:   context_7_resolve_library_id
> ```

> Choose short server names that remain unique after normalization. Under the default Code Mode, tools are grouped by the normalized server name:
>
> `tools.context_7.resolve_library_id(...)`

> Code Mode is the default. Set codemode to false when a server's tools must stay on the provider's native tool list

> Use permission actions to hide or deny tools without disconnecting their server. Match the normalized <server>_<tool> name

## Versión del protocolo (extracto literal)

> OpenCode opens every server with the classic MCP initialize handshake by default. Set a server's protocol to talk to one built on the 2026-07-28 revision

> | legacy | Default. Sends initialize and speaks protocol revisions up to 2025-11-25. |
> | auto | Probes with server/discover for the 2026-07-28 revision and falls back to legacy when the server does not support it. |
> | 2026-07-28 | Requires the 2026-07-28 revision. The connection fails against older servers. |

## Un servidor por directorio, o compartido (extracto literal)

> One OpenCode server can have many directories open, and each one connects to every MCP server on its own. Set pool to true to let directories with the same server settings share one connection and one tool list

> A local server is shared only between directories on this machine, not ones in a workspace. Sharing it across projects needs a fixed cwd, such as "~". Without one it runs in each project's folder, so each project gets its own and OpenCode logs a warning.
>
> A shared connection has no roots. When a tool asks for input, the request appears in the directory that called it.

## Instrucciones del servidor y contexto (extracto literal)

> When a server returns instructions during initialization, OpenCode adds them to the system prompt […]
>
> For servers that use Code Mode, OpenCode adds a line that says where the agent can find the server's tools.

> For calls made on behalf of a session, OpenCode sends the session ID in CallToolRequest.params._meta["ai.opencode/sessionID"]. […] The ID is request metadata, not a tool argument, so it is absent from the model-visible schema.

## Tiempos de espera (tabla, literal)

> | startup | 30 seconds | Transport connection and server initialization. |
> | catalog | 30 seconds | Listing tools, prompts, resources, and resource templates. |
> | execution | 12 hours | Tool calls, prompt retrieval, and resource reads. |

## Claude Code, para comparar

En Claude Code, las tools de un servidor MCP se llaman `mcp__<servidor>__<tool>`: [comprobado] en la sesión del 2026-11-22 en la que se escribió esta ficha, cuyas tools de MCP se llamaban así (por ejemplo, `mcp__github__get_file_contents`). No sale de la página de OpenCode.
