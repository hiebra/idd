---
title: "Lessons Learned: manage-git-discipline"
type: notes
source: session
ingested: 2026-11-22
tags: [lessons-learned, acceptance-tests, cucumber, git, claude-code-cloud, openspec]
lesson_kind: lessons-learned
lesson_count: 4
category: notes
confidence: high
summary: "En la nube, git firma cada commit y la suite tarda 15-20 minutos; un grupo opcional de una regex de cucumber que no captura puede no pasarse y colgar el paso; cambiar de rama cambia el branch-change.mjs que se ejecuta; y la suite tiene que quitar las variables del contenedor efímero que hereda."
---

# Lessons Learned: manage-git-discipline

> Extraído de la sesión del 2026-11-22. 4 lecciones de implementar y archivar `manage-git-discipline` en una sesión de Claude Code en la nube.

## Lesson 1: En la nube, git firma cada commit y la suite se vuelve lenta

**Category**: environment
**Context**: La suite crea muchos repos de prueba con commits (`support/project.js`, `support/branches.js`) en un contenedor de Claude Code en la nube.
**Symptom**: Un solo feature de `openspec-change-lifecycle` pasó de los dos minutos, y la suite entera tardó 15-20 minutos. Con `ps` se veía `/tmp/code-sign -Y sign` detrás de cada `git commit` de la suite.
**Root cause**: El entorno configura de forma global la firma de commits, y la heredan también los commits de los repos de prueba.
**Fix**: Ninguno en el repositorio: se lanzó la suite en segundo plano y se filtraron con `--name` los escenarios del paso en curso.
**Rule**: En la nube, ejecuta la suite completa en segundo plano y usa `--name` para iterar; cuenta con 15-20 minutos por pasada completa.

## Lesson 2: Un grupo opcional de una regex de cucumber que no captura puede no pasarse como argumento

**Category**: gotcha
**Context**: Un paso con la regex `` /^la sesión está en un contenedor efímero (sin rama… guardada|con `([^`]+)` guardada…)$/ `` y la función `function (_, saved)`.
**Symptom**: Con «sin rama guardada», el paso se colgaba hasta el timeout de 300 s; con `function (...groups)`, cucumber decía `function has 0 arguments, should have 1`.
**Root cause**: cucumber pasa un argumento por cada grupo de la regex y decide entre función síncrona y de callback por la aridad. El grupo interno que no capturaba descuadraba esa cuenta, y con aridad 2 tomó la función por una de callback.
**Fix**: Hacer no capturante el grupo externo, `` (?:sin …|con `([^`]+)` …) ``, y declarar `function (saved)` con `saved ?? null` (`idd@5d7f5b0:acceptance-tests/step-definitions/change-lifecycle.steps.js`).
**Rule**: En los pasos con regex, deja como capturantes solo los grupos que la función recibe, y que su aridad sea exactamente ese número.

## Lesson 3: Al cambiar de rama se ejecuta el branch-change.mjs de esa rama

**Category**: gotcha
**Context**: Comprobar en esta sesión que `check propose` en `main` avisa sin bloquear (task 6.3).
**Symptom**: Tras `git switch main`, la puerta respondió con el mensaje antiguo, que no deja proponer en una rama permanente. Además, cambiar de rama con la suite en marcha dejó tres fallos sueltos en `test:core`, que desaparecieron al repetirla.
**Root cause**: `.agents/openspec/branch-change.mjs` es un archivo versionado: al cambiar de rama se ejecuta la versión de `main`, y la suite copia el árbol de trabajo que haya en cada momento.
**Fix**: Probar sobre un worktree de `main` con el módulo de la rama de trabajo, sin cambiar de rama: `git worktree add <dir> main` y `node /ruta/de/la/rama/.agents/openspec/branch-change.mjs check propose` dentro de `<dir>`.
**Rule**: Para probar el módulo nuevo en otra rama, usa un worktree; no cambies de rama, y menos con la suite en marcha.

## Lesson 4: La suite hereda las variables del contenedor efímero

**Category**: gotcha
**Context**: La puerta `check commit` y `prepare_git` deciden si la sesión es un contenedor efímero por `CLAUDE_CODE_CONTAINER_ID` y `CLAUDE_CODE_REMOTE=true`.
**Symptom**: Ejecutada en la nube, la suite veía siempre un contenedor efímero: el entorno real tiene esas variables, y las máquinas simuladas las pasaban al núcleo del arranque y a las puertas.
**Root cause**: `cleanEnv` de `support/machine.js` solo quitaba las variables `npm_*`, `GIT_*` y las del agente, y `checkGate` usaba `process.env` tal cual.
**Fix**: Quitar las dos variables en `cleanEnv` y en `sessionEnv`, y ponerlas solo cuando el escenario pide un contenedor efímero (`idd@5d7f5b0:acceptance-tests/support/machine.js`, `idd@5d7f5b0:acceptance-tests/support/branches.js`).
**Rule**: Cualquier variable del entorno real que cambie el comportamiento del proyecto debe controlarla el escenario: quítala del entorno heredado y ponla solo cuando el escenario la pida.
