---
title: "Volver a comprobar las APIs de sesión del plugin al subir de versión OpenCode"
kind: watch
status: active
priority: p2
created: 2026-11-21
updated: 2026-11-22
last_checked: 2026-11-22
next_action: "Al subir de versión OpenCode, repetir con el banco de la lección 9 las pruebas de archivado desde el plugin, de tools con codemode, del contrato de limpieza de los plugins (la función que devuelve setup, ejecutada antes de cada recarga y al cerrar, y el signal de events.on), de que no salgan trazas ECONNRESET al cerrar con --standalone y de que tras dos recargas solo reciba eventos la carga nueva, y del contrato de sesión que simula la suite (list por páginas, context, prompt con skills), y, desde autopilot-sesion-operativa, del hook prompt con el texto mutable, de ui.router.current() y los eventos focus del renderer, de las llamadas RPC de la TUI con la ubicación y de que la web siga sin cargar la interfaz de los plugins; y actualizar el plugin y acceptance-tests/support/agents/opencode-sim.mjs si algo cambia."
sources:
  - raw/repos/2026-11-22-idd-6d6e79c-autopilot-sesion-operativa.md
  - raw/notes/2026-11-21-ll-sesiones-opencode-autopilot.md
  - raw/notes/2026-11-22-ll-suscripciones-tui-opencode.md
tags: [opencode, watch, plugins, sessions]
confidence: high
summary: "El plugin de add-openspec-autopilot se apoya en tres comportamientos de OpenCode 2.3.2 que parecen accidentales y pueden cambiar."
---

# Volver a comprobar las APIs de sesión del plugin al subir de versión OpenCode

## Why Track This

Con OpenCode 2.3.2 se comprobaron tres comportamientos que obligan a rodeos o a cuidado en los plugins del proyecto (lecciones 1 y 3 de la nota del 2026-11-21, y lección 2 de la [nota del 2026-11-22](../../raw/notes/2026-11-22-ll-suscripciones-tui-opencode.md)):

- `ctx.session.update` ignora `archived`, así que se archiva desde la parte de TUI.
- Las tools de un plugin solo existen en Code Mode salvo `options: { codemode: false }`.
- OpenCode ejecuta como limpieza la función que devuelve el `setup` de cada parte, antes de cada recarga en caliente y al cerrar, y `events.on(nombre, manejador, { signal })` se da de baja al abortarse el `signal`. Los plugins lo usan para liberar sus suscripciones (ADR-0011). Sin eso, el escuchador de la carga anterior sigue vivo tras cada recarga (lo que registró la lección 5 del 2026-11-21) y, con `--standalone`, cada suscripción viva deja una traza `ECONNRESET` al cerrar.

Además, el plugin y el OpenCode simulado de la suite (`acceptance-tests/support/agents/opencode-sim.mjs`) se apoyan en este contrato, comprobado al implementar el change (tasks 1.1 a 1.5 y 12.2 de add-openspec-autopilot):

- `ctx.session.list()` devuelve `{ data, cursor }` por páginas, no un array, y lista las sesiones de todos los proyectos.
- `ctx.session.context({ sessionID })` da los mensajes de cualquier sesión, también archivada.
- `ctx.session.prompt({ sessionID, text, skills: [{ id }] })` arranca la sesión con el contenido de la skill.
- Una sesión con el agente plan ve y llama a una tool con `codemode: false`.
- El hook `context` puede esperar al menos 300 s a un diálogo de la TUI sin que falle la petición.
- Tras una recarga en caliente solo siguen vivos los hooks, tools y manejadores RPC de la última generación del servidor.

Desde `autopilot-sesion-operativa` (ADR-0013, `idd@6d6e79c:openspec/changes/archive/2026-11-22-autopilot-sesion-operativa/design.md`), el plugin depende también de: el hook `prompt` con el texto mutable, `ui.router.current()` consultado cada 300 ms, los eventos `focus` del renderer, las llamadas RPC de la TUI con `{ location }`, y que la UI web no cargue la interfaz de los plugins de un proyecto.

La suite simula OpenCode, así que no detectaría que cambien.

## Current State

Comprobado el 2026-11-21 con OpenCode 2.3.2 y el proveedor falso, también con el plugin de add-openspec-autopilot en la TUI, en modo normal y en modo auto (task 12.2). El contrato de limpieza, el 2026-11-22 con OpenCode 2.3.2 y `alibaba/qwen3.8-flash` (task 5.2 de fix-tui-subscription-cleanup): 0 `ECONNRESET` al cerrar, sin recargas y tras dos, y tras dos recargas el `select` y el `navigate` atendidos solo por la última carga.

## Next Action

Al subir OpenCode: repetir esas tres pruebas. Si el plugin ya puede archivar, el archivado deja de depender de la TUI; si deja de ejecutarse la limpieza de `setup` o cambia `events.on`, vuelven las trazas al cerrar y los escuchadores duplicados, y la protección de D13 contra duplicados vuelve a ser necesaria en `openspec-autopilot`.
