---
title: "Lessons Learned: APIs de sesión de OpenCode 2.3.2 para orquestar un change"
type: notes
source: session
ingested: 2026-11-21
tags: [lessons-learned, opencode, plugins, sessions, tui, openspec]
lesson_kind: lessons-learned
lesson_count: 9
category: notes
confidence: high
summary: "Pruebas P1-P13 del change add-openspec-autopilot: archivar, metadata, tools del plugin, recarga en caliente, opciones, encadenar sesiones desde idle, interrupción, compactación, varias TUIs y claves x-* de OpenSpec."
---

# Lessons Learned: APIs de sesión de OpenCode 2.3.2 para orquestar un change

> Sesión del 2026-11-21 (explore y pruebas de add-openspec-autopilot), con OpenCode 2.3.2 y OpenSpec 1.17.0. Mismas etiquetas de evidencia que [la nota anterior](2026-11-21-ll-wiki-en-dos-agentes-2.md). Salvo que se indique otra cosa, todo es **[comprobado]** en la TUI (`--standalone`, en tmux) con el proveedor falso; el banco de pruebas se describe en la lección 9 y no quedó en el repositorio.

## Lección 1: El ctx.session.update del plugin ignora `archived`; se archiva desde la parte de TUI

**Category**: gotcha
**Context**: Archivar la sesión que termina su paso (prueba P1 del change).
**Symptom**: `ctx.session.update({ sessionID, archived: true })` desde el servidor del plugin devuelve sin error, pero no hay evento `session.archived`, `time.archived` no aparece y `time.updated` no cambia. Con `title` en la misma llamada, el título sí cambia.
**Root cause**: El dominio de sesión del plugin no aplica `archived`, aunque `SessionUpdateInput` lo declare. Por la API HTTP (`opencode api session.update -d '{"archived":true}'`) y por el cliente de la TUI (`context.client.session.update`) sí archiva.
**Fix**: Archivar desde `tui.js` con `context.client.session.update({ sessionID, archived: true })`, pedido desde el servidor por RPC.
**Rule**: En OpenCode 2.3.2, una operación del plugin que no da error no prueba nada: hay que leer la sesión después (`get`). El archivado solo funciona con el cliente de la TUI o con la API HTTP.

Además, también [comprobado]: `list()` sin filtro incluye las archivadas (con `time.archived`), y `archived: true/false` filtra bien. La TUI oculta las archivadas en su lista de sesiones, que no tiene acción de archivar (solo borrar y renombrar). Una sesión archivada con el foco sigue aceptando mensajes y trabajando. La TUI restaura sus pestañas tras reiniciar.

## Lección 2: `session.update({ metadata })` sustituye la metadata entera, y persiste

**Category**: gotcha
**Context**: Guardar el estado del change en la metadata de las sesiones (P2).
**Symptom**: Tras `update({ metadata: { b: 2 } })` sobre `{ openspec: {...}, a: 1 }`, `get` devuelve solo `{ b: 2 }`.
**Root cause**: `update` reemplaza el objeto; no fusiona.
**Fix**: Leer con `get`, combinar y escribir el objeto completo.
**Rule**: La metadata de sesión se escribe siempre entera (leer, combinar y escribir). Sobrevive a reiniciar OpenCode, igual que el archivado.

## Lección 3: Las tools de un plugin solo existen en Code Mode salvo `options: { codemode: false }`

**Category**: gotcha
**Context**: Registrar una tool para que el modelo la llame (P11).
**Symptom**: La tool registrada con `ctx.tool.transform(ed => ed.add({...}))` no aparece en la lista de tools de la petición, y el modelo recibe: `No tool named "probe_do" is currently available`.
**Root cause**: Por defecto, una tool de plugin solo es accesible desde dentro de la tool `execute` (Code Mode).
**Fix**: Añadir `options: { codemode: false }` a la definición. Aparece en la lista y el modelo la llama directamente.
**Rule**: Una tool de plugin de OpenCode 2.3.2 que el modelo debe llamar directamente se declara con `options: { codemode: false }`. Que un modelo real decida llamarla cuando se lo pide un prompt no se ha comprobado (solo con el proveedor falso).

## Lección 4: Los plugins locales se recargan en caliente, también al cambiar sus `options` en la configuración

**Category**: correction
**Context**: Decidir si el modo auto puede ser una opción del plugin (P13). Se afirmó, a partir de los tipos, que cambiar `options` exigiría reiniciar; el usuario lo puso en duda y la prueba le dio la razón.
**Symptom**: (ninguno; la suposición era falsa)
**Root cause**: OpenCode vigila los archivos del plugin y la configuración. Al editar `server.js` o `tui.js`, o al cambiar `plugins[].options` en la configuración del usuario (evento `config.updated`), vuelve a ejecutar `setup` en el mismo proceso, ya con las opciones nuevas.
**Fix**: Una entrada `{ "package": "<ruta a .opencode/plugins/<id>>", "options": {...} }` en `plugins` de la configuración del usuario da `ctx.options` al plugin local, sin cargarlo dos veces.
**Rule**: No afirmes cómo se comporta OpenCode en ejecución a partir de sus tipos: etiquétalo como lectura de tipos y compruébalo. Las opciones de un plugin local pueden ser una preferencia de cada usuario y cambiar sin reiniciar.

## Lección 5: Tras una recarga en caliente siguen vivos los escuchadores RPC de la TUI anteriores

