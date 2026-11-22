---
title: "El ciclo de un change y su automatización en OpenCode"
category: topic
sources:
  - raw/notes/2026-11-22-ll-suscripciones-tui-opencode.md
  - raw/repos/2026-11-22-idd-99bdccd-fix-tui-subscription-cleanup.md
  - raw/repos/2026-11-21-idd-772d0f0-add-openspec-autopilot.md
  - raw/notes/2026-11-21-ll-sesiones-opencode-autopilot.md
created: 2026-11-21
updated: 2026-11-22
verified: 2026-11-22
tags: [openspec, git, opencode, plugins, openspec-autopilot, adr, spec]
confidence: high
volatility: warm
summary: "Un change se hace en una rama temporal con una sola fusión, y el change de la rama se lee de git con un módulo neutral. En OpenCode 2, el plugin openspec-autopilot encadena una sesión por paso con el estado en la metadata de las sesiones, revisiones confirmadas en la TUI y un modo auto opcional; en Claude Code los mismos workflows se lanzan a mano. Sintetizado de ADR-0006 a ADR-0008, las specs openspec-change-lifecycle y openspec-autopilot, el README y las pruebas con OpenCode 2.3.2."
---

# El ciclo de un change y su automatización en OpenCode

> El ciclo de un change es el mismo en los dos agentes y se decide con un módulo neutral que lee git; OpenCode 2 lo automatiza además con un plugin que da una sesión a cada paso. Todo lo de esta página sale de los archivos fijados en `idd@772d0f0` (el commit del archivado de `add-openspec-autopilot`) y de las pruebas con OpenCode 2.3.2 de la [nota de lecciones](../../raw/notes/2026-11-21-ll-sesiones-opencode-autopilot.md).

## El ciclo, igual en los dos agentes

`idd@772d0f0:adr/0007-single-branch-change-lifecycle.md`, `idd@772d0f0:openspec/specs/openspec-change-lifecycle/spec.md`, `idd@772d0f0:README.md`:

- **Una rama temporal y una sola fusión**: propuesta, implementación, archive y resincronización del wiki van en la rama, y el archive se hace en ella, antes de fusionar. Nunca en una rama permanente.
- **Ramas permanentes**: la lista `x-main` de `openspec/config.yaml`, o `main` si no está. La última es la rama de origen. Cualquier otra rama local es temporal, y con HEAD separado no hay ninguna. Una `x-main` con otra forma se trata como ausente y avisa. OpenSpec 1.17.0 acepta claves `x-*` sin avisos ([lecciones](../../raw/notes/2026-11-21-ll-sesiones-opencode-autopilot.md), lección 8).
- **El change de la rama se lee de git**: es el que ha cambiado en `openspec/changes/` desde el merge-base con la rama de origen, con commit o sin él. No se apunta en ningún sitio. Lo calcula `idd@772d0f0:.agents/openspec/branch-change.mjs` (`--json`), sin dependencias y el mismo para los dos agentes (D1 del design).
- **Las puertas** (proponer, apply, archive) las decide `branch-change.mjs check <propose|apply|archive> [<change>]`, que imprime `{ ok, message }` y sale con 0 o 1. La skill `openspec-git-discipline` manda ejecutarlo y obedecerlo (ver [su origen](../concepts/origen-de-openspec-git-discipline.md)).
- **Los commits y las fusiones los hace el usuario**: los workflows los piden tras cada artefacto, cada task, el archive y la resincronización del wiki.

## La asimetría entre agentes

`idd@772d0f0:adr/0006-agent-asymmetry-policy.md` fija cuándo una capacidad puede existir en un solo agente. Deben cumplirse estas condiciones:

- el ciclo y lo versionado son iguales con ella y sin ella;
- en el otro agente lo mismo se hace a mano;
- no deja restos en el otro agente;
- la suite verifica las dos cosas;
- se declara en la proposal y en un ADR.

Lo común al ciclo va en una pieza neutral, y por eso `branch-change.mjs` está fuera del plugin. En Claude Code no hay nada del plugin, y la suite lo comprueba (`.claude/` no nombra el plugin, sus tools ni su RPC).

## El plugin `openspec-autopilot`

`idd@772d0f0:adr/0008-openspec-autopilot-plugin.md`, `idd@772d0f0:openspec/specs/openspec-autopilot/spec.md` y el código de `idd@772d0f0:.opencode/plugins/openspec-autopilot/`:

