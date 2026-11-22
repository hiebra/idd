---
title: "Lessons Learned: lint --fix y librarian scan del motor 1.0.0"
type: notes
source: session
ingested: 2026-11-22
tags: [lessons-learned, llm-wiki, lint, librarian, archive]
lesson_kind: lessons-learned
lesson_count: 2
category: notes
confidence: high
summary: "Dos lecciones del motor nvk/llm-wiki 1.0.0: lint --fix aparca una fuente sin artículo en una página de pendientes y el lint pasa; librarian scan solo puntúa antigüedad y forma, y escribe en .librarian/ y log.md."
---

# Lessons Learned: lint --fix y librarian scan del motor 1.0.0

> Sesión del 2026-11-22: evaluación de las operaciones del wiki en `operations.archive.guidance` de `openspec/config.yaml`. [comprobado] ejecutando `llm-wiki lint` sobre una copia de `.wiki/` y leyendo el motor fijado (`.agents/wiki-engine/`, v1.0.0).

## Lesson 1: lint --fix aparca en una página de pendientes la fuente que ningún artículo cita, y el lint pasa

**Category**: gotcha
**Context**: comprobar si el paso 6 de la resincronización (lint con `--fix` hasta que no dé errores) cubre una nota de lecciones escrita después del compile del paso 2.
**Symptom**: con una nota nueva en `raw/notes/` que no cita ningún artículo, `llm-wiki lint` da un aviso (falta en el índice) y una sugerencia (fuente sin artículo) y sale con 1. Tras `llm-wiki lint --fix`, sale con 0 y `Result: PASS`.
**Root cause**: el arreglo de cobertura crea o actualiza `wiki/references/uncompiled-source-coverage.md`, un artículo `confidence: low` que cita la fuente como pendiente de síntesis, y con eso la fuente deja de estar sin referencia. La lección no llega a ningún artículo (`claude-plugin/skills/wiki-manager/references/linting.md`, C6 y tabla de auto-fix).
**Fix**: no se aplicó al wiki del proyecto; se comprobó en una copia. La nota tiene que compilarse antes del lint.
**Rule**: un lint en `PASS` tras `--fix` no prueba que las fuentes nuevas estén compiladas; compila las notas de lecciones antes del lint y, si aparece `uncompiled-source-coverage.md`, trátalo como trabajo pendiente.

## Lesson 2: librarian scan 1.0.0 solo puntúa antigüedad y forma, y escribe en .librarian/

**Category**: discovery
**Context**: el paso 3 de la resincronización pide al librarian revisar «sin modificar nada» lo que quedó obsoleto o contradicho.
**Symptom**: en los seis scans de `.wiki/log.md` da 0 obsoletos y 0 de baja calidad; la revisión de contenido del archivado de `windows-support` la añadió el agente al informe por su cuenta. El commit del paso (`e303463`) cambia `.librarian/REPORT.md`, `.librarian/scan-results.json`, `.librarian/log.md` y `log.md`.
**Root cause**: `scan` solo ejecuta los pases `staleness` (fechas `ingested`, `verified`, `updated` e integridad de `sources:`) y `quality` (tamaño, número de fuentes, See Also). Los pases `verification`, `coherence` y `dedup` figuran como futuros y `fix` no está implementado (`claude-plugin/commands/librarian.md`). Lo contradicho por una fuente nueva lo clasifica `refresh` (`unchanged`, `updated`, `contradicted`, `unreachable`), que evalúa antes de escribir (`references/refresh.md`).
**Fix**: ninguno en el wiki; motiva el change que reordena la resincronización.
**Rule**: con el motor 1.0.0, para saber qué contradice un change usa `/wiki:refresh` sobre los artículos que citan las rutas tocadas; `librarian scan` es una puntuación de salud que escribe sus informes, no una revisión de contenido.
