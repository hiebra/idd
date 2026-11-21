---
title: "Volver a comprobar las APIs de sesión del plugin al subir de versión OpenCode"
kind: watch
status: active
priority: p2
created: 2026-11-21
updated: 2026-11-21
last_checked: 2026-11-21
next_action: "Al subir de versión OpenCode, repetir con el banco de la lección 9 las pruebas de archivado desde el plugin, de tools con codemode y de escuchadores RPC que sobreviven a la recarga, y revisar el design de add-openspec-autopilot si algo cambia."
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

La suite simula OpenCode, así que no detectaría que cambien.

## Current State

Comprobado el 2026-11-21 con OpenCode 2.3.2 y el proveedor falso.

## Next Action

Al subir OpenCode: repetir esas tres pruebas. Si el plugin ya puede archivar, el archivado deja de depender de la TUI; si los escuchadores ya se dan de baja, la protección contra duplicados sigue siendo inocua.