- **Dónde actúa**: solo con la TUI y en una rama temporal con un change o sin ninguno. Sin TUI (`opencode run`, Desktop), en una rama permanente, con HEAD separado o con varios changes en la rama, no orquesta nada. Con varios changes, avisa.
- **Una sesión por paso**: cada artefacto, cada task, el verify, el archive, la resincronización del wiki y, en el modo normal, las revisiones. Cada paso termina cuando el modelo llama a la tool `openspec_handoff`. El plugin comprueba en el repositorio que el paso hizo algo, crea la sesión siguiente con su agente, su metadata y su skill, navega a ella y archiva la anterior. Es idempotente por `phase` y `seq`.
- **El paso siguiente** lo decide una función pura (`lib/next-step.mjs`) a partir de `openspec status` y `tasks.md`, en los dos modos.
- **El estado vive solo en la metadata de las sesiones**, en la clave `openspec`: la sesión dueña del change por `worktree` y `branch`, el paso de cada sesión, los resultados de las revisiones y las lecciones candidatas. El repositorio no cambia. Si dos sesiones toman el control a la vez, gana la de `time.created` más antiguo y la otra queda libre con un aviso (D4).
- **Al abrir una sesión a mano**: sin change, toma el control y arranca `openspec-new-change`. Con change y sin dueña, toma el control y sigue por el paso de `openspec status`. Si la dueña trabaja, la nueva queda libre. Si la dueña está parada, un diálogo pregunta si ir a ella o archivarla y seguir.
- **Revisión humana guiada** (modo normal): tras cada artefacto, cada task y el verify. El cierre lo propone el modelo, pero lo confirma el usuario en un diálogo de la TUI. Una revisión no satisfactoria lleva a `openspec-update-change`, que recibe un índice de las sesiones del change (tool `openspec_session`), y después a una revisión del plan.
- **Árbol limpio**: antes de empezar un paso, el árbol de trabajo tiene que estar limpio. Si no, la sesión espera el commit (`waiting-commit`). En el modo auto, solo se comprueba en el primer paso tras un cambio de zona (D11).
- **Modo auto**: sin revisiones. Se para cuando un workflow pregunta y en cada cambio entre la zona de specs y la de código. El verify termina llamando a la tool con su veredicto: sin problemas críticos pasa al archive sin pedir confirmación; con ellos, la sesión queda esperando al usuario, que la cierra como una revisión. Sin veredicto (`clean` o `critical`), la tool no traspasa y le pide al modelo que vuelva a llamarla con uno (`idd@772d0f0:.opencode/plugins/openspec-autopilot/server.js`). Es una opción de cada usuario (`options.auto` en su configuración global de OpenCode), no del proyecto.
- **Libera sus suscripciones al descargarse**: la parte de TUI ata sus dos `events.on` a un `AbortSignal` y `setup` devuelve la función que lo aborta, que OpenCode ejecuta antes de cada recarga en caliente y al cerrar. Así, tras una recarga solo atiende los eventos la carga nueva, y al cerrar con `--standalone` no deja trazas `ECONNRESET` en el terminal. ADR-0010 lo exige a todos los plugins de OpenCode del proyecto (`idd@99bdccd:adr/0010-opencode-plugins-release-what-they-register.md`, `idd@99bdccd:.opencode/plugins/openspec-autopilot/tui.js`).
- **Nunca bloquea OpenCode**: ante un fallo, avisa y deja la sesión libre, sin lanzar excepciones hacia OpenCode (D12).

## Las restricciones de OpenCode 2.3.2 que lo moldean

De las pruebas con la TUI real y un proveedor falso ([lecciones](../../raw/notes/2026-11-21-ll-sesiones-opencode-autopilot.md)):

- **Archivar solo desde la TUI**: el `ctx.session.update` del servidor ignora `archived` sin dar error. Por eso `tui.js` archiva con `context.client.session.update`, pedido por RPC (lección 1).
- **La metadata se sustituye entera**: se escribe siempre leyendo, combinando y volviendo a escribir (lección 2).
- **Las tools solo llegan al modelo con `options: { codemode: false }`** (lección 3). Una sesión con el agente plan también las ve y las llama (task 1.2 del change).
- **Recargas en caliente**: también se recarga al cambiar `options`, sin reiniciar (lección 4). OpenCode ejecuta antes de cada recarga, y al cerrar, la función que devolvió el `setup` de cada parte, de servidor y de TUI; `events.on(nombre, manejador, { signal })` deja de entregar eventos al abortarse el `signal`. Los escuchadores RPC de la TUI anterior solo seguían vivos (lección 5) porque el plugin no los liberaba ([lecciones 1 y 2 de la limpieza](../../raw/notes/2026-11-22-ll-suscripciones-tui-opencode.md)): con la limpieza, tras dos recargas solo recibe eventos la carga nueva, comprobado con OpenCode 2.3.2 real (`idd@99bdccd:openspec/changes/archive/2026-11-22-fix-tui-subscription-cleanup/tasks.md`, task 5.2). El identificador, la generación y la respuesta única de D13 se mantienen como defensa ante carreras durante una recarga (ADR-0010). Los hooks del servidor anterior no sobreviven (task 1.4).
- **Cerrar con `--standalone` corta las suscripciones vivas**: cada `events.on` de la TUI es una suscripción a `/api/event`, y si el servidor propio de la TUI se apaga con ella viva, el cliente imprime una traza `ClientError: Transport … ECONNRESET`. Sin `--standalone` no ocurre, porque el servidor sigue vivo (`idd@99bdccd:openspec/changes/archive/2026-11-22-fix-tui-subscription-cleanup/design.md`, Context).
- **Encadenar desde `experimental.idle`**: crear la sesión, `prompt`, navegar y archivar la anterior tarda menos de 200 ms. Tras una interrupción o una compactación no se ejecuta `idle` (lección 6).
- **`ctx.session.list()` devuelve `{ data, cursor }` por páginas**, no un array. Se descubrió en la prueba final con OpenCode real, y se corrigió en el plugin y en el simulador (`idd@772d0f0:openspec/changes/archive/2026-11-21-add-openspec-autopilot/tasks.md`, task 12.2).
- **El modelo no decide por el usuario**: un modelo real cerró con `ok` una revisión ante "Gracias, lo miro luego.". De ahí la confirmación en la TUI (lección 10).

