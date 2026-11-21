---
title: "El arranque de sesión: núcleo neutral y un adaptador por agente"
category: topic
sources:
  - raw/repos/2026-11-21-idd-1cf0792.md
  - raw/repos/2026-11-21-idd-f2be907-readme.md
created: 2026-11-21
updated: 2026-11-21
verified: 2026-11-21
tags: [session-bootstrap, claude-code, opencode, adr, spec]
confidence: high
volatility: warm
summary: "Qué hace el arranque de sesión de la plantilla, por qué se divide en un núcleo bash y un adaptador por agente, y qué garantiza su spec; sintetizado de ADR-0001, ADR-0002, ADR-0005, la spec session-bootstrap y el código del núcleo y los adaptadores."
---

# El arranque de sesión: núcleo neutral y un adaptador por agente

> Al abrir una sesión de Claude Code u OpenCode 2, el proyecto se prepara solo: instala sus dependencias, deja el `openspec` del proyecto en el `PATH`, instala el motor del wiki y entrega la guía y el recordatorio del wiki. Todo lo de esta página sale de los archivos citados, fijados en `idd@1cf0792` (el README, en `idd@f2be907`).

## Por qué existe

- Las sesiones en la nube empiezan sin dependencias, y sin un paso de preparación cada sesión exige instalar a mano el CLI de OpenSpec en su versión, las dependencias del proyecto y las de la suite (`idd@1cf0792:adr/0001-session-bootstrap-hook.md`, Context).
- Se descartaron un script del entorno de la nube (no cubre las sesiones locales ni viaja con el repositorio), las instrucciones en el README y la instalación del CLI solo (ADR-0001).

## Por qué un núcleo y adaptadores

ADR-0002 (`idd@1cf0792:adr/0002-agent-neutral-session-bootstrap.md`) sustituye a ADR-0001 cuando entra OpenCode 2. Los dos agentes disparan el arranque, exponen el `PATH` y muestran los avisos de forma distinta.

- **El núcleo** (`idd@1cf0792:.agents/hooks/session-bootstrap.sh`) es bash y está fuera de la configuración de cualquier agente. Tiene toda la lógica, recibe el directorio del proyecto y termina siempre con éxito. Avisa por stderr con el prefijo `session-start:` y devuelve por stdout líneas `bin=` y `wiki-engine=`. Además tiene los modos `guide` y `reminder`, que preparan la guía y el recordatorio del wiki para un agente.
- **No está escrito en Node** porque no podría avisar de que falta Node o de que su versión no llega. Reimplementarlo en el plugin de OpenCode duplicaría la lógica (ADR-0002, alternativas).
- **Cada adaptador** solo aporta cómo se dispara el arranque, cómo se expone el entorno y cómo se muestran los avisos:

| | Claude Code | OpenCode 2 |
|---|---|---|
| Adaptador | hook `SessionStart`, `idd@1cf0792:.claude/hooks/session-start.sh`, y `UserPromptSubmit`, `idd@1cf0792:.claude/hooks/user-prompt-submit.sh` (registrados en `.claude/settings.json`) | plugin local sin dependencias, `idd@1cf0792:.opencode/plugins/session-bootstrap/server.js` y `tui.js` |
| `PATH` y `CLAUDE_PLUGIN_ROOT` | `CLAUDE_ENV_FILE` | hook `create.before` de cada comando de shell |
| Avisos | `systemMessage` del JSON del hook | toasts de la TUI, por el RPC del plugin |
| Guía y recordatorio | `additionalContext` de `SessionStart` y de `UserPromptSubmit` | hook `context` (ver [El hook context de OpenCode](../concepts/hook-context-opencode.md)) |

ADR-0002 recoge también que Claude Code no muestra lo que un hook `SessionStart` escribe por stderr cuando termina con éxito. Por eso los avisos de ADR-0001 no llegaban al usuario, y ahora van en `systemMessage`.

## Qué garantiza la spec

`idd@1cf0792:openspec/specs/session-bootstrap/spec.md`:

- **El CLI del proyecto**: el `openspec` de la versión de `package.json` tiene prioridad sobre uno global. Si el `PATH` no se puede ajustar, se avisa e indica cómo ejecutarlo. "Avisar" es mostrarlo en la interfaz del agente; dejarlo en un log no cuenta.
- **Las dependencias**: todas, las de la raíz y las de `acceptance-tests/`. Solo se reinstalan si cambian `package.json`, `package-lock.json` o el núcleo, y una instalación vale para los dos agentes.
- **Los requisitos**: sin npm o con un Node inferior al de `engines.node`, se avisa y no se instala nada. Un fallo de instalación avisa, no bloquea la sesión y se reintenta en la siguiente.
- **El motor del wiki**: se instala en la versión fijada, se sustituye si hay otra y no se versiona. Un fallo avisa con la instalación manual y se reintenta.
- **Guía y recordatorio**: los entrega el adaptador del arranque, nunca un archivo de instrucciones que el agente cargue siempre.

## Consecuencias que recogen los ADRs

- La primera sesión de cada clon tarda más. El arranque impone `npm install` en local, y el proyecto queda ligado a Node.js con npm y a bash (ADR-0001 y ADR-0002).
- En OpenCode, el primer comando de la primera sesión espera a la instalación. En OpenCode Desktop y en `opencode run`, sin TUI, los avisos solo quedan en el log (ADR-0002).
- Para desactivarlo todo en local: `disableAllHooks` en `.claude/settings.local.json`, o `"plugins": ["-session-bootstrap"]` en la configuración global de OpenCode. Solo el wiki: `PROJECT_WIKI=off` (`idd@f2be907:README.md`).

## See Also

- [Qué carga cada agente y cuándo](carga-en-la-misma-sesion-por-agente.md)
- [El hook context de OpenCode](../concepts/hook-context-opencode.md)
- [El flujo wiki-first](flujo-wiki-first.md)
- [La suite de aceptación y spec-as-source](suite-de-aceptacion-y-spec-as-source.md)
- [Una sola copia de las skills, vista por cada agente](../concepts/una-sola-copia-de-las-skills.md)

## Sources

- [Collection: repositorio de la plantilla intent-driven](../../raw/repos/2026-11-21-idd-1cf0792.md): `adr/0001-session-bootstrap-hook.md`, `adr/0002-agent-neutral-session-bootstrap.md`, `adr/0005-wiki-engine-through-session-bootstrap.md`, `openspec/specs/session-bootstrap/spec.md`, `.agents/hooks/session-bootstrap.sh`, `.claude/hooks/session-start.sh`, `.claude/hooks/user-prompt-submit.sh`, `.opencode/plugins/session-bootstrap/server.js`.
- [Collection: README de la plantilla tras el archivado](../../raw/repos/2026-11-21-idd-f2be907-readme.md): `README.md`.
