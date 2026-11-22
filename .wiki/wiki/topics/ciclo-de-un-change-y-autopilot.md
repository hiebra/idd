---
title: "El ciclo de un change y su automatización en OpenCode"
category: topic
sources:
  - raw/notes/2026-11-22-ll-adr-0013-sustituye-confirmacion-revision.md
  - raw/repos/2026-11-22-idd-6d6e79c-autopilot-sesion-operativa.md
  - raw/notes/2026-11-22-ll-suscripciones-tui-opencode.md
  - raw/repos/2026-11-22-idd-99bdccd-fix-tui-subscription-cleanup.md
  - raw/repos/2026-11-22-idd-002f043-adr-0011.md
  - raw/repos/2026-11-21-idd-772d0f0-add-openspec-autopilot.md
  - raw/notes/2026-11-21-ll-sesiones-opencode-autopilot.md
  - raw/notes/2026-11-22-ll-add-quote-comment-rule.md
created: 2026-11-21
updated: 2026-11-22
verified: 2026-11-22
tags: [openspec, git, opencode, plugins, openspec-autopilot, adr, spec]
confidence: high
volatility: warm
summary: "Un change se hace en una rama temporal con una sola fusión, que el modelo puede crear con el módulo neutral branch-change.mjs, y el change de la rama se lee de git. En OpenCode 2, el plugin openspec-autopilot mantiene una sesión operativa por rama, decide lo producido en cada paso con el CLI de OpenSpec y cierra las revisiones con git, con la lógica en el servidor para cualquier cliente; en Claude Code los mismos workflows se lanzan a mano. Sintetizado de ADR-0006, ADR-0012, ADR-0013, las specs openspec-change-lifecycle y openspec-autopilot, el README y las pruebas con OpenCode 2.3.2."
---

# El ciclo de un change y su automatización en OpenCode

> El ciclo de un change es el mismo en los dos agentes y se decide con un módulo neutral que lee git; OpenCode 2 lo automatiza además con un plugin que da una sesión a cada paso. Todo lo de esta página sale de los archivos fijados en `idd@772d0f0` (el commit del archivado de `add-openspec-autopilot`) y de las pruebas con OpenCode 2.3.2 de la [nota de lecciones](../../raw/notes/2026-11-21-ll-sesiones-opencode-autopilot.md).

## El ciclo, igual en los dos agentes

`idd@772d0f0:adr/0007-single-branch-change-lifecycle.md`, `idd@772d0f0:openspec/specs/openspec-change-lifecycle/spec.md`, `idd@772d0f0:README.md`:

- **Una rama temporal y una sola fusión**: propuesta, implementación, archive y resincronización del wiki van en la rama, y el archive se hace en ella, antes de fusionar. Nunca en una rama permanente.
- **Ramas permanentes**: la lista `x-main` de `openspec/config.yaml`, o `main` si no está. La última es la rama de origen. Cualquier otra rama local es temporal, y con HEAD separado no hay ninguna. Una `x-main` con otra forma se trata como ausente y avisa. OpenSpec 1.17.0 acepta claves `x-*` sin avisos ([lecciones](../../raw/notes/2026-11-21-ll-sesiones-opencode-autopilot.md), lección 8).
- **El change de la rama se lee de git**: es el que ha cambiado en `openspec/changes/` desde el merge-base con la rama de origen, con commit o sin él. No se apunta en ningún sitio. Lo calcula `idd@772d0f0:.agents/openspec/branch-change.mjs` (`--json`), sin dependencias y el mismo para los dos agentes (D1 del design).
- **Las puertas** (proponer, apply, archive) las decide `branch-change.mjs check <propose|apply|archive> [<change>]`, que imprime `{ ok, message }` y sale con 0 o 1. La skill `openspec-git-discipline` manda ejecutarlo y obedecerlo (ver [[origen-de-openspec-git-discipline|su origen]] ([su origen](../concepts/origen-de-openspec-git-discipline.md))).
- **Los commits y las fusiones los hace el usuario** (`idd@6d6e79c:adr/0012-model-creates-change-branches-plugin-stages.md`, que sustituye a ADR-0007): fuera del autopilot, los workflows los piden tras cada artefacto, cada task, el archive y la resincronización del wiki; en el autopilot, el plugin deja lo producido en el stage y el modelo no pide commits.
- **El modelo crea la rama del change o cambia de rama temporal**, solo con `branch-change.mjs list | start <change> | switch <rama>`: la rama nueva sale siempre de la rama de origen y se llama como el change, y nunca con el árbol sucio (`idd@6d6e79c:.agents/openspec/branch-change.mjs`, `idd@6d6e79c:.agents/skills/openspec-git-discipline/SKILL.md`).
- **Antes de proponer, busca las decisiones previas**: el schema solo pide leer los ADRs en el paso `design`, pero una propuesta puede chocar con un ADR en vigor sobre el mismo mecanismo. En `add-quote-comment-rule`, la primera propuesta usaba `AGENTS.md`, que ADR-0005 ya había descartado, y hubo que rehacerla al escribir las specs ([lecciones de add-quote-comment-rule](../../raw/notes/2026-11-22-ll-add-quote-comment-rule.md), lección 3).

