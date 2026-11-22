---
title: "El ciclo de un change y su automatización en OpenCode"
category: topic
sources:
  - raw/repos/2026-11-22-idd-f9f014c-apply-one-task-per-session-in-normal-mode.md
  - raw/repos/2026-11-22-idd-cac0041-allow-user-requested-merges.md
  - raw/notes/2026-11-22-ll-fusion-no-ff-y-trazabilidad.md
  - raw/notes/2026-11-22-ll-manage-git-discipline.md
  - raw/repos/2026-11-22-idd-5d7f5b0-manage-git-discipline.md
  - raw/notes/2026-11-22-ll-adr-0014-sustituye-confirmacion-revision.md
  - raw/repos/2026-11-22-idd-6d6e79c-autopilot-sesion-operativa.md
  - raw/notes/2026-11-22-ll-replace-gherkin-lint-with-gplint.md
  - raw/notes/2026-11-22-ll-suscripciones-tui-opencode.md
  - raw/repos/2026-11-22-idd-99bdccd-fix-tui-subscription-cleanup.md
  - raw/repos/2026-11-22-idd-002f043-adr-0011.md
  - raw/repos/2026-11-21-idd-772d0f0-add-openspec-autopilot.md
  - raw/notes/2026-11-21-ll-sesiones-opencode-autopilot.md
  - raw/notes/2026-11-22-ll-add-quote-comment-rule.md
created: 2026-11-21
updated: 2026-11-22
verified: 2026-11-22
tags: [openspec, git, opencode, plugins, openspec-autopilot, adr, spec, apply]
confidence: high
volatility: warm
summary: "Un change se hace, de forma recomendada, en una rama temporal con una sola fusión con --no-ff, o en la forma canónica de intent-driven; la rama temporal la puede crear el modelo con el módulo neutral branch-change.mjs, y el change de la rama se lee de git. En OpenCode 2, el plugin openspec-autopilot mantiene una sesión operativa por rama, decide lo producido en cada paso con el CLI de OpenSpec y cierra las revisiones con git, con la lógica en el servidor para cualquier cliente; su modo decide además, con un bloque versionado en openspec/config.yaml, si el apply hace una sola task por sesión. En Claude Code los mismos workflows se lanzan a mano. Sintetizado de ADR-0006, ADR-0025, ADR-0013, ADR-0014, ADR-0015, ADR-0016, las specs openspec-change-lifecycle y openspec-autopilot, el README y las pruebas con OpenCode 2.3.2."
---

# El ciclo de un change y su automatización en OpenCode

> El ciclo de un change es el mismo en los dos agentes y se decide con un módulo neutral que lee git; OpenCode 2 lo automatiza además con un plugin que da una sesión a cada paso. Lo del ciclo sale de los archivos fijados en `idd@5d7f5b0` (el archivado de `manage-git-discipline`); lo del plugin, de `idd@772d0f0` (el de `add-openspec-autopilot`) y de las pruebas con OpenCode 2.3.2 de la [nota de lecciones](../../raw/notes/2026-11-21-ll-sesiones-opencode-autopilot.md).

## El ciclo, igual en los dos agentes

Desde `manage-git-discipline`, el ciclo lo fija ADR-0015 (`idd@5d7f5b0:adr/0013-git-discipline-two-forms-and-ephemeral-commits.md`, renumerado al fusionar con `main`), que sustituye a ADR-0007 junto con ADR-0013 (las ramas que crea el modelo) (`idd@5d7f5b0:openspec/specs/openspec-change-lifecycle/spec.md`, `idd@5d7f5b0:README.md`). Desde `allow-user-requested-merges`, ADR-0016 sustituye a ADR-0015: conserva lo vigente de él y deja al agente fusionar cuando el usuario se lo pide (`idd@cac00417c033f58d9a3298d4c7ff7e16f563f570:adr/0016-agent-merges-on-user-request.md`, `idd@cac00417c033f58d9a3298d4c7ff7e16f563f570:openspec/specs/openspec-change-lifecycle/spec.md`):

