---
title: "Proveedor falso para verificar el contexto"
category: concept
sources:
  - raw/notes/2026-11-22-ll-pruebas-opencode-real-autopilot.md
  - raw/notes/2026-11-22-ll-archivado-autopilot-plan-explore.md
  - raw/repos/2026-11-22-idd-9eae630-autopilot-plan-explore.md
  - raw/notes/2026-11-21-ll-wiki-en-dos-agentes-2.md
  - raw/repos/2026-11-21-idd-1cf0792.md
  - raw/notes/2026-11-22-ll-modo-auto-instalar-opencode.md
created: 2026-11-21
updated: 2026-11-22
verified: 2026-11-22
tags: [opencode, testing, providers, verification]
confidence: high
volatility: warm
summary: "Para saber exactamente qué recibe el modelo en OpenCode sin claves de ningún proveedor, se configura un servidor local compatible con OpenAI que registra el cuerpo de cada petición."
---

# Proveedor falso para verificar el contexto

> Preguntarle al modelo si recibió algo es indirecto y depende de él. Interceptar la petición dice exactamente qué le llega. Todo lo de esta página está **[comprobado]** con OpenCode 2.3.2 el 2026-11-21 (lección 4 de [la nota de lecciones](../../raw/notes/2026-11-21-ll-wiki-en-dos-agentes-2.md); tareas 1.2 y 8.3 en `idd@1cf0792:openspec/changes/archive/2026-11-21-add-llm-wiki-support/tasks.md`).

## Cómo

1. Un servidor Node local que guarda el cuerpo de cada `POST /v1/chat/completions` y responde en SSE con un par de `chat.completion.chunk` y `data: [DONE]`.
2. Un proveedor `@ai-sdk/openai-compatible` con `baseURL: http://127.0.0.1:<puerto>/v1` y una `apiKey` cualquiera, en un `opencode.json` **fuera del repositorio** (el global de la prueba, con `XDG_CONFIG_HOME` aislado).
3. `opencode run --standalone "<mensaje>"` (con `-c` para seguir la sesión), o la TUI en `tmux` cuando importa que la sesión siga abierta (ver [[carga-en-la-misma-sesion-por-agente|Qué carga cada agente y cuándo]] ([Qué carga cada agente y cuándo](../topics/carga-en-la-misma-sesion-por-agente.md))).
4. Para probar herramientas, el proveedor puede responder con la llamada que indique el propio mensaje (`@@TOOL <nombre> <json>`), y un plugin sonda puede ejecutar cualquier API del plugin y registrarla ([lección 9](../../raw/notes/2026-11-21-ll-sesiones-opencode-autopilot.md)).
5. Para guionizar la TUI sin tmux, se ejecuta `--standalone` en un pseudoterminal de Python y se le mandan las secuencias reales de cada atajo: el agente se cambia con Shift+Tab, que es `ESC [ Z` (`\x1b[Z`), no `\t`. Para no usar el servicio de fondo del usuario, la TUI y `opencode run -s <sesión>` se conectan con `--server` a un `opencode serve` propio, con un puerto fijo y `OPENCODE_SERVER_PASSWORD` en el entorno. Para probar mensajes a mitad de turno, el proveedor tarda cuando el mensaje lo pide; una recarga en caliente se provoca editando `tui.js` de la copia ([lecciones del archivado de autopilot-plan-explore](../../raw/notes/2026-11-22-ll-archivado-autopilot-plan-explore.md), lección 2; `idd@9eae630:openspec/changes/archive/2026-11-22-autopilot-plan-explore/tasks.md`, tasks 1.3, 1.4 y 7.2).
- En una sesión de Claude Code en la nube, el modo auto puede bloquear la instalación de `@opencode/cli` del paso 1 del banco. Hay que aprobarla a mano o permitirla antes con reglas `allow` estrechas, sin comprobar que basten ([lección del 2026-11-22](../../raw/notes/2026-11-22-ll-modo-auto-instalar-opencode.md)).

- OpenCode 2 se instala con `npm install @opencode/cli@<versión>`, no con `opencode-ai`, que es la serie 1 ([lección 1 de las pruebas en OpenCode real](../../raw/notes/2026-11-22-ll-pruebas-opencode-real-autopilot.md)).
- Para leer los resultados: la metadata de las sesiones está en `$XDG_DATA_HOME/opencode/opencode.db` (tabla `session_v2`, en solo lectura); la web pide la conexión en su propia pantalla («Use password»), y `opencode api --server <url> POST /api/session/<id>/prompt` la maneja sin navegador. En el modo auto, `tmux kill-server` se bloquea como destructivo; y conviene un directorio XDG nuevo por banco ([lección 7](../../raw/notes/2026-11-22-ll-pruebas-opencode-real-autopilot.md)).

## Qué se ve

- La primera petición es la del título, sin herramientas, y no pasa por el hook `context`.
- En la petición del agente, las skills van en la descripción de la herramienta `skill`, como `<skill><id>…</id>`.
- Buscar texto con acentos sobre `json.dumps(cuerpo)` da falsos negativos, porque escapa los caracteres no ASCII (`Guía`). Usa `ensure_ascii=False`.

## Límite

Comprueba qué recibe el modelo, no qué hace con ello. Para eso hace falta un modelo real, como en la tarea 8.3 del change.

## See Also

- [[hook-context-opencode|El hook context de OpenCode]] ([El hook context de OpenCode](hook-context-opencode.md))
- [[carga-en-la-misma-sesion-por-agente|Qué carga cada agente y cuándo]] ([Qué carga cada agente y cuándo](../topics/carga-en-la-misma-sesion-por-agente.md))
- [[suite-de-aceptacion-y-spec-as-source|La suite de aceptación y spec-as-source]] ([La suite de aceptación y spec-as-source](../topics/suite-de-aceptacion-y-spec-as-source.md))

## Sources

- [Lessons Learned: el archivado de autopilot-plan-explore](../../raw/notes/2026-11-22-ll-archivado-autopilot-plan-explore.md): lección 2.
- [Collection: archivado de autopilot-plan-explore (idd@9eae630)](../../raw/repos/2026-11-22-idd-9eae630-autopilot-plan-explore.md): `tasks.md` del change archivado.
- [Lessons Learned](../../raw/notes/2026-11-21-ll-wiki-en-dos-agentes-2.md): lección 4.
- [Collection: repositorio de la plantilla intent-driven](../../raw/repos/2026-11-21-idd-1cf0792.md): `tasks.md` del change archivado.
- [Lessons Learned](../../raw/notes/2026-11-22-ll-modo-auto-instalar-opencode.md): el modo auto y la instalación de OpenCode.
- [Lessons Learned: pruebas de autopilot-rama-por-sesion en OpenCode 2.3.2 real](../../raw/notes/2026-11-22-ll-pruebas-opencode-real-autopilot.md): lecciones 1 y 7.
