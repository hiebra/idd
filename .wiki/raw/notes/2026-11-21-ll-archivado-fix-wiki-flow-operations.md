---
title: "Lessons Learned: archivado de fix-wiki-flow-operations"
type: notes
source: session
ingested: 2026-11-21
tags: [lessons-learned, openspec, archive, adr, llm-wiki, git]
lesson_kind: lessons-learned
lesson_count: 2
category: notes
confidence: high
summary: "Al archivar, los enlaces relativos del adr.md de un change se rompen al bajar un nivel; y las rutas que tocó un change se sacan de sus propios commits, no del diff de la rama contra main cuando la rama lleva más de un change."
---

# Lessons Learned: archivado de fix-wiki-flow-operations

> Extraído de la sesión del 2026-11-21. 2 lecciones sobre el archivado de un change y la resincronización del wiki.

## Lesson 1: Los enlaces relativos del adr.md de un change se rompen al archivarlo

**Category**: gotcha
**Context**: Archivar `fix-wiki-flow-operations`, cuyo `adr.md` enlaza el ADR nuevo como `[ADR-0009](../../../adr/0009-….md)`.
**Symptom**: Tras mover el change de `openspec/changes/<name>/` a `openspec/changes/archive/<fecha>-<name>/`, el enlace apunta a `openspec/adr/…`, que no existe.
**Root cause**: El archive baja el change un nivel; las rutas relativas escritas desde `openspec/changes/<name>/` necesitan un `../` más. Los archivados anteriores no lo sufrían porque citan los ADRs como ruta del repositorio entre comillas invertidas (`adr/0004-….md`), no como enlace.
**Fix**: Cambiar `../../../adr/` por `../../../../adr/` en el `adr.md` archivado y comprobar que el destino existe (`idd@b48392d:openspec/changes/archive/2026-11-21-fix-wiki-flow-operations/adr.md`).
**Rule**: Antes de mover un change al archivo, revisa los enlaces relativos de sus artefactos que salen del change y añádeles un `../`; o cita los archivos del repositorio por su ruta desde la raíz, que no depende de dónde está el change.

## Lesson 2: Las rutas que tocó un change salen de sus commits, no del diff de la rama

**Category**: discovery
**Context**: Paso 1 de la resincronización del wiki al archivar: fijar "el código, las specs y los ADRs que tocó el change".
**Symptom**: El diff entre el merge-base con `main` y el commit del archivado incluía `add-openspec-autopilot` y ADR-0006 a ADR-0008, que son de otro change que comparte la rama.
**Root cause**: Con el ciclo de ADR-0007 la rama temporal debería llevar un solo change, pero esta llevaba dos; el diff contra `main` mezcla lo de ambos.
**Fix**: Tomar los archivos de los commits propios del change (desde su propuesta, `2e89fa3`, hasta el archivado) y dejar fuera los del otro change.
**Rule**: Para fijar las fuentes de un change al archivarlo, comprueba primero si la rama lleva más de un change; si es así, sácalas de los commits de ese change y no del diff de la rama contra `main`.