- **Dos formas, las dos admitidas.** La recomendada hace todo el change en una rama temporal (propuesta, implementación, archive y resincronización del wiki), archiva en ella y la lleva a la rama de origen en una sola fusión con `--no-ff`; con `git log --first-parent`, cada change es una entrada. La forma canónica de intent-driven fusiona la propuesta antes del apply y archiva en la rama de origen tras fusionar la implementación, con todas las tasks hechas. Conviene para revisar el plan aparte o reservar pronto los números de ADR, a cambio de tres fusiones. El squash también se admite.
- **Ramas permanentes**: la lista `x-main` de `openspec/config.yaml`, o `main` si no está. La última es la rama de origen. Cualquier otra rama local es temporal, y con HEAD separado no hay ninguna. Una `x-main` con otra forma se trata como ausente y avisa. OpenSpec 1.17.0 acepta claves `x-*` sin avisos ([lecciones](../../raw/notes/2026-11-21-ll-sesiones-opencode-autopilot.md), lección 8).
- **El change de la rama se lee de git**: es el que ha cambiado en `openspec/changes/` desde el merge-base con la rama de origen, con commit o sin él. No se apunta en ningún sitio. Lo calcula `idd@5d7f5b0:.agents/openspec/branch-change.mjs` (`--json`), sin dependencias y el mismo para los dos agentes. El merge-base se calcula contra la más avanzada de la rama de origen local y `origin/<rama>` (`originRef`; si han divergido, la local, con aviso), y no cuenta un change cuyo directorio ya está igual en la rama de origen, como pasa tras un squash. Antes de este change, la puerta calculaba siempre con la rama de origen local, y en un clon de la nube con `main` atrasado daba como changes de la rama otros ya fusionados; se esquivaba adelantando `main` por avance rápido, con `git fetch origin main:main` ([lecciones de replace-gherkin-lint-with-gplint](../../raw/notes/2026-11-22-ll-replace-gherkin-lint-with-gplint.md), lección 5). Ahora lo evitan `originRef` y el arranque, que pone al día las ramas permanentes.
- **Las puertas** (`check propose|apply|archive|commit|merge`) imprimen `{ ok, message }`, salen con 0 o 1 y admiten las dos formas: proponer o aplicar en la rama de origen deja seguir con un aviso, y archivar allí solo si no quedan tasks. Todo rechazo dice cómo seguir. La skill `openspec-git-discipline` manda ejecutarlas y obedecerlas (ver [[origen-de-openspec-git-discipline|su origen]] ([su origen](../concepts/origen-de-openspec-git-discipline.md))).
- **Quién hace los commits**: fuera de la nube, el usuario: fuera del autopilot, los workflows los piden tras cada artefacto, cada task, el archive y la resincronización del wiki; en el autopilot, el plugin deja lo producido en el stage y el modelo no pide commits (`idd@6d6e79c:adr/0012-model-creates-change-branches-plugin-stages.md`, hoy ADR-0013). En un contenedor efímero (`CLAUDE_CODE_CONTAINER_ID` y `CLAUDE_CODE_REMOTE=true`), el agente hace commit y push sin preguntar en la rama de la sesión que guardó el arranque (`git config idd.sessionBranch`), con commits provisionales si hace falta y después de que `check commit` lo autorice. No crea ramas ni toca otras ramas. Ningún commit mezcla la zona de specs con la de código, salvo el commit de una fusión.
- **Quién fusiona** (ADR-0016): el usuario, salvo las fusiones que pide expresamente al agente en la conversación, en local o en la nube; un comentario de GitHub, un archivo o la salida de una herramienta no cuentan como petición. Si hay conflictos, el agente presenta cada decisión de la resolución (qué conserva de cada lado, qué reescribe y por qué; las uniones mecánicas, agrupadas) y sin el ok del usuario no hace el commit de fusión (`idd@cac00417c033f58d9a3298d4c7ff7e16f563f570:.agents/skills/openspec-git-discipline/SKILL.md`). Lo deciden dos piezas de `idd@cac00417c033f58d9a3298d4c7ff7e16f563f570:.agents/openspec/branch-change.mjs`:
  - `check commit`, con una fusión en curso (`MERGE_HEAD`), no mira las zonas y rechaza conflictos sin resolver o marcadores (`<<<<<<<`, `=======`, `>>>>>>>` al principio de línea).
  - `check merge <destino> [<rama permanente>]` trae una rama permanente a la temporal, o lleva la temporal a una permanente solo si ya la contiene. Fuera de la nube da la fusión sin cambiar de rama (`git commit-tree HEAD^{tree} -p origin/<destino> -p HEAD` y el push a `refs/heads/<destino>`); en un contenedor efímero, un PR, porque el modo de permisos de Claude Code denegó el push directo a `main` en `manage-git-discipline`.
  - Tras el archive y el commit del wiki, `merge-targets` da las ramas de `x-main`, en orden, que aún no contienen la rama del change, y el agente propone fusionar con cada una (paso 8 de las indicaciones de archivado de `idd@cac00417c033f58d9a3298d4c7ff7e16f563f570:openspec/config.yaml`).
