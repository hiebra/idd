---
title: "Lessons Learned: lo que llega de main puede contradecir el change sin conflicto de git"
type: notes
source: session
ingested: 2026-11-22
tags: [lessons-learned, git, merge, openspec-autopilot, llm-wiki]
lesson_kind: lessons-learned
lesson_count: 1
category: notes
confidence: high
summary: "Al fusionar main en la rama de autopilot-plan-explore, dos textos que llegaban daban por hecho que las revisiones corren con el agente plan; git los fusionó sin conflicto aunque el change lo había cambiado a build."
---

# Lessons Learned: lo que llega de main puede contradecir el change sin conflicto de git

> Extraído de la sesión del 2026-11-22: las fusiones de `origin/main` en la rama de `autopilot-plan-explore` (commits `c307f8f` y `8b4c395`, PR hiebra/idd#12). [comprobado] leyendo lo que llegaba y pasando `npm run test:core`. Complementa la [lección sobre lecciones equivalentes](2026-11-22-ll-fusion-wiki-lecciones-equivalentes.md).

## Lesson 1: busca en lo que llega los supuestos que el change invalida, aunque git no marque conflicto

**Category**: gotcha
**Context**: fusionar `main` en la rama de un change que cambia un comportamiento (ADR-0019: todas las sesiones del autopilot, también las revisiones, nacen con el agente build), cuando a `main` han llegado changes escritos con el comportamiento anterior.
**Symptom**: dos textos que daban por hecho que la revisión corre con el agente plan se fusionaron sin conflicto:
- en `.wiki/wiki/topics/ciclo-de-un-change-y-autopilot.md`, el punto de `guiar-revision-con-tests` decía que «el agente `plan` de la revisión ejecuta el runner sin pedir permiso» (fusión `c307f8f`);
- en `acceptance-tests/core-tests/autopilot-plugin.test.js`, el test de `apply-one-task-per-session-in-normal-mode` sembraba la revisión del verify con `agent: 'plan'` (fusión `8b4c395`). El test pasaba igual, así que tampoco los tests lo señalaban.
**Root cause**: git solo marca conflicto cuando los dos lados tocan las mismas líneas. Un texto nuevo que llega de `main` y se apoya en lo que el change ha cambiado está en otras líneas, y entra limpio. Un test que pasa con el supuesto viejo no lo delata, porque el plugin tolera una sesión sembrada con plan.
**Fix**: se buscó en lo que llegaba (`git diff <merge-base> origin/main`) el término del comportamiento cambiado (`plan`, `agent`) y se corrigieron los dos: el punto del wiki dice ahora que se comprobó cuando la revisión corría con plan y que con build no cambia, y el test siembra la revisión con `agent: 'build'`.
**Rule**: al fusionar `main` en la rama de un change que cambia un comportamiento, revisa también lo que llega sin conflicto: busca en el diff de `main` desde el merge-base los términos de lo que el change cambió, y corrige el código, los tests y el wiki que se apoyen en el supuesto anterior.
