---
title: "Corregir la prueba intermitente «two sessions taking control at once» del autopilot"
kind: task
status: active
priority: p3
created: 2026-11-22
updated: 2026-11-22
last_checked: 2026-11-22
next_action: "En un change propio, encontrar por qué a veces las dos sesiones quedan como dueñas y corregir el plugin o la prueba; comprobar con 20 ejecuciones seguidas de la prueba sola."
sources:
  - raw/notes/2026-11-22-ll-windows-support.md
tags: [openspec-autopilot, core-tests, flaky]
confidence: high
summary: "La prueba de core-tests/autopilot-plugin.test.js en la que dos sesiones toman el control a la vez falla de forma intermitente, también sin el change windows-support."
---

# Corregir la prueba intermitente «two sessions taking control at once» del autopilot

## Why Track This

`acceptance-tests/core-tests/autopilot-plugin.test.js`, «two sessions taking control at once: the oldest wins and the other is left free», falla a veces con `2 !== 1`: las dos sesiones quedan como dueñas del change. Hace que `npm run test:core` falle de forma intermitente, y puede esconder una carrera real del plugin.

## Current State

Comprobado el 2026-11-22 durante `windows-support`: ejecutada sola 8 veces, falla 1 con el `lib/project.mjs` de ese change y 1 con el de `idd@ec60c4d`, anterior a él; no la causa ese change. En `test:core` completo falló 2 veces de 6.

## Next Action

En un change propio: ver si la carrera está en el plugin (las dos sesiones toman el control antes de ver la metadata de la otra) o en la prueba (lo que espera `settle`), corregirla y comprobarla con 20 ejecuciones seguidas.

## Notes

No está en el `tasks.md` de `windows-support`, que lo deja fuera de alcance (task 7.1).
