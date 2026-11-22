## Why

En el modo normal, la sesión de revisión de `openspec-autopilot` solo pide al modelo que "guíe al usuario por la revisión": resumir lo que hay que mirar, señalar lo dudoso y responder preguntas. En las revisiones de una task y del verify, lo revisado es código cuyo comportamiento ya describen los escenarios de aceptación del change (`spec-as-source`), pero el modelo no los usa: la verificación se queda en leer el diff, y el usuario no tiene una forma guiada de comprobar que el código hace lo que dicen las specs ni de ver cómo se comporta al ejecutarlo.

## What Changes

- **La revisión de una task y la del verify se guían con los tests de aceptación**: la instrucción pide al modelo localizar los escenarios del change que cubren lo revisado (todo el change, en el verify), recorrerlos con el usuario como guion de la verificación, ejecutarlos con el runner de aceptación del proyecto y explicar el resultado. Las ejecuciones no deben dejar en el árbol archivos que git no ignore, porque la revisión la cierra git.
- **El usuario puede ejecutar en modo depuración el código generado**: si lo revisado incluye código fuente que se puede ejecutar, la instrucción pide al modelo ofrecer al usuario la orden exacta para lanzarlo con el depurador del stack (por ejemplo, el escenario de aceptación que lo ejercita), con dónde poner los puntos de ruptura. La orden la ejecuta el usuario, no el modelo.
- **Las revisiones de los artefactos del plan y de los cambios en el plan no cambian**: no hay código nuevo que ejecutar.

Queda fuera de alcance que el plugin ejecute tests por su cuenta o decida algo con su resultado: la revisión la sigue cerrando git.

## Capabilities

### New Capabilities

### Modified Capabilities
- `openspec-autopilot`: un requisito nuevo. La instrucción de la revisión de una task y la del verify pide guiar la verificación con los escenarios de aceptación del change, ejecutarlos y ofrecer al usuario la ejecución en modo depuración del código generado, si lo hay.

## Impact

- `.opencode/plugins/openspec-autopilot/lib/prompts.mjs` (`reviewPrompt`). La lógica de servidor no cambia.
- Los pasos de `acceptance-tests/step-definitions/autopilot.steps.js` para los escenarios nuevos.
- El wiki del proyecto, en la resincronización tras el archive (el artículo `ciclo-de-un-change-y-autopilot.md`).
- Claude Code: nada. El plugin no existe allí (ADR-0006).
