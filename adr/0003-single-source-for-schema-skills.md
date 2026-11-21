# ADR-0003: Una sola copia de las skills, vista por cada agente desde sus propias rutas

- Status: accepted
- Date: 2026-11-21
- Supersedes: -

## Context

El proyecto trae skills de dos orígenes:

- **Las del schema** (`acceptance-test-authoring`, `gherkin-authoring`, `spec-as-source`…), que viven en `.agents/skills/` y Claude Code ve mediante symlinks en `.claude/skills/`. Esta disposición no estaba escrita en ningún sitio.
- **Los workflows de OpenSpec**, que genera el CLI del proyecto en `.claude/skills/`.

Con OpenCode 2 como segundo agente soportado, hay que decidir cómo llegan esas skills a cada agente. OpenCode 2 busca skills de proyecto en `.opencode/skills`, y por compatibilidad en `.claude/skills` y `.agents/skills`. Identifica cada skill por su ruta y, si un mismo ID aparece en varias fuentes, carga solo la de mayor precedencia.

Alternativas consideradas:

- **Copiar o generar las skills por agente** (por ejemplo, `.opencode/skills/` con `openspec update`). Crea copias que pueden divergir o quedarse en otra versión de OpenSpec, y en OpenCode tapan a las originales por precedencia.
- **Mover las skills del schema dentro de la configuración de un agente.** Ata la fuente a una herramienta concreta.

## Decision

- **Fuente única de las skills del schema:** `.agents/skills/`. Cada agente soportado las ve desde ahí, por sus propias rutas de descubrimiento.
  - Claude Code, mediante symlinks en `.claude/skills/`.
  - OpenCode 2, leyendo `.agents/skills` directamente.
- **Los workflows de OpenSpec** se generan una sola vez, en el directorio que gestiona el CLI de OpenSpec del proyecto (hoy `.claude/skills/`). Los agentes que no lo leen de forma nativa no reciben una copia generada aparte: hay que buscar una ruta que lean.
- **No se mantienen copias de una skill por agente.**
- **La suite de aceptación verifica**, con las reglas de descubrimiento de cada agente, que cada agente encuentra cada skill una sola vez y que todos los workflows corresponden a la versión de OpenSpec fijada por el proyecto.

El comportamiento está especificado en `openspec/specs/agent-skills/spec.md`.

## Consequences

- Una skill se añade o se cambia en un único sitio. Si a Claude Code le falta el symlink, la suite lo detecta.
- Subir de versión OpenSpec sigue regenerando solo `.claude/skills/`, y los dos agentes ven la misma versión.
- La disponibilidad en OpenCode depende de su lectura por compatibilidad de `.claude/skills` y `.agents/skills`. Si OpenCode la retira o cambia la precedencia, hay que revisar esta decisión y la simulación de la suite.
- Los symlinks de `.claude/skills/` mantienen la limitación de los entornos sin soporte de symlinks (Windows sin modo desarrollador).
- Añadir un agente que no lea ninguna de esas rutas exige un mecanismo para exponerle la fuente única, no una copia, y un nuevo ADR si cambia esta decisión.
