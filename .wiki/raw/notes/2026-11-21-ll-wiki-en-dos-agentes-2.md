---
title: "Lessons Learned: motor del wiki, guía y recordatorio en Claude Code y OpenCode 2"
type: notes
source: session
ingested: 2026-11-21
tags: [lessons-learned, claude-code, opencode, session-bootstrap, llm-wiki]
lesson_kind: lessons-learned
lesson_count: 5
category: notes
confidence: medium-high
summary: "Lecciones de add-llm-wiki-support con la evidencia de cada afirmación: qué se comprobó ejecutando, qué se hereda del design o de leer código, y qué es inferencia; incluye la comprobación del plugin instalado desde SessionStart."
---

# Lessons Learned: motor del wiki, guía y recordatorio en Claude Code y OpenCode 2

> Sesión del 2026-11-21, con Claude Code 2.1.330 y OpenCode 2.3.2.

Cada afirmación lleva su tipo de evidencia:

- **[comprobado]**: ejecutado en esta sesión, con la salida a la vista. Se cita dónde quedó anotado; si no quedó en el repositorio, se dan aquí los pasos para repetirlo.
- **[heredado]**: tomado de un documento del proyecto que lo da por comprobado, sin repetirlo aquí.
- **[lectura de código]**: leído en el código o en los tipos, no observado en ejecución.
- **[inferencia]**: deducido de lo observado, sin comprobación directa.

## Lección 1: En Claude Code, un plugin instalado desde SessionStart no carga en esa sesión; las skills y comandos del proyecto sí

**Category**: discovery
**Context**: Hacer disponible nvk/llm-wiki en la primera sesión, también en la nube, donde cada sesión empieza en un contenedor nuevo.
- **[comprobado]** Un plugin instalado desde el hook `SessionStart` no aparece en esa sesión y sí en la siguiente. Para repetirlo:
  1. Un marketplace local con un plugin `probe` (una skill `probe-plugin-skill` y un comando `probecmd`) y un proyecto cuyo `SessionStart` ejecuta `claude plugin marketplace add <dir>` y `claude plugin install probe@probe-market`.
  2. `CLAUDE_CONFIG_DIR` vacío; `claude plugin list` da antes "No plugins installed".
  3. Dos sesiones `claude -p "Responde solo: ok" --output-format stream-json --verbose`.

  Resultado: en la primera el hook instala con éxito ("Successfully installed plugin: probe@probe-market (scope: user)"), pero el evento `init` no trae ni el plugin, ni la skill, ni el comando. En la segunda, el `init` trae el plugin `probe@probe-market`, `probe:probe-plugin-skill` y `probe:probecmd`.
- **[comprobado]** Lo que se pone por symlink en `.claude/skills/<id>/` y `.claude/commands/<ns>/` aparece en el `init` de la misma sesión, y los comandos se invocan como `/<ns>:<cmd>` (tarea 1.1 en `idd@1cf0792:openspec/changes/archive/2026-11-21-add-llm-wiki-support/tasks.md`; tarea 8.3 para un clon recién creado).
- **Sin comprobar:** por qué ocurre. No se sabe en qué momento Claude Code lee los plugins respecto a `SessionStart`. La CLI dice en la segunda instalación que los cambios cuentan "at the next session start or /reload-plugins". Si `/reload-plugins` serviría para cargar el plugin a mitad de sesión no se ha probado; en todo caso exigiría que el usuario lo ejecutara.
**Rule**: Para que algo externo esté disponible en la primera sesión de Claude Code, exponlo por las rutas de skills y comandos del proyecto, no como plugin.

## Lección 2: CLAUDE_ENV_FILE llega al Bash del modelo, pero `` !`…` `` no admite `${VAR}`

**Category**: gotcha
- **[comprobado]** Un `` !`echo "${CLAUDE_PLUGIN_ROOT:-unset}"` `` en un comando falla con "A variable in braces in this command can't be checked before it runs" (tarea 1.1 en `idd@1cf0792:openspec/changes/archive/2026-11-21-add-llm-wiki-support/tasks.md`).
- **[comprobado]** `CLAUDE_PLUGIN_ROOT` exportado por `CLAUDE_ENV_FILE` en `SessionStart` llega al Bash que ejecuta el modelo desde un comando puesto por symlink, y `"${CLAUDE_PLUGIN_ROOT}/bin/llm-wiki" --help` responde (tareas 1.1 y 8.3 en `idd@1cf0792:openspec/changes/archive/2026-11-21-add-llm-wiki-support/tasks.md`).
- **[lectura de código]** Los comandos del motor que usan el helper (`adapter.md`, `specialist.md`, `research.md` de nvk/llm-wiki v1.0.0) lo invocan con instrucciones al modelo, no con `` !`…` ``.
**Rule**: Para pasar variables a los comandos de una sesión de Claude Code, usa `CLAUDE_ENV_FILE` y no dependas de `${…}` en `` !`…` ``.

