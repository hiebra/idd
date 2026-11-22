---
title: "La suite de aceptación y spec-as-source"
category: topic
sources:
  - raw/repos/2026-11-22-idd-d355c01-replace-gherkin-lint-with-gplint.md
  - raw/repos/2026-11-22-idd-99bdccd-fix-tui-subscription-cleanup.md
  - raw/notes/2026-11-21-ll-marcadores-guia-recordatorio.md
  - raw/repos/2026-11-21-idd-1cf0792.md
  - raw/repos/2026-11-21-idd-f2be907-readme.md
  - raw/repos/2026-11-21-idd-b48392d-fix-wiki-flow-operations.md
  - raw/repos/2026-11-21-idd-772d0f0-add-openspec-autopilot.md
  - raw/notes/2026-11-22-ll-add-quote-comment-rule.md
created: 2026-11-21
updated: 2026-11-22
verified: 2026-11-22
tags: [acceptance-tests, spec-as-source, openspec, cucumber, gplint]
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
- **Archivos copiados**: `cucumber.cjs`, `extract-gherkin.cjs`, `openspec-effective-paths.cjs` y `.gplintrc` son copias literales de la skill `acceptance-test-authoring` (`idd@d355c01:acceptance-tests/README.md`). Hasta `replace-gherkin-lint-with-gplint`, la configuración del lint era `.gherkin-lintrc`.
- **El lint de las specs** (`npm run lint:specs`, capability `spec-lint`): extrae los `spec.md` y pasa `gplint` con `.gplintrc`, la configuración fijada de la skill (`idd@d355c01:adr/0012-spec-lint-with-gplint.md`). Sustituye a `gherkin-lint`, que arrastraba 6 vulnerabilidades sin arreglo y cuyas reglas de AST no entraban en los hijos de `Rule:`. Como la extracción convierte cada requisito en un `Rule:`, esas reglas no revisaban ningún escenario. `.gplintrc` solo usa los niveles `"error"` y `"off"`, porque con cualquier otro `gplint` lanza una excepción y sale con 0 sin revisar nada (`idd@d355c01:openspec/changes/archive/2026-11-22-replace-gherkin-lint-with-gplint/design.md`). Los escenarios de `spec-lint` no ejecutan el script tal cual, porque reconstruiría `.extracted/` mientras cucumber-js lo usa: `support/spec-lint.js` ejecuta sus dos comandos sobre otros directorios, y `core-tests/spec-lint-script.test.js` impide que el script y esos comandos se separen (`idd@d355c01:acceptance-tests/support/spec-lint.js`).
- **Pasos**: los pasos solo llaman a métodos de intención del World y hacen aserciones.
- **Sin agentes reales**: cada escenario trabaja sobre una copia temporal del proyecto, en una máquina simulada (`PATH` y entorno). Los adaptadores de `support/agents/` imitan cómo invoca cada agente el arranque: Claude Code ejecuta los hooks de `.claude/settings.json`, y OpenCode es un host Node que carga el plugin con contextos falsos (`idd@1cf0792:acceptance-tests/support/agents/opencode-host.mjs`). Ese host puede además recargar la parte de TUI, emitir un aviso sintético por el RPC y cerrar la TUI con su propio servidor; a diferencia de OpenCode, solo recarga la TUI, porque volver a ejecutar la parte de servidor relanzaría el núcleo del arranque (`idd@99bdccd:acceptance-tests/support/agents/opencode-host.mjs`).
- **El ciclo de un change** (`openspec-change-lifecycle`): cada escenario monta el estado de git que necesita sobre la copia, que ya es un repositorio con `main` (`idd@772d0f0:acceptance-tests/support/branches.js`). El change y las puertas salen de `branch-change.mjs` de la copia; como la suite no ejecuta el modelo de los workflows, comprueba la puerta y que la skill `openspec-git-discipline` la usa, por sus identificadores de sección `<!-- lifecycle:<id> -->` (`idd@772d0f0:acceptance-tests/README.md`).
- **El plugin `openspec-autopilot`**: se prueba en un OpenCode simulado con varias sesiones, un proceso hijo de larga duración que el World maneja por IPC (`idd@772d0f0:acceptance-tests/support/agents/opencode-sim.mjs` y `opencode-sim.js`). Reiniciar OpenCode es un proceso nuevo sobre el mismo almacén de sesiones. Simula el contrato comprobado con OpenCode 2.3.2: metadata sustituida entera, `archived` ignorado en el servidor, `list` por páginas, tools solo con `codemode: false`, recargas que ejecutan antes la limpieza que devolvió cada `setup`, escuchadores de la TUI que solo sobreviven si el plugin no los libera, el cierre con `--standalone` con una traza por cada suscripción viva, y fallos inyectables (`idd@99bdccd:acceptance-tests/README.md`). El modelo es un guion por escenario, y de cada petición se registra lo que recibe (ver [[ciclo-de-un-change-y-autopilot|El ciclo de un change y su automatización en OpenCode]] ([El ciclo de un change y su automatización en OpenCode](ciclo-de-un-change-y-autopilot.md))).
- **El wiki**: se simula con un motor falso, un repositorio git local con dos tags y una marca de versión en cada archivo (`idd@1cf0792:acceptance-tests/support/engine.js`).
- **Lo que no está en las specs**, como los conflictos de nombres con el motor o `.wiki/` ignorado por otra regla, se prueba con `node --test` en `acceptance-tests/core-tests/` (`npm run test:core`).
- **Textos que el arranque transforma**: la estructura se comprueba en la fuente y el contenido en lo entregado. El soporte de la suite replica la transformación (`GUIDE_OPERATIONS` en `idd@b48392d:acceptance-tests/support/world.js`), y `idd@b48392d:acceptance-tests/core-tests/wiki-markers.test.js` fija la tabla de marcadores para que las dos copias no diverjan ([lecciones de fix-wiki-flow-operations](../../raw/notes/2026-11-21-ll-marcadores-guia-recordatorio.md)).
- **Durante un change que modifica escenarios**, el criterio de verde es `npm test`. `npm run test:specs` puede tener pasos sin definir de los escenarios sustituidos hasta el archive ([lecciones de fix-wiki-flow-operations](../../raw/notes/2026-11-21-ll-marcadores-guia-recordatorio.md)).
- **Pasos nuevos**: antes de definirlos, contrasta su expresión con las genéricas que ya existen y con los pasos que empiezan igual, y restringe las capturas a los valores de los `Examples` ([lecciones de fix-wiki-flow-operations](../../raw/notes/2026-11-21-ll-marcadores-guia-recordatorio.md)).
- **Pasos de ausencia**: un paso que afirma que algo no llega al agente comprueba la ausencia de ese contenido concreto, no que no llegue nada. `el agente no recibe la guía del wiki` exigía un contexto vacío y se rompió cuando el arranque empezó a entregar también la regla de comentarios (`idd@16e4617:acceptance-tests/step-definitions/wiki.steps.js`; [lecciones de add-quote-comment-rule](../../raw/notes/2026-11-22-ll-add-quote-comment-rule.md), lección 2).