**Category**: gotcha
**Context**: Pedir a la parte de TUI que navegue o muestre un diálogo (P3).
**Symptom**: Cada comando enviado por RPC llega N veces a `tui.js`, una por cada recarga previa. Una instancia vieja seguía usando la ruta `context.router` y fallaba. Al abrir un `dialog.select`, una instancia vieja abrió el suyo, el diálogo nuevo lo cerró y esa instancia respondió `undefined` antes de que el usuario eligiera.
**Root cause**: La recarga no da de baja `client.events.on(...)` de la instancia anterior.
**Fix**: (para el diseño) Identificar cada petición y responderla una sola vez; ignorar respuestas duplicadas o de una instancia que ya no está.
**Rule**: En un plugin de OpenCode 2.3.2, todo lo que se maneja por eventos RPC en la TUI debe ser idempotente y llevar identificador, porque cada recarga deja vivo el escuchador anterior.

## Lección 6: Cómo se encadenan, interrumpen y observan las sesiones desde un plugin

**Category**: discovery
**Context**: Pasar de un paso del change al siguiente sin el usuario (P3, P4, P6, P8).
**Rule**: En OpenCode 2.3.2, la cadena completa se puede hacer desde `experimental.idle`, y el estado de cualquier sesión se lee con `get`:
- `session.create({ title, agent, metadata })` crea la sesión con ese agente y esa metadata; `session.prompt` sobre otra sesión la pone a trabajar enseguida, en paralelo a la que llama.
- `session.command({ sessionID, name, text })` ejecuta la plantilla de un comando, y `prompt({ text, skills: [{ id }] })` inyecta el contenido de la skill, ambos sin que nadie escriba.
- En `experimental.idle`, `synthetic` mantiene viva la misma ejecución (el modelo lo recibe como mensaje del usuario e `idle` vuelve a saltar), y crear + `prompt` + navegar + archivar la anterior funciona en menos de 200 ms.
- En la TUI, la navegación es `context.ui.router.navigate({ type: "session", sessionID })` (no `context.router`), y abre la sesión en una pestaña. `ui.dialog.select` devuelve el valor elegido, o `undefined` con Esc.
- Tras una interrupción (Esc dos veces, o `ctx.session.interrupt`) no se ejecuta `idle`: llega `session.execution.interrupted` y la sesión queda con `outcome: "interrupted"`. Tras una compactación manual tampoco.
- El hook `compaction` se ejecuta, y si pone `input.result = { summary }` evita la petición al modelo. Llegan `session.compaction.started` y `.ended` (o `.failed`).
- `ctx.session` no tiene `active()`, pero `get` da `time.busy` y `time.idle`: una sesión trabaja si `busy` es posterior a `idle` o si no hay `idle`.

## Lección 7: Varias TUIs, y cuándo existe una sesión

**Category**: discovery
**Context**: Control del change con más de una TUI abierta y al abrir sesiones (P5, P9).
**Rule**: Cada TUI `--standalone` es una instancia propia del plugin (otro PID) y solo recibe los eventos de sus sesiones. La base de datos (sesiones, metadata, `time.busy`) y `ctx.storage` se comparten, pero `ctx.storage` no tiene ninguna operación atómica. Una sesión de la TUI no existe hasta el primer mensaje, y se crea con el agente elegido en ese momento. Al abrir, la TUI no retoma la última sesión: empieza en una pestaña nueva, restaura las pestañas abiertas (también las de sesiones archivadas) y vuelve al agente build aunque el último fuera plan.

## Lección 8: OpenSpec 1.17.0 acepta claves `x-*`, y su verify no es un comando

**Category**: discovery
**Context**: Configurar el plugin desde OpenSpec y detectar el resultado del verify.
**Rule**: OpenSpec 1.17.0 acepta claves `x-*` sin avisos en `openspec/config.yaml` y en el `.openspec.yaml` de un change (`list`, `status`, `instructions`, `validate`, `doctor`, `new change`), y el propio OpenSpec usa `.openspec.yaml` para opciones por change (`skip_specs`). No existe `openspec verify`: el verify es la skill `openspec-verify-change`, que termina en un informe en Markdown con problemas CRITICAL, WARNING o SUGGESTION, sin código de salida que leer.

## Lección 9: Banco de pruebas reproducible para plugins de OpenCode

**Category**: pattern
**Context**: Comprobar APIs de plugin sin claves y sin tocar el repositorio.
**Rule**: Un banco fuera del repositorio permite comprobar cualquier API de plugin de forma determinista:
1. Instalar `@opencode/cli@2.3.2` con npm en una carpeta aparte, con `XDG_CONFIG_HOME`, `XDG_DATA_HOME`, `XDG_STATE_HOME` y `XDG_CACHE_HOME` aislados.
2. Un proveedor falso compatible con OpenAI que, si el último mensaje del usuario contiene `@@TOOL <nombre> <json>`, responde con esa llamada a herramienta, y con `@@SLOW <s>`, tarda.
3. Un proyecto de prueba con un plugin sonda cuya tool (`codemode: false`) ejecuta cualquier `ctx.<dominio>.<método>(args)`, reenvía órdenes a la TUI por RPC y lo registra todo (con PID) en un log.
4. La TUI `--standalone` en tmux, manejada con `send-keys`.

`opencode serve` exige contraseña: `opencode api` la toma de `OPENCODE_PASSWORD`. La configuración de proveedor al estilo v1 (`provider.<id>.npm = "@ai-sdk/openai-compatible"`) sigue funcionando en 2.3.2.
