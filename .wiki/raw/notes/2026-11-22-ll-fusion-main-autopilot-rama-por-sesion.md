---
title: "Lessons Learned: fusión de main en la rama de autopilot-rama-por-sesion"
type: notes
source: session
ingested: 2026-11-22
tags: [lessons-learned, git, merge, conflictos, opencode, openspec-autopilot]
lesson_kind: lessons-learned
lesson_count: 2
category: notes
confidence: high
summary: "Al unir los dos lados de un bloque de conflicto se puede perder la línea de cierre que compartían (un cierre de bloque de código o un `});`); y el plugin de OpenCode hereda el entorno del contenedor efímero, así que branch-change.mjs rechaza sus cambios de rama si no se le pasa un entorno sin esas variables."
---

# Lessons Learned: fusión de main en la rama de autopilot-rama-por-sesion

> Extraído de la sesión del 2026-11-22: fusión de `origin/main` en `claude/exciting-ramanujan-802ws8` (commit de fusión `bc49d4f`, PR hiebra/idd#14), con 15 archivos en conflicto. [comprobado] con `npm run lint:specs` y la suite de aceptación. Complementa las lecciones de [los contadores](2026-11-22-ll-fusion-wiki-contadores.md) y de [las lecciones equivalentes](2026-11-22-ll-fusion-wiki-lecciones-equivalentes.md) al fusionar.

## Lesson 1: al unir los dos lados de un conflicto, se puede perder la línea que compartían

**Category**: gotcha
**Context**: conflictos de dos ramas que añaden al final de un mismo bloque: requisitos al final de `openspec/specs/openspec-autopilot/spec.md`, pasos al final de los archivos de `step-definitions/`.
**Symptom**: tras unir con un script «lado de la rama + lado de main», `npm run lint:specs` dio `Steps should begin with "Given"…` y `unexpected end of file, expected: #DocStringSeparator` en la spec del autopilot.
**Root cause**: git deja fuera del bloque de conflicto la línea común que cierra los dos lados (el cierre del bloque `gherkin` o el `});` del último paso). Al poner un lado detrás del otro, el primero queda sin cerrar y el cierre común solo sigue al segundo.
**Fix**: añadir el cierre al final del primer lado (en los pasos, `});`; en la spec, el cierre del bloque de código), y comprobarlo con `node --check` y `npm run lint:specs`.
**Rule**: al unir los dos lados de un conflicto, mira la línea que sigue a `>>>>>>>`: si cierra el bloque, el primer lado también la necesita. Pasa después el lint o el comprobador de sintaxis de cada archivo.

## Lesson 2: el plugin de OpenCode hereda el entorno del contenedor efímero

**Category**: gotcha
**Context**: tras la fusión, `switchBranch` y `originBranch` de `.agents/openspec/branch-change.mjs` rechazan actuar en un contenedor efímero (ADR-0016), y el plugin `openspec-autopilot` los llama al entrar en una sesión o desde el modal de `/new`.
**Symptom**: en la nube fallaron «Entrar en una sesión pone su rama» y «Cambiar a la rama de origen desde el modal», con el aviso `En un contenedor efímero el agente trabaja solo en la rama de la sesión`.
**Root cause**: el plugin se ejecuta en el proceso de OpenCode, que hereda `CLAUDE_CODE_CONTAINER_ID` y `CLAUDE_CODE_REMOTE=true` del contenedor en que corre la suite, y `isEphemeral` lee `process.env` por defecto.
**Fix**: `switchTo` de `.opencode/plugins/openspec-autopilot/lib/project.mjs` llama a `switchBranch(directory, branch, {})` y `originBranch(directory, {})`: el rechazo protege del agente la rama de la sesión, y estos cambios los pide el usuario desde OpenCode.
**Rule**: cuando una regla de `branch-change.mjs` depende del entorno, decide si vale para quien la llama: el plugin no es el agente, así que le pasa un entorno explícito en vez de heredar el del proceso.
