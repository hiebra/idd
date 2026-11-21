---
title: "La suite de aceptación y spec-as-source"
category: topic
sources:
  - raw/notes/2026-11-21-ll-marcadores-guia-recordatorio.md
  - raw/repos/2026-11-21-idd-1cf0792.md
  - raw/repos/2026-11-21-idd-f2be907-readme.md
  - raw/repos/2026-11-21-idd-b48392d-fix-wiki-flow-operations.md
created: 2026-11-21
updated: 2026-11-21
verified: 2026-11-21
tags: [acceptance-tests, spec-as-source, openspec, cucumber]
confidence: high
volatility: warm
summary: "Cómo la plantilla usa los spec.md como fuente ejecutable de una suite cucumber-js que no arranca los agentes reales sino que simula cómo invoca cada uno el arranque. Sintetizado de openspec/config.yaml, los README y el soporte de la suite."
---

# La suite de aceptación y spec-as-source

> Los escenarios Gherkin de las specs son los tests, y la suite simula a cada agente en lugar de arrancarlo. Todo lo de esta página sale de los archivos citados, fijados en `idd@1cf0792` (el README, en `idd@f2be907`).

## spec-as-source

- `idd@1cf0792:openspec/config.yaml` exige la skill `spec-as-source` en las reglas de specs y de tasks (`rules.specs`, `rules.tasks`).
- En la práctica (`idd@f2be907:README.md`), los `spec.md` son la fuente ejecutable de los tests, las tasks empiezan por esos tests, y los cambios en `openspec/` y en el código nunca van en el mismo commit.

## La suite

`idd@1cf0792:acceptance-tests/README.md`:

- **Qué ejecuta**: cucumber-js (`stack: javascript`) ejecuta el Gherkin de cada `spec.md` de `openspec/specs/` y de los changes activos. Los changes archivados no se ejecutan nunca.
- **Archivos copiados**: `cucumber.cjs`, `extract-gherkin.cjs`, `openspec-effective-paths.cjs` y `.gherkin-lintrc` son copias literales de la skill `acceptance-test-authoring`.
- **Pasos**: los pasos solo llaman a métodos de intención del World y hacen aserciones.
- **Sin agentes reales**: cada escenario trabaja sobre una copia temporal del proyecto, en una máquina simulada (`PATH` y entorno). Los adaptadores de `support/agents/` imitan cómo invoca cada agente el arranque: Claude Code ejecuta los hooks de `.claude/settings.json`, y OpenCode es un host Node que carga el plugin con contextos falsos (`idd@1cf0792:acceptance-tests/support/agents/opencode-host.mjs`).
- **El wiki**: se simula con un motor falso, un repositorio git local con dos tags y una marca de versión en cada archivo (`idd@1cf0792:acceptance-tests/support/engine.js`).
- **Lo que no está en las specs**, como los conflictos de nombres con el motor o `.wiki/` ignorado por otra regla, se prueba con `node --test` en `acceptance-tests/core-tests/` (`npm run test:core`).
- **Textos que el arranque transforma**: la estructura se comprueba en la fuente y el contenido en lo entregado. El soporte de la suite replica la transformación (`GUIDE_OPERATIONS` en `idd@b48392d:acceptance-tests/support/world.js`), y `idd@b48392d:acceptance-tests/core-tests/wiki-markers.test.js` fija la tabla de marcadores para que las dos copias no diverjan ([lecciones de fix-wiki-flow-operations](../../raw/notes/2026-11-21-ll-marcadores-guia-recordatorio.md)).
- **Durante un change que modifica escenarios**, el criterio de verde es `npm test`. `npm run test:specs` puede tener pasos sin definir de los escenarios sustituidos hasta el archive ([lecciones de fix-wiki-flow-operations](../../raw/notes/2026-11-21-ll-marcadores-guia-recordatorio.md)).
- **Pasos nuevos**: antes de definirlos, contrasta su expresión con las genéricas que ya existen y con los pasos que empiezan igual, y restringe las capturas a los valores de los `Examples` ([lecciones de fix-wiki-flow-operations](../../raw/notes/2026-11-21-ll-marcadores-guia-recordatorio.md)).

## Su límite

- La suite comprueba lo que garantiza la plantilla, no cómo razona el modelo.
- `openspec validate --strict` no pasa con las specs del proyecto: sus avisos de idioma ("DEBE" en lugar de SHALL/MUST) y de formato (Gherkin en bloques de código) cuentan como errores. El criterio de cierre es validar sin `--strict` y revisar los demás avisos ([lecciones de fix-wiki-flow-operations](../../raw/notes/2026-11-21-ll-marcadores-guia-recordatorio.md)).
- Depende de que la simulación de cada agente siga el contrato real. Cuando un agente cambia su API, hay que actualizar el adaptador y su simulación (`idd@1cf0792:adr/0002-agent-neutral-session-bootstrap.md`). Ese contrato se comprueba aparte con los agentes reales (ver [El hook context de OpenCode](../concepts/hook-context-opencode.md) y [Proveedor falso para verificar el contexto](../concepts/proveedor-falso-para-verificar-contexto.md)).

## See Also

- [El arranque de sesión](arranque-de-sesion.md)
- [Proveedor falso para verificar el contexto](../concepts/proveedor-falso-para-verificar-contexto.md)
- [El hook context de OpenCode](../concepts/hook-context-opencode.md)

## Sources

- [Lecciones de fix-wiki-flow-operations](../../raw/notes/2026-11-21-ll-marcadores-guia-recordatorio.md): `openspec validate --strict`, marcadores de la guía, `test:specs` durante un change y expresiones de paso.

- [Collection: repositorio de la plantilla intent-driven](../../raw/repos/2026-11-21-idd-1cf0792.md): `openspec/config.yaml`, `acceptance-tests/README.md`, `acceptance-tests/support/agents/opencode-host.mjs`, `acceptance-tests/support/engine.js`, `adr/0002-agent-neutral-session-bootstrap.md`.
- [Collection: archivado de fix-wiki-flow-operations](../../raw/repos/2026-11-21-idd-b48392d-fix-wiki-flow-operations.md): `acceptance-tests/support/world.js`, `acceptance-tests/core-tests/wiki-markers.test.js`.
- [Collection: README de la plantilla tras el archivado](../../raw/repos/2026-11-21-idd-f2be907-readme.md): `README.md`.