## Su límite

- La suite comprueba lo que garantiza la plantilla, no cómo razona el modelo.
- `openspec validate --strict` no pasa con las specs del proyecto: sus avisos de idioma ("DEBE" en lugar de SHALL/MUST) y de formato (Gherkin en bloques de código) cuentan como errores. El criterio de cierre es validar sin `--strict` y revisar los demás avisos ([lecciones de fix-wiki-flow-operations](../../raw/notes/2026-11-21-ll-marcadores-guia-recordatorio.md)).
- Depende de que la simulación de cada agente siga el contrato real. Cuando un agente cambia su API, hay que actualizar el adaptador y su simulación (`idd@1cf0792:adr/0002-agent-neutral-session-bootstrap.md`). Ese contrato se comprueba aparte con los agentes reales (ver [[hook-context-opencode|El hook context de OpenCode]] ([El hook context de OpenCode](../concepts/hook-context-opencode.md)) y [[proveedor-falso-para-verificar-contexto|Proveedor falso para verificar el contexto]] ([Proveedor falso para verificar el contexto](../concepts/proveedor-falso-para-verificar-contexto.md))).

## See Also

- [[arranque-de-sesion|El arranque de sesión]] ([El arranque de sesión](arranque-de-sesion.md))
- [[proveedor-falso-para-verificar-contexto|Proveedor falso para verificar el contexto]] ([Proveedor falso para verificar el contexto](../concepts/proveedor-falso-para-verificar-contexto.md))
- [[hook-context-opencode|El hook context de OpenCode]] ([El hook context de OpenCode](../concepts/hook-context-opencode.md))
- [[ciclo-de-un-change-y-autopilot|El ciclo de un change y su automatización en OpenCode]] ([El ciclo de un change y su automatización en OpenCode](ciclo-de-un-change-y-autopilot.md))

## Sources

- [Lecciones de fix-wiki-flow-operations](../../raw/notes/2026-11-21-ll-marcadores-guia-recordatorio.md): `openspec validate --strict`, marcadores de la guía, `test:specs` durante un change y expresiones de paso.
- [Lessons Learned: add-quote-comment-rule](../../raw/notes/2026-11-22-ll-add-quote-comment-rule.md): lección 2.

- [Collection: repositorio de la plantilla intent-driven](../../raw/repos/2026-11-21-idd-1cf0792.md): `openspec/config.yaml`, `acceptance-tests/README.md`, `acceptance-tests/support/agents/opencode-host.mjs`, `acceptance-tests/support/engine.js`, `adr/0002-agent-neutral-session-bootstrap.md`.
- [Collection: archivado de fix-wiki-flow-operations](../../raw/repos/2026-11-21-idd-b48392d-fix-wiki-flow-operations.md): `acceptance-tests/support/world.js`, `acceptance-tests/core-tests/wiki-markers.test.js`.
- [Collection: README de la plantilla tras el archivado](../../raw/repos/2026-11-21-idd-f2be907-readme.md): `README.md`.
- [Collection: archivado de add-openspec-autopilot (idd@772d0f0)](../../raw/repos/2026-11-21-idd-772d0f0-add-openspec-autopilot.md): `acceptance-tests/README.md`, `acceptance-tests/support/branches.js`, `acceptance-tests/support/agents/opencode-sim.mjs`, `acceptance-tests/support/agents/opencode-sim.js`.
- [Collection: archivado de replace-gherkin-lint-with-gplint (idd@d355c01)](../../raw/repos/2026-11-22-idd-d355c01-replace-gherkin-lint-with-gplint.md): `acceptance-tests/README.md`, `acceptance-tests/support/spec-lint.js`, `adr/0012-spec-lint-with-gplint.md`, el `design.md` del change archivado.
- [Collection: archivado de fix-tui-subscription-cleanup (idd@99bdccd)](../../raw/repos/2026-11-22-idd-99bdccd-fix-tui-subscription-cleanup.md): `acceptance-tests/README.md`, `acceptance-tests/support/agents/opencode-host.mjs`.
