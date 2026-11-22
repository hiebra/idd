---
title: "El arranque de sesión: núcleo neutral y un adaptador por agente"
category: topic
sources:
  - raw/notes/2026-11-22-ll-pruebas-opencode-real-autopilot.md
  - raw/repos/2026-11-22-idd-5d7f5b0-manage-git-discipline.md
  - raw/repos/2026-11-22-idd-99bdccd-fix-tui-subscription-cleanup.md
  - raw/repos/2026-11-21-idd-1cf0792.md
  - raw/repos/2026-11-21-idd-f2be907-readme.md
  - raw/repos/2026-11-21-idd-b48392d-fix-wiki-flow-operations.md
  - raw/repos/2026-11-21-idd-16e4617-add-quote-comment-rule.md
created: 2026-11-21
updated: 2026-11-22
verified: 2026-11-22
tags: [session-bootstrap, claude-code, opencode, adr, spec]
confidence: high
volatility: warm
summary: "Qué hace el arranque de sesión de la plantilla, por qué se divide en un núcleo bash y un adaptador por agente, y qué garantiza su spec; sintetizado de ADR-0001, ADR-0002, ADR-0005, ADR-0010, la spec session-bootstrap y el código del núcleo y los adaptadores."
---

# El arranque de sesión: núcleo neutral y un adaptador por agente

> Al abrir una sesión de Claude Code u OpenCode 2, el proyecto se prepara solo: instala sus dependencias, deja el `openspec` del proyecto en el `PATH`, instala el motor del wiki y entrega al agente las instrucciones del proyecto: la guía y el recordatorio del wiki, y la regla de comentarios con su recordatorio. Todo lo de esta página sale de los archivos citados, fijados en `idd@1cf0792` (el README, en `idd@f2be907`).

## Por qué existe

- Las sesiones en la nube empiezan sin dependencias, y sin un paso de preparación cada sesión exige instalar a mano el CLI de OpenSpec en su versión, las dependencias del proyecto y las de la suite (`idd@1cf0792:adr/0001-session-bootstrap-hook.md`, Context).
- Se descartaron un script del entorno de la nube (no cubre las sesiones locales ni viaja con el repositorio), las instrucciones en el README y la instalación del CLI solo (ADR-0001).

## Por qué un núcleo y adaptadores

ADR-0002 (`idd@1cf0792:adr/0002-agent-neutral-session-bootstrap.md`) sustituye a ADR-0001 cuando entra OpenCode 2. Los dos agentes disparan el arranque, exponen el `PATH` y muestran los avisos de forma distinta.

- **El núcleo** (`idd@1cf0792:.agents/hooks/session-bootstrap.sh`) es bash y está fuera de la configuración de cualquier agente. Tiene toda la lógica, recibe el directorio del proyecto y termina siempre con éxito. Avisa por stderr con el prefijo `session-start:` y devuelve por stdout líneas `bin=` y `wiki-engine=`. Además tiene los modos `guide` y `reminder`, que preparan la guía y el recordatorio del wiki para un agente: rellenan sus marcadores de operación (`{{query}}`, `{{ingest}}`) con cómo se invoca cada una en ese agente y no entregan el texto si queda alguno sin rellenar (`idd@b48392d:.agents/hooks/session-bootstrap.sh`, `fill_markers`). Desde `add-quote-comment-rule` tiene también `comments-rule` y `comments-reminder`: el segundo lee el mensaje del usuario por stdin y solo imprime el recordatorio si el mensaje activa la regla, así que la decisión está en el núcleo y no en cada adaptador (`idd@16e4617:.agents/hooks/session-bootstrap.sh`, `activates_comments`).
- **No está escrito en Node** porque no podría avisar de que falta Node o de que su versión no llega. Reimplementarlo en el plugin de OpenCode duplicaría la lógica (ADR-0002, alternativas).
- **Cada adaptador** solo aporta cómo se dispara el arranque, cómo se expone el entorno y cómo se muestran los avisos:

