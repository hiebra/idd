---
title: "Lessons Learned: lecciones equivalentes al resolver una fusión en el wiki"
type: notes
source: session
ingested: 2026-11-22
tags: [lessons-learned, wiki, git, merge, conflictos]
lesson_kind: lessons-learned
lesson_count: 1
category: notes
confidence: high
summary: "Al resolver una fusión con conflictos en el wiki, la rama que llega puede traer ya lecciones equivalentes a las propias: hay que buscarlas antes de resolver y citar la nota propia como segunda fuente en vez de duplicar viñetas."
---

# Lessons Learned: lecciones equivalentes al resolver una fusión en el wiki

> Extraído de la sesión del 2026-11-22. 1 lección de fusionar `origin/main` (`allow-user-requested-merges`) en la rama de `git-discipline-standard-with-exception` (commit de fusión `c57dc28`).

## Lesson 1: la rama que llega puede traer lecciones equivalentes a las propias

**Category**: pattern
**Context**: resolver los conflictos de `.wiki/wiki/topics/suite-de-aceptacion-y-spec-as-source.md` en la fusión de `origin/main` con la rama del change. Las dos ramas habían registrado lecciones en paralelo, en sesiones distintas.
**Symptom**: el lado de `main` del conflicto ya tenía dos viñetas equivalentes a las lecciones 1 y 5 de [git-discipline-standard-with-exception](2026-11-22-ll-git-discipline-standard-with-exception.md): «Escenarios renombrados en una delta» (un MODIFIED no puede perder escenarios; se usa REMOVED más ADDED) y «Acotar una pasada» (las rutas que se pasan a `cucumber-js` se suman a las del perfil; solo `--name` o los tags acotan). Unir los dos lados las habría duplicado.
**Root cause**: las lecciones se registran en la rama de cada change, y dos changes concurrentes pueden comprobar lo mismo. Además, la de `main` confirmaba la causa que la lección 5 propia solo había inferido (`effectivePaths()` del perfil).
**Fix**: se conservaron las viñetas de `main`, y la nota propia se citó como segunda fuente en la viñeta equivalente, en lugar de añadir otra.
**Rule**: antes de resolver los conflictos del wiki en una fusión, busca en el lado que llega lecciones equivalentes a las propias; si las hay, conserva una sola viñeta, cita las dos notas y quédate con la versión mejor comprobada.
