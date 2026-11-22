---
title: "El ciclo de un change y su automatización en OpenCode"
category: topic
sources:
  - raw/notes/2026-11-22-ll-manage-git-discipline.md
  - raw/repos/2026-11-22-idd-5d7f5b0-manage-git-discipline.md
  - raw/repos/2026-11-21-idd-772d0f0-add-openspec-autopilot.md
  - raw/notes/2026-11-21-ll-sesiones-opencode-autopilot.md
  - raw/notes/2026-11-22-ll-add-quote-comment-rule.md
created: 2026-11-21
updated: 2026-11-22
verified: 2026-11-21
tags: [openspec, git, opencode, plugins, openspec-autopilot, adr, spec]
confidence: high
volatility: warm
summary: "Un change se hace, de forma recomendada, en una rama temporal con una sola fusión con --no-ff, o en la forma canónica de intent-driven; el change de la rama se lee de git con un módulo neutral. En OpenCode 2, el plugin openspec-autopilot encadena una sesión por paso con el estado en la metadata de las sesiones, revisiones confirmadas en la TUI y un modo auto opcional; en Claude Code los mismos workflows se lanzan a mano. Sintetizado de ADR-0006, ADR-0008, ADR-0013, las specs openspec-change-lifecycle y openspec-autopilot, el README y las pruebas con OpenCode 2.3.2."
---

# El ciclo de un change y su automatización en OpenCode

> El ciclo de un change es el mismo en los dos agentes y se decide con un módulo neutral que lee git; OpenCode 2 lo automatiza además con un plugin que da una sesión a cada paso. Lo del ciclo sale de los archivos fijados en `idd@5d7f5b0` (el archivado de `manage-git-discipline`); lo del plugin, de `idd@772d0f0` (el de `add-openspec-autopilot`) y de las pruebas con OpenCode 2.3.2 de la [nota de lecciones](../../raw/notes/2026-11-21-ll-sesiones-opencode-autopilot.md).

## El ciclo, igual en los dos agentes

Desde `manage-git-discipline`, el ciclo lo fija `idd@5d7f5b0:adr/0013-git-discipline-two-forms-and-ephemeral-commits.md`, que sustituye a ADR-0007 (`idd@5d7f5b0:openspec/specs/openspec-change-lifecycle/spec.md`, `idd@5d7f5b0:README.md`):

