---
title: "El hook context de OpenCode"
category: concept
sources:
  - raw/notes/2026-11-21-ll-wiki-en-dos-agentes.md
  - raw/repos/2026-11-21-idd-1cf0792.md
created: 2026-11-21
updated: 2026-11-21
tags: [opencode, plugins, context, session-bootstrap]
confidence: high
volatility: warm
summary: "Contrato del hook context de OpenCode 2.3.2: se ejecuta antes de cada petición al modelo, permite cambiar system y messages sin guardarlo, y una excepción sin capturar hace fallar la petición."
---

# El hook context de OpenCode

> Un plugin de OpenCode 2 registra `ctx.session.hook("context", cb)`. El callback se ejecuta antes de **cada** petición al modelo y puede cambiar lo que el modelo recibe, sin que el cambio quede guardado en la sesión. Comprobado con OpenCode 2.3.2 el 2026-11-21 ([lecciones](../../raw/notes/2026-11-21-ll-wiki-en-dos-agentes.md), lección 3).

## Contrato

- **Entrada:** `input.system` (partes `{type: "text", text}`) e `input.messages` (mensajes con `role` y `content`), que se pueden cambiar en el sitio. También trae `agent`, `model`, `options` y `tools`.
- **Efímero:** lo que se añade no se guarda. Con varios mensajes en la misma sesión (`opencode run -c`), cada petición lleva una sola copia de lo añadido: no se acumula.
- **Objetos planos:** un plugin sin dependencias puede insertar `{role: "user", content: [{type: "text", text}]}` sin importar `@opencode/ai`.
- **Fallo:** si el callback lanza una excepción sin capturar, la petición falla. `opencode run` termina con 1 y el modelo no recibe nada.
- **No todas las peticiones pasan por él.** La de generar el título de la sesión no; la compactación y `generate` tienen sus propios hooks.

## Cómo lo usa la plantilla

El plugin `session-bootstrap` (`idd@1cf0792:.opencode/plugins/session-bootstrap/server.js`) añade la guía del wiki a `system` e inserta el recordatorio como mensaje `user` justo antes del último mensaje del usuario, como hace el modo Plan de OpenCode. Todo el callback va en `try/catch`: si el recordatorio no se puede generar o los mensajes no se dejan cambiar, la petición sale sin él y el mensaje del usuario llega igual.

Alternativas descartadas en el design del change: el hook `prompt`, que cambiaría el texto guardado del mensaje, e `instructions.entry.put`, una API experimental marcada para retirarse.

## Riesgo

Es una API de plugins de una versión concreta. La suite la simula (`idd@1cf0792:acceptance-tests/support/agents/opencode-host.mjs`), así que no detectaría un cambio real: ver [el registro de vigilancia](../../inventory/candidates/volver-a-comprobar-hook-context-al-subir-opencode.md).

## See Also

- [Qué carga cada agente y cuándo](../topics/carga-en-la-misma-sesion-por-agente.md)
- [Proveedor falso para verificar el contexto](proveedor-falso-para-verificar-contexto.md)

## Sources

- [Lessons Learned: motor del wiki, guía y recordatorio en Claude Code y OpenCode 2](../../raw/notes/2026-11-21-ll-wiki-en-dos-agentes.md): lección 3.
- [Collection: repositorio de la plantilla intent-driven](../../raw/repos/2026-11-21-idd-1cf0792.md): `idd@1cf0792:.opencode/plugins/session-bootstrap/server.js`, `idd@1cf0792:acceptance-tests/support/agents/opencode-host.mjs`.