## La asimetría entre agentes

`idd@772d0f0:adr/0006-agent-asymmetry-policy.md` fija cuándo una capacidad puede existir en un solo agente. Deben cumplirse estas condiciones:

- el ciclo y lo versionado son iguales con ella y sin ella;
- en el otro agente lo mismo se hace a mano;
- no deja restos en el otro agente;
- la suite verifica las dos cosas;
- se declara en la proposal y en un ADR.

Lo común al ciclo va en una pieza neutral, y por eso `branch-change.mjs` está fuera del plugin. En Claude Code no hay nada del plugin, y la suite lo comprueba (`.claude/` no nombra el plugin, sus tools ni su RPC).

## El plugin `openspec-autopilot`

`idd@6d6e79c:adr/0013-autopilot-verifies-product-and-closes-reviews-with-git.md` (sustituye a ADR-0008), `idd@6d6e79c:openspec/specs/openspec-autopilot/spec.md`, el design del change archivado (`idd@6d6e79c:openspec/changes/archive/2026-11-22-autopilot-sesion-operativa/design.md`) y el código de `idd@6d6e79c:.opencode/plugins/openspec-autopilot/`:

- **El ciclo no depende de que el modelo obedezca.** El motivo, de las pruebas con `alibaba/qwen3.8-flash`: el modelo no llamaba a `openspec_handoff` o seguía escribiendo artefactos tras llamarla, y la instrucción del paso, inyectada solo en la primera petición, se perdía en los mensajes siguientes.
- **Sesión operativa**: una sola sesión viva por rama (la dueña en la metadata). Al arrancar una TUI sin ella, el plugin la crea y la arranca sola, también en una rama permanente (con `openspec-new-change`, y el modelo crea la rama). Cualquier otra ventana de la TUI (inicio, `/new`, otra sesión, o al recuperar el foco) muestra un modal de un botón que lleva a ella. Al volver a ella, se valida contra la rama, el change y el árbol; una discrepancia con `openspec status` se explica en un modal, sin arreglarla.
- **Producto evaluable**: al empezar cada paso se guarda una foto del change según el CLI (artefactos en `done`, tasks marcadas, con el id del CLI); al quedar la sesión en reposo, lo que ha cambiado es el producto, haya llamado el modelo a la tool o no. Sin producto no se avanza; con producto, el plugin lo pasa al stage (por artefacto, o `git add -A`) y abre una revisión por producto, en el orden del schema (`lib/product.mjs`).
- **La revisión la cierra git**: cuando el usuario envía un prompt, el hook `prompt` compara git con el inicio de la revisión: HEAD avanzado y nada en el stage es ok (commit); HEAD igual, nada en el stage y cambios en el árbol es ko, y lo sacado del stage y el prompt (como conclusiones) van a `openspec-update-change` (`lib/git.mjs`). Desaparece el diálogo de confirmación. La revisión del verify, que empieza con el árbol limpio, acepta un commit vacío.
- **Esperas de commit**: tras el archive y la resincronización del wiki, y en el modo auto en cada cambio de zona, siempre que el árbol esté sucio. `update-change` empieza con el árbol sucio a propósito.
- **La lógica vive en el servidor y funciona con cualquier cliente**; la TUI solo pone modal, foco, navegación y archivado. Sin TUI (UI web, Desktop, `opencode run`): aviso en el contexto de las sesiones ajenas, archivado diferido (`archivePending`) hasta que llega una TUI, y arranque solo con el mensaje `autopilot`.
- **Lo que se mantiene**: una sesión por paso con su workflow y su agente, el estado solo en la metadata, el índice de sesiones para `update-change`, las lecciones candidatas en la metadata, el aviso tras compactar, los dos modos y nada en Claude Code (ADR-0006).

## Las restricciones de OpenCode 2.3.2 que lo moldean

De las pruebas con la TUI real y un proveedor falso ([lecciones](../../raw/notes/2026-11-21-ll-sesiones-opencode-autopilot.md)):

