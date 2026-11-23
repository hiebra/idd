---
title: "VS Code: interfaz de línea de comandos (code) y apertura por URL"
source: "https://raw.githubusercontent.com/microsoft/vscode-docs/main/docs/configure/command-line.md"
type: articles
ingested: 2026-11-22
tags: [vscode, cli, url-handler, depuracion, extensiones]
summary: "Extracto de la documentación del CLI de VS Code: code abre carpetas y archivos, --goto abre un archivo en una línea, --reuse-window usa la última ventana activa y hay opciones para instalar y listar extensiones, pero ninguna para iniciar una sesión de depuración ni para poner puntos de ruptura. VS Code también se abre por URL (vscode://file/…:línea:columna) y una extensión puede registrar su propio manejador de URL (vscode://publisher.extension/ruta?consulta)."
canonical_url: "https://github.com/microsoft/vscode-docs/blob/c077aa5dac6244f0759ea84a0a552ff09e6ec333/docs/configure/command-line.md"
upstream_id: "microsoft/vscode-docs@c077aa5dac6244f0759ea84a0a552ff09e6ec333:docs/configure/command-line.md"
upstream_type: git-file
revision: "c077aa5dac6244f0759ea84a0a552ff09e6ec333"
license: "no comprobada"
content_format: markdown
fetched: 2026-11-22
extraction_tool: "curl del raw de main y git ls-remote de HEAD (c077aa5) en la misma sesión; extracto literal. Publicado en https://code.visualstudio.com/docs/configure/command-line"
---

# VS Code: `code` y apertura por URL (extracto)

## Opciones del CLI (extracto literal de la tabla)

> `-n` or `--new-window` | Opens a new session of VS Code instead of restoring the previous session (default).
> `-r` or `--reuse-window` | Forces opening a file or folder in the last active window.
> `-g` or `--goto` | When used with *file:line{:character}*, opens a file at a specific line and optional character position. This argument is provided since some operating systems permit `:` in a file name.
> `-w` or `--wait` | Wait for the files to be closed before returning.

> `--install-extension <extension-id> | <extension-vsix-path>` | Install or update an extension. Provide either the full extension name `publisher.extension` or the path to a VSIX file as an argument.
> `--list-extensions` | List the installed extensions. `--profile` argument can be used to list for a certain profile.
> `--add <dir>` | Add folder(s) to the last active window for a multi-root workspace.

También existe `--profile "<nombre>"` para abrir con un perfil. La página no documenta ninguna opción que inicie una sesión de depuración, elija una configuración de `launch.json` o ponga puntos de ruptura: las palabras «debug», «breakpoint» y `launch.json` no aparecen en el archivo (`grep -i`, 0 coincidencias).

## Abrir VS Code con URLs (extracto literal)

> You can also open projects and files using the platform's URL handling mechanism.

```
vscode://file/{full path to project}/
vscode://file/{full path to file}
vscode://file/{full path to file}:line:column
vscode://settings/{setting-id}
vscode:extension/{publisher}.{extensionName}
```

> Send a request to an extension (URI handler)
>
> Extensions can register a custom URI handler using the `vscode.window.registerUriHandler` API to handle incoming deep links from external websites or tools, such as OAuth authentication callbacks. The URL authority matches the extension ID (`{publisher}.{extensionName}`):
>
> `vscode://{publisher}.{extensionName}/{path}?{query}`

> You can use the URL in applications such as browsers or file explorers that can parse and redirect the URL. For example, on Windows, you could pass a `vscode://` URL directly to the Windows Explorer or to the command line as `start vscode://{full path to file}`.

La misma sección documenta `vscode://agents/new?prompt=…&workspace=…`, que prepara el borrador de una sesión de agente nueva con ese prompt y esa carpeta.

En los extractos, las variables de plantilla de la documentación (`{% data variables.product.prodname_vscode_shortname %}`) se han sustituido por «VS Code».
