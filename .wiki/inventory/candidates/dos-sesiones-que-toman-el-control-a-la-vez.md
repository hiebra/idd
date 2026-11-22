---
title: "Dos sesiones que toman el control a la vez pueden quedar las dos como operativas"
kind: task
status: active
priority: p3
created: 2026-11-22
updated: 2026-11-22
last_checked: 2026-11-22
next_action: "Abrir un change de OpenSpec que haga atómica, o compruebe de nuevo tras escribir, la toma del control con `autopilot`, y dejar estable el core test \"two sessions taking control at once\"."
sources: []
tags: [opencode, openspec-autopilot, task, concurrencia]
confidence: medium
summary: "Si dos sesiones dicen `autopilot` a la vez y la más antigua escribe su metadata después de que la nueva compruebe, ninguna ve a la otra como más antigua y quedan las dos como operativas. Lo detecta de forma intermitente un core test."
---

# Dos sesiones que toman el control a la vez pueden quedar las dos como operativas

## Why Track This

El core test "two sessions taking control at once: the oldest wins and the other is left free" (`acceptance-tests/core-tests/autopilot-plugin.test.js`) falla de vez en cuando. Lo hizo tres veces durante `autopilot-plan-explore`: en la task 4.1, antes de que el change tocara `onPrompt`, y dos en la sección 5 (`idd@48ca630:openspec/changes/autopilot-plan-explore/tasks.md`, task 5.7).

La causa está en el código, no en el simulador. En el hook `prompt`, cada sesión que dice `autopilot` escribe su metadata como operativa y después comprueba cuál es la más antigua ("escribir y comprobar; gana la más antigua", D2 de `autopilot-sesion-operativa`). Si la más antigua escribe después de que la nueva compruebe, la nueva no la ve y se queda, y la antigua solo se ve a sí misma o se ve como la más antigua: quedan dos sesiones operativas.

La lectura que `autopilot-plan-explore` añadió al principio del hook `prompt` (`rememberTurn`) puede hacerlo algo más probable, pero no lo causa. El usuario decidió el 2026-11-22 dejarlo para un change aparte.

## Current State

Abierto. Posibles arreglos, sin decidir:

- volver a comprobar tras un breve retardo, o en el primer `context` de la sesión, y soltar el control si hay una más antigua;
- un candado por rama en algo con escritura atómica (la metadata de OpenCode no la tiene, ni `ctx.storage`, lección 7 de [las lecciones de las sesiones de OpenCode](../../raw/notes/2026-11-21-ll-sesiones-opencode-autopilot.md)).

## Next Action

Abrir un change de OpenSpec para la toma del control y dejar estable el core test.
