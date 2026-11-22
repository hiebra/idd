## Why

Cuando el usuario comenta una parte de una respuesta del agente, el agente contesta a cada comentario con otra respuesta larga, que el usuario vuelve a comentar por partes, y la conversación no converge. Hace falta una forma de comentar varias partes de una intervención sin que cada comentario dispare una respuesta, y de decidir después cómo debe tratarlos el agente.

## What Changes

- **Un comentario** es un prompt del usuario que empieza por una cadena entre comillas simples (`'así'`). El agente no lo responde: contesta solo con una frase fija que recuerda las opciones, y acumula el comentario sin investigar ni modificar nada a raíz de él.
- **"ya"** en un prompt del usuario hace que el agente responda en un solo mensaje a todos los comentarios acumulados desde su última respuesta completa.
- **"reformula"** en un prompt del usuario hace que el agente repita su intervención completa, reescrita para incorporar los comentarios acumulados. Asume que el usuario solo ha leído las partes que citó, así que la intervención reformulada se entiende por sí sola: no remite a la anterior ni da por leído nada de lo que el usuario no comentó.
- **La regla llega por el arranque de sesión**, como la guía del wiki (ADR-0005): tiene una única fuente en `.agents/`, el adaptador de cada agente la entrega al empezar la sesión y, cuando un mensaje del usuario es un comentario o contiene "ya" o "reformula", la recuerda junto con ese mensaje. Así el agente la aplica aunque la sesión sea larga, y los demás mensajes no cargan con ella.
- **Cada usuario la desactiva en local**, sin tocar archivos versionados, igual que el wiki.

Fuera de alcance: detectar comentarios con otras marcas (comillas dobles, citas de Markdown); entregar la regla por `AGENTS.md` o `CLAUDE.md`, que no se pueden desactivar en local; reglas de conversación más allá de los comentarios.

## Capabilities

### New Capabilities
- `response-comments`: cómo trata el agente los comentarios del usuario sobre su intervención anterior (marca de comentario, respuesta fija, acumulación, "ya" y "reformula"), y cómo le llega la regla en cada agente soportado: desde una única fuente, al empezar la sesión y con los mensajes que la activan, y desactivable en local.

### Modified Capabilities

## Impact

- Núcleo del arranque (`.agents/hooks/session-bootstrap.sh`) y adaptadores de los dos agentes: el hook `SessionStart` y el `UserPromptSubmit` de Claude Code, y el hook `context` del plugin de OpenCode. Hoy el `UserPromptSubmit` descarta el mensaje; tendrá que leerlo para decidir si recuerda la regla.
- Un archivo nuevo con la regla en `.agents/`.
- Suite de aceptación: escenarios de entrega, de recordatorio por mensaje y de desactivación, en los dos agentes simulados.
- README: mencionar la regla y cómo desactivarla.
- ADR-0005 decidió entregar instrucciones al agente por el arranque, no por archivos que se cargan siempre; este change aplica esa decisión a una segunda instrucción.
