---
title: "Lessons Learned: update-comment-phrase-and-opencode-marker"
type: notes
source: session
ingested: 2026-11-22
tags: [lessons-learned, opencode, response-comments, openspec, acceptance-tests]
lesson_kind: lessons-learned
lesson_count: 3
category: notes
confidence: medium
summary: "Una cita de la web de OpenCode llega al hook context como texto dentro del mensaje user (según el usuario, sin comprobar); openspec validate --strict siempre falla en este proyecto por los avisos de SHALL/MUST y Gherkin; y la prueba del núcleo 'two sessions taking control at once' es intermitente."
---

# Lessons Learned: update-comment-phrase-and-opencode-marker

> Extraído de la sesión del 2026-11-22. 3 lecciones de proponer, implementar y archivar `update-comment-phrase-and-opencode-marker`.

## Lesson 1: Cómo llega al modelo una cita de la web de OpenCode

**Category**: discovery
**Context**: Reconocer como comentario un fragmento citado desde la web de OpenCode, que sí permite citar (la TUI no).
**Symptom**: No se sabía qué recibe el hook `context` cuando el usuario cita en la web.
**Root cause**: En el hook `context`, `input.messages` llega en formato LLM, y la cita aparece solo como texto dentro del mensaje `user`, no como `>` al principio.
**Fix**: **[heredado]** Formato dado por el usuario, sin comprobar con OpenCode real: `\nThe user quoted the following from <origen>:\n> línea…\n` y, si hay comentario, `\nThe user made the following comment regarding this quote: <comentario>`. Su expresión: `/\nThe user quoted the following from (.+?):\n((?:> .*\n?)+)(?:\nThe user made the following comment regarding this quote: ([\s\S]*))?/`. El núcleo la detecta con `awk` en cualquier línea del mensaje (`idd@1657745:.agents/hooks/session-bootstrap.sh`, `activates_comments`).
**Rule**: Para detectar una cita en OpenCode, busca su texto fijo en cualquier punto del último mensaje `user`, no una marca al principio; y comprueba el formato al subir de versión de OpenCode.

## Lesson 2: `openspec validate --strict` siempre falla en este proyecto

**Category**: gotcha
**Context**: Validar el change antes de implementarlo y antes de archivarlo.
**Symptom**: `openspec validate <change> --strict` da "has issues", con solo avisos: `should contain SHALL or MUST` y `scenario … is missing a WHEN/GIVEN step and a THEN step`.
**Root cause**: Las specs están en español (DEBE, no SHALL/MUST) y los escenarios van en bloques de Gherkin (`spec-as-source`), que el validador no reconoce como pasos; `--strict` convierte esos avisos en fallo.
**Fix**: Validar sin `--strict`, que da "is valid", y comprobar los escenarios con la suite y `npm run lint:specs`.
**Note**: Confirma una lección anterior, ya recogida en [las lecciones de fix-wiki-flow-operations](2026-11-21-ll-marcadores-guia-recordatorio.md); aquí se volvió a pedir `--strict` en las tasks por no consultarla.
**Rule**: En este proyecto, el criterio es `openspec validate <change>` sin `--strict`, más la suite y el lint de specs; no pidas `--strict` en las tasks.

## Lesson 3: La prueba "two sessions taking control at once" es intermitente

**Category**: gotcha
**Context**: Comprobar que la suite estaba en verde antes de tocar nada.
**Symptom**: `npm run test:core` dio 1 fallo en `acceptance-tests/core-tests/autopilot-plugin.test.js:168` ("two sessions taking control at once: the oldest wins and the other is left free": `2 !== 1`, las dos sesiones quedaron como dueñas). Al repetirla sola tres veces, pasó siempre.
**Root cause**: Sin investigar; parece una carrera entre las dos tomas de control en el OpenCode simulado. No tiene que ver con el change.
**Fix**: Ninguno todavía: repetir la prueba antes de atribuir el fallo al cambio en curso.
**Rule**: Si esa prueba falla, repítela sola antes de investigar el cambio en curso; si vuelve a fallar a menudo, abre un change para estabilizarla.
