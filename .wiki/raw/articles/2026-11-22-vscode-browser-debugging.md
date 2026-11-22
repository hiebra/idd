---
title: "VS Code: depuración en el navegador (Edge, Chrome) y el tutorial de React"
source: "https://raw.githubusercontent.com/microsoft/vscode-docs/main/docs/nodejs/browser-debugging.md"
type: articles
ingested: 2026-11-22
tags: [vscode, depuracion, navegador, chrome, edge, react, source-maps]
summary: "Extracto de la documentación de depuración en el navegador de VS Code y de su tutorial de React: el depurador de Edge y Chrome viene integrado (tipos msedge, chrome y editor-browser); una configuración launch abre la url con el depurador puesto y webRoot resuelve los source maps; una configuración attach se conecta a un navegador arrancado con --remote-debugging-port; y el servidor de desarrollo tiene que estar en marcha antes de iniciar la sesión."
canonical_url: "https://github.com/microsoft/vscode-docs/blob/c077aa5dac6244f0759ea84a0a552ff09e6ec333/docs/nodejs/browser-debugging.md"
upstream_id: "microsoft/vscode-docs@c077aa5dac6244f0759ea84a0a552ff09e6ec333:docs/nodejs/browser-debugging.md, docs/nodejs/reactjs-tutorial.md y docs/debugtest/integrated-browser.md; microsoft/vscode-js-debug@026dfbc0a30ea5a531030095e9307e664b3b7310:OPTIONS.md"
upstream_type: git-file
revision: "c077aa5dac6244f0759ea84a0a552ff09e6ec333"
license: "no comprobada"
content_format: markdown
fetched: 2026-11-22
extraction_tool: "curl del raw de main y git ls-remote de HEAD en la misma sesión (vscode-docs c077aa5, vscode-js-debug 026dfbc); extracto literal, con las variables de plantilla de la documentación sustituidas: el nombre del producto por «VS Code» y kb(workbench.action.debug.start) por F5, su atajo por defecto"
---

# VS Code: depuración en el navegador (extracto)

## El depurador integrado (extracto literal de `browser-debugging.md`)

> VS Code includes a built-in debugger for Edge and Chrome. There are a couple ways to get started with it.
>
> * Use the Open Link command to debug a URL.
> * Clicking a link in the JavaScript debug terminal.
> * Use a launch config to launch a browser with your app.

> The simplest way to debug a webpage is through the **Debug: Open Link** command found in the Command Palette […]. When you run this command, you'll be prompted for a URL to open, and the debugger will be attached.

## Lanzar el navegador (extracto literal)

```json
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "msedge",
      "request": "launch",
      "name": "Launch my cool app",
      "url": "http://localhost:8000"
    }
  ]
}
```

> When you hit F5 or the **Start** button in the **Run and Debug** view, `http://localhost:8000` will be opened in debug mode. If you'd like to use Chrome instead of Edge, replace `msedge` with `chrome`.
>
> To debug inside VS Code without opening an external browser, use `editor-browser` as the type.

## Adjuntarse a un navegador (extracto literal)

> To attach to a running browser, it needs to be launched in a special debug mode. You can do this using the following command, replacing `edge.exe` with the path to your Edge or Chrome binary:
>
> `edge.exe --remote-debugging-port=9222 --user-data-dir=remote-debug-profile`
>
> Setting the `--remote-debugging-port` tells the browser to listen on that port for a debug connection. Setting a separate `--user-data-dir` forces a new instance of the browser to be opened; if this flag isn't given, then the command will open a new window of any running browser and not enter debug mode.

```json
{
  "type": "msedge",
  "request": "attach",
  "name": "Attach to browser",
  "port": 9222
}
```

## Atributos (extracto literal)

> * `webRoot` - The root directory for your source code. Most often, and by default, the `webRoot` is your workspace folder. This option is used for sourcemap resolution.
>
> These attributes are only available for launch configurations of request type `launch`:
>
> * `url` - The URL to automatically open when the browser is launched.
> * `runtimeExecutable` - Either an absolute path to the browser executable to use, or the version of the browser to use. Valid versions include `stable` (default), `canary`, `beta`, and `dev`.
>
> These attributes are only available for launch configurations of request type `attach`:
>
> * `url` - If given, VS Code will attach to a tab with this URL. If not provided, it will attach to all browser tabs.
> * `port` - Port to use for remote debugging the browser, matching the `--remote-debugging-port` used when starting the browser.
> * `address` - IP address or hostname the debugged browser is listening on.

De `OPTIONS.md` de `vscode-js-debug` (`chrome: launch`): `webRoot` es «the workspace absolute path to the webserver root. Used to resolve paths like /app.js to files on disk. Shorthand for a pathMapping for "/"»; `userDataDir`: «By default, the browser is launched with a separate user profile in a temp folder.»; `port`: «Defaults to "0", which will cause the browser to be debugged via pipes».

## Source maps (extracto literal)

> The JavaScript debugger in VS Code supports source maps that allow debugging transformed code. […] Most modern tools used for building web applications will work out of the box.

## Tutorial de React (extracto literal de `reactjs-tutorial.md`)

> `create-react-app` is no longer actively maintained. The React team now recommends using a framework like Vite (`npm create vite@latest my-app -- --template react`) or Next.js.

```json
{
    "type": "msedge",
    "request": "launch",
    "name": "Launch Edge against localhost",
    "url": "http://localhost:3000",
    "webRoot": "${workspaceFolder}"
}
```

> Ensure that your development server is running (`npm start`). Then press F5 or the green arrow to launch the debugger and open a new browser instance. The source code where the breakpoint is set runs on startup before the debugger was attached, so we won't hit the breakpoint until we refresh the web page. Refresh the page and you should hit your breakpoint.

El tutorial sigue usando `create-react-app` (puerto 3000) en sus pasos; la nota inicial recomienda Vite para proyectos nuevos.
