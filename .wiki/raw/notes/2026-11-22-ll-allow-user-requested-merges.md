---
title: "Lessons Learned: allow-user-requested-merges"
type: notes
source: session
ingested: 2026-11-22
tags: [lessons-learned, acceptance-tests, cucumber, node-test, openspec]
lesson_kind: lessons-learned
lesson_count: 3
category: notes
confidence: high
summary: "La suite copia el proyecto desde el disco en cada escenario, así que editarlo con la suite en marcha contamina la pasada; las rutas que se pasan a cucumber-js se suman a las del perfil y solo --name acota; y una prueba de core del autopilot falla de forma intermitente con la máquina cargada."
---

# Lessons Learned: allow-user-requested-merges

> Extraído de la sesión del 2026-11-22. 3 lecciones sobre cómo ejecutar la suite de aceptación mientras se implementa un change.

## Lesson 1: La suite copia el proyecto desde el disco en cada escenario

**Category**: gotcha
**Context**: Con la suite completa en segundo plano, para comprobar la base (task 1.1), seguía implementando el change.
**Symptom**: Un riesgo, más que un fallo: los cambios en `.agents/` u `openspec/` habrían llegado a los escenarios que aún no se habían ejecutado, y la pasada de base habría dejado de medir la base.
**Root cause**: `support/project.js` copia el repositorio tal como está en el disco (sin `.git`, `acceptance-tests/` ni `.wiki/`) al empezar cada escenario. En cambio, los pasos y `support/` se cargan una vez al arrancar. Por eso, renombrar marcadores en los pasos con la suite ya en marcha no surtió efecto: tres escenarios fallaron con los marcadores antiguos.
**Fix**: Mientras corría la pasada solo toqué `acceptance-tests/`. El código del change lo edité al terminar, y la pasada final la lancé con todo ya en su sitio.
**Rule**: Con la suite en marcha, no edites nada de lo que se copia al proyecto de prueba (todo salvo `.git`, `acceptance-tests/` y `.wiki/`). Y los cambios en `acceptance-tests/` no cuentan hasta la siguiente pasada.

## Lesson 2: Las rutas que se pasan a cucumber-js se suman a las del perfil

**Category**: gotcha
**Context**: Quise ejecutar solo los escenarios del autopilot y del change, con `npx cucumber-js <feature> <feature> --name "...|.*"`.
**Symptom**: Se ejecutaron los 222 escenarios de la suite efectiva, no los de los dos features.
**Root cause**: El perfil por defecto de `cucumber.cjs` ya fija `paths: effectivePaths()`. Las rutas de la línea de órdenes se suman a esas en lugar de sustituirlas, así que solo `--name` acota de verdad. Con `.*` en el `--name`, no acotaba nada.
**Fix**: Iterar solo con `--name` y un patrón concreto, sin `.*`.
**Rule**: Para ejecutar una parte de la suite, filtra con `--name` (o con tags); no te fíes de pasar rutas de `.feature`.

## Lesson 3: «two sessions taking control at once» falla de forma intermitente con la máquina cargada

**Category**: gotcha
**Context**: Ejecuté `npm run test:core` mientras la suite de cucumber corría en segundo plano.
**Symptom**: `not ok 13 - two sessions taking control at once: the oldest wins and the other is left free`, con `2 !== 1` en `core-tests/autopilot-plugin.test.js:176`. Las dos sesiones quedaron como `owner`.
**Root cause**: No investigada. Es una prueba de una carrera entre dos sesiones, sensible a los tiempos: con la CPU ocupada por la otra suite, las dos sesiones toman el control. Sola pasa 3 de 3 veces, y en la pasada final de core, con la máquina libre, pasaron las 120 pruebas.
**Fix**: Ninguno en el código. La prueba se repitió sola, y core se ejecutó al final, sin cucumber a la vez.
**Rule**: No ejecutes `test:core` a la vez que la suite de cucumber. Si esa prueba falla, repítela sola antes de tomarlo por una regresión.
