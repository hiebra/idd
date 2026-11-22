---
title: "Lessons Learned: pruebas de autopilot-rama-por-sesion en OpenCode 2.3.2 real"
type: notes
source: session
ingested: 2026-11-22
tags: [lessons-learned, opencode, openspec-autopilot, worktrees, git, session-bootstrap, testing]
lesson_kind: lessons-learned
lesson_count: 7
category: notes
confidence: high
summary: "Las pruebas en OpenCode 2.3.2 real encontraron cinco fallos que el simulador no mostraba: el arranque de sesión movía con update-ref una rama sacada en otro worktree; el proyecto está en ctx.location.project; remove de una estrategia no recibe sourceDirectory ni puede pedir forzar; el segundo keymap.dispatch necesita una pausa; y el worktree de la pantalla de inicio nace con el primer mensaje."
---

# Lessons Learned: pruebas de autopilot-rama-por-sesion en OpenCode 2.3.2 real

> Sesión del 2026-11-22: tasks 7.1–7.5 y 8.10 de `autopilot-rama-por-sesion`, con `@opencode/cli` 2.3.2, la TUI `--standalone` en tmux, un proveedor falso y un remoto desnudo. Salvo que se diga otra cosa, **[comprobado]**.

## Lesson 1: OpenCode 2 está en npm como `@opencode/cli`

**Category**: correction
**Context**: Montar el banco de las pruebas de la sección 7 del change.
**Symptom**: La sesión que implementó el change dejó las pruebas pendientes porque «npm solo tiene `opencode-ai` 1.19.6, y la serie 2 está solo en los tags del repositorio».
**Root cause**: Buscó el paquete de la serie 1. La lección 9 de [la nota de sesiones de OpenCode](2026-11-21-ll-sesiones-opencode-autopilot.md) ya decía que se instala `@opencode/cli@2.3.2`, pero no se consultó el wiki.
**Fix**: `npm install @opencode/cli@2.3.2` en una carpeta aparte; `opencode --version` da `v2.3.2`.
**Rule**: Antes de dar por no disponible una herramienta o una versión, consulta el wiki del proyecto: OpenCode 2 se instala con `npm install @opencode/cli@<versión>`, no con `opencode-ai`.

## Lesson 2: `update-ref` sobre una rama sacada en otro worktree deja ese directorio desfasado

**Category**: gotcha
**Context**: `prepare_git` de `.agents/hooks/session-bootstrap.sh` pone al día las ramas permanentes atrasadas con `git update-ref`, salvo la del directorio en que arranca.
**Symptom**: Al arrancar una sesión en un worktree nuevo, el `main` del clon principal pasó a apuntar al commit de `origin/main` sin mensaje en el reflog, y `git status` del clon dio `D  bench-upstream.txt` en el stage: la diferencia con el commit nuevo, como si el usuario la hubiera preparado.
**Root cause**: `git symbolic-ref HEAD` solo dice la rama de ese worktree. `update-ref` mueve la referencia, pero no el árbol ni el índice del directorio en que está sacada.
**Fix**: Saltar todas las ramas de `git worktree list --porcelain` (líneas `branch refs/heads/<rama>`) (`idd@ee902ef`).
**Rule**: Antes de mover con `update-ref` una rama local, excluye todas las ramas sacadas en cualquier worktree del clon, no solo la del directorio actual.

## Lesson 3: El contexto del plugin de OpenCode 2.3.2 tiene el proyecto en `ctx.location.project`

**Category**: discovery
**Context**: La tool `openspec_worktree` llamaba a `ctx.worktree.create({ projectID: ctx.project?.id, name })`.
**Symptom**: En la web, «No se ha creado el worktree: Missing key at ["projectID"]». En el simulador pasaba.
**Root cause**: `ctx.project` no existe. Un volcado de las claves del contexto dio `location: { directory, workspaceID, project: { id, directory, canonical } }` y `options`, sin la dirección del servidor. `worktree.create` exige `projectID`, y `session.create` acepta `location: { directory }` (`SessionCreateInput` de `@opencode/client` 2.3.2).
**Fix**: Tomar `ctx.location.project.id` o, si falta, el `projectID` de la sesión que llama a la tool (`idd@08d4b25`). El enlace de la web sale de la opción `serverUrl`.
**Rule**: Antes de usar una propiedad del contexto de un plugin de OpenCode, compruébala con un volcado de sus claves en OpenCode real. Si el simulador la inventa, los tests pasan igual.

## Lesson 4: Una estrategia de worktree de un plugin no puede pedir confirmación para forzar en OpenCode 2.3.2