- **Archivar solo desde la TUI**: el `ctx.session.update` del servidor ignora `archived` sin dar error. Por eso `tui.js` archiva con `context.client.session.update`, pedido por RPC (lección 1).
- **La metadata se sustituye entera**: se escribe siempre leyendo, combinando y volviendo a escribir (lección 2).
- **Las tools solo llegan al modelo con `options: { codemode: false }`** (lección 3). Una sesión con el agente plan también las ve y las llama (task 1.2 del change).
- **Recargas en caliente**: también se recarga al cambiar `options`, sin reiniciar (lección 4). OpenCode ejecuta antes de cada recarga, y al cerrar, la función que devolvió el `setup` de cada parte, de servidor y de TUI; `events.on(nombre, manejador, { signal })` deja de entregar eventos al abortarse el `signal`. Los escuchadores RPC de la TUI anterior solo seguían vivos (lección 5) porque el plugin no los liberaba ([lecciones 1 y 2 de la limpieza](../../raw/notes/2026-11-22-ll-suscripciones-tui-opencode.md)): con la limpieza, tras dos recargas solo recibe eventos la carga nueva, comprobado con OpenCode 2.3.2 real (`idd@99bdccd:openspec/changes/archive/2026-11-22-fix-tui-subscription-cleanup/tasks.md`, task 5.2). El identificador, la generación y la respuesta única de D13 se mantienen como defensa ante carreras durante una recarga (ADR-0011). Los hooks del servidor anterior no sobreviven (task 1.4).
- **Cerrar con `--standalone` corta las suscripciones vivas**: cada `events.on` de la TUI es una suscripción a `/api/event`, y si el servidor propio de la TUI se apaga con ella viva, el cliente imprime una traza `ClientError: Transport … ECONNRESET`. Sin `--standalone` no ocurre, porque el servidor sigue vivo (`idd@99bdccd:openspec/changes/archive/2026-11-22-fix-tui-subscription-cleanup/design.md`, Context).
- **Encadenar desde `experimental.idle`**: crear la sesión, `prompt`, navegar y archivar la anterior tarda menos de 200 ms. Tras una interrupción o una compactación no se ejecuta `idle` (lección 6).
- **`ctx.session.list()` devuelve `{ data, cursor }` por páginas**, no un array. Se descubrió en la prueba final con OpenCode real, y se corrigió en el plugin y en el simulador (`idd@772d0f0:openspec/changes/archive/2026-11-21-add-openspec-autopilot/tasks.md`, task 12.2).
- **El modelo no decide por el usuario**: un modelo real cerró con `ok` una revisión ante "Gracias, lo miro luego.". De ahí la confirmación en la TUI de ADR-0008 (lección 10), que ADR-0013 sustituye por el cierre con git: la decisión del usuario es su commit, no una frase del modelo ([lección del 2026-11-22](../../raw/notes/2026-11-22-ll-adr-0013-sustituye-confirmacion-revision.md)).

- **La UI web no ejecuta la interfaz de un plugin local** [comprobado]: ni `tui.js` ni un bundle `./gui-experimental`, que solo carga OpenCode Desktop por su *bridge*; `experimental.browser/attach` es el navegador integrado de Desktop (design de `autopilot-sesion-operativa`, Context).
- **El hook de servidor `prompt`** llega con cada mensaje, antes de la petición al modelo, con el texto mutable; también cuando el mensaje queda pendiente detrás del turno en curso. Es el que cierra las revisiones por git.
- **La TUI**: `ui.router.current()` sin evento de cambio (se consulta cada 300 ms), `renderer.on('focus' | 'blur')` con las secuencias de foco del terminal, y `ui.dialog` con `alert`, `confirm`, `prompt` y `select`.
- **Las llamadas RPC de la TUI necesitan la ubicación**: en la pantalla de inicio, sin ella, el servidor responde 400 `rpc.unavailable` (los 400 del log al arrancar); con `{ location: { directory } }` funcionan.
- **El servicio carga el plugin una vez por proyecto en el mismo proceso**: lo que se guarde en `globalThis` (generación, PID presentados) tiene que ir por directorio.
- **Las sesiones que crea un plugin usan el modelo por defecto de la configuración**, no el elegido en la TUI.

## Cómo se verifica

- **La suite** prueba el plugin en un OpenCode simulado con varias sesiones (`idd@772d0f0:acceptance-tests/support/agents/opencode-sim.mjs`). Es un proceso hijo que el World maneja por IPC, con un modelo guionizado por escenario y fallos inyectables. Lo que no está en las specs va en `core-tests/autopilot-next-step.test.js` y `core-tests/autopilot-plugin.test.js` (`idd@772d0f0:acceptance-tests/README.md`). El simulador ejecuta en cada recarga, y al cerrar, la limpieza que devuelve cada `setup`, respeta el `signal` de `events.on` y deja una traza en el terminal por cada suscripción viva al cerrar (`idd@99bdccd:acceptance-tests/support/agents/opencode-sim.mjs`).
- **El simulador no detecta un cambio real de OpenCode**: al subir de versión hay que repetir las pruebas en el banco de la lección 9, fuera del repositorio (ver [el registro de vigilancia](../../inventory/candidates/volver-a-comprobar-apis-de-sesion-al-subir-opencode.md)).