## Cómo se verifica

- **La suite** prueba el plugin en un OpenCode simulado con varias sesiones (`idd@772d0f0:acceptance-tests/support/agents/opencode-sim.mjs`). Es un proceso hijo que el World maneja por IPC, con un modelo guionizado por escenario y fallos inyectables. Lo que no está en las specs va en `core-tests/autopilot-next-step.test.js` y `core-tests/autopilot-plugin.test.js` (`idd@772d0f0:acceptance-tests/README.md`). El simulador ejecuta en cada recarga, y al cerrar, la limpieza que devuelve cada `setup`, respeta el `signal` de `events.on` y deja una traza en el terminal por cada suscripción viva al cerrar (`idd@99bdccd:acceptance-tests/support/agents/opencode-sim.mjs`).
- **El simulador no detecta un cambio real de OpenCode**: al subir de versión hay que repetir las pruebas en el banco de la lección 9, fuera del repositorio (ver [el registro de vigilancia](../../inventory/candidates/volver-a-comprobar-apis-de-sesion-al-subir-opencode.md)).

## Lo que no se sabe

- **Su uso prolongado**: si el coste de un commit antes de cada paso del modo normal compensa. ADR-0008 lo asume como consecuencia, pero no hay experiencia de uso registrada.
- **Que un modelo real llame a `openspec_handoff` en el momento justo** fuera de las revisiones. Solo se comprobó con el proveedor falso y, para las revisiones, con `qwen3.8-flash` (lección 10).

## See Also

- [openspec-git-discipline: una regla heredada sin justificación registrada](../concepts/origen-de-openspec-git-discipline.md)
- [La suite de aceptación y spec-as-source](suite-de-aceptacion-y-spec-as-source.md)
- [El hook context de OpenCode](../concepts/hook-context-opencode.md)
- [El flujo wiki-first](flujo-wiki-first.md)

## Sources

- [Collection: archivado de add-openspec-autopilot (idd@772d0f0)](../../raw/repos/2026-11-21-idd-772d0f0-add-openspec-autopilot.md): `adr/0006-agent-asymmetry-policy.md`, `adr/0007-single-branch-change-lifecycle.md`, `adr/0008-openspec-autopilot-plugin.md`, `openspec/specs/openspec-change-lifecycle/spec.md`, `openspec/specs/openspec-autopilot/spec.md`, `.agents/openspec/branch-change.mjs`, `.opencode/plugins/openspec-autopilot/`, `README.md`, `acceptance-tests/README.md`, `openspec/changes/archive/2026-11-21-add-openspec-autopilot/tasks.md`.
- [Lessons Learned: APIs de sesión de OpenCode 2.3.2 para orquestar un change](../../raw/notes/2026-11-21-ll-sesiones-opencode-autopilot.md): lecciones 1 a 10.
- [Collection: archivado de fix-tui-subscription-cleanup (idd@99bdccd)](../../raw/repos/2026-11-22-idd-99bdccd-fix-tui-subscription-cleanup.md): `adr/0010-opencode-plugins-release-what-they-register.md`, `.opencode/plugins/openspec-autopilot/tui.js`, `acceptance-tests/support/agents/opencode-sim.mjs`, `openspec/changes/archive/2026-11-22-fix-tui-subscription-cleanup/design.md` y `tasks.md`.
- [Lessons Learned: suscripciones de la TUI de OpenCode y su limpieza](../../raw/notes/2026-11-22-ll-suscripciones-tui-opencode.md): lecciones 1, 2 y 4 (las trazas al cerrar con `--standalone`, el contrato de limpieza que corrige la regla de la lección 5, y la prueba en OpenCode real sin tmux).
