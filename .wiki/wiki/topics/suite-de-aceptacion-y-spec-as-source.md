---
title: "La suite de aceptación y spec-as-source"
category: topic
sources:
  - raw/notes/2026-11-22-ll-archive-autopilot-rama-por-sesion.md
  - raw/notes/2026-11-22-ll-autopilot-rama-por-sesion.md
  - raw/repos/2026-11-22-idd-9eae630-autopilot-plan-explore.md
  - raw/notes/2026-11-22-ll-cucumber-rerun.md
  - raw/notes/2026-11-22-ll-apply-guidance-timeout.md
  - raw/notes/2026-11-22-ll-reorder-wiki-resync.md
  - raw/notes/2026-11-22-ll-archive-windows-support.md
  - raw/repos/2026-11-22-idd-3d2d8fe-windows-support.md
  - raw/notes/2026-11-22-ll-windows-support.md
  - raw/notes/2026-11-22-ll-git-discipline-standard-with-exception.md
  - raw/notes/2026-11-22-ll-allow-user-requested-merges-2.md
  - raw/notes/2026-11-22-ll-update-comment-phrase-and-opencode-marker.md
  - raw/repos/2026-11-22-idd-1657745-update-comment-phrase-and-opencode-marker.md
  - raw/repos/2026-11-22-idd-5d7f5b0-manage-git-discipline.md
  - raw/notes/2026-11-22-ll-allow-user-requested-merges.md
  - raw/notes/2026-11-22-ll-manage-git-discipline.md
  - raw/repos/2026-11-22-idd-6d6e79c-autopilot-sesion-operativa.md
  - raw/notes/2026-11-22-ll-replace-gherkin-lint-with-gplint.md
  - raw/articles/2026-11-22-gplint.md
  - raw/repos/2026-11-22-idd-d355c01-replace-gherkin-lint-with-gplint.md
  - raw/repos/2026-11-22-idd-99bdccd-fix-tui-subscription-cleanup.md
  - raw/notes/2026-11-21-ll-marcadores-guia-recordatorio.md
  - raw/repos/2026-11-21-idd-1cf0792.md
  - raw/repos/2026-11-21-idd-f2be907-readme.md
  - raw/repos/2026-11-21-idd-b48392d-fix-wiki-flow-operations.md
  - raw/repos/2026-11-21-idd-772d0f0-add-openspec-autopilot.md
  - raw/notes/2026-11-22-ll-add-quote-comment-rule.md
  - raw/notes/2026-11-22-ll-update-comment-closing-and-quotes.md
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
- **El lint de las specs** (`npm run lint:specs`, capability `spec-lint`): extrae los `spec.md` y pasa `gplint` con `.gplintrc`, la configuración fijada de la skill (`idd@d355c01:adr/0012-spec-lint-with-gplint.md`). Sustituye a `gherkin-lint`, que arrastraba 6 vulnerabilidades sin arreglo y cuyas reglas de AST no entraban en los hijos de `Rule:`. Como la extracción convierte cada requisito en un `Rule:`, esas reglas no revisaban ningún escenario. `gplint` es el fork mantenido de `gherkin-lint`; su 2.0 eliminó el nivel `"on"` ([gplint](../../raw/articles/2026-11-22-gplint.md)). `.gplintrc` solo usa los niveles `"error"` y `"off"`, porque con cualquier otro `gplint` lanza una excepción y sale con 0 sin revisar nada ([lecciones de replace-gherkin-lint-with-gplint](../../raw/notes/2026-11-22-ll-replace-gherkin-lint-with-gplint.md), lecciones 1 y 2) (`idd@d355c01:openspec/changes/archive/2026-11-22-replace-gherkin-lint-with-gplint/design.md`). Los escenarios de `spec-lint` no ejecutan el script tal cual, porque reconstruiría `.extracted/` mientras cucumber-js lo usa: `support/spec-lint.js` ejecuta sus dos comandos sobre otros directorios, y `core-tests/spec-lint-script.test.js` impide que el script y esos comandos se separen (`idd@d355c01:acceptance-tests/support/spec-lint.js`).
- **Dónde se ejecuta el lint**: `lint:specs` solo existe en `acceptance-tests/package.json`. En la raíz, `npm run -s lint:specs` sale con 1 sin decir nada, y con una tubería detrás el código que llega es el de la tubería; se ejecuta desde `acceptance-tests/` y se lee su código de salida directamente ([lecciones del archivado de windows-support](../../raw/notes/2026-11-22-ll-archive-windows-support.md), lección 2).
- **Pasos**: los pasos solo llaman a métodos de intención del World y hacen aserciones.
- **Sin agentes reales**: cada escenario trabaja sobre una copia temporal del proyecto, en una máquina simulada (`PATH` y entorno). Los adaptadores de `support/agents/` imitan cómo invoca cada agente el arranque: Claude Code ejecuta los hooks de `.claude/settings.json`, y OpenCode es un host Node que carga el plugin con contextos falsos (`idd@1cf0792:acceptance-tests/support/agents/opencode-host.mjs`). Ese host puede además recargar la parte de TUI, emitir un aviso sintético por el RPC y cerrar la TUI con su propio servidor; a diferencia de OpenCode, solo recarga la TUI, porque volver a ejecutar la parte de servidor relanzaría el núcleo del arranque (`idd@99bdccd:acceptance-tests/support/agents/opencode-host.mjs`). Desde `update-comment-phrase-and-opencode-marker` carga en orden los plugins de sesión del proyecto que existan (`session-bootstrap` y `response-comments`), y los hooks `context` de todos se ejecutan sobre la misma petición (`idd@1657745:acceptance-tests/support/agents/opencode-host.mjs`, `opencode.js`).
- **El ciclo de un change** (`openspec-change-lifecycle`): cada escenario monta el estado de git que necesita sobre la copia, que ya es un repositorio con `main` (`idd@772d0f0:acceptance-tests/support/branches.js`). El change y las puertas salen de `branch-change.mjs` de la copia; como la suite no ejecuta el modelo de los workflows, comprueba la puerta y que la skill `openspec-git-discipline` la usa, por sus identificadores de sección `<!-- lifecycle:<id> -->` (`idd@772d0f0:acceptance-tests/README.md`).
- **El plugin `openspec-autopilot`**: se prueba en un OpenCode simulado con varias sesiones, un proceso hijo de larga duración que el World maneja por IPC (`idd@772d0f0:acceptance-tests/support/agents/opencode-sim.mjs` y `opencode-sim.js`). Reiniciar OpenCode es un proceso nuevo sobre el mismo almacén de sesiones. Simula el contrato comprobado con OpenCode 2.3.2: metadata sustituida entera, `archived` ignorado en el servidor, `list` por páginas, tools solo con `codemode: false`, recargas que ejecutan antes la limpieza que devolvió cada `setup`, escuchadores de la TUI que solo sobreviven si el plugin no los libera, el cierre con `--standalone` con una traza por cada suscripción viva, y fallos inyectables (`idd@99bdccd:acceptance-tests/README.md`). Desde `autopilot-sesion-operativa` simula además el hook `prompt`, la pantalla y el foco de la TUI, el diálogo de un botón con Enter o Esc, el PID de la TUI (arranque frente a recarga), una TUI que llama a la RPC antes de que se registre, un cliente sin TUI y respuestas del modelo que escriben archivos (`idd@6d6e79c:acceptance-tests/README.md`). Desde `autopilot-plan-explore`, el hook `prompt` con su `messageID`, que es el `id` del mensaje en `context`, el mensaje que entra a mitad de turno con un solo reposo, el recordatorio del agente plan, el cambio de agente (`switchAgent`), reglas del modelo por agente (`match.agent`), respuestas que tardan (`delayMs`) y entregas RPC que no cuentan como trabajo pendiente mientras esperan un modal abierto. `core-tests/opencode-sim.test.js` comprueba con un plugin sonda que el simulador reproduce eso de OpenCode real (`idd@9eae630:acceptance-tests/README.md`). El modelo es un guion por escenario, y de cada petición se registra lo que recibe (ver [[ciclo-de-un-change-y-autopilot|El ciclo de un change y su automatización en OpenCode]] ([El ciclo de un change y su automatización en OpenCode](ciclo-de-un-change-y-autopilot.md))).
- **El wiki**: se simula con un motor falso, un repositorio git local con dos tags y una marca de versión en cada archivo (`idd@1cf0792:acceptance-tests/support/engine.js`).
- **Lo que no está en las specs**, como los conflictos de nombres con el motor o `.wiki/` ignorado por otra regla, se prueba con `node --test` en `acceptance-tests/core-tests/` (`npm run test:core`).
- **Temporizadores con `unref()` en `core-tests`**: si un test espera a que salte un límite ante una promesa que no termina, `node --test` lo cancela (`cancelledByParent`) porque el event loop se queda sin nada vivo. Mantenlo vivo con un `setInterval` mientras dura el test. Y al resumir, compara `# tests` con `# pass`, porque un test cancelado no cuenta como `fail` ([lecciones de apply-guidance-timeout](../../raw/notes/2026-11-22-ll-apply-guidance-timeout.md), lección 1).
- **Textos que el arranque transforma**: la estructura se comprueba en la fuente y el contenido en lo entregado. El soporte de la suite replica la transformación (`GUIDE_OPERATIONS` en `idd@b48392d:acceptance-tests/support/world.js`), y `idd@b48392d:acceptance-tests/core-tests/wiki-markers.test.js` fija la tabla de marcadores para que las dos copias no diverjan ([lecciones de fix-wiki-flow-operations](../../raw/notes/2026-11-21-ll-marcadores-guia-recordatorio.md)).
- **Durante un change que modifica escenarios**, el criterio de verde es `npm test`. `npm run test:specs` puede tener pasos sin definir de los escenarios sustituidos hasta el archive ([lecciones de fix-wiki-flow-operations](../../raw/notes/2026-11-21-ll-marcadores-guia-recordatorio.md)).
- **Pasos nuevos**: antes de definirlos, contrasta su expresión con las genéricas que ya existen y con los pasos que empiezan igual, y restringe las capturas a los valores de los `Examples` ([lecciones de fix-wiki-flow-operations](../../raw/notes/2026-11-21-ll-marcadores-guia-recordatorio.md)).
- **`.extracted/` es compartido**: `cucumber.cjs` y `lint:specs` lo borran y lo reconstruyen, así que dos ejecuciones a la vez se pisan; para probar algo en paralelo, extrae en otro directorio ([lecciones de replace-gherkin-lint-with-gplint](../../raw/notes/2026-11-22-ll-replace-gherkin-lint-with-gplint.md), lección 4).
- **Un `#### Scenario:` sin nombre** no llega al `.feature`: el extractor lo deja en blanco, y por eso ningún linter lo detecta (lección 3 de la misma nota).
- **Una prueba del núcleo intermitente**: "two sessions taking control at once" (`acceptance-tests/core-tests/autopilot-plugin.test.js:168`) falló 1 de 4 veces con las dos sesiones como dueñas, sin relación con el change en curso. Antes de atribuirle un fallo al cambio, repítela sola ([lecciones de update-comment-phrase-and-opencode-marker](../../raw/notes/2026-11-22-ll-update-comment-phrase-and-opencode-marker.md), lección 3). Falla con la máquina cargada, también dentro de la propia pasada de `test:core`, que ejecuta los archivos en paralelo: no se lanza a la vez que cucumber, y se repite sola con `node --test --test-name-pattern="two sessions taking control" core-tests/autopilot-plugin.test.js` ([lecciones de allow-user-requested-merges](../../raw/notes/2026-11-22-ll-allow-user-requested-merges.md), lección 3, y [su corrección](../../raw/notes/2026-11-22-ll-allow-user-requested-merges-2.md), lección 2).
- **Python en las skills**: `py_compile` deja un `__pycache__` junto al archivo, y el `.gitignore` no lo ignora; para comprobar la sintaxis, `ast.parse` no escribe nada (lección 6 de la misma nota).
- **Pasos de ausencia**: un paso que afirma que algo no llega al agente comprueba la ausencia de ese contenido concreto, no que no llegue nada. `el agente no recibe la guía del wiki` exigía un contexto vacío y se rompió cuando el arranque empezó a entregar también la regla de comentarios (`idd@16e4617:acceptance-tests/step-definitions/wiki.steps.js`; [lecciones de add-quote-comment-rule](../../raw/notes/2026-11-22-ll-add-quote-comment-rule.md), lección 2).
- **Repos git de prueba** (desde `manage-git-discipline`): `support/branches.js` monta un remoto bare por proyecto, ramas remotas por delante o divergidas, fusiones con squash, clones superficiales desde `file://` y el entorno de un contenedor efímero, con pruebas propias en `core-tests/branches-support.test.js` (`idd@5d7f5b0:acceptance-tests/support/branches.js`).
- **Variables del entorno real**: la suite hereda el entorno de la máquina que la ejecuta. En la nube eso incluye `CLAUDE_CODE_CONTAINER_ID` y `CLAUDE_CODE_REMOTE`, que hacen que el proyecto se crea en un contenedor efímero. `cleanEnv` y `sessionEnv` las quitan y solo las pone el escenario que las pide; cualquier variable real que cambie el comportamiento debe tratarse igual (`idd@5d7f5b0:acceptance-tests/support/machine.js`; [lecciones de manage-git-discipline](../../raw/notes/2026-11-22-ll-manage-git-discipline.md), lección 4).
- **Regex con grupos opcionales**: cucumber pasa un argumento por cada grupo capturante y decide por la aridad si la función es de callback. Un grupo opcional que no captura descuadra la cuenta y el paso se cuelga hasta el timeout. Solo deben capturar los grupos que la función recibe ([lecciones de manage-git-discipline](../../raw/notes/2026-11-22-ll-manage-git-discipline.md), lección 2).
- **La `/` en los pasos definidos con cadena**: en una Cucumber Expression, `/` es una alternativa, así que un paso con `/new` no casa y sale sin definir; escápala (`\\/`) o usa una expresión regular ([lecciones de autopilot-rama-por-sesion](../../raw/notes/2026-11-22-ll-autopilot-rama-por-sesion.md), lección 1).
- **Duración en la nube**: el entorno firma cada commit, también los de los repos de prueba, y la suite entera tardó 15-20 minutos en `manage-git-discipline` y 6-7 minutos en las cuatro pasadas de `allow-user-requested-merges`, en otro contenedor. Conviene ejecutarla en segundo plano e iterar con `--name` ([lecciones de manage-git-discipline](../../raw/notes/2026-11-22-ll-manage-git-discipline.md), lección 1; [corrección de allow-user-requested-merges](../../raw/notes/2026-11-22-ll-allow-user-requested-merges-2.md), lección 1).
- **Dependencias para otra plataforma**: un `node_modules` instalado en Linux no sirve en Windows; los paquetes con `os`/`cpu` en el lockfile solo se instalan en su plataforma (en `acceptance-tests/`, `@esbuild/win32-x64` y `@typescript/typescript-win32-x64`). Se preparan en esa plataforma, y lo que falta se deduce de esos campos del lockfile ([lecciones de windows-support](../../raw/notes/2026-11-22-ll-windows-support.md), lección 2).
- **`pwsh` es requisito de la suite** (desde `windows-support`, ADR-0017): los escenarios de `windows-readiness` ejecutan el diagnóstico con `pwsh -NoProfile -NonInteractive -File … -FactsFile …`, una vez en texto (del que leen el código de salida) y otra con `-Json` (del que leen el informe), y las dos tienen que terminar igual. Sin `pwsh` fallan diciéndolo; no se saltan. En la nube lo instala el script de configuración del entorno `idd` (`idd@3d2d8fe:acceptance-tests/README.md`).
- **Máquinas Windows simuladas**: `support/windows-readiness.js` parte de los hechos de una máquina con todo lo necesario (OpenCode 2.3.2, Node.js 22.12 con npm, git, Python 3.12, el motor y las dependencias de los lockfiles reales), y cada `But` cambia un hecho. Así se prueba toda la evaluación fuera de Windows; la recogida de hechos solo se puede comprobar a mano en Windows real (`idd@3d2d8fe:acceptance-tests/support/windows-readiness.js`, `idd@3d2d8fe:acceptance-tests/README.md`; ver [[soporte-de-windows|El soporte de Windows]] ([El soporte de Windows](soporte-de-windows.md))).
- **Simular Git for Windows**: `step-definitions/line-endings.steps.js` vuelve a extraer la copia del proyecto de su propio repositorio con `core.autocrlf=true` y abre una sesión de OpenCode (`idd@3d2d8fe:acceptance-tests/README.md`).
- **La copia del proyecto sale del disco en cada escenario:** con la suite en marcha no se edita nada de lo que se copia (todo salvo `.git`, `acceptance-tests/` y `.wiki/`), y los cambios en los pasos no cuentan hasta la siguiente pasada ([lecciones de allow-user-requested-merges](../../raw/notes/2026-11-22-ll-allow-user-requested-merges.md), lección 1).
- **Acotar una pasada:** las rutas que se pasan a `cucumber-js` se suman a las del perfil (`effectivePaths()`); solo `--name` o los tags acotan ([lecciones de allow-user-requested-merges](../../raw/notes/2026-11-22-ll-allow-user-requested-merges.md), lección 2; [lecciones de git-discipline-standard-with-exception](../../raw/notes/2026-11-22-ll-git-discipline-standard-with-exception.md), lección 5). Pasar un `.feature` como argumento ejecuta la suite completa, porque `cucumber.cjs` fija `paths` en el perfil por defecto ([lecciones de windows-support](../../raw/notes/2026-11-22-ll-windows-support.md), lección 6). Tampoco acota `@<archivo>` con un archivo de rerun, porque sus líneas son rutas: `--format rerun:<archivo>` sirve para listar los escenarios que fallan, y se repiten con `--name` ([lecciones de cucumber-rerun](../../raw/notes/2026-11-22-ll-cucumber-rerun.md), lección 1).
- **Delta specs sin H1**: `extract-gherkin.cjs` exige que toda `spec.md`, también las de un change activo, empiece por `# <capability>`; sin ella falla la carga de `cucumber.cjs` y no se ejecuta ningún escenario, aunque `openspec validate` dé el change por válido ([lecciones de update-comment-closing-and-quotes](../../raw/notes/2026-11-22-ll-update-comment-closing-and-quotes.md), lección 2).
- **Escenarios renombrados en una delta**: un MODIFIED sustituye el requisito entero y no puede perder escenarios de la spec principal, así que cambiar el nombre de un escenario exige REMOVED del requisito viejo (con Reason y Migration) y ADDED del nuevo, no RENAMED + MODIFIED (lección 3 de la misma nota).

