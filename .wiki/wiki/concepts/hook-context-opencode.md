---
title: "El hook context de OpenCode"
category: concept
sources:
  - raw/repos/2026-11-22-idd-9eae630-autopilot-plan-explore.md
  - raw/notes/2026-11-21-ll-wiki-en-dos-agentes-2.md
  - raw/repos/2026-11-21-idd-1cf0792.md
  - raw/repos/2026-11-21-idd-16e4617-add-quote-comment-rule.md
created: 2026-11-21
updated: 2026-11-22
verified: 2026-11-22
tags: [opencode, plugins, context, session-bootstrap]
confidence: high
volatility: warm
summary: "Contrato del hook context de OpenCode 2.3.2, comprobado capturando los cuerpos de las peticiones: cambia system y messages sin guardarlo, no se acumula, y una excepción sin capturar impide la petición."
---

# El hook context de OpenCode

> Un plugin de OpenCode 2 registra `ctx.session.hook("context", cb)` para cambiar lo que recibe el modelo en cada petición. Lo comprobado se vio en los cuerpos de las peticiones, capturados con un [[proveedor-falso-para-verificar-contexto|proveedor falso]] ([proveedor falso](proveedor-falso-para-verificar-contexto.md)) (OpenCode 2.3.2, 2026-11-21; lección 3 de [la nota de lecciones](../../raw/notes/2026-11-21-ll-wiki-en-dos-agentes-2.md), tarea 1.2 en `idd@1cf0792:openspec/changes/archive/2026-11-21-add-llm-wiki-support/tasks.md`).

## Contrato

- **[comprobado]** `input.system` (partes `{type: "text", text}`) e `input.messages` se pueden cambiar en el sitio, y el modelo recibe el cambio. Valen los objetos planos: `{role: "user", content: [{type: "text", text}]}`, sin importar `@opencode/ai`.
- **[comprobado]** Lo añadido no se acumula: con `opencode run -c` en el segundo y el tercer mensaje, cada petición lleva una sola copia.
- **[comprobado]** Si el callback lanza una excepción sin capturar, `opencode run` termina con 1 y no se hace la petición del agente. Si la captura, la petición sale sin lo añadido y el modelo responde.
- **[comprobado]** La entrada trae también `agent` (`"build"` o `"plan"`), que cambia con Shift+Tab de un mensaje al siguiente y es el mismo en todas las peticiones de un turno. Cada mensaje guardado de `input.messages` lleva su `id`, que es el `messageID` del hook `prompt` en los del usuario; los resultados de tool no llevan. En plan, OpenCode añade su recordatorio como mensaje `user` (OpenCode 2.3.2, 2026-11-22; `idd@9eae630:openspec/changes/archive/2026-11-22-autopilot-plan-explore/tasks.md`, tasks 1.1 y 1.4).
- **[comprobado]** La petición del título de la sesión no pasa por este hook.
- **[lectura de código]** Según los tipos `SessionHooks` de `@opencode/plugin` 2.3.2, la compactación y `generate` tienen sus propios hooks. No se ha comprobado si pasan también por `context`.

## Cómo lo usa la plantilla

El plugin `session-bootstrap` (`idd@1cf0792:.opencode/plugins/session-bootstrap/server.js`) añade la guía del wiki a `system` e inserta el recordatorio como mensaje `user` justo antes del último mensaje del usuario. **[lectura de código]** El modo Plan de OpenCode hace lo mismo, según su código en el binario de `@opencode/cli` 2.3.2. Todo el callback va en `try/catch`. Desde `add-quote-comment-rule` añade también la regla de comentarios a `system` y, si el último mensaje del usuario la activa, su recordatorio junto al del wiki. Como el hook se ejecuta en cada petición al modelo, también en las que siguen a una herramienta dentro del mismo turno, solo pregunta al núcleo cuando cambia el texto de ese mensaje, y guarda la respuesta (`idd@16e4617:.opencode/plugins/session-bootstrap/server.js`, `lastUserText`).

**[heredado]** El design del change descartó el hook `prompt`, que cambiaría el texto guardado del mensaje, e `instructions.entry.put`, una API experimental marcada para retirarse (`idd@1cf0792:openspec/changes/archive/2026-11-21-add-llm-wiki-support/design.md`, D3).

## Riesgo

Es una API de plugins de una versión concreta. La suite la simula (`idd@1cf0792:acceptance-tests/support/agents/opencode-host.mjs`), así que no detectaría un cambio real: ver [el registro de vigilancia](../../inventory/candidates/volver-a-comprobar-hook-context-al-subir-opencode.md).

## See Also

- [[carga-en-la-misma-sesion-por-agente|Qué carga cada agente y cuándo]] ([Qué carga cada agente y cuándo](../topics/carga-en-la-misma-sesion-por-agente.md))
- [[proveedor-falso-para-verificar-contexto|Proveedor falso para verificar el contexto]] ([Proveedor falso para verificar el contexto](proveedor-falso-para-verificar-contexto.md))
- [[arranque-de-sesion|El arranque de sesión]] ([El arranque de sesión](../topics/arranque-de-sesion.md))
- [[suite-de-aceptacion-y-spec-as-source|La suite de aceptación y spec-as-source]] ([La suite de aceptación y spec-as-source](../topics/suite-de-aceptacion-y-spec-as-source.md))

## Sources

- [Collection: archivado de autopilot-plan-explore (idd@9eae630)](../../raw/repos/2026-11-22-idd-9eae630-autopilot-plan-explore.md): `openspec/changes/archive/2026-11-22-autopilot-plan-explore/tasks.md`.
- [Lessons Learned](../../raw/notes/2026-11-21-ll-wiki-en-dos-agentes-2.md): lección 3.
- [Collection: repositorio de la plantilla intent-driven](../../raw/repos/2026-11-21-idd-1cf0792.md): `server.js`, `opencode-host.mjs`, y `tasks.md` y `design.md` del change archivado.
- [Collection: archivado de add-quote-comment-rule](../../raw/repos/2026-11-21-idd-16e4617-add-quote-comment-rule.md): `server.js`.