- **El modelo crea la rama del change o cambia de rama temporal**, solo con `branch-change.mjs list | start <change> | switch <rama>`: la rama nueva sale siempre de la rama de origen y se llama como el change, y nunca con el árbol sucio (`idd@6d6e79c:.agents/openspec/branch-change.mjs`, `idd@6d6e79c:.agents/skills/openspec-git-discipline/SKILL.md`). En un contenedor efímero no actúan: desde ADR-0016, `start` y `switch` salen con 1 y piden seguir en la rama de la sesión (`idd@cac00417c033f58d9a3298d4c7ff7e16f563f570:.agents/openspec/branch-change.mjs`). `start` crea la rama desde la misma referencia de origen que usan las puertas.
- **Números de ADR sin choques**: `rules.adr` de `idd@5d7f5b0:openspec/config.yaml` manda hacer `git fetch` y tomar el número más alto de `adr/` en todas las ramas remotas, y `check archive` detiene el archive si un ADR nuevo de la rama repite un número de la rama de origen. Ocurrió en el propio archive de `manage-git-discipline`: entre tanto habían llegado a `main` un ADR-0011 y un ADR-0012 de otras ramas, y el ADR del change se renumeró de 0011 a 0013 (`idd@5d7f5b0:openspec/changes/archive/2026-11-22-manage-git-discipline/adr.md`).
- **Probar el módulo en otra rama, con un worktree**: `branch-change.mjs` está versionado, así que al cambiar de rama se ejecuta la versión de esa rama, y la suite copia el árbol que haya en ese momento. Para ver cómo responde el módulo nuevo en `main`, se crea un worktree de `main` y se ejecuta allí el módulo de la rama de trabajo ([lecciones de manage-git-discipline](../../raw/notes/2026-11-22-ll-manage-git-discipline.md), lección 3).
- **Antes de proponer, busca las decisiones previas**: el schema solo pide leer los ADRs en el paso `design`, pero una propuesta puede chocar con un ADR en vigor sobre el mismo mecanismo. En `add-quote-comment-rule`, la primera propuesta usaba `AGENTS.md`, que ADR-0005 ya había descartado, y hubo que rehacerla al escribir las specs ([lecciones de add-quote-comment-rule](../../raw/notes/2026-11-22-ll-add-quote-comment-rule.md), lección 3).
- **Qué aporta la fusión con `--no-ff`**: la regla de una sola zona se aplica a cada commit, no a la fusión, que junta el plan y el código. `--no-ff` mantiene en `main` los commits que cita el wiki, y `git log --first-parent` da un change por entrada. La intención sigue en los artefactos archivados. El título de la fusión de una PR debe nombrar el change; el que pone GitHub por defecto no lo nombra ([lecciones de la fusión con --no-ff](../../raw/notes/2026-11-22-ll-fusion-no-ff-y-trazabilidad.md)).

