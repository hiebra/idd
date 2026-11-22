## Why

En el modo normal, quien verifica un change revisa task a task, pero nada acota cuánto le cuesta verificar cada una: el schema solo pide que una task se pueda completar en una sesión. En este repositorio, la mitad de los commits de código no pasa de 42 líneas cambiadas, y uno de cada diez pasa de 280, hasta 3.800.

Además, la depuración que ofrece la revisión (`guiar-revision-con-tests`) es una orden de terminal del stack de la plantilla (`node --inspect-brk`, `debugpy`). No sirve para que el verificador "toque" con el depurador de su IDE el código de un proyecto real, como Java sobre WLP o React sobre Vite con VS Code. La herramienta que lo resuelva aún no existe; lo que sí se puede fijar ya es qué tiene que ofrecer.

## What Changes

- **Un límite de verificación por task, predefinido en `openspec/config.yaml`.** Una regla nueva de `rules.tasks` pide que verificar una task no lleve a una persona más de **15 minutos**: leer su diff, recorrer y ejecutar los escenarios que la cubren y, si quiere, depurarla. Cada task lleva escrita su estimación, y la que pase del límite se divide. La regla incluye una referencia para estimar, que cada proyecto ajusta con el uso. El límite es una estimación al planificar: no se mide.
- **La revisión dice cuánto cuesta verificar.** En el autopilot, la revisión del artefacto `tasks` pide comprobar que cada task lleva su estimación y que ninguna pasa del límite, y dar el total del change. La revisión de una task empieza por su estimación y el límite, y avisa si lo que hay que verificar los supera con claridad: el usuario puede rechazarla para que se divida.
- **El contrato de un MCP de depuración.** La plantilla define, en un archivo versionado y legible por máquina, la API que debe ofrecer un servidor MCP para que el verificador depure con su IDE lo que revisa. Son dos tools de solo lectura:
  - `debug_targets`: qué se puede depurar de los archivos revisados, con qué IDE y en qué estado está.
  - `debug_launch_plan`: los pasos para lanzar el IDE en modo depuración con unos puntos de ruptura, separando los que ejecuta el modelo de los que hace el usuario, y los pasos para dejarlo todo como estaba.

  El MCP solo informa: no arranca procesos, no abre el IDE y no escribe en el árbol de trabajo. El contrato devuelve un plan, y no solo datos, porque el CLI de VS Code no documenta ninguna opción para iniciar una sesión de depuración: hace falta una extensión o que el usuario la inicie. El contrato trae ejemplos para Java sobre WLP y React sobre Vite con VS Code.
- **La revisión usa el MCP si la sesión lo tiene.** La instrucción de la revisión de una task y la del verify pide usar las dos tools para ofrecer la depuración. Sin MCP, o sin nada que depurar según él, sigue dando la orden de terminal, como hoy.

Queda fuera de alcance:

- El servidor MCP: la plantilla no lo incluye.
- Que el modelo maneje el depurador (paso a paso, variables): depura la persona.
- Un comprobador de conformidad contra un servidor real: se hará cuando haya uno con el que probarlo.
- Medir el tiempo real de verificación, y cambiar el apply para cuando una task crece al implementarla.

## Capabilities

### New Capabilities
- `task-verification-limit`: el límite predefinido de minutos de verificación por task en las reglas del artefacto `tasks`, con la estimación escrita en cada task.
- `debug-mcp-contract`: el contrato del MCP de depuración: sus dos tools, sus esquemas de entrada y de salida, sus invariantes y sus ejemplos.

### Modified Capabilities
- `openspec-autopilot`: el requisito «Revisión guiada con los tests de aceptación» pasa a pedir el MCP de depuración cuando la sesión lo tiene, con la orden de terminal como alternativa. Un requisito nuevo hace que la revisión del artefacto `tasks` y la de una task informen del coste de verificación frente al límite.

## Impact

- `openspec/config.yaml` (`rules.tasks`), en la zona de specs. Lo leen los dos agentes a través del CLI de OpenSpec.
- `.agents/debug/` (nuevo): el contrato y sus ejemplos.
- `.opencode/plugins/openspec-autopilot/lib/prompts.mjs` (`reviewPrompt`). La lógica de servidor no cambia.
- `acceptance-tests/`: pasos nuevos y una dependencia de desarrollo para validar JSON Schema.
- `README.md`: el límite, el contrato y cómo se conecta un MCP que lo cumpla.
- Claude Code: el límite le llega igual. La parte de la revisión solo existe en el plugin de OpenCode, como el resto de la revisión guiada (ADR-0006).
- Ramas sin fusionar que tocan lo mismo: `apply-one-task-per-session-in-normal-mode` añade `operations.apply` a `config.yaml` (otra zona del archivo), y `autopilot-plan-explore` pasa las revisiones al agente `build`. Ninguna toca el bloque de verificación de la revisión.
- El wiki del proyecto: las 12 fuentes de la investigación ya están ingeridas (`4b984f3`); se compilan en la resincronización tras el archive.
