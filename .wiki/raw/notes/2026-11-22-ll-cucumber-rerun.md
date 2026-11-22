---
title: "Lessons Learned: el archivo de rerun de cucumber-js no acota la pasada (apply-one-task-per-session-in-normal-mode)"
type: notes
source: session
ingested: 2026-11-22
tags: [lessons-learned, acceptance-tests, cucumber-js]
lesson_kind: lessons-learned
lesson_count: 1
category: notes
confidence: high
summary: "--format rerun lista los escenarios que fallan, pero npx cucumber-js @rerun.txt vuelve a cargar la suite entera, porque sus rutas se suman a las del perfil; para repetirlos, --name"
---

# Lessons Learned: el archivo de rerun de cucumber-js no acota la pasada

> Extraído de la sesión del 2026-11-22, al comprobar tras fusionar `main` en la rama de `apply-one-task-per-session-in-normal-mode` qué escenarios fallaban. cucumber-js 13.3.0. Completa la lección 6 de [windows-support](2026-11-22-ll-windows-support.md) (la ruta posicional de un `.feature` no acota).

## Lesson 1: `@rerun.txt` se suma a las rutas del perfil

**Category**: gotcha
**Context**: La suite de aceptación da 15 fallos de 269 y hay que saber si son todos de `windows-readiness` (sin `pwsh` en la nube).
**Symptom**: `npx cucumber-js --format rerun:<archivo>` deja en el archivo las rutas y líneas de los escenarios que fallan, pero `npx cucumber-js --dry-run @<archivo>` carga los 269 escenarios, igual que sin argumentos.
**Root cause**: las líneas del archivo de rerun son rutas, y `cucumber.cjs` fija `paths` (`effectivePaths()`) en el perfil por defecto; las rutas de la línea de órdenes se suman a ellas, no las sustituyen [comprobado el efecto con `--dry-run`, no la regla interna de cucumber].
**Fix**: leer el archivo de rerun para saber qué falla (`tr ' ' '\n' < <archivo> | sed 's/:.*//' | sort | uniq -c` da los fallos por feature) y repetir los escenarios por su nombre: `--name "^<escenario>$"` dejó la pasada en 1 escenario.
**Rule**: en esta suite, `--format rerun` sirve para listar los fallos de una pasada; para repetirlos, `--name` o tags, nunca `@<archivo>` ni la ruta del `.feature`.