- **Dos formas, las dos admitidas.** La recomendada hace todo el change en una rama temporal (propuesta, implementación, archive y resincronización del wiki), archiva en ella y la lleva a la rama de origen en una sola fusión con `--no-ff`; con `git log --first-parent`, cada change es una entrada. La forma canónica de intent-driven fusiona la propuesta antes del apply y archiva en la rama de origen tras fusionar la implementación, con todas las tasks hechas. Conviene para revisar el plan aparte o reservar pronto los números de ADR, a cambio de tres fusiones. El squash también se admite.
- **Ramas permanentes**: la lista `x-main` de `openspec/config.yaml`, o `main` si no está. La última es la rama de origen. Cualquier otra rama local es temporal, y con HEAD separado no hay ninguna. Una `x-main` con otra forma se trata como ausente y avisa. OpenSpec 1.17.0 acepta claves `x-*` sin avisos ([lecciones](../../raw/notes/2026-11-21-ll-sesiones-opencode-autopilot.md), lección 8).
- **El change de la rama se lee de git**: es el que ha cambiado en `openspec/changes/` desde el merge-base con la rama de origen, con commit o sin él. No se apunta en ningún sitio. Lo calcula `idd@5d7f5b0:.agents/openspec/branch-change.mjs` (`--json`), sin dependencias y el mismo para los dos agentes. El merge-base se calcula contra la más avanzada de la rama de origen local y `origin/<rama>` (`originRef`; si han divergido, la local, con aviso), y no cuenta un change cuyo directorio ya está igual en la rama de origen, como pasa tras un squash.
- **Las puertas** (`check propose|apply|archive|commit`) imprimen `{ ok, message }`, salen con 0 o 1 y admiten las dos formas: proponer o aplicar en la rama de origen deja seguir con un aviso, y archivar allí solo si no quedan tasks. Todo rechazo dice cómo seguir. La skill `openspec-git-discipline` manda ejecutarlas y obedecerlas (ver [su origen](../concepts/origen-de-openspec-git-discipline.md)).
- **Quién hace los commits**: fuera de la nube, el usuario; los workflows los piden tras cada artefacto, cada task, el archive y la resincronización del wiki. En un contenedor efímero (`CLAUDE_CODE_CONTAINER_ID` y `CLAUDE_CODE_REMOTE=true`), el agente hace commit y push sin preguntar en la rama de la sesión que guardó el arranque (`git config idd.sessionBranch`), con commits provisionales si hace falta y después de que `check commit` lo autorice. Nunca fusiona ni toca otras ramas. Ningún commit mezcla la zona de specs con la de código.
- **Números de ADR sin choques**: `rules.adr` de `idd@5d7f5b0:openspec/config.yaml` manda hacer `git fetch` y tomar el número más alto de `adr/` en todas las ramas remotas, y `check archive` detiene el archive si un ADR nuevo de la rama repite un número de la rama de origen. Ocurrió en el propio archive de `manage-git-discipline`: entre tanto habían llegado a `main` un ADR-0011 y un ADR-0012 de otras ramas, y el ADR del change se renumeró de 0011 a 0013 (`idd@5d7f5b0:openspec/changes/archive/2026-11-22-manage-git-discipline/adr.md`).
- **Probar el módulo en otra rama, con un worktree**: `branch-change.mjs` está versionado, así que al cambiar de rama se ejecuta la versión de esa rama, y la suite copia el árbol que haya en ese momento. Para ver cómo responde el módulo nuevo en `main`, se crea un worktree de `main` y se ejecuta allí el módulo de la rama de trabajo ([lecciones de manage-git-discipline](../../raw/notes/2026-11-22-ll-manage-git-discipline.md), lección 3).
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

`idd@772d0f0:adr/0008-openspec-autopilot-plugin.md`, `idd@772d0f0:openspec/specs/openspec-autopilot/spec.md` y el código de `idd@772d0f0:.opencode/plugins/openspec-autopilot/`:

- **Dónde actúa**: solo con la TUI y en una rama temporal con un change o sin ninguno. Sin TUI (`opencode run`, Desktop), en una rama permanente, con HEAD separado o con varios changes en la rama, no orquesta nada. Con varios changes, avisa.
- **Una sesión por paso**: cada artefacto, cada task, el verify, el archive, la resincronización del wiki y, en el modo normal, las revisiones. Cada paso termina cuando el modelo llama a la tool `openspec_handoff`. El plugin comprueba en el repositorio que el paso hizo algo, crea la sesión siguiente con su agente, su metadata y su skill, navega a ella y archiva la anterior. Es idempotente por `phase` y `seq`.
- **El paso siguiente** lo decide una función pura (`lib/next-step.mjs`) a partir de `openspec status` y `tasks.md`, en los dos modos.
- **El estado vive solo en la metadata de las sesiones**, en la clave `openspec`: la sesión dueña del change por `worktree` y `branch`, el paso de cada sesión, los resultados de las revisiones y las lecciones candidatas. El repositorio no cambia. Si dos sesiones toman el control a la vez, gana la de `time.created` más antiguo y la otra queda libre con un aviso (D4).
- **Al abrir una sesión a mano**: sin change, toma el control y arranca `openspec-new-change`. Con change y sin dueña, toma el control y sigue por el paso de `openspec status`. Si la dueña trabaja, la nueva queda libre. Si la dueña está parada, un diálogo pregunta si ir a ella o archivarla y seguir.
- **Revisión humana guiada** (modo normal): tras cada artefacto, cada task y el verify. El cierre lo propone el modelo, pero lo confirma el usuario en un diálogo de la TUI. Una revisión no satisfactoria lleva a `openspec-update-change`, que recibe un índice de las sesiones del change (tool `openspec_session`), y después a una revisión del plan.
- **Árbol limpio**: antes de empezar un paso, el árbol de trabajo tiene que estar limpio. Si no, la sesión espera el commit (`waiting-commit`). En el modo auto, solo se comprueba en el primer paso tras un cambio de zona (D11).
- **Modo auto**: sin revisiones. Se para cuando un workflow pregunta y en cada cambio entre la zona de specs y la de código. El verify termina llamando a la tool con su veredicto: sin problemas críticos pasa al archive sin pedir confirmación; con ellos, la sesión queda esperando al usuario, que la cierra como una revisión. Sin veredicto (`clean` o `critical`), la tool no traspasa y le pide al modelo que vuelva a llamarla con uno (`idd@772d0f0:.opencode/plugins/openspec-autopilot/server.js`). Es una opción de cada usuario (`options.auto` en su configuración global de OpenCode), no del proyecto.
- **Nunca bloquea OpenCode**: ante un fallo, avisa y deja la sesión libre, sin lanzar excepciones hacia OpenCode (D12).

