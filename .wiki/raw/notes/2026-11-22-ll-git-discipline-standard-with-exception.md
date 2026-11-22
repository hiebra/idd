---
title: "Lessons Learned: git-discipline-standard-with-exception"
type: notes
source: session
ingested: 2026-11-22
tags: [lessons-learned, openspec, git, spec-as-source, cucumber, branch-change]
lesson_kind: lessons-learned
lesson_count: 5
category: notes
confidence: high
summary: "5 lecciones de git-discipline-standard-with-exception: openspec validate también impide quitar escenarios en un MODIFIED, check commit cuenta los archivos sin seguimiento, openspec archive --yes no avisa de tasks pendientes, una puerta nueva puede bloquear el change que la introduce, y cucumber-js con la ruta de un .feature ejecuta la suite entera."
---

# Lessons Learned: git-discipline-standard-with-exception

> Extraído de la sesión del 2026-11-22. 5 lecciones de planificar, implementar y archivar `git-discipline-standard-with-exception`, comprobadas con OpenSpec 1.17.0, el `branch-change.mjs` del change y la suite de aceptación.

## Lesson 1: `openspec validate` también impide quitar escenarios en un MODIFIED

**Category**: gotcha
**Context**: validar la delta de `openspec-change-lifecycle`, en la que tres requisitos cambiaban de sentido y se reescribían con RENAMED + MODIFIED y escenarios nuevos.
**Symptom**: `openspec validate <change>` da `[ERROR] … MODIFIED "<requisito>" omits scenario(s) the current spec still has: "<escenario>" … Copy the omitted scenarios into the MODIFIED block (a MODIFIED requirement replaces the whole block, so archive refuses to drop them).`
**Root cause**: la protección de escenarios que aborta el archive ([lecciones de conflictos entre deltas](2026-11-22-ll-conflictos-entre-deltas-concurrentes.md), lección 1) la aplica también `validate`, antes del archive.
**Fix**: los requisitos que cambian de sentido pasaron a REMOVED (con **Reason** y **Migration**) más ADDED con el texto y los escenarios nuevos.
**Rule**: un MODIFIED solo puede conservar o ampliar los escenarios por nombre; para quitar o reemplazar escenarios, el requisito va como REMOVED más ADDED.

## Lesson 2: `check commit` cuenta los archivos sin seguimiento

**Category**: gotcha
**Context**: hacer, en un contenedor efímero, commits de una sola zona con un ADR nuevo en `adr/` (código) y su manifiesto en `openspec/changes/<change>/adr.md` (specs), los dos sin seguimiento.
**Symptom**: tras `git add adr/0020-*.md`, `check commit` respondió `Los cambios pendientes mezclan la zona de specs (…adr.md) y la de código (…0020-….md)`.
**Root cause**: la puerta clasifica todos los cambios pendientes, preparados o no, incluidos los archivos sin seguimiento.
**Fix**: apartar una zona con `git stash push -q -u -- <rutas>`, hacer el commit de la otra, `git stash pop` y hacer el segundo commit.
**Rule**: para separar zonas con `check commit` hay que apartar la otra del árbol de trabajo, también lo que no tiene seguimiento (`git stash push -u -- <rutas>`); no basta con no prepararla.

## Lesson 3: `openspec archive --yes` archiva con tasks pendientes sin avisar

**Category**: gotcha
**Context**: archivar `git-discipline-standard-with-exception` con la CLI, con la task 5.5 (actualizar el `Purpose`, que el archive no toca) todavía sin marcar.
**Symptom**: `openspec archive <change> --yes` aplicó la delta y movió el change sin mencionar la task pendiente.
**Root cause**: con `--yes`, la CLI se salta las confirmaciones; la advertencia de tasks incompletas la da el workflow `openspec-archive-change`, que cuenta las tasks con `openspec list --json`.
**Fix**: comprobar antes las tasks con `openspec list --json` (20 de 21), hacer la task pendiente justo después y marcarla en el `tasks.md` archivado.
**Rule**: antes de `openspec archive --yes`, comprueba las tasks pendientes con `openspec list --json`: la CLI con `--yes` no avisa de ellas.

## Lesson 4: una puerta nueva puede bloquear el change que la introduce

**Category**: pattern
**Context**: implementar en `branch-change.mjs` el `check apply` de la regla estándar, que sin `x-main-protected: true` exige la propuesta en la rama de origen, en la rama de la sesión de un contenedor efímero.
**Symptom**: tras la task 3.2, `check apply git-discipline-standard-with-exception` respondió `La propuesta de '…' no está en la rama de origen 'main': la regla pide que llegue antes a la rama de origen…`, a mitad del apply del propio change.
**Root cause**: la puerta está versionada en la rama, así que el change empieza a cumplirla en cuanto la implementa; la clave que lo habilitaba en este repositorio estaba planificada como la última task (5.1).
**Fix**: el usuario adelantó la 5.1 y se declaró `x-main-protected: true` en `openspec/config.yaml`, en un commit de la zona de specs.
**Rule**: cuando un change endurece una puerta del ciclo, planifica pronto la configuración que el propio change necesita para seguir pasándola, porque la puerta nueva se aplica en la misma rama en cuanto se implementa.

## Lesson 5: `cucumber-js` con la ruta de un `.feature` ejecuta la suite entera

**Category**: gotcha
**Context**: ejecutar solo la feature de la delta (`.extracted/changes/<change>/specs/<capability>/spec.feature`) tras reescribir la skill.
**Symptom**: `npx cucumber-js <ruta del .feature>` no terminó en 300 s y acabó con `215 scenarios (215 passed)`, la suite completa.
**Root cause**: [inferido] la configuración de `acceptance-tests/cucumber.cjs` fija las rutas de la suite efectiva, y la ruta pasada no las sustituye. Con `--name "<patrón>"` sí se filtra.
**Fix**: filtrar con `--name "<escenario>|<escenario>"`, que tarda unos segundos, y dejar la suite completa para el cierre.
**Rule**: para ejecutar solo unos escenarios de la suite de aceptación, filtra con `--name`; la ruta de un `.feature` no acota la ejecución.
