---
title: "Qué carga cada agente y cuándo"
category: topic
sources:
  - raw/notes/2026-11-21-ll-wiki-en-dos-agentes.md
  - raw/repos/2026-11-21-idd-1cf0792.md
created: 2026-11-21
updated: 2026-11-21
tags: [claude-code, opencode, session-bootstrap, llm-wiki, skills]
confidence: high
volatility: warm
summary: "Qué ve Claude Code 2.1.330 y OpenCode 2.3.2 en la misma sesión en que el arranque instala algo, y cómo lo aprovecha la plantilla para exponer el motor del wiki."
---

# Qué carga cada agente y cuándo

> El arranque de sesión instala cosas mientras el agente ya está arrancando. Lo que importa es qué ve el agente **en esa misma sesión**, porque en la nube cada sesión empieza en un contenedor nuevo y no hay "sesión siguiente" con lo instalado. Comprobado con Claude Code 2.1.330 y OpenCode 2.3.2 el 2026-11-21.

## Claude Code

- **Plugins: no.** Un plugin instalado con `claude plugin install` desde el hook `SessionStart` solo carga en la sesión siguiente. Por eso la plantilla no usa el plugin del motor del wiki ([lecciones](../../raw/notes/2026-11-21-ll-wiki-en-dos-agentes.md), lección 1).
- **Skills y comandos del proyecto: sí.** Lo que el hook deja en `.claude/skills/<id>/` y `.claude/commands/<ns>/<cmd>.md`, también como symlink, aparece en la misma sesión. Un comando de `commands/<ns>/` se invoca como `/<ns>:<cmd>`, igual que en un plugin.
- **Variables: por `CLAUDE_ENV_FILE`.** Lo que el hook exporta ahí llega a los comandos Bash del modelo, también desde un comando puesto por symlink. La preejecución `` !`…` `` de un comando no sirve con `${VAR}`: la rechaza la comprobación de permisos (lección 2).

La plantilla aplica las tres cosas. El núcleo enlaza `.claude/skills/wiki-manager` y `.claude/commands/wiki` al motor descargado en `.agents/wiki-engine/` (`idd@1cf0792:.agents/hooks/session-bootstrap.sh`, `ENGINE_LINKS`). El adaptador exporta `CLAUDE_PLUGIN_ROOT` por `CLAUDE_ENV_FILE` (`idd@1cf0792:.claude/hooks/session-start.sh`).

## OpenCode 2

- **Skills del proyecto: sí, en la misma sesión de la TUI.** OpenCode busca skills en `.claude/skills`, `.agents/skills` y `.opencode/skills`, y ante el mismo ID gana `.claude/skills` (`idd@1cf0792:acceptance-tests/support/skills.js`). Con el motor instalado a mitad de sesión, el siguiente mensaje ya lista `wiki-manager` y `wiki-query`, una vez cada una (lección 5).
- **Trabajo de fondo del plugin: puede morir a medias.** `opencode run` termina en cuanto responde el modelo y mata los procesos hijo del plugin. Si el arranque estaba clonando el motor, no queda instalado hasta la sesión siguiente, y quedaban restos `.agents/wiki-engine.tmp.<pid>`. El núcleo clona ahora en un temporal, lo sustituye con un renombrado y borra los restos cuyo proceso ya no existe. En la TUI, que sigue abierta, no ocurre.
- **Contexto: por el hook `context`**, no por `AGENTS.md` ni `instructions`, que el usuario no puede desactivar. Ver [El hook context de OpenCode](../concepts/hook-context-opencode.md).

## Consecuencias para la plantilla

- Para exponer una herramienta externa a los dos agentes en la primera sesión, la vía que funciona son las rutas de skills y comandos del proyecto, con una sola copia descargada y symlinks ([ADR-0005](../../../adr/0005-wiki-engine-through-session-bootstrap.md)).
- Al subir de versión cualquiera de los dos agentes hay que volver a comprobar esto. Para OpenCode hay un registro de vigilancia en [el inventario](../../inventory/candidates/volver-a-comprobar-hook-context-al-subir-opencode.md).

## See Also

- [El hook context de OpenCode](../concepts/hook-context-opencode.md)
- [Proveedor falso para verificar el contexto](../concepts/proveedor-falso-para-verificar-contexto.md)

## Sources

- [Lessons Learned: motor del wiki, guía y recordatorio en Claude Code y OpenCode 2](../../raw/notes/2026-11-21-ll-wiki-en-dos-agentes.md): lecciones 1, 2 y 5.
- [Collection: repositorio de la plantilla intent-driven](../../raw/repos/2026-11-21-idd-1cf0792.md): `idd@1cf0792:.agents/hooks/session-bootstrap.sh`, `idd@1cf0792:.claude/hooks/session-start.sh`, `idd@1cf0792:acceptance-tests/support/skills.js`.