## Lo que no se sabe

- **Su uso prolongado**: si el coste de revisar y hacer un commit por producto en el modo normal compensa. No hay experiencia de uso registrada más allá de las pruebas end-to-end de `autopilot-sesion-operativa`.
- **El ok de una revisión desde la UI web**: el ko se comprobó en la web; el ok usa la misma lógica, pero quedó como verificación manual pendiente (`idd@6d6e79c:openspec/changes/archive/2026-11-22-autopilot-sesion-operativa/tasks.md`, task 8.4).

## See Also

- [[origen-de-openspec-git-discipline|openspec-git-discipline: una regla heredada sin justificación registrada]] ([openspec-git-discipline: una regla heredada sin justificación registrada](../concepts/origen-de-openspec-git-discipline.md))
- [[suite-de-aceptacion-y-spec-as-source|La suite de aceptación y spec-as-source]] ([La suite de aceptación y spec-as-source](suite-de-aceptacion-y-spec-as-source.md))
- [[hook-context-opencode|El hook context de OpenCode]] ([El hook context de OpenCode](../concepts/hook-context-opencode.md))
- [[flujo-wiki-first|El flujo wiki-first]] ([El flujo wiki-first](flujo-wiki-first.md))

## Sources

- [Lessons Learned: el cierre de la revisión pasa de la confirmación en la TUI a git (ADR-0013)](../../raw/notes/2026-11-22-ll-adr-0013-sustituye-confirmacion-revision.md): lección 1.

- [Collection: archivado de autopilot-sesion-operativa (idd@6d6e79c)](../../raw/repos/2026-11-22-idd-6d6e79c-autopilot-sesion-operativa.md): `adr/0012-model-creates-change-branches-plugin-stages.md`, `adr/0013-autopilot-verifies-product-and-closes-reviews-with-git.md`, `openspec/specs/openspec-autopilot/spec.md`, `openspec/specs/openspec-change-lifecycle/spec.md`, `.opencode/plugins/openspec-autopilot/`, `.agents/openspec/branch-change.mjs`, `.agents/skills/openspec-git-discipline/SKILL.md`, `openspec/changes/archive/2026-11-22-autopilot-sesion-operativa/design.md` y `tasks.md`.

- [Collection: archivado de add-openspec-autopilot (idd@772d0f0)](../../raw/repos/2026-11-21-idd-772d0f0-add-openspec-autopilot.md): `adr/0006-agent-asymmetry-policy.md`, `adr/0007-single-branch-change-lifecycle.md`, `adr/0008-openspec-autopilot-plugin.md`, `openspec/specs/openspec-change-lifecycle/spec.md`, `openspec/specs/openspec-autopilot/spec.md`, `.agents/openspec/branch-change.mjs`, `.opencode/plugins/openspec-autopilot/`, `README.md`, `acceptance-tests/README.md`, `openspec/changes/archive/2026-11-21-add-openspec-autopilot/tasks.md`.
- [Lessons Learned: APIs de sesión de OpenCode 2.3.2 para orquestar un change](../../raw/notes/2026-11-21-ll-sesiones-opencode-autopilot.md): lecciones 1 a 10.
- [Lessons Learned: add-quote-comment-rule](../../raw/notes/2026-11-22-ll-add-quote-comment-rule.md): lección 3.
- [Collection: archivado de fix-tui-subscription-cleanup (idd@99bdccd)](../../raw/repos/2026-11-22-idd-99bdccd-fix-tui-subscription-cleanup.md): `.opencode/plugins/openspec-autopilot/tui.js`, `acceptance-tests/support/agents/opencode-sim.mjs`, `openspec/changes/archive/2026-11-22-fix-tui-subscription-cleanup/design.md` y `tasks.md`.
- [Collection: ADR-0011 tras la renumeración (idd@002f043)](../../raw/repos/2026-11-22-idd-002f043-adr-0011.md): `adr/0011-opencode-plugins-release-what-they-register.md`.
- [Lessons Learned: suscripciones de la TUI de OpenCode y su limpieza](../../raw/notes/2026-11-22-ll-suscripciones-tui-opencode.md): lecciones 1, 2 y 4 (las trazas al cerrar con `--standalone`, el contrato de limpieza que corrige la regla de la lección 5, y la prueba en OpenCode real sin tmux).
