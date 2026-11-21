---
title: "Proveedor falso para verificar el contexto"
category: concept
sources:
  - raw/notes/2026-11-21-ll-wiki-en-dos-agentes-2.md
  - raw/repos/2026-11-21-idd-1cf0792.md
created: 2026-11-21
updated: 2026-11-21
verified: 2026-11-21
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
3. `opencode run --standalone "<mensaje>"` (con `-c` para seguir la sesión), o la TUI en `tmux` cuando importa que la sesión siga abierta (ver [Qué carga cada agente y cuándo](../topics/carga-en-la-misma-sesion-por-agente.md)).
4. Para probar herramientas, el proveedor puede responder con la llamada que indique el propio mensaje (`@@TOOL <nombre> <json>`), y un plugin sonda puede ejecutar cualquier API del plugin y registrarla ([lección 9](../../raw/notes/2026-11-21-ll-sesiones-opencode-autopilot.md)).

## Qué se ve

- La primera petición es la del título, sin herramientas, y no pasa por el hook `context`.
- En la petición del agente, las skills van en la descripción de la herramienta `skill`, como `<skill><id>…</id>`.
- Buscar texto con acentos sobre `json.dumps(cuerpo)` da falsos negativos, porque escapa los caracteres no ASCII (`Guía`). Usa `ensure_ascii=False`.

## Límite

Comprueba qué recibe el modelo, no qué hace con ello. Para eso hace falta un modelo real, como en la tarea 8.3 del change.

## See Also

- [El hook context de OpenCode](hook-context-opencode.md)
- [Qué carga cada agente y cuándo](../topics/carga-en-la-misma-sesion-por-agente.md)
- [La suite de aceptación y spec-as-source](../topics/suite-de-aceptacion-y-spec-as-source.md)

## Sources

- [Lessons Learned](../../raw/notes/2026-11-21-ll-wiki-en-dos-agentes-2.md): lección 4.
- [Collection: repositorio de la plantilla intent-driven](../../raw/repos/2026-11-21-idd-1cf0792.md): `tasks.md` del change archivado.
