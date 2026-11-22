---
title: "Lessons Learned: main avanza mientras corre la suite de una fusión"
type: notes
source: session
ingested: 2026-11-22
tags: [lessons-learned, git, merge, pr, acceptance-tests]
lesson_kind: lessons-learned
lesson_count: 1
category: notes
confidence: high
summary: "La suite de aceptación tarda unos 8 minutos en la nube, y en ese tiempo main recibió otro PR: el commit de fusión que se acababa de probar ya no contenía origin/main y el PR volvió a tener conflictos. Se vuelve a hacer git fetch de main justo antes del commit de fusión."
---

# Lessons Learned: main avanza mientras corre la suite de una fusión

> Extraído de la sesión del 2026-11-22: fusiones de `origin/main` en `claude/exciting-ramanujan-802ws8` para el PR hiebra/idd#14 (commits de fusión `bc49d4f`, `16392e8` y `9168a29`). [comprobado] con `git merge-base --is-ancestor origin/main HEAD` y `git merge-tree` tras cada push.

## Lesson 1: entre la resolución y el commit de fusión, main puede volver a avanzar

**Category**: gotcha
**Context**: traer `origin/main` a la rama de la sesión para que el PR hacia `main` no tenga conflictos, con la suite de aceptación entera (unos 8 minutos en la nube) y el ok del usuario antes del commit de fusión.
**Symptom**: tras el push de `16392e8`, `git merge-tree --write-tree --name-only origin/main HEAD` daba 3 conflictos: mientras corría la suite había llegado a `main` el PR hiebra/idd#15 (`name-change-in-merge-title`). Antes, tras el push de `bc49d4f`, había pasado lo mismo con los PR hiebra/idd#12 y hiebra/idd#13.
**Root cause**: el `git fetch` se hizo al empezar la fusión, y otras sesiones fusionan PRs en `main` mientras tanto. El commit de fusión deja la rama al día con el `origin/main` de ese `fetch`, no con el de ahora.
**Fix**: otra fusión de `origin/main`, con su resolución, la suite y el ok del usuario. Tras el push, comprobar con `git fetch origin main` y `git merge-base --is-ancestor origin/main HEAD` que la rama contiene `main`.
**Rule**: antes del commit de fusión y después del push, vuelve a hacer `git fetch origin main` y comprueba que la rama contiene `origin/main`; si no, dilo al usuario antes de empezar otra fusión. Cuantos menos minutos pasen entre el `fetch` y el PR, menos probable es repetir la fusión.
