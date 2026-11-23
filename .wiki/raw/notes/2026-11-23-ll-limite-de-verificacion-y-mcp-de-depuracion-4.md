---
title: "Lessons Learned: task 2.4 de limite-de-verificacion-y-mcp-de-depuracion"
type: notes
source: session
ingested: 2026-11-23
tags: [lessons-learned, acceptance-tests, cucumber-js]
lesson_kind: lessons-learned
lesson_count: 1
category: notes
confidence: high
summary: "Un escenario temporal y aislado se ejecuta con un --config propio, pasado con una ruta relativa al directorio actual"
---

# Lessons Learned: task 2.4 de limite-de-verificacion-y-mcp-de-depuracion

> Extracted from session on 2026-11-23. 1 lesson about running a throwaway scenario outside the suite.

## Lesson 1: un escenario temporal se ejecuta con un `--config` propio y una ruta relativa

**Category**: gotcha
**Context**: comprobar que un defecto que no está en `support/debug-contract.js` falla diciéndolo, con un `.feature` temporal fuera del proyecto (en el scratchpad), sin tocar las specs.
**Symptom**: `npx cucumber-js <ruta>/x.feature --import ...` lanzó la suite completa, que pasó de 120 s y hubo que pararla. Con `--config /ruta/absoluta/c.cjs`, cucumber-js falló con `Cannot find module '/home/user/idd/acceptance-tests/tmp/.../c.cjs'`: antepuso el directorio actual a la ruta absoluta.
**Root cause**: el perfil por defecto de `cucumber.cjs` fija `paths` (`effectivePaths()`), y las rutas de la línea de órdenes se suman a ellas. Además, cucumber-js resuelve `--config` respecto al directorio actual aunque la ruta sea absoluta.
**Fix**: escribir un config propio, `module.exports = { default: { paths: ['<ruta absoluta>/x.feature'], import: ['support/**/*.js', 'step-definitions/**/*.js'], format: ['summary'] } }`, y pasarlo con una ruta relativa: `npx cucumber-js --config "$(realpath --relative-to=. <c.cjs>)"`. Solo se ejecuta ese escenario, en segundos.
**Rule**: para ejecutar en `acceptance-tests/` un escenario temporal que no está en las specs, no pases el `.feature` como argumento: dale un `--config` propio con sus `paths` e `import`, escrito con una ruta relativa al directorio actual.
