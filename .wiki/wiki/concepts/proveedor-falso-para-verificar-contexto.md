---
title: "Proveedor falso para verificar el contexto"
category: concept
sources:
  - raw/notes/2026-11-21-ll-wiki-en-dos-agentes.md
created: 2026-11-21
updated: 2026-11-21
tags: [opencode, testing, providers, verification]
confidence: high
volatility: warm
summary: "Para saber exactamente qué recibe el modelo en OpenCode sin claves de ningún proveedor, se configura un servidor local compatible con OpenAI que registra el cuerpo de cada petición."
---

# Proveedor falso para verificar el contexto

> Preguntarle al modelo si recibió algo es indirecto y depende de él. Interceptar la petición dice exactamente qué le llega: el system, los mensajes y las herramientas, entre ellas las skills listadas. En OpenCode basta un proveedor compatible con OpenAI apuntado a un servidor local ([lecciones](../../raw/notes/2026-11-21-ll-wiki-en-dos-agentes.md), lección 4).

## Cómo

1. Un servidor Node local que guarda el cuerpo de cada `POST /v1/chat/completions` y responde en SSE con un par de `chat.completion.chunk` y `data: [DONE]`.
2. Un proveedor `@ai-sdk/openai-compatible` con `baseURL: http://127.0.0.1:<puerto>/v1` y una `apiKey` cualquiera, en un `opencode.json` **fuera del repositorio** (el global de la prueba, con `XDG_CONFIG_HOME` aislado), para no dejar en el proyecto archivos de instrucciones ni configuración de prueba.
3. `opencode run --standalone "<mensaje>"` (con `-c` para seguir la sesión), o la TUI en `tmux` cuando importa que la sesión siga abierta (ver [Qué carga cada agente y cuándo](../topics/carga-en-la-misma-sesion-por-agente.md)).

## Qué se ve

- La primera petición es la del título, sin herramientas, y no pasa por el hook `context`.
- En la petición del agente, las skills van en la descripción de la herramienta `skill`, como `<skill><id>…</id>`.
- Al buscar texto con acentos en el cuerpo, `json.dumps` escapa los caracteres no ASCII (`Guía`): busca con `ensure_ascii=False` o sobre el texto ya decodificado.

## Límite

Comprueba qué recibe el modelo, no qué hace con ello. Para eso hace falta un modelo real, como en la tarea 8.3 de add-llm-wiki-support.

## See Also

- [El hook context de OpenCode](hook-context-opencode.md)
- [Qué carga cada agente y cuándo](../topics/carga-en-la-misma-sesion-por-agente.md)

## Sources

- [Lessons Learned: motor del wiki, guía y recordatorio en Claude Code y OpenCode 2](../../raw/notes/2026-11-21-ll-wiki-en-dos-agentes.md): lección 4.