## Su límite

- La suite comprueba lo que garantiza la plantilla, no cómo razona el modelo.
- `openspec validate --strict` no pasa con las specs del proyecto: sus avisos de idioma ("DEBE" en lugar de SHALL/MUST) y de formato (Gherkin en bloques de código) cuentan como errores. El criterio de cierre es validar sin `--strict` y revisar los demás avisos ([lecciones de fix-wiki-flow-operations](../../raw/notes/2026-11-21-ll-marcadores-guia-recordatorio.md); se volvió a ver en `update-comment-phrase-and-opencode-marker`, [lección 2](../../raw/notes/2026-11-22-ll-update-comment-phrase-and-opencode-marker.md))).
- Depende de que la simulación de cada agente siga el contrato real. Cuando un agente cambia su API, hay que actualizar el adaptador y su simulación (`idd@1cf0792:adr/0002-agent-neutral-session-bootstrap.md`). Ese contrato se comprueba aparte con los agentes reales (ver [[hook-context-opencode|El hook context de OpenCode]] ([El hook context de OpenCode](../concepts/hook-context-opencode.md)) y [[proveedor-falso-para-verificar-contexto|Proveedor falso para verificar el contexto]] ([Proveedor falso para verificar el contexto](../concepts/proveedor-falso-para-verificar-contexto.md))).
- **En una sesión en la nube, `windows-readiness` no se ejecuta**: el contenedor no trae `pwsh`, que ADR-0017 exige a la suite, y el modo automático deniega descargarlo; los 15 escenarios fallan por eso. Se cuenta el resto y se decide con el usuario si quedan cubiertos, o se ejecutan en una máquina con `pwsh` ([lecciones de reorder-wiki-resync](../../raw/notes/2026-11-22-ll-reorder-wiki-resync.md), lección 1).

