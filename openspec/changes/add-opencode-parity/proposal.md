## Why

Todo lo que hace que un proyecto creado desde la plantilla funcione nada más clonarlo (el arranque de sesión que instala dependencias y deja el `openspec` del proyecto en el `PATH`, y las skills del schema y de OpenSpec) solo existe para Claude Code. Quien abre el proyecto con OpenCode no tiene nada de eso, y ni siquiera la paridad que hay hoy con Claude Code en las skills está verificada: si se rompe un enlace o falta un workflow, nadie se entera hasta que alguien intenta usarlo.

## What Changes

- El arranque de sesión deja de ser exclusivo de Claude Code: al abrir una sesión de Claude Code o de OpenCode en el proyecto, se instalan las dependencias y el `openspec` del proyecto queda disponible, con las mismas garantías (solo se reinstala si algo cambia, avisa sin instalar si el entorno no cumple los requisitos, nunca bloquea la sesión).
- Claude Code y OpenCode conviven: el mismo clon sirve para trabajar con cualquiera de los dos, sin configurar nada.
- Las skills del schema (`.agents/skills/`) y los workflows de OpenSpec están disponibles en los dos agentes, y la suite de aceptación lo verifica.
- La suite de aceptación verifica el comportamiento de cada agente simulando cómo invoca este al proyecto, como hoy hace con Claude Code; no arranca los agentes reales.
- La decisión de ADR-0001 (un hook `SessionStart` de Claude Code) se sustituye por una nueva, y se registra la decisión, hoy implícita, de que `.agents/skills/` es la única fuente de las skills del schema.

Fuera de alcance: otros agentes distintos de Claude Code y OpenCode, ejecutar el binario real de OpenCode o de Claude Code en la suite, y la preparación automática donde no hay bash.

## Capabilities

### New Capabilities
- `agent-skills`: las skills del schema y los workflows de OpenSpec que trae el proyecto se pueden descubrir y usar en cada agente soportado (Claude Code y OpenCode).

### Modified Capabilities
- `session-bootstrap`: el arranque de sesión pasa de cubrir solo las sesiones de Claude Code a cubrir las de cualquier agente soportado (Claude Code y OpenCode), con el mismo comportamiento en ambos.

## Impact

- Configuración por agente: `.claude/` (hook y skills) y una nueva configuración de OpenCode en `.opencode/` (arranque de sesión y skills).
- El script de arranque de sesión y su ubicación, que hoy vive dentro de `.claude/`.
- Suite de aceptación (`acceptance-tests/`): la simulación de sesiones debe cubrir los dos agentes, y aparecen escenarios nuevos para `agent-skills`.
- Specs `session-bootstrap` (modificada) y `agent-skills` (nueva); ADR-0001 queda sustituido.
- README de la plantilla: lo que ofrece, qué ocurre al abrir sesión y cómo desactivarlo, para los dos agentes.
- Proyectos derivados: heredan la configuración de OpenCode; los que ya existen no cambian hasta que la incorporen.
