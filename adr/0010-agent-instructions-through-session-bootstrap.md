# ADR-0010: Toda instrucción del proyecto al agente llega por el arranque de sesión y se desactiva en local

- Status: accepted
- Date: 2026-11-21
- Supersedes: -

## Context

ADR-0005 decidió que la guía del wiki llega a cada agente por el arranque de sesión, y no por archivos de instrucciones que el agente carga siempre (`AGENTS.md`, `CLAUDE.md` o las `instructions` de `opencode.json`), porque esos archivos no se pueden desactivar en local. Esa decisión se tomó solo para el wiki.

El change `add-quote-comment-rule` añade una segunda instrucción, la regla de comentarios, y la primera versión iba en `AGENTS.md` con un `CLAUDE.md` que lo importaba. Sin una regla general, cada instrucción nueva vuelve a plantear la misma pregunta. Además, los proyectos creados desde la plantilla heredan esas instrucciones, y quien no quiera una no tiene forma de apagarla sin editar archivos versionados que comparte con su equipo.

Alternativas consideradas:

- **`AGENTS.md` + `CLAUDE.md` para lo que no sea el wiki.** Es lo más sencillo y lo que esperan los dos agentes, pero ninguna instrucción se podría desactivar en local, y el proyecto tendría dos vías de entrega con reglas distintas.
- **Una sola variable que desactive todas las instrucciones del proyecto.** No deja quedarse con unas y quitar otras.
- **Decidir caso por caso.** Cada instrucción reabre la discusión de ADR-0005.

## Decision

- **Toda instrucción que el proyecto entrega al agente llega por el arranque de sesión** (ADR-0002): el núcleo la prepara y el adaptador de cada agente la entrega, al empezar la sesión, con los mensajes del usuario o en los dos momentos.
- **Cada instrucción tiene una única fuente en `.agents/`**, igual para todos los agentes soportados salvo lo que deba nombrarse como se invoca en cada uno.
- **Cada instrucción se desactiva en local por separado**, con su propia variable de entorno `PROJECT_<NOMBRE>=off`, sin tocar archivos versionados. Desactivada, el agente no recibe nada de ella.
- **Si una instrucción solo tiene sentido con ciertos mensajes**, la decisión de qué mensajes la activan es determinista y está en el núcleo, la única copia, no en cada adaptador.
- **El proyecto no tiene archivos de instrucciones que un agente cargue siempre.** Los proyectos creados desde la plantilla pueden añadir los suyos; la plantilla no.

ADR-0005 sigue en vigor para el wiki: es el primer caso de esta regla.

## Consequences

- Cada usuario elige qué instrucciones del proyecto recibe, sin afectar a su equipo.
- Hay una sola vía de entrega y una sola forma de comprobarla en la suite: lo que el adaptador entrega en cada agente simulado.
- Una instrucción nueva cuesta más que añadir un párrafo a `AGENTS.md`: necesita su fuente, sus modos en el núcleo, su entrega en cada adaptador y sus escenarios.
- Los adaptadores combinan varias instrucciones en el mismo hook. En Claude Code van en un solo `additionalContext` por hook, porque no admite más de uno.
- Un agente nuevo necesita un adaptador que entregue todas las instrucciones, no solo la guía del wiki.
- Si un agente llega a permitir desactivar en local sus archivos de instrucciones, hay que revisar esta decisión en un change nuevo.
