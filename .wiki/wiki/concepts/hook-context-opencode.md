---
title: "El hook context de OpenCode"
category: concept
sources:
  - raw/notes/2026-11-21-ll-wiki-en-dos-agentes-2.md
  - raw/notes/2026-11-21-ll-wiki-en-dos-agentes.md
  - raw/repos/2026-11-21-idd-1cf0792.md
created: 2026-11-21
updated: 2026-11-21
tags: [opencode, plugins, context, session-bootstrap]
confidence: high
volatility: warm
summary: "Contrato del hook context de OpenCode 2.3.2, comprobado capturando los cuerpos de las peticiones: cambia system y messages sin guardarlo, no se acumula, y una excepción sin capturar impide la petición."
---

# El hook context de OpenCode

> Un plugin de OpenCode 2 registra `ctx.session.hook("context", cb)` para cambiar lo que recibe el modelo en cada petición. Lo comprobado se vio en los cuerpos de las peticiones, capturados con un [proveedor falso](proveedor-falso-para-verificar-contexto.md) (OpenCode 2.3.2, 2026-11-21; lección 3 de [la nota revisada](../../raw/notes/2026-11-21-ll-wiki-en-dos-agentes-2.md), tarea 1.2 en `idd@1cf0792:openspec/changes/archive/2026-11-21-add-llm-wiki-support/tasks.md`).

## Contrato

- **[comprobado]** `input.system` (partes `{type: "text", text}`) e `input.messages` se pueden cambiar en el sitio, y el modelo recibe el cambio. Valen los objetos planos: `{role: "user", content: [{type: "text", text}]}`, sin importar `@opencode/ai`.
- **[comprobado]** Lo añadido no se acumula: con `opencode run -c` en el segundo y el tercer mensaje, cada petición lleva una sola copia.
- **[comprobado]** Si el callback lanza una excepción sin capturar, `opencode run` termina con 1 y no se hace la petición del agente. Si la captura, la petición sale sin lo añadido y el modelo responde.
- **[comprobado]** La petición del título de la sesión no pasa por este hook.
- **[lectura de código]** Según los tipos `SessionHooks` de `@opencode/plugin` 2.3.2, la compactación y `generate` tienen sus propios hooks. No se ha comprobado si pasan también por `context`.

## Cómo lo usa la plantilla

El plugin `session-bootstrap` (`idd@1cf0792:.opencode/plugins/session-bootstrap/server.js`) añade la guía del wiki a `system` e inserta el recordatorio como mensaje `user` justo antes del último mensaje del usuario. **[lectura de código]** El modo Plan de OpenCode hace lo mismo, según su código en el binario de `@opencode/cli` 2.3.2. Todo el callback va en `try/catch`.

**[heredado]** El design del change descartó el hook `prompt`, que cambiaría el texto guardado del mensaje, e `instructions.entry.put`, una API experimental marcada para retirarse (`idd@1cf0792:openspec/changes/archive/2026-11-21-add-llm-wiki-support/design.md`, D3).

## Riesgo

Es una API de plugins de una versión concreta. La suite la simula (`idd@1cf0792:acceptance-tests/support/agents/opencode-host.mjs`), así que no detectaría un cambio real: ver [el registro de vigilancia](../../inventory/candidates/volver-a-comprobar-hook-context-al-subir-opencode.md).

## See Also

- [Qué carga cada agente y cuándo](../topics/carga-en-la-misma-sesion-por-agente.md)
- [Proveedor falso para verificar el contexto](proveedor-falso-para-verificar-contexto.md)

## Sources

- [Lessons Learned (revisada)](../../raw/notes/2026-11-21-ll-wiki-en-dos-agentes-2.md): lección 3.
- [Lessons Learned (sustituida)](../../raw/notes/2026-11-21-ll-wiki-en-dos-agentes.md): solo como linaje.
- [Collection: repositorio de la plantilla intent-driven](../../raw/repos/2026-11-21-idd-1cf0792.md): `server.js`, `opencode-host.mjs`, y `tasks.md` y `design.md` del change archivado.
