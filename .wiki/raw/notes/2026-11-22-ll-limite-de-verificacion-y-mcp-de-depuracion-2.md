---
title: "Lessons Learned: limite-de-verificacion-y-mcp-de-depuracion (task 1.2)"
type: notes
source: session
ingested: 2026-11-22
tags: [lessons-learned, acceptance-tests, cucumber-js]
lesson_kind: lessons-learned
lesson_count: 1
category: notes
confidence: high
summary: "--name de cucumber-js filtra por nombre de escenario; el nombre de un requisito de la spec no selecciona nada"
---

# Lessons Learned: limite-de-verificacion-y-mcp-de-depuracion (task 1.2)

> Extracted from session on 2026-11-22. 1 lesson about filtering the acceptance suite.

## Lesson 1: `--name` filtra por escenario, no por requisito

**Category**: gotcha
**Context**: comprobar que los escenarios del requisito «El ajuste de config.yaml no toca nada más» (openspec-autopilot) seguían en verde tras cambiar `openspec/config.yaml`.
**Symptom**: `npx cucumber-js --name "El ajuste de config.yaml no toca nada más"` no ejecutó ninguno de sus escenarios, y tampoco avisó. Solo corrieron los del otro `--name`.
**Root cause**: `extract-gherkin.cjs` convierte cada requisito en un `Rule:`, y `--name` de cucumber-js solo compara con los nombres de los escenarios, no con los de los `Rule:`.
**Fix**: sacar los nombres de los `#### Scenario:` del requisito en `openspec/specs/<capability>/spec.md` y pasar un `--name` por cada uno. Pasaron los 5.
**Rule**: para ejecutar los escenarios de un requisito, pasa un `--name` por cada escenario. Un `--name` con el nombre del requisito no selecciona nada y no da error, así que el resumen parece bueno aunque no se haya comprobado lo que querías.