| | Claude Code | OpenCode 2 |
|---|---|---|
| Adaptador | hook `SessionStart`, `idd@1cf0792:.claude/hooks/session-start.sh`, y `UserPromptSubmit`, `idd@1cf0792:.claude/hooks/user-prompt-submit.sh` (registrados en `.claude/settings.json`) | plugin local sin dependencias, `idd@1cf0792:.opencode/plugins/session-bootstrap/server.js` y `tui.js` |
| `PATH` y `CLAUDE_PLUGIN_ROOT` | `CLAUDE_ENV_FILE` | hook `create.before` de cada comando de shell |
| Avisos | `systemMessage` del JSON del hook | toasts de la TUI, por el RPC del plugin |
| Instrucciones y recordatorios | un solo `additionalContext` por hook, que junta los textos: guía del wiki y regla de comentarios en `SessionStart`; los dos recordatorios en `UserPromptSubmit`, que lee el `prompt` del JSON de stdin con `json_field` (bash, sin Node) | hook `context` (ver [[hook-context-opencode|El hook context de OpenCode]] ([El hook context de OpenCode](../concepts/hook-context-opencode.md))) |

ADR-0002 recoge también que Claude Code no muestra lo que un hook `SessionStart` escribe por stderr cuando termina con éxito. Por eso los avisos de ADR-0001 no llegaban al usuario, y ahora van en `systemMessage`.

## Qué garantiza la spec

`idd@1cf0792:openspec/specs/session-bootstrap/spec.md`:

- **El CLI del proyecto**: el `openspec` de la versión de `package.json` tiene prioridad sobre uno global. Si el `PATH` no se puede ajustar, se avisa e indica cómo ejecutarlo. "Avisar" es mostrarlo en la interfaz del agente; dejarlo en un log no cuenta.
- **Las dependencias**: todas, las de la raíz y las de `acceptance-tests/`. Solo se reinstalan si cambian `package.json`, `package-lock.json` o el núcleo, y una instalación vale para los dos agentes.
- **Los requisitos**: sin npm o con un Node inferior al de `engines.node`, se avisa y no se instala nada. Un fallo de instalación avisa, no bloquea la sesión y se reintenta en la siguiente.
- **Git listo para el ciclo** (desde `manage-git-discipline`): antes de instalar nada, `prepare_git` completa un clon superficial, en un contenedor efímero trae las referencias de `origin` y guarda la rama de la sesión en `git config idd.sessionBranch`, y pone al día con `update-ref` las ramas permanentes locales atrasadas, salvo la del clon; de una divergida solo avisa. No toca el árbol de trabajo y, fuera de la nube, solo usa la red para completar un clon superficial (`idd@5d7f5b0:.agents/hooks/session-bootstrap.sh`, `idd@5d7f5b0:openspec/specs/session-bootstrap/spec.md`). Saber si la sesión es un contenedor efímero lo dice `branch-change.mjs env`, para que la detección esté en un solo sitio. Desde `autopilot-rama-por-sesion` tampoco pone al día ninguna rama sacada en otro worktree del clon: `update-ref` la movería sin su árbol ni su índice, y su directorio vería como cambios en el stage la diferencia con el commit nuevo ([lección 2 de las pruebas en OpenCode real](../../raw/notes/2026-11-22-ll-pruebas-opencode-real-autopilot.md)).
- **El motor del wiki**: se instala en la versión fijada, se sustituye si hay otra y no se versiona. Un fallo avisa con la instalación manual y se reintenta.
- **Guía y recordatorio**: los entrega el adaptador del arranque, nunca un archivo de instrucciones que el agente cargue siempre. ADR-0010 extiende esa regla a toda instrucción que la plantilla dé al agente, cada una con su fuente en `.agents/` y su desactivación en local (`idd@16e4617:adr/0010-agent-instructions-through-session-bootstrap.md`); la primera tras el wiki es [[regla-de-comentarios|la regla de comentarios]] ([la regla de comentarios](../concepts/regla-de-comentarios.md)).
- **En OpenCode, la parte de TUI libera su suscripción a los avisos** al recargarse y al cerrarse: tras una recarga, cada aviso nuevo se muestra una sola vez, y al cerrar con `--standalone` no queda ningún error en el terminal (`idd@99bdccd:openspec/specs/session-bootstrap/spec.md`). Sin esa limpieza, cada carga anterior viva repetía el toast (`idd@99bdccd:.opencode/plugins/session-bootstrap/tui.js`).

