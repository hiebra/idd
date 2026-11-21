# ADR-0006: Cuándo se acepta que una capacidad exista en un solo agente

- Status: accepted
- Date: 2026-11-21
- Supersedes: -

## Context

Hasta ahora todo lo que aporta el proyecto existe igual en Claude Code y en OpenCode 2: el arranque de sesión (ADR-0002), las skills (ADR-0003) y el wiki (ADR-0004, ADR-0005). Cada vez que un agente no tenía un mecanismo, se buscó otro equivalente en lugar de renunciar a la capacidad.

El change `add-openspec-autopilot` propone automatizar el ciclo de un change en OpenCode 2: crear, encadenar y archivar sesiones, y confirmar decisiones en la TUI. Claude Code no tiene un equivalente: no tiene sesiones que un plugin del proyecto pueda crear y encadenar, ni diálogos en su interfaz. Es la primera vez que una capacidad solo puede existir en un agente, y no hay ninguna regla que diga si eso se acepta ni con qué condiciones.

Alternativas consideradas:

- **Paridad estricta: nada que no exista en los dos agentes.** Renuncia a la automatización en OpenCode sin ganar nada en Claude Code.
- **Aceptar asimetrías caso por caso, sin regla.** Cada caso reabre la discusión, y no hay forma de garantizar que el proyecto siga funcionando igual en el otro agente.
- **Un sustituto pobre en el otro agente** (por ejemplo, una skill que imite el encadenamiento). Da la apariencia de paridad con otro comportamiento, y exige mantener dos implementaciones.

## Decision

Una capacidad puede existir en un solo agente soportado si cumple todas estas condiciones:

- **El ciclo y lo que queda versionado son iguales con ella y sin ella.** Los artefactos, los commits que se piden y el resultado en el repositorio no dependen de qué agente se use.
- **En el otro agente, lo mismo se hace a mano** con los mismos workflows y las mismas reglas.
- **No deja nada a medias en el otro agente**: ningún hook, skill, comando ni configuración que solo tenga sentido con la capacidad.
- **La suite de aceptación verifica las dos cosas**: el comportamiento en el agente que la tiene y la ausencia de restos en el otro.
- **La asimetría se declara** en la proposal del change que la introduce y en un ADR.

Lo que la capacidad necesite y sea común al ciclo (por ejemplo, saber qué change tiene una rama) va en una pieza neutral que usan los dos agentes, no dentro de la capacidad.

## Consequences

- Cada agente puede aprovechar lo que tiene sin rebajar al otro, y el proyecto sigue dando el mismo resultado en los dos.
- Las asimetrías son explícitas y verificables, no un efecto secundario.
- La experiencia de uso difiere entre agentes: en el que no tiene la capacidad hay más pasos a mano.
- Para una capacidad asimétrica hay que separar con cuidado lo común al ciclo de lo propio del agente, y esa separación tiene un coste de diseño.
- Si el otro agente llega a tener un mecanismo equivalente, hay que decidir en un change nuevo si se implementa también allí.
