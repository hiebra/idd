---
title: "Lessons Learned: soporte de Windows (windows-support)"
type: notes
source: session
ingested: 2026-11-22
tags: [lessons-learned, windows, opencode, npm, git, powershell, cucumber, windows-support]
lesson_kind: lessons-learned
lesson_count: 7
category: notes
confidence: high
summary: "Siete lecciones del change windows-support: el motor del wiki se clona desde un git bundle, un node_modules de Linux no sirve en Windows, cómo ejecutar el CLI del proyecto desde un plugin de OpenCode en Windows, git add --renormalize lo mete todo en el stage, un BOM duplicado rompe un .ps1, cucumber-js ignora una ruta posicional y un cd dentro de un comando en segundo plano no cambia el directorio."
---

# Lessons Learned: soporte de Windows (windows-support)

> Sesión del 2026-11-22 (change `windows-support`), con Node.js 22, git 2.43, `pwsh` 7.4.6 en Linux y OpenSpec 1.17.0. Todo es [comprobado] ejecutando, salvo donde se indica otra cosa.

## Lección 1: el motor del wiki se puede instalar sin red desde un git bundle

**Category**: discovery
**Context**: buscar cómo instalar el motor (`nvk/llm-wiki`) en una máquina sin internet.
**Root cause**: el núcleo del arranque trata `repo` de `.agents/wiki/engine.json` como una URL de git cuando no tiene la forma `owner/name`, y la clona con `git clone --depth 1 --branch <ref>`.
**Fix**: un bundle hecho con `git bundle create <archivo> --tags` se clona con `git clone --depth 1 --branch v1.0.0 <ruta del bundle>` sin errores, y `git ls-remote <bundle>` lista el tag.
**Rule**: para una instalación sin red del motor, `engine.json` puede apuntar a un git bundle local con el tag fijado, sin cambiar el núcleo.

## Lección 2: un node_modules instalado en Linux no sirve en Windows

**Category**: gotcha
**Context**: el diagnóstico de Windows, evaluando el `package-lock.json` de `acceptance-tests/` para `win32-x64`.
**Symptom**: con las dependencias instaladas en Linux, faltan `@esbuild/win32-x64@0.28.2` y `@typescript/typescript-win32-x64@7.0.2`.
**Root cause**: los paquetes opcionales con `os`/`cpu` en el lockfile solo se instalan en su plataforma, y npm baja el de la plataforma en la que se ejecuta.
**Fix**: el diagnóstico filtra el lockfile por `os`/`cpu` de la máquina y nombra los que faltan. La caché para una instalación sin red se tiene que llenar con `npm ci` en una máquina Windows.
**Rule**: las dependencias npm para otra plataforma se preparan en esa plataforma, y lo que falta se deduce de los campos `os`/`cpu` del lockfile.

## Lección 3: cómo ejecutar el CLI del proyecto desde un plugin de OpenCode en Windows

**Category**: gotcha
**Context**: que el autopilot ejecute `openspec` en Windows.
**Symptom**: `node_modules/.bin/openspec` es un script de shell en Windows, y `spawn` rechaza `openspec.cmd` sin `shell: true` desde Node.js 18.20.2 y 20.12.2 [conocimiento interno, no comprobado aquí]. La simulación (un `.bin/openspec` no ejecutable) dejó el plugin sin sesión operativa.
**Root cause**: además, `process.execPath` no sirve para lanzar `node`: en OpenCode es su propio binario, compilado con Bun [conocimiento interno, no comprobado aquí].
**Fix**: ejecutar `node <script>`, con el `bin.openspec` de `node_modules/@fission-ai/openspec/package.json`, y si no está el paquete, el `openspec` del `PATH` (`openspecCommand()` en `lib/project.mjs`).
**Rule**: desde un plugin de OpenCode, un CLI de npm se ejecuta como `node <bin del paquete>`, nunca por `node_modules/.bin/` ni con `process.execPath`.

## Lección 4: git add --renormalize mete en el stage todo el árbol

**Category**: gotcha
**Context**: comprobar, tras añadir `.gitattributes`, que el índice ya estaba en LF.
**Symptom**: `git add --renormalize .` metió en el stage todos los cambios sin commit, no solo los de finales de línea.
**Fix**: `git reset -q` (no toca el árbol) y comprobar con `git ls-files --eol`, que no modifica nada.
**Rule**: para ver los finales de línea del índice se usa `git ls-files --eol`; `git add --renormalize` solo con el árbol limpio.

## Lección 5: un BOM UTF-8 duplicado rompe el bloque de ayuda de un .ps1

**Category**: gotcha
**Context**: reescribir el script PowerShell y añadirle el BOM que necesita Windows PowerShell 5.1.
**Symptom**: el parser de `pwsh` da `Missing closing ')' in expression` en la línea 7, dentro del bloque `<# ... #>`.
**Root cause**: el archivo ya tenía BOM, y volver a escribirlo con `utf-8-sig` añadió otro; el segundo es un carácter delante de `<#`.
**Fix**: leer con `utf-8-sig`, quitar los `\ufeff` iniciales y escribir con un solo BOM. Comprobar con `od -c` que empieza por `357 273 277 <`.
**Rule**: antes de añadir un BOM a un archivo, mira si ya lo tiene; tras escribir un `.ps1`, pásalo por `[System.Management.Automation.Language.Parser]::ParseFile`.

## Lección 6: cucumber-js no se limita a una ruta posicional en este proyecto

**Category**: gotcha
**Context**: ejecutar solo los escenarios de un `.feature` de `.extracted/`.
**Symptom**: `npx cucumber-js .extracted/.../spec.feature` ejecutó la suite completa (220 escenarios).
**Root cause**: `cucumber.cjs` fija `paths` en el perfil por defecto, y la ruta posicional no lo sustituye [comprobado el efecto, no la regla interna de cucumber].
**Fix**: filtrar con `--name "<escenario>"` (se puede repetir).
**Rule**: en esta suite, un subconjunto de escenarios se ejecuta con `--name`, no pasando el `.feature`.

## Lección 7: un cd dentro de un comando en segundo plano no cambia el directorio de los siguientes

**Category**: gotcha
**Context**: lanzar la suite en segundo plano y, a la vez, `test:core`, el lint y `openspec validate`.
**Symptom**: `test:core` no dio resumen, el lint salió con 1 y `validate` dijo que el change no tenía deltas.
**Root cause**: en `cd acceptance-tests && ( … ) &`, el `&` manda al segundo plano toda la lista, `cd` incluido, y los comandos siguientes se ejecutaron en la raíz del repo y en `/home/user`.
**Fix**: poner el `cd` dentro del subshell o usar rutas absolutas en cada comando.
**Rule**: ante un resultado imposible, como un change sin deltas que sí los tiene, comprueba primero en qué directorio se ha ejecutado el comando.