## Entre el sync y el archive

Con los deltas ya sincronizados y el change aún activo, el cargador de specs efectivas avisa de que un requisito REMOVED no existe en `openspec/specs/`: es lo esperado y confirma el sync. El sync puede hacerse por bloques, sustituyendo cada `### Requirement:` por nombre, porque los MODIFIED de los deltas llevan el requisito entero (como recuerda la lección de los escenarios renombrados, más arriba); después se comprueba que cada bloque del delta aparece literal en la spec principal ([lecciones del archive de autopilot-rama-por-sesion](../../raw/notes/2026-11-22-ll-archive-autopilot-rama-por-sesion.md), lecciones 1 y 2).

## See Also

- [[soporte-de-windows|El soporte de Windows]] ([El soporte de Windows](soporte-de-windows.md))
- [[arranque-de-sesion|El arranque de sesión]] ([El arranque de sesión](arranque-de-sesion.md))
- [[proveedor-falso-para-verificar-contexto|Proveedor falso para verificar el contexto]] ([Proveedor falso para verificar el contexto](../concepts/proveedor-falso-para-verificar-contexto.md))
- [[hook-context-opencode|El hook context de OpenCode]] ([El hook context de OpenCode](../concepts/hook-context-opencode.md))
- [[ciclo-de-un-change-y-autopilot|El ciclo de un change y su automatización en OpenCode]] ([El ciclo de un change y su automatización en OpenCode](ciclo-de-un-change-y-autopilot.md))
- [[regla-de-comentarios|La regla de comentarios]] ([La regla de comentarios](../concepts/regla-de-comentarios.md))

