# ADR-0005: El motor del wiki y su guía llegan a cada agente por el arranque de sesión

- Status: accepted
- Date: 2026-11-21
- Supersedes: -

## Context

ADR-0004 exige que cada agente soportado (Claude Code y OpenCode 2) tenga el motor del wiki en la versión fijada por el proyecto. También exige que reciba la guía del wiki en cada sesión y un recordatorio en cada mensaje, y que cada usuario pueda desactivarlo todo en local sin tocar archivos versionados.

Hechos comprobados:

- **En Claude Code** (2.1.330, en real), un plugin instalado desde el hook `SessionStart` solo se carga en la sesión siguiente. En la nube cada sesión empieza en un contenedor nuevo, así que no estaría nunca disponible. Las skills y los comandos que el hook escribe en `.claude/skills/` y `.claude/commands/` sí se cargan en la misma sesión.
- **En OpenCode 2**, un usuario no puede retirar desde su configuración las `instructions` del `opencode.json` del proyecto, ni evitar que se lea el `AGENTS.md` de la raíz.
- **En el motor**, la skill de OpenCode es la de Claude Code con cambios de redacción, las mismas referencias y el mismo helper.

Alternativas consideradas:

- **El plugin de Claude Code**, declarado en `.claude/settings.json` o instalado por el arranque. No se carga en la sesión, y en la nube nunca.
- **La vía `instructions` del motor en OpenCode, y la guía en `AGENTS.md` + `CLAUDE.md`.** Son la vía canónica y la más sencilla, pero no se pueden desactivar en local. Además, `instructions` ocupa unos 30 KB por sesión.
- **Vendorizar el motor o usarlo como submódulo.** Mete código del motor en el repositorio y complica los proyectos creados desde la plantilla.

## Decision

- **El núcleo del arranque descarga el motor** en la versión declarada en `.agents/wiki/engine.json`, una vez por versión, en `.agents/wiki-engine/`, ignorado por git. Lo expone a cada agente por sus rutas de descubrimiento, con symlinks también ignorados:
  - la skill `wiki-manager` en `.claude/skills/`, que leen los dos agentes;
  - los comandos en `.claude/commands/wiki/`, para Claude Code;
  - la skill `wiki-query` en `.opencode/skills/`, para OpenCode.

  Hay una sola copia del motor, en la línea de ADR-0003, y no se usa el plugin de Claude Code.
- **La guía (`.agents/wiki/guide.md`) y el recordatorio (`.agents/wiki/reminder.md`)** tienen una única fuente. Los prepara el núcleo y los entregan los adaptadores del arranque de ADR-0002:
  - en Claude Code, la guía con el hook `SessionStart` y el recordatorio con `UserPromptSubmit`;
  - en OpenCode, los dos con el hook `context` del plugin.

  El proyecto no tiene archivos de instrucciones que un agente cargue siempre, como `AGENTS.md` o `CLAUDE.md`, con la guía.
- **Desactivación en local**: la variable de entorno `PROJECT_WIKI=off` hace que el núcleo no instale el motor, retire los symlinks y no entregue ni la guía ni el recordatorio.
- **El arranque mantiene `.wiki/` sin ignorar**: retira la línea `.wiki/` que el motor añade al `.gitignore` y avisa.

## Consequences

- El motor está disponible en la misma sesión en los dos agentes, también en la nube, con una sola versión y sin código del motor en el repositorio.
- El arranque depende de git y de acceso a GitHub en la primera sesión de cada clon y al subir de versión. Si falla, avisa y lo reintenta, como con npm.
- Las rutas que se exponen dependen de la estructura del motor (v1.0.0). Subir de versión exige revisarlas, y la suite lo comprueba.
- Fuera de un plugin, `${CLAUDE_PLUGIN_ROOT}` lo aporta el adaptador, y Claude Code pide permiso la primera vez que se ejecuta el helper del motor.
- OpenCode usa la skill de Claude Code. La guía le aclara que no existen los comandos `/wiki:*`. Si no basta, se añadiría el paquete de OpenCode con otro ID.
- El recordatorio en OpenCode depende del hook `context` y la skill, de la precedencia de `.claude/skills`. Si OpenCode cambia cualquiera de los dos, hay que revisar esta decisión y la simulación de la suite.
- Un agente nuevo necesita un adaptador que entregue la guía y el recordatorio. Un archivo de instrucciones que no se pueda desactivar no vale.
