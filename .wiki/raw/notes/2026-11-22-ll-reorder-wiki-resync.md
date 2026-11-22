---
title: "Lessons Learned: reorder-wiki-resync"
type: notes
source: session
ingested: 2026-11-22
tags: [lessons-learned, acceptance-tests, windows-readiness, cloud-session, auto-mode]
lesson_kind: lessons-learned
lesson_count: 1
category: notes
confidence: high
summary: "Una lección de reorder-wiki-resync: en una sesión en la nube, los 15 escenarios de windows-readiness fallan por falta de pwsh, y el modo automático deniega su descarga desde GitHub."
---

# Lessons Learned: reorder-wiki-resync

> Sesión del 2026-11-22 (apply y archivado de `reorder-wiki-resync`, en una sesión en la nube). [comprobado] ejecutando.

## Lesson 1: en la nube, los escenarios de windows-readiness no se pueden ejecutar

**Category**: gotcha
**Context**: la task de cierre que ejecuta la suite efectiva entera (`npm test` en `acceptance-tests/`).
**Symptom**: 245 de 260 escenarios pasan; los 15 que fallan son todos de `windows-readiness`, con `Error: the windows-readiness scenarios need pwsh (PowerShell 7) on the machine that runs the suite`.
**Root cause**: ADR-0017 hace de `pwsh` un requisito de la suite, y el contenedor de la nube no lo trae. Al intentar descargar la release de PowerShell desde GitHub, el modo automático de Claude Code denegó la acción.
**Fix**: no se rodeó la denegación. `test:core` (170/170) y `lint:specs` salieron con 0, y el usuario dio la task por cubierta porque el change no tocaba nada de Windows.
**Rule**: en una sesión en la nube, cuenta como resultado de la suite los escenarios que no son de Windows y decide con el usuario si `windows-readiness` queda cubierta; para ejecutarlos, permite antes la descarga de `pwsh` en el entorno o ejecútalos en una máquina que lo tenga.