## Las restricciones de OpenCode 2.3.2 que lo moldean

De las pruebas con la TUI real y un proveedor falso ([lecciones](../../raw/notes/2026-11-21-ll-sesiones-opencode-autopilot.md)):

- **Archivar solo desde la TUI**: el `ctx.session.update` del servidor ignora `archived` sin dar error. Por eso `tui.js` archiva con `context.client.session.update`, pedido por RPC (lección 1).
- **La metadata se sustituye entera**: se escribe siempre leyendo, combinando y volviendo a escribir (lección 2).
- **Las tools solo llegan al modelo con `options: { codemode: false }`** (lección 3). Una sesión con el agente plan también las ve y las llama (task 1.2 del change).
- **Recargas en caliente**: también se recarga al cambiar `options`, sin reiniciar (lección 4). Pero los escuchadores RPC de la TUI anterior siguen vivos, y por eso cada petición lleva identificador, una generación y una sola respuesta (lección 5, D13). Los hooks del servidor anterior no sobreviven (task 1.4).
- **Encadenar desde `experimental.idle`**: crear la sesión, `prompt`, navegar y archivar la anterior tarda menos de 200 ms. Tras una interrupción o una compactación no se ejecuta `idle` (lección 6).
- **`ctx.session.list()` devuelve `{ data, cursor }` por páginas**, no un array. Se descubrió en la prueba final con OpenCode real, y se corrigió en el plugin y en el simulador (`idd@772d0f0:openspec/changes/archive/2026-11-21-add-openspec-autopilot/tasks.md`, task 12.2).
- **El modelo no decide por el usuario**: un modelo real cerró con `ok` una revisión ante "Gracias, lo miro luego.". De ahí la confirmación en la TUI (lección 10).

## Cómo se verifica

- **La suite** prueba el plugin en un OpenCode simulado con varias sesiones (`idd@772d0f0:acceptance-tests/support/agents/opencode-sim.mjs`). Es un proceso hijo que el World maneja por IPC, con un modelo guionizado por escenario y fallos inyectables. Lo que no está en las specs va en `core-tests/autopilot-next-step.test.js` y `core-tests/autopilot-plugin.test.js` (`idd@772d0f0:acceptance-tests/README.md`).
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
- [Lessons Learned: add-quote-comment-rule](../../raw/notes/2026-11-22-ll-add-quote-comment-rule.md): lección 3.
- [Collection: archivado de manage-git-discipline (idd@5d7f5b0)](../../raw/repos/2026-11-22-idd-5d7f5b0-manage-git-discipline.md): `adr/0013-git-discipline-two-forms-and-ephemeral-commits.md`, `openspec/specs/openspec-change-lifecycle/spec.md`, `.agents/openspec/branch-change.mjs`, `openspec/config.yaml`, `README.md`, `openspec/changes/archive/2026-11-22-manage-git-discipline/adr.md`.
- [Lessons Learned: manage-git-discipline](../../raw/notes/2026-11-22-ll-manage-git-discipline.md): lección 3.
