---
title: "Lessons Learned: motor del wiki, guía y recordatorio en Claude Code y OpenCode 2"
type: notes
source: session
ingested: 2026-11-21
tags: [lessons-learned, claude-code, opencode, session-bootstrap, llm-wiki]
lesson_kind: lessons-learned
lesson_count: 5
category: notes
confidence: high
summary: "Lo comprobado al implementar add-llm-wiki-support: qué carga cada agente en la misma sesión, el contrato real del hook context de OpenCode, cómo ver lo que recibe el modelo sin proveedor y por qué opencode run interrumpe el arranque."
---

# Lessons Learned: motor del wiki, guía y recordatorio en Claude Code y OpenCode 2

> Extraído de la sesión del 2026-11-21 (change add-llm-wiki-support, archivado en idd@1cf0792). 5 lecciones, comprobadas con Claude Code 2.1.330 y OpenCode 2.3.2.

## Lección 1: En Claude Code, lo que se expone por rutas del proyecto carga en la misma sesión; un plugin no

**Category**: discovery
**Context**: Hacer disponible nvk/llm-wiki en la primera sesión, también en la nube, donde cada sesión empieza en un contenedor nuevo.
**Symptom**: Un plugin instalado con `claude plugin install` desde el hook `SessionStart` solo aparece en la sesión siguiente.
**Root cause**: Claude Code carga los plugins antes de ejecutar `SessionStart`, pero lee `.claude/skills/` y `.claude/commands/` después.
**Fix**: Symlinks desde `.claude/skills/wiki-manager` y `.claude/commands/wiki` al motor descargado. El evento `init` de `claude -p --output-format stream-json --verbose` ya trae la skill y los 28 comandos `wiki:*`, y `commands/<ns>/<cmd>.md` se invoca como `/<ns>:<cmd>`.
**Rule**: Para que algo externo esté disponible en la primera sesión de Claude Code, exponlo por las rutas de skills y comandos del proyecto, no como plugin.

## Lección 2: `CLAUDE_ENV_FILE` llega al Bash del modelo, pero `` !`…` `` no admite `${VAR}`

**Category**: gotcha
**Context**: Que los comandos del motor encuentren su helper con `${CLAUDE_PLUGIN_ROOT}/bin/llm-wiki` fuera de un plugin.
**Symptom**: Un `` !`echo "${CLAUDE_PLUGIN_ROOT:-unset}"` `` en un comando falla con "A variable in braces in this command can't be checked before it runs".
**Root cause**: La comprobación de permisos de la preejecución rechaza las variables entre llaves. Los comandos del motor no la usan: piden al modelo que ejecute el helper con Bash.
**Fix**: Exportar `CLAUDE_PLUGIN_ROOT` por `CLAUDE_ENV_FILE` en `SessionStart`. El Bash del modelo lo ve, también desde un comando puesto por symlink.
**Rule**: Para pasar variables a los comandos de una sesión de Claude Code, usa `CLAUDE_ENV_FILE` y no dependas de `${…}` en `` !`…` ``.

## Lección 3: El contrato real del hook `context` de OpenCode 2.3.2

**Category**: discovery
**Context**: Entregar la guía y un recordatorio por mensaje en OpenCode sin `AGENTS.md` ni `instructions`.
**Root cause**: `ctx.session.hook("context", cb)` se ejecuta antes de cada petición al modelo. `cb` recibe `system` (partes `{type:"text", text}`) y `messages`, que se pueden cambiar. Lo que añade no se guarda en la sesión.
**Fix**: La guía va con `input.system.push(...)`, y el recordatorio con `messages.splice(posición del último user, 0, {role:"user", content:[{type:"text", text}]})`, como el modo Plan. Los objetos planos valen, sin `@opencode/ai`. Con `-c` en el segundo y el tercer mensaje hay una sola copia por petición.
**Symptom (en el caso de fallo)**: Una excepción sin capturar en el hook hace fallar la petición: `opencode run` termina con 1 y el modelo no recibe nada.
**Rule**: En OpenCode, añade contexto efímero con el hook `context`, insértalo como mensaje `user` antes del último, y envuelve todo el hook en `try/catch`.

## Lección 4: Para ver lo que recibe el modelo sin proveedor, basta un servidor falso compatible con OpenAI

**Category**: pattern
**Context**: Comprobar en OpenCode real la guía, el recordatorio y las skills listadas sin claves de ningún proveedor.
**Fix**: Un servidor Node local que registra cada cuerpo y responde en SSE `chat.completion.chunk`, configurado como proveedor `@ai-sdk/openai-compatible` (`baseURL: http://127.0.0.1:<puerto>/v1`) en un `opencode.json` fuera del repositorio. Las skills aparecen en la herramienta `skill` como `<skill><id>…</id>`. La petición de título no pasa por el hook `context`.
**Gotcha**: Al buscar texto con acentos en el cuerpo, `json.dumps` escapa los caracteres no ASCII (`Guía`). Busca con `ensure_ascii=False`.
**Rule**: Para verificar qué contexto llega a un modelo, intercepta la petición con un proveedor falso en lugar de preguntarle al modelo.

## Lección 5: `opencode run` mata el trabajo de fondo del plugin; la TUI no

**Category**: gotcha
**Context**: Prueba de la tarea 8.3 en un clon recién creado.
**Symptom**: Tras `opencode run` no había symlinks del motor y quedaba `.agents/wiki-engine.tmp.<pid>`.
**Root cause**: `opencode run` termina al responder el modelo y mata el núcleo del arranque, que se ejecuta en segundo plano, a medio `git clone`. En la TUI la sesión sigue abierta, el motor queda instalado en unos 16 s y las skills aparecen en esa misma sesión.
**Fix**: El núcleo borra los `.tmp.*` y `.old.*` cuyo PID ya no existe (`kill -0`).
**Rule**: El trabajo de fondo de un plugin de OpenCode puede morir a medias: hazlo atómico, con un temporal y un renombrado, y que limpie los restos de ejecuciones anteriores.