## Sources

- [Lessons Learned: archive de autopilot-rama-por-sesion](../../raw/notes/2026-11-22-ll-archive-autopilot-rama-por-sesion.md): lecciones 1 y 2.
- [Lessons Learned: autopilot-rama-por-sesion](../../raw/notes/2026-11-22-ll-autopilot-rama-por-sesion.md): lección 1.
- [Collection: archivado de autopilot-plan-explore (idd@9eae630)](../../raw/repos/2026-11-22-idd-9eae630-autopilot-plan-explore.md): `acceptance-tests/README.md`, `acceptance-tests/support/agents/opencode-sim.mjs`, `acceptance-tests/core-tests/opencode-sim.test.js`.
- [Lessons Learned: el archivo de rerun de cucumber-js no acota la pasada](../../raw/notes/2026-11-22-ll-cucumber-rerun.md): lección 1.
- [Lessons Learned: límite de tiempo de syncGuidance (apply-one-task-per-session-in-normal-mode)](../../raw/notes/2026-11-22-ll-apply-guidance-timeout.md): lección 1.
- [Lessons Learned: reorder-wiki-resync](../../raw/notes/2026-11-22-ll-reorder-wiki-resync.md): lección 1.
- [Lessons Learned: git-discipline-standard-with-exception](../../raw/notes/2026-11-22-ll-git-discipline-standard-with-exception.md): lección 5.
- [Lessons Learned: update-comment-phrase-and-opencode-marker](../../raw/notes/2026-11-22-ll-update-comment-phrase-and-opencode-marker.md): lecciones 2 y 3.
- [Collection: archivado de update-comment-phrase-and-opencode-marker](../../raw/repos/2026-11-22-idd-1657745-update-comment-phrase-and-opencode-marker.md): `acceptance-tests/support/agents/opencode-host.mjs`, `acceptance-tests/support/agents/opencode.js`.
- [Collection: archivado de autopilot-sesion-operativa (idd@6d6e79c)](../../raw/repos/2026-11-22-idd-6d6e79c-autopilot-sesion-operativa.md): `acceptance-tests/README.md`, `acceptance-tests/support/agents/opencode-sim.mjs`.
- [Lessons Learned: el lint de las specs con gplint](../../raw/notes/2026-11-22-ll-replace-gherkin-lint-with-gplint.md): lecciones 1 a 4 y 6.
- [GPLint: README y CHANGELOG de la 2.6.2](../../raw/articles/2026-11-22-gplint.md): fork de `gherkin-lint`, nivel `"on"` eliminado en la 2.0.
- [Lecciones de fix-wiki-flow-operations](../../raw/notes/2026-11-21-ll-marcadores-guia-recordatorio.md): `openspec validate --strict`, marcadores de la guía, `test:specs` durante un change y expresiones de paso.
- [Lessons Learned: add-quote-comment-rule](../../raw/notes/2026-11-22-ll-add-quote-comment-rule.md): lección 2.

