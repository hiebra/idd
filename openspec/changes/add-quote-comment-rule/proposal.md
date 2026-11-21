## Why

Cuando el usuario comenta una parte de una respuesta del agente, el agente contesta a cada comentario con otra respuesta larga, que el usuario vuelve a comentar por partes, y la conversación no converge. Hace falta una forma de comentar varias partes de una intervención sin que cada comentario dispare una respuesta, y de decidir después cómo debe tratarlos el agente.

## What Changes

- **Un comentario** es un prompt del usuario que empieza por una cadena entre comillas simples (`'así'`). El agente no lo responde: contesta solo con una frase fija que recuerda las opciones, y acumula el comentario sin investigar ni modificar nada a raíz de él.
- **"ya"** en un prompt del usuario hace que el agente responda en un solo mensaje a todos los comentarios acumulados desde su última respuesta completa.
- **"reformula"** en un prompt del usuario hace que el agente repita su intervención completa, reescrita para incorporar los comentarios acumulados. Asume que el usuario solo ha leído las partes que citó, así que la intervención reformulada se entiende por sí sola: no remite a la anterior ni da por leído nada de lo que el usuario no comentó.
- **Una sola fuente en los dos agentes**: la regla vive en `AGENTS.md`, en la raíz, que OpenCode lee de forma nativa; un `CLAUDE.md` que solo contiene `@AGENTS.md` la carga en Claude Code.

Fuera de alcance: detectar comentarios con otras marcas (comillas dobles, citas de Markdown); hacer cumplir la regla con hooks en lugar de con instrucciones al agente; reglas de conversación más allá de los comentarios.

## Capabilities

### New Capabilities
- `response-comments`: cómo trata el agente los comentarios del usuario sobre su intervención anterior (marca de comentario, respuesta fija, acumulación, "ya" y "reformula"), y que esa regla llega a cada agente soportado desde una única fuente.

### Modified Capabilities

## Impact

- `AGENTS.md` y `CLAUDE.md` nuevos en la raíz. Los heredan los proyectos creados desde la plantilla, que pueden ampliarlos con sus propias instrucciones.
- Suite de aceptación: escenarios que comprueban que Claude Code y OpenCode cargan la regla desde `AGENTS.md`.
- README: mencionar la regla entre lo que ofrece la plantilla.
