---
title: "Volver a comprobar las APIs de sesión del plugin al subir de versión OpenCode"
kind: watch
status: active
priority: p2
created: 2026-11-21
updated: 2026-11-21
last_checked: 2026-11-21
next_action: "Al subir de versión OpenCode, repetir con el banco de la lección 9 las pruebas de archivado desde el plugin, de tools con codemode, de escuchadores RPC que sobreviven a la recarga y del contrato de sesión que simula la suite (list por páginas, context, prompt con skills), y actualizar el plugin y acceptance-tests/support/agents/opencode-sim.mjs si algo cambia."
sources:
  - raw/notes/2026-11-21-ll-sesiones-opencode-autopilot.md
tags: [opencode, watch, plugins, sessions]
confidence: high
summary: "El plugin de add-openspec-autopilot se apoya en tres comportamientos de OpenCode 2.3.2 que parecen accidentales y pueden cambiar."
---

# Volver a comprobar las APIs de sesión del plugin al subir de versión OpenCode

## Why Track This

Con OpenCode 2.3.2 se comprobaron tres comportamientos que obligan a rodeos en el plugin de add-openspec-autopilot (lecciones 1, 3 y 5 de la nota del 2026-11-21):

- `ctx.session.update` ignora `archived`, así que se archiva desde la parte de TUI.
- Las tools de un plugin solo existen en Code Mode salvo `options: { codemode: false }`.
- Cada recarga en caliente deja vivo el escuchador RPC anterior de la TUI.

Además, el plugin y el OpenCode simulado de la suite (`acceptance-tests/support/agents/opencode-sim.mjs`) se apoyan en este contrato, comprobado al implementar el change (tasks 1.1 a 1.5 y 12.2 de add-openspec-autopilot):

- `ctx.session.list()` devuelve `{ data, cursor }` por páginas, no un array, y lista las sesiones de todos los proyectos.
- `ctx.session.context({ sessionID })` da los mensajes de cualquier sesión, también archivada.
- `ctx.session.prompt({ sessionID, text, skills: [{ id }] })` arranca la sesión con el contenido de la skill.
- Una sesión con el agente plan ve y llama a una tool con `codemode: false`.
- El hook `context` puede esperar al menos 300 s a un diálogo de la TUI sin que falle la petición.
- Tras una recarga en caliente solo siguen vivos los hooks, tools y manejadores RPC de la última generación del servidor.

La suite simula OpenCode, así que no detectaría que cambien.

## Current State

Comprobado el 2026-11-21 con OpenCode 2.3.2 y el proveedor falso, también con el plugin de add-openspec-autopilot en la TUI, en modo normal y en modo auto (task 12.2).

## Next Action

Al subir OpenCode: repetir esas tres pruebas. Si el plugin ya puede archivar, el archivado deja de depender de la TUI; si los escuchadores ya se dan de baja, la protección contra duplicados sigue siendo inocua.
