---
title: "Lessons Learned: el agente plan en la revisión guiada con tests (guiar-revision-con-tests)"
type: notes
source: session
ingested: 2026-11-22
tags: [lessons-learned, opencode, openspec-autopilot, agente-plan, guiar-revision-con-tests]
lesson_kind: lessons-learned
lesson_count: 2
category: notes
confidence: high
summary: "En OpenCode 2.3.2 el agente plan ejecuta la shell sin pedir confirmación con la configuración por defecto, y el comportamiento del autopilot solo vale como prueba si se observa en su sesión operativa: una sesión ajena recibe el aviso de no operar."
---

# Lessons Learned: el agente plan en la revisión guiada con tests

> Sesión del 2026-11-22 (change guiar-revision-con-tests), con la prueba de la task 3.2 hecha con OpenCode 2.3.2 real en otra máquina (`idd@288741b:openspec/changes/archive/2026-11-22-guiar-revision-con-tests/tasks.md`). Las dos son [comprobado].

## Lección 1: En OpenCode 2.3.2, el agente plan ejecuta la shell sin pedir confirmación

**Category**: discovery
**Context**: El design del change suponía que el agente `plan` de la revisión pediría permiso al usuario antes de ejecutar el runner de aceptación.
**Root cause**: Con la configuración por defecto de OpenCode 2.3.2, la shell de `plan` no pide confirmación: el modelo ejecutó `npx cucumber-js --name "Saludar a Ana"` sin preguntar. `plan` no edita archivos, pero sí ejecuta órdenes.
**Fix**: Se corrigió el riesgo del design: se acepta, porque el runner no cambia archivos versionados y la instrucción pide no dejar archivos que git no ignore; quien quiera aprobar cada orden lo configura en los permisos de `plan`.
**Rule**: No cuentes con que `plan` pida permiso para la shell ni lo trates como un agente de solo lectura: lo que una instrucción le permita ejecutar, lo ejecutará sin preguntar.

## Lección 2: El comportamiento del autopilot solo se comprueba en su sesión operativa

**Category**: correction
**Context**: Una primera anotación de la task 3.2 decía que `plan` no ejecuta la shell. Venía de una sesión del autopilot que no era la revisión de una task.
**Root cause**: Una sesión que no es la operativa recibe en su contexto el aviso de que ahí no se opera y de cuál es la sesión operativa (`foreignPrompt`), así que el modelo se abstiene a propósito. Lo que hace ahí no dice nada de lo que haría en la sesión del paso.
**Fix**: Se repitió la prueba en la revisión de task que abrió el autopilot, y se sustituyó la nota.
**Rule**: Para comprobar qué hace el modelo en un paso del autopilot, obsérvalo en la sesión que el plugin abrió para ese paso; descarta como prueba cualquier sesión ajena.
