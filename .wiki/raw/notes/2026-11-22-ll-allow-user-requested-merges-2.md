---
title: "Lessons Learned: allow-user-requested-merges (fusiones con main)"
type: notes
source: session
ingested: 2026-11-22
tags: [lessons-learned, acceptance-tests, cucumber, node-test, claude-code-cloud]
lesson_kind: lessons-learned
lesson_count: 2
category: notes
confidence: high
summary: "En este contenedor la suite completa tardó 6-7 minutos en cuatro pasadas, no los 15-20 registrados, con la firma de commits aún activa; y la prueba intermitente del autopilot también falla dentro de la propia pasada de test:core, sin cucumber a la vez."
---

# Lessons Learned: allow-user-requested-merges (fusiones con main)

> Extraído de la sesión del 2026-11-22, al traer `main` cuatro veces a la rama del change. Corrige dos datos ya registrados.

## Lesson 1: La suite completa tardó 6-7 minutos, no 15-20

**Category**: correction
**Context**: Cuatro pasadas completas de `npm test` en el mismo contenedor de la nube (4 CPUs): la de la base, la final del change y las que siguieron a la segunda y la tercera fusión con `main`.
**Symptom**: El wiki decía que la suite entera tarda 15-20 minutos en la nube (lección 1 de `2026-11-22-ll-manage-git-discipline.md`). Las cuatro pasadas tardaron 6 min 52 s, 6 min 13 s, 7 min 0 s y 6 min 38 s, con 222 a 227 escenarios. `test:core` tardó unos 37 s.
**Root cause**: No investigada. La firma seguía activa (`commit.gpgsign=true`, `gpg.ssh.program=/tmp/code-sign`), así que no es que hubiera dejado de firmarse. La duración puede depender del contenedor.
**Fix**: Ninguno. Se lanzó en segundo plano y se iteró con `--name`, como antes.
**Rule**: En la nube, cuenta con unos 6-7 minutos por pasada completa (hasta 15-20 en otro contenedor), y sigue lanzándola en segundo plano e iterando con `--name`.

## Lesson 2: «two sessions taking control at once» falla también dentro de test:core, sin cucumber a la vez

**Category**: correction
**Context**: `npm run test:core` lanzado justo después de que terminara cucumber, sin nada más corriendo.
**Symptom**: `not ok 13 - two sessions taking control at once`, con 165/166 en verde. Antes solo había fallado con cucumber en paralelo (lección 3 de `2026-11-22-ll-allow-user-requested-merges.md`).
**Root cause**: No investigada. `node --test` ejecuta los archivos de `core-tests/` en paralelo, así que la propia pasada de core ya carga la máquina. Sola pasa 3 de 3 veces.
**Fix**: Repetirla sola antes de atribuir el fallo al cambio en curso.
**Rule**: Que esa prueba falle no prueba una regresión, ni siquiera en una pasada de core sin nada más corriendo: repítela sola (`node --test --test-name-pattern="two sessions taking control" core-tests/autopilot-plugin.test.js`).
