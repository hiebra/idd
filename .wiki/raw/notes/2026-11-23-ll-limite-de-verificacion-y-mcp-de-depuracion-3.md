---
title: "Lessons Learned: task 2.1 de limite-de-verificacion-y-mcp-de-depuracion"
type: notes
source: session
ingested: 2026-11-23
tags: [lessons-learned, acceptance-tests, cucumber-js]
lesson_kind: lessons-learned
lesson_count: 1
category: notes
confidence: high
summary: "El resumen de la suite completa no sale en las últimas líneas cuando hay pasos sin definir: guarda toda la salida"
---

# Lessons Learned: task 2.1 de limite-de-verificacion-y-mcp-de-depuracion

> Extracted from session on 2026-11-23. 1 lesson about reading the result of the full acceptance suite.

## Lesson 1: el resumen de la suite no está en las últimas líneas

**Category**: gotcha
**Context**: ejecutar la suite completa (`npx cucumber-js --format summary`) para comprobar que la task 2.1 no rompía nada, con escenarios de tasks posteriores aún sin pasos.
**Symptom**: `npx cucumber-js --format summary 2>&1 | tail -4` solo mostró `return 'pending';` y `});`: ni el recuento de escenarios ni los fallos. Hubo que volver a ejecutar la suite entera.
**Root cause**: cuando hay pasos sin definir, cucumber-js imprime sus esqueletos («Write code here that turns the phrase above into concrete actions») después del resumen, así que el resumen queda lejos del final de la salida.
**Fix**: guardar toda la salida en un archivo (`npx cucumber-js --format summary > suite.txt 2>&1`) y buscar ahí `^[0-9]+ (scenarios|steps)` y `Failed scenarios:`.
**Rule**: no recortes con `tail` la salida de la suite completa: guárdala entera en un archivo y busca en ella el recuento y los escenarios que fallan, sobre todo en medio de un change, cuando hay escenarios sin pasos.
