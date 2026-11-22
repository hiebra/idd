---
title: "Lessons Learned: archive de autopilot-rama-por-sesion"
type: notes
source: session
ingested: 2026-11-22
tags: [lessons-learned, openspec, archive, acceptance-tests]
lesson_kind: lessons-learned
lesson_count: 2
category: notes
confidence: high
summary: "Tras sincronizar un requisito REMOVED, el cargador de specs efectivas de la suite avisa de que la regla no existe en openspec/specs mientras el change sigue activo, y es lo esperado; y los bloques MODIFIED de los deltas del proyecto llevan el requisito entero, así que sustituirlos por nombre completa el sync."
---

# Lessons Learned: archive de autopilot-rama-por-sesion

> Extraído de la sesión del 2026-11-22 que archivó `autopilot-rama-por-sesion` (commit del archivado `812f22d`). 2 lecciones del sync de las specs.

## Lesson 1: El aviso «no such rule exists» tras el sync de un REMOVED es lo esperado

**Category**: gotcha
**Context**: Suite de aceptación ejecutada después de sincronizar los deltas en `openspec/specs/` y antes de mover el change al archivo.
**Symptom**: `[effective-spec] WARNING: change "autopilot-rama-por-sesion" marks rule "Las ventanas ajenas llevan a la sesión operativa" of capability "openspec-autopilot" as MODIFIED/REMOVED, but no such rule exists in openspec/specs.`
**Root cause**: El cargador (`acceptance-tests/openspec-effective-paths.cjs`) combina las specs principales con los deltas de los changes activos; con el REMOVED ya aplicado, la regla que el delta quita ya no está en la spec principal.
**Fix**: Ninguno: los 247 escenarios pasaron. El aviso desaparece al archivar el change.
**Rule**: Entre el sync y el archive, ese aviso para un requisito REMOVED confirma el sync; solo es un problema si aparece antes del sync o para un MODIFIED.

## Lesson 2: Los bloques MODIFIED de los deltas llevan el requisito entero

**Category**: discovery
**Context**: Sync de los deltas de `autopilot-rama-por-sesion` (4 MODIFIED, 1 REMOVED, 7 ADDED en tres capabilities).
**Symptom**: —
**Root cause**: En este proyecto, cada bloque MODIFIED de un delta repite el requisito completo, con todos sus escenarios.
**Fix**: El sync se hizo sustituyendo cada bloque `### Requirement:` por nombre, quitando los REMOVED y añadiendo los ADDED al final; después se comprobó que cada bloque del delta aparece literal en la spec principal y se pasó `openspec validate --specs`.
**Rule**: Un sync por bloques es completo cuando los MODIFIED llevan el requisito entero; verifica después que cada bloque del delta aparece literal en la spec principal.