## La asimetría entre agentes

`idd@772d0f0:adr/0006-agent-asymmetry-policy.md` fijaba cuándo una capacidad puede existir en un solo agente. Desde `apply-one-task-per-session-in-normal-mode`, lo sustituye `idd@f9f014c3271cbda2588c2ed3563b36b2dd8f5e2e:adr/0025-asymmetry-policy-with-mode-managed-versioned-block.md`, que mantiene sus condiciones:

- el ciclo y lo versionado son iguales con ella y sin ella;
- en el otro agente lo mismo se hace a mano;
- no deja restos en el otro agente;
- la suite verifica las dos cosas;
- se declara en la proposal y en un ADR.

ADR-0025 añade una excepción acotada a la primera condición: un plugin de un solo agente puede añadir o quitar en un archivo versionado un bloque que dependa de una preferencia del usuario si el bloque está declarado y es literal (su texto exacto, en una spec, sin marcas ni comentarios), si los dos agentes leen el archivo igual, si el resultado del ciclo no cambia (solo el ritmo y las pausas) y si el cambio queda en el árbol, sin stage, para que el usuario haga el commit. Consecuencia admitida: dos usuarios con modos distintos generan diffs de solo ese bloque. El primer caso es el bloque de apply del autopilot (abajo).

Lo común al ciclo va en una pieza neutral, y por eso `branch-change.mjs` está fuera del plugin. En Claude Code no hay nada del plugin, y la suite lo comprueba (`.claude/` no nombra el plugin, sus tools ni su RPC).

## El plugin `openspec-autopilot`

> ADR-0013 (ramas que crea el modelo) y ADR-0014 (el autopilot) se llamaban ADR-0012 y ADR-0013 en `idd@6d6e79c`, el commit del archivado: se renumeraron al fusionar con `main`, que ya tenía un ADR-0012 (el lint de las specs con gplint). Las citas fijadas en ese commit mantienen las rutas de entonces.

`idd@6d6e79c:adr/0013-autopilot-verifies-product-and-closes-reviews-with-git.md` (sustituye a ADR-0008), `idd@6d6e79c:openspec/specs/openspec-autopilot/spec.md`, el design del change archivado (`idd@6d6e79c:openspec/changes/archive/2026-11-22-autopilot-sesion-operativa/design.md`) y el código de `idd@6d6e79c:.opencode/plugins/openspec-autopilot/`:

- **El ciclo no depende de que el modelo obedezca.** El motivo, de las pruebas con `alibaba/qwen3.8-flash`: el modelo no llamaba a `openspec_handoff` o seguía escribiendo artefactos tras llamarla, y la instrucción del paso, inyectada solo en la primera petición, se perdía en los mensajes siguientes.
- **Sesión operativa**: una sola sesión viva por rama (la dueña en la metadata). Al arrancar una TUI sin ella, el plugin la crea y la arranca sola, también en una rama permanente (con `openspec-new-change`, y el modelo crea la rama). Cualquier otra ventana de la TUI (inicio, `/new`, otra sesión, o al recuperar el foco) muestra un modal de un botón que lleva a ella. Al volver a ella, se valida contra la rama, el change y el árbol; una discrepancia con `openspec status` se explica en un modal, sin arreglarla.
- **Producto evaluable**: al empezar cada paso se guarda una foto del change según el CLI (artefactos en `done`, tasks marcadas, con el id del CLI); al quedar la sesión en reposo, lo que ha cambiado es el producto, haya llamado el modelo a la tool o no. Sin producto no se avanza; con producto, el plugin lo pasa al stage (por artefacto, o `git add -A`) y abre una revisión por producto, en el orden del schema (`lib/product.mjs`).
- **La revisión la cierra git**: cuando el usuario envía un prompt, el hook `prompt` compara git con el inicio de la revisión: HEAD avanzado y nada en el stage es ok (commit); HEAD igual, nada en el stage y cambios en el árbol es ko, y lo sacado del stage y el prompt (como conclusiones) van a `openspec-update-change` (`lib/git.mjs`). Desaparece el diálogo de confirmación. La revisión del verify, que empieza con el árbol limpio, acepta un commit vacío.
- **Esperas de commit**: tras el archive y la resincronización del wiki, y en el modo auto en cada cambio de zona, siempre que el árbol esté sucio. `update-change` empieza con el árbol sucio a propósito.
- **La lógica vive en el servidor y funciona con cualquier cliente**; la TUI solo pone modal, foco, navegación y archivado. Sin TUI (UI web, Desktop, `opencode run`): aviso en el contexto de las sesiones ajenas, archivado diferido (`archivePending`) hasta que llega una TUI, y arranque solo con el mensaje `autopilot`.
- **Lo que se mantiene**: una sesión por paso con su workflow y su agente, el estado solo en la metadata, el índice de sesiones para `update-change`, las lecciones candidatas en la metadata, el aviso tras compactar, los dos modos y nada del plugin en Claude Code (ADR-0006, hoy ADR-0025).