- [Collection: repositorio de la plantilla intent-driven](../../raw/repos/2026-11-21-idd-1cf0792.md): `openspec/config.yaml`, `acceptance-tests/README.md`, `acceptance-tests/support/agents/opencode-host.mjs`, `acceptance-tests/support/engine.js`, `adr/0002-agent-neutral-session-bootstrap.md`.
- [Collection: archivado de fix-wiki-flow-operations](../../raw/repos/2026-11-21-idd-b48392d-fix-wiki-flow-operations.md): `acceptance-tests/support/world.js`, `acceptance-tests/core-tests/wiki-markers.test.js`.
- [Collection: README de la plantilla tras el archivado](../../raw/repos/2026-11-21-idd-f2be907-readme.md): `README.md`.
- [Collection: archivado de add-openspec-autopilot (idd@772d0f0)](../../raw/repos/2026-11-21-idd-772d0f0-add-openspec-autopilot.md): `acceptance-tests/README.md`, `acceptance-tests/support/branches.js`, `acceptance-tests/support/agents/opencode-sim.mjs`, `acceptance-tests/support/agents/opencode-sim.js`.
- [Collection: archivado de manage-git-discipline (idd@5d7f5b0)](../../raw/repos/2026-11-22-idd-5d7f5b0-manage-git-discipline.md): `acceptance-tests/support/branches.js`, `acceptance-tests/support/machine.js`, `acceptance-tests/core-tests/branches-support.test.js`.
- [Lessons Learned: manage-git-discipline](../../raw/notes/2026-11-22-ll-manage-git-discipline.md): lecciones 1, 2 y 4.
- [Lessons Learned: update-comment-closing-and-quotes](../../raw/notes/2026-11-22-ll-update-comment-closing-and-quotes.md): lecciones 2 y 3.
- [Collection: archivado de replace-gherkin-lint-with-gplint (idd@d355c01)](../../raw/repos/2026-11-22-idd-d355c01-replace-gherkin-lint-with-gplint.md): `acceptance-tests/README.md`, `acceptance-tests/support/spec-lint.js`, `adr/0012-spec-lint-with-gplint.md`, el `design.md` del change archivado.
- [Collection: archivado de fix-tui-subscription-cleanup (idd@99bdccd)](../../raw/repos/2026-11-22-idd-99bdccd-fix-tui-subscription-cleanup.md): `acceptance-tests/README.md`, `acceptance-tests/support/agents/opencode-host.mjs`.
- [Collection: archivado de windows-support (idd@3d2d8fe)](../../raw/repos/2026-11-22-idd-3d2d8fe-windows-support.md): `acceptance-tests/README.md`, `acceptance-tests/support/windows-readiness.js`, `acceptance-tests/step-definitions/windows-readiness.steps.js`, `acceptance-tests/step-definitions/line-endings.steps.js`.
- [Lessons Learned: soporte de Windows (windows-support)](../../raw/notes/2026-11-22-ll-windows-support.md): lecciones 2 y 6.
- [Lessons Learned: archivado de windows-support](../../raw/notes/2026-11-22-ll-archive-windows-support.md): lección 2.
