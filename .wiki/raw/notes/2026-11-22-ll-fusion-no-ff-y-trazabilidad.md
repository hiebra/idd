---
title: "Lessons Learned: la fusión con --no-ff y la trazabilidad de cada change"
type: notes
source: session
ingested: 2026-11-22
tags: [lessons-learned, git, openspec, no-ff, trazabilidad, wiki-first]
lesson_kind: lessons-learned
lesson_count: 3
category: notes
confidence: high
summary: "La regla de una zona por commit no afecta a la fusión; --no-ff mantiene en main los commits que cita el wiki y agrupa cada change, pero la intención está en los artefactos archivados y el mensaje de la fusión de una PR no nombra el change."
---

# Lessons Learned: la fusión con --no-ff y la trazabilidad de cada change

> Sale de la sesión del 2026-11-22. Son 3 lecciones sobre qué limita la regla de una sola zona y qué aporta `--no-ff` a quien busca la intención y las fuentes de un cambio.

## Lesson 1: La regla de una sola zona se aplica a los commits, no a la fusión

**Category**: correction
**Context**: Duda sobre si se puede fusionar a la vez el plan y la implementación.
**Symptom**: Se recordaba una política que lo impediría.
**Root cause**: La spec `openspec-change-lifecycle` (requirement *Commits provisionales de una sola zona*) prohíbe que un **commit** mezcle la zona de specs (`openspec/`, salvo los `tasks.md`) con la de código. La puerta `branch-change.mjs check commit` lo comprueba solo en los commits del agente (`idd@a62cf14:openspec/specs/openspec-change-lifecycle/spec.md`, `idd@a62cf14:.agents/openspec/branch-change.mjs`).
**Fix**: Dentro de la rama, los commits alternan entre las dos zonas. La fusión `--no-ff` con la rama de origen junta el plan, el código, el archive y el wiki, y es la forma recomendada (`idd@a62cf14:adr/0015-git-discipline-two-forms-and-ephemeral-commits.md`).
**Rule**: La separación por zonas se aplica a cada commit de la rama; la fusión de la rama entera puede contener las dos zonas.

## Lesson 2: Con --no-ff, los commits que cita el wiki siguen en main

**Category**: discovery
**Context**: Saber si `--no-ff` ayuda a seguir hasta su origen las citas `idd@<commit>:<ruta>` del wiki.
**Symptom**: —
**Root cause**: Los artículos citan commits de la rama del change. Con `--no-ff`, esos commits quedan en la historia de `main`. Comprobado con `git merge-base --is-ancestor`: `5d7f5b0`, `6d6e79c` y `772d0f0` están en `origin/main`. Con un squash dejarían de estarlo y habría que resolver la cita por su blob. ADR-0015 da ese motivo: el squash "borra de `main` los commits que cita el wiki".
**Fix**: Fusionar con `--no-ff`. `git log --first-parent` muestra un change por entrada, y `git diff M^1 M` da el change entero. Desde una línea de código: `git blame` da el commit, y la primera fusión posterior en `main` da su change.
**Rule**: `--no-ff` mantiene en la historia de la rama de origen los commits que cita el wiki; la búsqueda por blob queda solo para el squash.

## Lesson 3: La fusión permite llegar a la intención, pero no la contiene

**Category**: gotcha
**Context**: Saber si la fusión con `--no-ff` ayuda al modelo a detectar la intención de cada cambio.
**Symptom**: El merge de la PR más reciente, `dad41e9`, tiene el título por defecto de GitHub, *"Merge pull request #3 from hiebra/claude/eloquent-hawking-jvhlb0"*. Las fusiones locales anteriores nombraban el change (`32639ba`: *"Merge autopilot-sesion-operativa into main"*).
**Root cause**: La intención está en `proposal.md`, `design.md` y los ADRs que el change archiva dentro de la fusión, no en el commit de fusión. Ninguna herramienta del proyecto va del código al change y del change al wiki: el flujo wiki-first va del wiki al código a través de las citas. ADR-0015 no afirma que `--no-ff` ayude a detectar la intención; es una deducción de esta sesión.
**Fix**: Poner el nombre del change en el título del commit de fusión de cada PR, para que `git log --first-parent` sirva de índice de changes por nombre. Queda en seguimiento en el inventario ([nombrar el change en la fusión](../../inventory/candidates/nombrar-el-change-en-el-titulo-de-la-fusion.md)).
**Rule**: `--no-ff` hace posible ir de un cambio a su intención, pero hace falta pedirlo, y el título de la fusión debe nombrar el change para que sirva de índice.
