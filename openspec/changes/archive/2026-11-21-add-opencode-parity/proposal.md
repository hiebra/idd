## Why

Todo lo que hace que un proyecto creado desde la plantilla funcione nada más clonarlo (el arranque de sesión que instala dependencias y deja el `openspec` del proyecto en el `PATH`, y las skills del schema y de OpenSpec) solo existe para Claude Code. Quien abre el proyecto con OpenCode no tiene nada de eso, y ni siquiera lo que hay hoy en Claude Code está bien verificado: si se rompe un enlace de una skill o falta un workflow, nadie se entera hasta que alguien intenta usarlo, y los avisos del arranque de sesión se escriben en una salida que Claude Code no muestra al usuario, así que nadie los ve aunque la suite esté en verde.

## What Changes

- El arranque de sesión deja de ser exclusivo de Claude Code: al abrir una sesión de Claude Code o de OpenCode 2 o superior en el proyecto, se instalan las dependencias y el `openspec` del proyecto queda disponible, con las mismas garantías (solo se reinstala si algo cambia, avisa sin instalar si el entorno no cumple los requisitos, nunca bloquea la sesión).
- Los avisos del arranque de sesión (requisitos del entorno incumplidos, fallo de instalación, `PATH` sin ajustar) se muestran al usuario en la interfaz de cada agente; dejarlos en un log no cuenta como aviso. Esto corrige también Claude Code, donde hoy los avisos se pierden.
- Claude Code y OpenCode conviven: el mismo clon sirve para trabajar con cualquiera de los dos, sin configurar nada.
- Las skills del schema (`.agents/skills/`) y los workflows de OpenSpec están disponibles en los dos agentes, y la suite de aceptación lo verifica.
- La suite de aceptación verifica el comportamiento de cada agente simulando cómo invoca este al proyecto, como hoy hace con Claude Code; no arranca los agentes reales.
- La decisión de ADR-0001 (un hook `SessionStart` de Claude Code) se sustituye por una nueva, y se registra la decisión, hoy implícita, de que `.agents/skills/` es la única fuente de las skills del schema.

Fuera de alcance: OpenCode 1 y otros agentes distintos de Claude Code y OpenCode 2; los avisos visibles en OpenCode Desktop y en `opencode run` (sin interfaz de terminal), donde el arranque funciona igual pero el aviso solo queda en el log; ejecutar el binario real de OpenCode o de Claude Code en la suite; y la preparación automática donde no hay bash.

## Capabilities

### New Capabilities
- `agent-skills`: las skills del schema y los workflows de OpenSpec que trae el proyecto se pueden descubrir y usar en cada agente soportado (Claude Code y OpenCode 2 o superior).

### Modified Capabilities
- `session-bootstrap`: el arranque de sesión pasa de cubrir solo las sesiones de Claude Code a cubrir las de cualquier agente soportado (Claude Code y OpenCode 2 o superior), con el mismo comportamiento en ambos, y sus avisos pasan a mostrarse al usuario en la interfaz del agente.

## Impact

- Configuración por agente: `.claude/` (hook y skills) y un plugin de OpenCode en `.opencode/` para el arranque de sesión.
- El script de arranque de sesión y su ubicación, que hoy vive dentro de `.claude/`.
- Suite de aceptación (`acceptance-tests/`): la simulación de sesiones debe cubrir los dos agentes, y aparecen escenarios nuevos para `agent-skills`.
- Specs `session-bootstrap` (modificada) y `agent-skills` (nueva); ADR-0001 queda sustituido.
- README de la plantilla: lo que ofrece, qué ocurre al abrir sesión y cómo desactivarlo, para los dos agentes.
- Proyectos derivados: heredan la configuración de OpenCode; los que ya existen no cambian hasta que la incorporen.
