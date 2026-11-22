---
title: "Lessons Learned: autopilot-rama-por-sesion"
type: notes
source: session
ingested: 2026-11-22
tags: [lessons-learned, acceptance-tests, cucumber, git]
lesson_kind: lessons-learned
lesson_count: 2
category: notes
confidence: high
summary: "En una expresión de Cucumber (paso como cadena), una `/` es una alternativa, así que un paso con `/new` no casa y sale sin definir; y `git switch <rama>` solo crea la rama local desde origin/<rama> si el remoto `origin` está configurado."
---

# Lessons Learned: autopilot-rama-por-sesion

> Extraído de la sesión del 2026-11-22. 2 lecciones de implementar `autopilot-rama-por-sesion`: los pasos de cucumber del modal de `/new` y el subcomando `origin` de `branch-change.mjs`.

## Lesson 1: En una expresión de Cucumber, la `/` es una alternativa

**Category**: gotcha
**Context**: Pasos de `acceptance-tests/step-definitions/autopilot.steps.js` definidos con cadenas: `When('el usuario hace `/new` desde la sesión operativa', …)`.
**Symptom**: La suite dio esos escenarios como `undefined`, con el snippet `When('el usuario hace `\\/new` desde la sesión operativa', …)`, aunque el texto del paso era idéntico.
**Root cause**: En las Cucumber Expressions, `/` separa alternativas de texto (`a/b` casa con `a` o con `b`), así que `` `/new` `` no casa con el texto literal.
**Fix**: Definir esos pasos con una expresión regular (`/^el usuario hace `\/new` desde la sesión operativa$/`); también vale escapar la barra (`\\/`).
**Rule**: Un paso de cucumber-js definido con cadena cuyo texto lleva `/` (o `(`, `)`, `{`, `}`) necesita escaparlo o pasar a expresión regular; si un paso sale sin definir con un texto que parece igual, compara con el snippet que propone cucumber.

## Lesson 2: `git switch <rama>` solo crea la rama local desde `origin/<rama>` con el remoto configurado

**Category**: gotcha
**Context**: `originBranch` de `.agents/openspec/branch-change.mjs` (subcomando `origin`) y su core-test con la rama de origen solo como `refs/remotes/origin/main`, creada con `git update-ref`, sin `git remote add`.
**Symptom**: `git switch -q main` falló: no existía `refs/heads/main` y git no la creó desde `origin/main`.
**Root cause**: La creación automática de `git switch <rama>` (DWIM de `--guess`) busca la rama en las referencias de los remotos configurados; una `refs/remotes/origin/<rama>` sin el remoto `origin` en la configuración no cuenta.
**Fix**: Si no hay rama local, crearla explícitamente: `git switch -q -c <rama> origin/<rama>`.
**Rule**: Para pasar a una rama que puede existir solo en `origin/`, no confíes en el DWIM de `git switch <rama>`: comprueba `refs/heads/<rama>` y, si no está, usa `git switch -c <rama> origin/<rama>`.
