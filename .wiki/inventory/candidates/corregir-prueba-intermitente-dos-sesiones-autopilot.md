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
  - raw/repos/2026-11-22-idd-9eae630-autopilot-plan-explore.md
tags: [openspec-autopilot, core-tests, flaky]
confidence: high
summary: "La prueba de core-tests/autopilot-plugin.test.js en la que dos sesiones toman el control a la vez falla de forma intermitente, también sin el change windows-support."
---

# Corregir la prueba intermitente «two sessions taking control at once» del autopilot

## Why Track This

`acceptance-tests/core-tests/autopilot-plugin.test.js`, «two sessions taking control at once: the oldest wins and the other is left free», falla a veces con `2 !== 1`: las dos sesiones quedan como dueñas del change. Hace que `npm run test:core` falle de forma intermitente, y puede esconder una carrera real del plugin.

## Current State

Comprobado el 2026-11-22 durante `windows-support`: ejecutada sola 8 veces, falla 1 con el `lib/project.mjs` de ese change y 1 con el de `idd@ec60c4d`, anterior a él; no la causa ese change. En `test:core` completo falló 2 veces de 6.

Durante `autopilot-plan-explore` falló otras tres veces: en la task 4.1, antes de que el change tocara `onPrompt`, y dos en la sección 5 (`idd@9eae630:openspec/changes/archive/2026-11-22-autopilot-plan-explore/tasks.md`, task 5.7). Allí se localizó la causa en el plugin, no en la prueba: en el hook `prompt`, cada sesión que dice `autopilot` escribe su metadata como operativa y después comprueba cuál es la más antigua ("escribir y comprobar; gana la más antigua", D2 de `autopilot-sesion-operativa`). Si la más antigua escribe después de que la nueva compruebe, la nueva no la ve y se queda, y quedan dos sesiones operativas. La lectura que `autopilot-plan-explore` añadió al principio del hook (`rememberTurn`) puede hacerlo algo más probable, pero no lo causa.

Posibles arreglos, sin decidir: volver a comprobar tras un breve retardo, o en el primer `context` de la sesión, y soltar el control si hay una más antigua; o un candado por rama con escritura atómica (la metadata de OpenCode no la tiene, ni `ctx.storage`, lección 7 de [las lecciones de las sesiones de OpenCode](../../raw/notes/2026-11-21-ll-sesiones-opencode-autopilot.md)).

## Next Action

En un change propio: corregir la carrera del plugin descrita arriba (sin descartar que la prueba también espere de menos en `settle`) y comprobarla con 20 ejecuciones seguidas.

## Notes

No está en el `tasks.md` de `windows-support`, que lo deja fuera de alcance (task 7.1).
