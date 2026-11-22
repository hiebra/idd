---
title: "Lessons Learned: límite de tiempo de syncGuidance (apply-one-task-per-session-in-normal-mode)"
type: notes
source: session
ingested: 2026-11-22
tags: [lessons-learned, core-tests, node-test, openspec-autopilot]
lesson_kind: lessons-learned
lesson_count: 1
category: notes
confidence: high
summary: "Un temporizador con unref() no mantiene vivo node --test: un test que espera un timeout ante una promesa que no termina falla con cancelledByParent"
---

# Lessons Learned: límite de tiempo de syncGuidance

> Extraído de la sesión del 2026-11-22. 1 lección, al añadir `withTimeout` a `lib/apply-guidance.mjs` (idd@b9ef0b1).

## Lesson 1: un temporizador con unref() no sostiene el event loop en node --test

**Category**: gotcha
**Context**: Test de núcleo de `withTimeout(promise, ms)` en `acceptance-tests/core-tests/apply-guidance.test.js`, que comprueba que se deja de esperar una promesa que no termina (`new Promise(() => {})`). El temporizador del límite lleva `unref()`, como los de `lib/rpc.mjs` y `server.js`, para no retener el proceso de OpenCode.
**Symptom**: `not ok … failureType: 'cancelledByParent'`, error `Promise resolution is still pending but the event loop has already resolved`. Además, el resumen de `npm run test:core` filtrado con `grep "^# (pass|fail)"` mostraba `pass` sin `fail`, porque un test cancelado no cuenta como `fail`.
**Root cause**: Si lo único pendiente es una promesa sin nada detrás y un temporizador con `unref()`, el event loop se queda sin nada que lo mantenga vivo, y `node --test` cancela el test antes de que salte el límite. En el plugin no pasa, porque OpenCode mantiene el proceso vivo.
**Fix**: Dejar `unref()` en el código del plugin y, en el test, mantener vivo el event loop con un `setInterval(() => {}, 1000)`, que se borra en el `finally`.
**Rule**: Para probar con `node --test` un límite de tiempo cuyo temporizador lleva `unref()`, mantén el event loop vivo durante el test. Y al resumir una pasada, compara `# tests` con `# pass`: además de `# fail`, cuenta los tests cancelados.
