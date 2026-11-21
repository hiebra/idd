---
title: "Volver a comprobar el hook context y la precedencia de skills al subir de versión OpenCode"
kind: watch
status: active
priority: p2
created: 2026-11-21
updated: 2026-11-21
last_checked: 2026-11-21
next_action: "Al subir de versión OpenCode, repetir con la versión nueva las comprobaciones de la tarea 1.2 de add-llm-wiki-support y, si algo cambia, actualizar el plugin y opencode-host.mjs."
sources:
  - raw/notes/2026-11-21-ll-wiki-en-dos-agentes-2.md
  - raw/repos/2026-11-21-idd-1cf0792.md
tags: [opencode, watch, session-bootstrap, llm-wiki]
confidence: high
summary: "La entrega de la guía y del recordatorio en OpenCode depende de APIs de plugin comprobadas solo en OpenCode 2.3.2."
---

# Volver a comprobar el hook context y la precedencia de skills al subir de versión OpenCode

## Why Track This

El plugin `session-bootstrap` entrega la guía y el recordatorio con `ctx.session.hook("context")`, y el motor se expone a OpenCode porque lee `.claude/skills` con precedencia sobre `.opencode/skills` (idd@1cf0792:.opencode/plugins/session-bootstrap/server.js). Las dos cosas se comprobaron solo con OpenCode 2.3.2 (lecciones 3 y 5 de la nota del 2026-11-21). La suite las simula en `acceptance-tests/support/agents/opencode-host.mjs`, así que no detectaría un cambio de la API real.

## Current State

Comprobado el 2026-11-21 con OpenCode 2.3.2: la guía va al system, el recordatorio se inserta como mensaje `user` y no se acumula, una excepción sin capturar hace fallar la petición, y las skills `wiki-manager` y `wiki-query` aparecen una vez cada una.

## Next Action

Al subir OpenCode: repetir las comprobaciones con el proveedor falso compatible con OpenAI (lección 4) y, si algo difiere, actualizar `server.js`, `opencode-host.mjs` y `acceptance-tests/README.md`.

## Notes

El README de la plantilla solo indica qué revisar al subir la versión del motor del wiki, no al subir OpenCode.