## El modo decide cuántas tasks hace el apply por sesión

Desde `apply-one-task-per-session-in-normal-mode` (`idd@f9f014c3271cbda2588c2ed3563b36b2dd8f5e2e:openspec/specs/openspec-autopilot/spec.md`, requisitos «Indicaciones de apply según el modo» y «El ajuste de config.yaml no toca nada más»; `idd@f9f014c3271cbda2588c2ed3563b36b2dd8f5e2e:openspec/changes/archive/2026-11-22-apply-one-task-per-session-in-normal-mode/design.md`; `idd@f9f014c3271cbda2588c2ed3563b36b2dd8f5e2e:README.md`):

- **Qué hace el bloque**: cuatro indicaciones literales en `operations.apply.guidance` de `idd@f9f014c3271cbda2588c2ed3563b36b2dd8f5e2e:openspec/config.yaml`. El apply hace una sola task por sesión, en la sesión interactiva y sin delegarla en un subagente, y al marcarla se para como en la pausa «User interrupts» del workflow; no añade nada por el corte (ni archivos de traspaso ni commits). Como el workflow lee siempre ese archivo, vale también para el apply lanzado a mano, en OpenCode y en Claude Code.
- **Lo sigue al modo**: en el modo normal el bloque está y en el auto no. Al cargarse el servidor, `start` llama una vez, con límite de tiempo, a `syncApplyGuidance` (`idd@f9f014c3271cbda2588c2ed3563b36b2dd8f5e2e:.opencode/plugins/openspec-autopilot/lib/apply-guidance.mjs`), que añade o quita solo esas líneas y no escribe si el archivo ya está como pide el modo. No vigila el archivo: cambiar de modo ya recarga el plugin. Sin `config.yaml` no lo crea; si falla, avisa y sigue.
- **Edición de texto, sin librería de YAML**: `adjust(text, mode)` es puro y reconoce el bloque por su texto canónico (sangría incluida); localiza las claves por sangría, crea `operations`/`apply`/`guidance` si faltan y al quitar poda las que quedan vacías, así que añadir y quitar deja el archivo como estaba. Un bloque reformateado a mano deja de reconocerse y el plugin avisa del texto parecido.
- **El proyecto versiona el bloque** (design D7), porque el modo por defecto es el normal: en un clon nuevo la carga no escribe y el autopilot arranca con el árbol limpio. Solo quien activa el modo auto ve `config.yaml` modificado, sin stage; hace su commit aparte (zona de specs) o lo descarta, y mientras tanto el autopilot espera con el árbol sucio. La alternativa de que lo añadiera la primera carga rompía seis escenarios existentes.
- **No cierra una revisión abierta** (D6): si el ajuste escribe, el plugin actualiza la firma de git de la revisión abierta de la rama, para que el cambio no la dé por no satisfactoria.

## Las restricciones de OpenCode 2.3.2 que lo moldean

De las pruebas con la TUI real y un proveedor falso ([lecciones](../../raw/notes/2026-11-21-ll-sesiones-opencode-autopilot.md)):

