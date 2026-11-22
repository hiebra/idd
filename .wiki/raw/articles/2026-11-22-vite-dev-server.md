---
title: "Vite: el servidor de desarrollo (puerto, host, proxy y CLI)"
source: "https://raw.githubusercontent.com/vitejs/vite/main/docs/config/server-options.md"
type: articles
ingested: 2026-11-22
tags: [vite, react, servidor-de-desarrollo, puerto, proxy, cli]
summary: "Extracto de la documentación de Vite: el servidor de desarrollo se arranca con vite (alias vite dev y vite serve), escucha por defecto en localhost:5173 y, si el puerto está ocupado, prueba el siguiente salvo que se ponga server.strictPort; server.proxy reenvía a otro servidor las peticiones cuya ruta empieza por una clave, sin transformarlas."
canonical_url: "https://github.com/vitejs/vite/blob/3567471998e3da315675086f44368e266c9c0e33/docs/config/server-options.md"
upstream_id: "vitejs/vite@3567471998e3da315675086f44368e266c9c0e33:docs/config/server-options.md y docs/guide/cli.md"
upstream_type: git-file
revision: "3567471998e3da315675086f44368e266c9c0e33"
license: "MIT"
content_format: markdown
fetched: 2026-11-22
extraction_tool: "curl del raw de main y git ls-remote de HEAD (3567471) en la misma sesión; extracto literal. Publicado en https://vite.dev/config/server-options y https://vite.dev/guide/cli"
---

# Vite: el servidor de desarrollo (extracto)

## Opciones del servidor (extracto literal de `server-options.md`)

> ## server.host
>
> - **Type:** `string | boolean`
> - **Default:** `'localhost'`
>
> Specify which IP addresses the server should listen on.

> ## server.port
>
> - **Type:** `number`
> - **Default:** `5173`
>
> Specify server port. Note if the port is already being used, Vite will automatically try the next available port so this may not be the actual port the server ends up listening on.

> ## server.strictPort
>
> - **Type:** `boolean`
>
> Set to `true` to exit if port is already in use, instead of automatically trying the next available port.

> ## server.proxy
>
> - **Type:** `Record<string, string | ProxyOptions>`
>
> Configure custom proxy rules for the dev server. Expects an object of `{ key: options }` pairs. Any requests whose request path starts with that key will be proxied to the specified target. […] If a request matches any of the configured proxy rules, the request won't be transformed by Vite.

## CLI (extracto literal de `cli.md`)

> ### `vite`
>
> Start Vite dev server in the current directory. `vite dev` and `vite serve` are aliases for `vite`.
>
> `vite [root]`

Opciones del servidor de desarrollo, de la tabla: `--host [host]` («Specify hostname»), `--port <port>` («Specify port»), `--open [path]` («Open browser on startup»), `--strictPort` («Exit if specified port is already in use»), `-c, --config <file>` y `-m, --mode <mode>`.

La página de opciones de build (`docs/config/build-options.md`, mismo commit) documenta `build.sourcemap` (por defecto `false`) para los source maps de producción. Las tres páginas consultadas (opciones del servidor, CLI y opciones de build) no describen ninguna opción para los source maps del servidor de desarrollo; no se han consultado las demás.