## Consecuencias que recogen los ADRs

- La primera sesión de cada clon tarda más. El arranque impone `npm install` en local, y el proyecto queda ligado a Node.js con npm y a bash (ADR-0001 y ADR-0002).
- En OpenCode, el primer comando de la primera sesión espera a la instalación. En OpenCode Desktop y en `opencode run`, sin TUI, los avisos solo quedan en el log (ADR-0002).
- Para desactivarlo todo en local: `disableAllHooks` en `.claude/settings.local.json`, o `"plugins": ["-session-bootstrap"]` en la configuración global de OpenCode. Solo el wiki: `PROJECT_WIKI=off` (`idd@f2be907:README.md`). Solo la regla de comentarios: `PROJECT_COMMENTS=off` (`idd@16e4617:README.md`).

## See Also

- [[carga-en-la-misma-sesion-por-agente|Qué carga cada agente y cuándo]] ([Qué carga cada agente y cuándo](carga-en-la-misma-sesion-por-agente.md))
- [[hook-context-opencode|El hook context de OpenCode]] ([El hook context de OpenCode](../concepts/hook-context-opencode.md))
- [[flujo-wiki-first|El flujo wiki-first]] ([El flujo wiki-first](flujo-wiki-first.md))
- [[regla-de-comentarios|La regla de comentarios]] ([La regla de comentarios](../concepts/regla-de-comentarios.md))
- [[suite-de-aceptacion-y-spec-as-source|La suite de aceptación y spec-as-source]] ([La suite de aceptación y spec-as-source](suite-de-aceptacion-y-spec-as-source.md))
- [[una-sola-copia-de-las-skills|Una sola copia de las skills, vista por cada agente]] ([Una sola copia de las skills, vista por cada agente](../concepts/una-sola-copia-de-las-skills.md))

## Sources

- [Collection: repositorio de la plantilla intent-driven](../../raw/repos/2026-11-21-idd-1cf0792.md): `adr/0001-session-bootstrap-hook.md`, `adr/0002-agent-neutral-session-bootstrap.md`, `adr/0005-wiki-engine-through-session-bootstrap.md`, `openspec/specs/session-bootstrap/spec.md`, `.agents/hooks/session-bootstrap.sh`, `.claude/hooks/session-start.sh`, `.claude/hooks/user-prompt-submit.sh`, `.opencode/plugins/session-bootstrap/server.js`.
- [Collection: archivado de fix-wiki-flow-operations](../../raw/repos/2026-11-21-idd-b48392d-fix-wiki-flow-operations.md): `.agents/hooks/session-bootstrap.sh`.
- [Collection: README de la plantilla tras el archivado](../../raw/repos/2026-11-21-idd-f2be907-readme.md): `README.md`.
- [Collection: archivado de add-quote-comment-rule](../../raw/repos/2026-11-21-idd-16e4617-add-quote-comment-rule.md): `.agents/hooks/session-bootstrap.sh`, `.claude/hooks/session-start.sh`, `.claude/hooks/user-prompt-submit.sh`, `.claude/hooks/json.sh`, `adr/0010-agent-instructions-through-session-bootstrap.md`, `README.md`.
- [Collection: archivado de manage-git-discipline (idd@5d7f5b0)](../../raw/repos/2026-11-22-idd-5d7f5b0-manage-git-discipline.md): `.agents/hooks/session-bootstrap.sh`, `openspec/specs/session-bootstrap/spec.md`.
- [Collection: archivado de fix-tui-subscription-cleanup (idd@99bdccd)](../../raw/repos/2026-11-22-idd-99bdccd-fix-tui-subscription-cleanup.md): `openspec/specs/session-bootstrap/spec.md`, `.opencode/plugins/session-bootstrap/tui.js`.
- [Lessons Learned: pruebas de autopilot-rama-por-sesion en OpenCode 2.3.2 real](../../raw/notes/2026-11-22-ll-pruebas-opencode-real-autopilot.md): lección 2.