**Category**: gotcha
**Context**: `remove` de la estrategia `openspec-autopilot` (`lib/worktree.mjs`), al quitar un worktree desde «Manage workspaces».
**Symptom**: Cualquier worktree daba «Failed to delete worktree … git worktree remove ha fallado: fatal: not a git repository». Con eso corregido, uno con cambios daba «Failed to delete worktree… Uncommitted changes», sin el diálogo «Delete worktree?».
**Root cause**: OpenCode llama a `remove` solo con `{ directory, force }`, sin `sourceDirectory`, y la estrategia ejecutaba git en `dirname(directory)`. **[código]** OpenCode solo conserva `forceRequired` si el error es de sus clases internas (`instanceof`); cualquier otro lo envuelve en «Worktree strategy <id> failed to remove: <mensaje>», y la TUI solo pregunta si `data.forceRequired === true`. El plugin no puede importar `@opencode/schema` («Cannot find package»), y una copia de npm no pasaría `instanceof`.
**Fix**: Ejecutar git en el propio worktree, y con cambios lanzar un error que diga que se haga antes el commit o se quite con `git worktree remove --force <dir>` (`idd@359ce64`).
**Rule**: En OpenCode 2.3.2, la estrategia de worktree de un plugin no debe contar con `sourceDirectory` en `remove` ni con `forceRequired`: el mensaje de error es todo lo que ve el usuario.

## Lesson 5: La TUI de OpenCode 2.3.2 necesita tiempo entre dos `keymap.dispatch`, y crea el worktree según desde dónde

**Category**: gotcha
**Context**: El modal de `/new` abre «Manage workspaces» con `dispatch("session.move")` y «Name worktree» con `dispatch("dialog.move_session.new")`.
**Symptom**:
- Con los dos `dispatch` seguidos, solo se abrió «Manage workspaces», y el nombre escrito fue a su búsqueda.
- Desde la pantalla de inicio, confirmar el nombre dejó la barra en «(new worktree)»: el worktree se creó con el primer mensaje, en una sesión propia.
- `/new` desde una sesión de un worktree abrió la pantalla de inicio del directorio principal.
**Root cause**: El segundo comando llega antes de que el primer diálogo esté montado. **[inferencia]** La pantalla de inicio no tiene directorio hasta que hay sesión.
**Fix**: Una pausa de 200 ms entre los dos, con otro intento a los 600 ms (`idd@73bb57c`). El primer mensaje pasa a la sesión operativa como descripción del change (`idd@f2edb3e`).
**Rule**: Separa con una pausa los comandos encadenados de la TUI que abren diálogos. Y no supongas que un worktree existe al confirmar su nombre: desde la pantalla de inicio nace con el primer mensaje.

## Lesson 6: Si las pruebas reales contradicen al simulador, corrige antes el simulador

**Category**: pattern
**Context**: La suite tenía 221 escenarios en verde y OpenCode real tenía cinco fallos.
**Symptom**: El simulador tenía `ctx.project`, pasaba `sourceDirectory` a `remove`, conservaba `forceRequired`, abría «Name worktree» al instante y creaba el worktree al confirmar el nombre.
**Root cause**: El simulador reproducía lo que se suponía de OpenCode, no lo comprobado.
**Fix**: Task 8.1: ajustar el simulador a lo comprobado (incluido que `worktree.create` exija `projectID`), ver cada escenario en rojo por la razón real y después corregir el plugin (`idd@99085a9`).
**Rule**: Cuando una prueba en el producto real contradice a un simulador, haz primero que el simulador reproduzca el fallo y solo después corrige el código; si no, el arreglo no queda cubierto.

## Lesson 7: Cómo leer y manejar el banco de OpenCode 2.3.2

**Category**: discovery
**Context**: Leer los resultados del banco en una sesión de Claude Code en la nube.
**Rule**:
- La metadata de las sesiones se lee de `$XDG_DATA_HOME/opencode/opencode.db` en solo lectura (`sqlite3` en modo `ro`, tabla `session_v2`; los mensajes en `session_message` y `session_part`).
- La web pide la conexión en su propia pantalla («Use password»), no por autenticación HTTP.
- `opencode api --server <url> POST /api/session/<id>/prompt -d '{"text": …}'` permite manejar la web sin navegador.
- En el modo auto, `tmux kill-server` se bloquea como acción destructiva: abre sesiones de tmux con nombre propio.
- Usa un directorio XDG nuevo por banco, porque el scratchpad puede conservar datos de bancos anteriores.