## Lección 3: El hook context de OpenCode 2.3.2

**Category**: discovery
- **[comprobado]** `ctx.session.hook("context", cb)` recibe `system` y `messages`, que se pueden cambiar. `system.push({type:"text", text})` y `messages.splice(<último user>, 0, {role:"user", content:[{type:"text", text}]})` con objetos planos llegan al modelo, según los cuerpos de las peticiones capturados con un proveedor falso (tarea 1.2 en `idd@1cf0792:openspec/changes/archive/2026-11-21-add-llm-wiki-support/tasks.md`).
- **[comprobado]** No se acumula: con `opencode run -c` en el segundo y el tercer mensaje, cada petición lleva una sola copia (tarea 1.2).
- **[comprobado]** Con una excepción capturada dentro del hook, la petición sale sin lo añadido y el modelo responde. Con una sin capturar, `opencode run` termina con 1 y no se hace la petición del agente, aunque la del título sí (tarea 1.2).
- **[comprobado]** La petición del título no pasa por el hook `context` (tarea 1.2).
- **[lectura de código]** El modo Plan de OpenCode inserta su recordatorio igual, como mensaje `user` antes del último, según el código empaquetado en el binario de `@opencode/cli` 2.3.2. Que la compactación y `generate` tienen hooks propios sale de los tipos `SessionHooks` de `@opencode/plugin` 2.3.2.
**Rule**: En OpenCode, añade contexto efímero con el hook `context`, insértalo como mensaje `user` antes del último, y envuelve todo el hook en `try/catch`.

## Lección 4: Un proveedor falso compatible con OpenAI enseña lo que recibe el modelo

**Category**: pattern
- **[comprobado]** Un servidor Node local que registra cada cuerpo y responde en SSE `chat.completion.chunk`, configurado como proveedor `@ai-sdk/openai-compatible` (`baseURL: http://127.0.0.1:<puerto>/v1`) en un `opencode.json` fuera del repositorio, basta para ver el system, los mensajes y las herramientas (tareas 1.2 y 8.3 en `idd@1cf0792:openspec/changes/archive/2026-11-21-add-llm-wiki-support/tasks.md`).
- **[comprobado]** Las skills van en la descripción de la herramienta `skill`, como `<skill><id>…</id>` (tarea 1.2).
- **[comprobado]** Buscar texto con acentos sobre `json.dumps(cuerpo)` da falsos negativos, porque escapa los caracteres no ASCII (`Guía`). Ocurrió en esta sesión al buscar la guía, y se corrigió con `ensure_ascii=False`. No está anotado en el repositorio.
**Rule**: Para verificar qué contexto llega a un modelo, intercepta la petición con un proveedor falso en lugar de preguntarle al modelo.

## Lección 5: opencode run interrumpe el trabajo de fondo del plugin; la TUI no

**Category**: gotcha
- **[comprobado]** En un clon recién creado, tras `opencode run --standalone` no quedaron symlinks del motor y sí `.agents/wiki-engine.tmp.<pid>` (tarea 8.3 en `idd@1cf0792:openspec/changes/archive/2026-11-21-add-llm-wiki-support/tasks.md`).
- **[inferencia]** La causa es que `opencode run` termina al responder el modelo y el núcleo del arranque, que el plugin lanza en segundo plano, muere a medio `git clone`. No se vio cómo terminaba ese proceso. Encaja con lo que quedó en disco, y con que en la TUI, que sigue abierta, el motor sí queda instalado.
- **[comprobado]** En la TUI (`opencode --standalone` en `tmux`), el motor quedó instalado a los pocos segundos con el proveedor falso y a los 16 s con un modelo real, y el siguiente mensaje de esa misma sesión ya listaba `wiki-manager` y `wiki-query`, una vez cada una (tarea 8.3).
- **[comprobado]** Con el arreglo, el núcleo borra los `.tmp.*` y `.old.*` cuyo PID ya no existe. Lo prueba `acceptance-tests/core-tests/engine-links.test.js` en idd@1cf0792.
**Rule**: El trabajo de fondo de un plugin de OpenCode puede quedar a medias: hazlo atómico, con un temporal y un renombrado, y que limpie los restos de ejecuciones anteriores.

## Lo que no es de esta sesión

- **[heredado]** Ante el mismo ID de skill gana `.claude/skills` sobre `.agents/skills` y `.opencode/skills`. Es la lectura del código fuente de OpenCode recogida en `idd@1cf0792:openspec/changes/archive/2026-11-21-add-llm-wiki-support/design.md` (Context) y en `idd@1cf0792:acceptance-tests/support/skills.js`. En esta sesión solo se vio que cada skill aparece una vez, no la precedencia ante un ID repetido.