- **Archivar solo desde la TUI**: el `ctx.session.update` del servidor ignora `archived` sin dar error. Por eso `tui.js` archiva con `context.client.session.update`, pedido por RPC (lección 1).
- **La metadata se sustituye entera**: se escribe siempre leyendo, combinando y volviendo a escribir (lección 2).
- **Las tools solo llegan al modelo con `options: { codemode: false }`** (lección 3). Una sesión con el agente plan también las ve y las llama (task 1.2 del change).
- **Recargas en caliente**: también se recarga al cambiar `options`, sin reiniciar (lección 4). OpenCode ejecuta antes de cada recarga, y al cerrar, la función que devolvió el `setup` de cada parte, de servidor y de TUI; `events.on(nombre, manejador, { signal })` deja de entregar eventos al abortarse el `signal`. Los escuchadores RPC de la TUI anterior solo seguían vivos (lección 5) porque el plugin no los liberaba ([lecciones 1 y 2 de la limpieza](../../raw/notes/2026-11-22-ll-suscripciones-tui-opencode.md)): con la limpieza, tras dos recargas solo recibe eventos la carga nueva, comprobado con OpenCode 2.3.2 real (`idd@99bdccd:openspec/changes/archive/2026-11-22-fix-tui-subscription-cleanup/tasks.md`, task 5.2). El identificador, la generación y la respuesta única de D13 se mantienen como defensa ante carreras durante una recarga (ADR-0011). Los hooks del servidor anterior no sobreviven (task 1.4).
- **Cerrar con `--standalone` corta las suscripciones vivas**: cada `events.on` de la TUI es una suscripción a `/api/event`, y si el servidor propio de la TUI se apaga con ella viva, el cliente imprime una traza `ClientError: Transport … ECONNRESET`. Sin `--standalone` no ocurre, porque el servidor sigue vivo (`idd@99bdccd:openspec/changes/archive/2026-11-22-fix-tui-subscription-cleanup/design.md`, Context).
- **Encadenar desde `experimental.idle`**: crear la sesión, `prompt`, navegar y archivar la anterior tarda menos de 200 ms. Tras una interrupción o una compactación no se ejecuta `idle` (lección 6).
- **`ctx.session.list()` devuelve `{ data, cursor }` por páginas**, no un array. Se descubrió en la prueba final con OpenCode real, y se corrigió en el plugin y en el simulador (`idd@772d0f0:openspec/changes/archive/2026-11-21-add-openspec-autopilot/tasks.md`, task 12.2).
- **El modelo no decide por el usuario**: un modelo real cerró con `ok` una revisión ante "Gracias, lo miro luego.". De ahí la confirmación en la TUI de ADR-0008 (lección 10), que ADR-0014 sustituye por el cierre con git: la decisión del usuario es su commit, no una frase del modelo ([lección del 2026-11-22](../../raw/notes/2026-11-22-ll-adr-0014-sustituye-confirmacion-revision.md)).

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
- [[worktrees-de-opencode|Cómo crea OpenCode 2 los worktrees]] ([Cómo crea OpenCode 2 los worktrees](../concepts/worktrees-de-opencode.md))

## Sources

