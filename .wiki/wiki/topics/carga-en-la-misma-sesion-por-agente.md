---
title: "Qué carga cada agente y cuándo"
category: topic
sources:
  - raw/notes/2026-11-21-ll-wiki-en-dos-agentes-2.md
  - raw/notes/2026-11-21-ll-wiki-en-dos-agentes.md
  - raw/repos/2026-11-21-idd-1cf0792.md
created: 2026-11-21
updated: 2026-11-21
tags: [claude-code, opencode, session-bootstrap, llm-wiki, skills]
confidence: medium-high
volatility: warm
summary: "Qué ven Claude Code 2.1.330 y OpenCode 2.3.2 en la misma sesión en que el arranque instala algo, con el tipo de evidencia de cada afirmación, y cómo lo aprovecha la plantilla."
---

# Qué carga cada agente y cuándo

> El arranque de sesión instala cosas mientras el agente ya está arrancando. Lo que importa es qué ve el agente **en esa misma sesión**, porque en la nube cada sesión empieza en un contenedor nuevo. Cada afirmación lleva su evidencia: **[comprobado]**, **[heredado]**, **[lectura de código]** o **[inferencia]**, con el sentido de [la nota de lecciones revisada](../../raw/notes/2026-11-21-ll-wiki-en-dos-agentes-2.md).

## Claude Code 2.1.330

- **Plugins: no.** **[comprobado]** Un plugin instalado con `claude plugin install` desde `SessionStart` no aparece en esa sesión (ni el plugin, ni su skill, ni su comando en el evento `init`) y sí en la siguiente. La nota da los pasos para repetirlo (lección 1). Por qué ocurre no se ha averiguado. Si `/reload-plugins` lo cargaría a mitad de sesión no se ha probado, y exigiría que el usuario lo ejecutara.
- **Skills y comandos del proyecto: sí.** **[comprobado]** Lo que el hook deja por symlink en `.claude/skills/<id>/` y `.claude/commands/<ns>/` aparece en la misma sesión, y los comandos se invocan como `/<ns>:<cmd>` (`idd@1cf0792:openspec/changes/archive/2026-11-21-add-llm-wiki-support/tasks.md`, tareas 1.1 y 8.3).
- **Variables: por `CLAUDE_ENV_FILE`.** **[comprobado]** Lo que el hook exporta ahí llega al Bash del modelo, también desde un comando enlazado. Una preejecución `` !`…` `` con `${VAR}` la rechaza la comprobación de permisos (lección 2).

La plantilla aplica las tres cosas. El núcleo enlaza `.claude/skills/wiki-manager` y `.claude/commands/wiki` al motor descargado en `.agents/wiki-engine/` (`idd@1cf0792:.agents/hooks/session-bootstrap.sh`, `ENGINE_LINKS`). El adaptador exporta `CLAUDE_PLUGIN_ROOT` por `CLAUDE_ENV_FILE` (`idd@1cf0792:.claude/hooks/session-start.sh`).

## OpenCode 2.3.2

- **Skills del proyecto en la misma sesión de la TUI: sí.** **[comprobado]** Con el motor instalado a mitad de sesión, el siguiente mensaje ya lista `wiki-manager` y `wiki-query`, una vez cada una (lección 5).
- **Precedencia ante un ID repetido.** **[heredado]** OpenCode busca en `.claude/skills`, `.agents/skills` y `.opencode/skills`, y gana `.claude/skills`. Es la lectura del código fuente de OpenCode recogida en `idd@1cf0792:openspec/changes/archive/2026-11-21-add-llm-wiki-support/design.md` y en `idd@1cf0792:acceptance-tests/support/skills.js`. No se ha comprobado en ejecución con un ID repetido.
- **`opencode run` deja el arranque a medias.** **[comprobado]** Tras `opencode run`, en un clon recién creado, no quedaron symlinks del motor y sí un `.agents/wiki-engine.tmp.<pid>`. **[inferencia]** Lo más probable es que el núcleo, que el plugin lanza en segundo plano, muera cuando `opencode run` termina al responder el modelo. En la TUI, que sigue abierta, no ocurre **[comprobado]**. El núcleo clona ahora en un temporal, lo sustituye con un renombrado y borra los restos cuyo proceso ya no existe.
- **Contexto: por el hook `context`**, no por `AGENTS.md` ni `instructions`, que el usuario no puede desactivar. Ver [El hook context de OpenCode](../concepts/hook-context-opencode.md).

## Consecuencias para la plantilla

- Para exponer una herramienta externa a los dos agentes en la primera sesión, la vía comprobada son las rutas de skills y comandos del proyecto, con una sola copia descargada y symlinks ([ADR-0005](../../../adr/0005-wiki-engine-through-session-bootstrap.md)).
- Al subir de versión cualquiera de los dos agentes hay que volver a comprobarlo. Para OpenCode hay un registro de vigilancia en [el inventario](../../inventory/candidates/volver-a-comprobar-hook-context-al-subir-opencode.md).

## See Also

- [El hook context de OpenCode](../concepts/hook-context-opencode.md)
- [Proveedor falso para verificar el contexto](../concepts/proveedor-falso-para-verificar-contexto.md)

## Sources

- [Lessons Learned (revisada)](../../raw/notes/2026-11-21-ll-wiki-en-dos-agentes-2.md): lecciones 1, 2 y 5 y "Lo que no es de esta sesión".
- [Lessons Learned (sustituida)](../../raw/notes/2026-11-21-ll-wiki-en-dos-agentes.md): solo como linaje. Su explicación de la causa de la lección 1 no tenía base y se ha retirado.
- [Collection: repositorio de la plantilla intent-driven](../../raw/repos/2026-11-21-idd-1cf0792.md): `idd@1cf0792:.agents/hooks/session-bootstrap.sh`, `idd@1cf0792:.claude/hooks/session-start.sh`, `idd@1cf0792:acceptance-tests/support/skills.js`, `idd@1cf0792:openspec/changes/archive/2026-11-21-add-llm-wiki-support/tasks.md` y `design.md`.
