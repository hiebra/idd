# ADR-0027: La depuración en la verificación se apoya en un MCP externo que solo informa, con un contrato que fija la plantilla

- Status: accepted
- Date: 2026-11-22
- Supersedes: -

## Context

La revisión de una task y la del verify ofrecen al usuario depurar lo revisado (`guiar-revision-con-tests`). Hoy la oferta es una orden de terminal del stack de la plantilla (`node --inspect-brk`, `debugpy`), que lanza el usuario. Los proyectos creados desde la plantilla tienen otros stacks, y quien verifica depura con su IDE: los primeros casos son Java sobre WLP y React sobre Vite con VS Code.

Para lanzar un IDE en modo depuración hay que conocer el stack, el IDE y el proyecto, y la plantilla no conoce ninguno. Tampoco basta con una orden:

- El CLI de VS Code no documenta ninguna opción para iniciar una sesión de depuración ni para poner puntos de ruptura. Desde fuera, la inicia una extensión a la que se llega con una URL, o la persona.
- El modelo solo puede ejecutar órdenes que terminan. Un servidor en modo dev o un proceso suspendido a la espera del depurador dejan colgada su orden.
- La revisión no modifica el árbol de trabajo, porque la cierra git (ADR-0014).

No existe todavía ninguna herramienta que lo resuelva. El dueño del proyecto quiere que la capacidad llegue por un servidor MCP que aporte la información que el modelo necesita para lanzar el IDE, y que la plantilla fije ya qué tiene que ofrecer.

Alternativas consideradas:

- **Seguir solo con la orden de terminal.** No sirve fuera del stack de la plantilla ni con un IDE.
- **Que la plantilla aprenda cada stack y cada IDE**, en la instrucción de la revisión. No tiene fin, y mete en un texto conocimiento que cambia con cada proyecto.
- **Un MCP que actúa**: que inicie la sesión, ponga los puntos de ruptura y avance paso a paso, como DebugMCP. Exige un servidor dentro del IDE, y aquí quien depura es la persona.
- **Un MCP que solo describe** (puertos, órdenes de arranque, configuraciones) y que el modelo componga el lanzamiento. Deja en el modelo el conocimiento del stack y del IDE, y no resuelve quién arranca lo que no termina.

## Decision

- **Lo que hace falta para depurar un stack con un IDE vive en un servidor MCP externo.** La plantilla no lo incluye y no aprende ningún stack ni ningún IDE.
- **La plantilla fija el contrato de ese servidor**, en `.agents/debug/` (capability `debug-mcp-contract`): las tools, sus esquemas, sus invariantes, sus errores y sus ejemplos. Es un contrato dirigido por quien lo consume, con versión `mayor.menor`; un cambio incompatible sube la mayor.
- **El servidor solo informa.** Sus tools son de solo lectura: no arrancan ni paran procesos, no abren el IDE y no escriben en el árbol de trabajo. No tienen estado: cada llamada se entiende por sus argumentos, y el árbol de trabajo se pasa como parámetro.
- **La respuesta es un plan con pasos de dos actores.** Los de `agent` los ejecuta el modelo, y son órdenes que terminan solas y enseguida. Los de `user` los hace la persona: lo que se queda en marcha y la depuración. El modelo no arranca nada que no termine y no maneja el depurador.
- **Seguir un plan no deja en el árbol de trabajo archivos que git no ignore.**
- **El ciclo es el mismo con el servidor y sin él.** Sin servidor, la revisión da la orden de terminal de siempre. Nada versionado depende de que esté (ADR-0025).
- **Cómo se usa el servidor lo dice la instrucción de la revisión del autopilot**, no una instrucción permanente (ADR-0010). En Claude Code se usa a mano.
- **La suite comprueba el contrato y sus ejemplos.** No comprueba ningún servidor, porque la plantilla no tiene ninguno.

## Consequences

- Soportar un stack o un IDE nuevo es trabajo del servidor, no de la plantilla. La instrucción de la revisión no cambia.
- El contrato es un compromiso entre dos piezas que evolucionan por separado. Cambiarlo obliga a versionarlo y a que el servidor y la instrucción se pongan de acuerdo.
- Mientras no exista un servidor, el contrato no se ha probado. El primero puede obligar a una versión 2.
- Cuánto hace el modelo y cuánto la persona depende del servidor y del IDE. Con VS Code y sin una extensión propia, la persona pone los puntos de ruptura e inicia la sesión; con una extensión, un solo paso del modelo.
- El modelo ejecuta órdenes que le dicta un servidor. Es un servidor local que configura el usuario, y la instrucción pide enseñar el plan antes de ejecutar ningún paso.
- Si algún día el agente tiene que manejar el depurador (paso a paso, variables), hace falta un ADR nuevo: esta decisión lo deja fuera.