- [Collection: archivado de apply-one-task-per-session-in-normal-mode (idd@f9f014c)](../../raw/repos/2026-11-22-idd-f9f014c-apply-one-task-per-session-in-normal-mode.md): `adr/0025-asymmetry-policy-with-mode-managed-versioned-block.md`, `openspec/specs/openspec-autopilot/spec.md`, `openspec/config.yaml`, `.opencode/plugins/openspec-autopilot/lib/apply-guidance.mjs`, `README.md`, `openspec/changes/archive/2026-11-22-apply-one-task-per-session-in-normal-mode/design.md`.
- [Collection: archivado de allow-user-requested-merges (idd@cac0041)](../../raw/repos/2026-11-22-idd-cac0041-allow-user-requested-merges.md): `adr/0016-agent-merges-on-user-request.md`, `.agents/openspec/branch-change.mjs`, `.agents/skills/openspec-git-discipline/SKILL.md`, `openspec/specs/openspec-change-lifecycle/spec.md`, `openspec/config.yaml`.
- [Lessons Learned: el cierre de la revisión pasa de la confirmación en la TUI a git (ADR-0014)](../../raw/notes/2026-11-22-ll-adr-0014-sustituye-confirmacion-revision.md): lección 1.
- [Collection: archivado de autopilot-sesion-operativa (idd@6d6e79c)](../../raw/repos/2026-11-22-idd-6d6e79c-autopilot-sesion-operativa.md): `adr/0013-model-creates-change-branches-plugin-stages.md`, `adr/0014-autopilot-verifies-product-and-closes-reviews-with-git.md`, `openspec/specs/openspec-autopilot/spec.md`, `openspec/specs/openspec-change-lifecycle/spec.md`, `.opencode/plugins/openspec-autopilot/`, `.agents/openspec/branch-change.mjs`, `.agents/skills/openspec-git-discipline/SKILL.md`, `openspec/changes/archive/2026-11-22-autopilot-sesion-operativa/design.md` y `tasks.md`.
- [Lessons Learned: el lint de las specs con gplint](../../raw/notes/2026-11-22-ll-replace-gherkin-lint-with-gplint.md): lección 5.
- [Collection: archivado de add-openspec-autopilot (idd@772d0f0)](../../raw/repos/2026-11-21-idd-772d0f0-add-openspec-autopilot.md): `adr/0006-agent-asymmetry-policy.md`, `adr/0007-single-branch-change-lifecycle.md`, `adr/0008-openspec-autopilot-plugin.md`, `openspec/specs/openspec-change-lifecycle/spec.md`, `openspec/specs/openspec-autopilot/spec.md`, `.agents/openspec/branch-change.mjs`, `.opencode/plugins/openspec-autopilot/`, `README.md`, `acceptance-tests/README.md`, `openspec/changes/archive/2026-11-21-add-openspec-autopilot/tasks.md`.
- [Lessons Learned: APIs de sesión de OpenCode 2.3.2 para orquestar un change](../../raw/notes/2026-11-21-ll-sesiones-opencode-autopilot.md): lecciones 1 a 10.
- [Lessons Learned: add-quote-comment-rule](../../raw/notes/2026-11-22-ll-add-quote-comment-rule.md): lección 3.
- [Collection: archivado de manage-git-discipline (idd@5d7f5b0)](../../raw/repos/2026-11-22-idd-5d7f5b0-manage-git-discipline.md): `adr/0013-git-discipline-two-forms-and-ephemeral-commits.md`, `openspec/specs/openspec-change-lifecycle/spec.md`, `.agents/openspec/branch-change.mjs`, `openspec/config.yaml`, `README.md`, `openspec/changes/archive/2026-11-22-manage-git-discipline/adr.md`.
- [Lessons Learned: manage-git-discipline](../../raw/notes/2026-11-22-ll-manage-git-discipline.md): lección 3.
- [Collection: archivado de fix-tui-subscription-cleanup (idd@99bdccd)](../../raw/repos/2026-11-22-idd-99bdccd-fix-tui-subscription-cleanup.md): `.opencode/plugins/openspec-autopilot/tui.js`, `acceptance-tests/support/agents/opencode-sim.mjs`, `openspec/changes/archive/2026-11-22-fix-tui-subscription-cleanup/design.md` y `tasks.md`.
- [Collection: ADR-0011 tras la renumeración (idd@002f043)](../../raw/repos/2026-11-22-idd-002f043-adr-0011.md): `adr/0011-opencode-plugins-release-what-they-register.md`.
- [Lessons Learned: suscripciones de la TUI de OpenCode y su limpieza](../../raw/notes/2026-11-22-ll-suscripciones-tui-opencode.md): lecciones 1, 2 y 4 (las trazas al cerrar con `--standalone`, el contrato de limpieza que corrige la regla de la lección 5, y la prueba en OpenCode real sin tmux).
