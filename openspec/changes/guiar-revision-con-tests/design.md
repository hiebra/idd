## Context

`reviewPrompt` (`.opencode/plugins/openspec-autopilot/lib/prompts.mjs`) construye la instrucción de cada sesión de revisión del modo normal. Hoy es la misma para todo lo revisado: no modificar archivos, guiar al usuario (resumir, señalar lo dudoso, responder), cómo se cierra con git y las lecciones. Las revisiones corren con el agente `plan` (`WORKFLOW.review`).

El proyecto sigue `spec-as-source`: el comportamiento de cada task está en los escenarios Gherkin de las specs del change, que el runner de aceptación del proyecto ejecuta. El cierre de la revisión depende del estado de git (ADR-0014): un commit es ok; HEAD igual, nada en el stage y cambios en el árbol, ko.

## Goals / Non-Goals

**Goals:**
- En la revisión de una task y en la del verify, el modelo usa los escenarios de aceptación del change como guion de la verificación, los ejecuta y explica el resultado.
- Si hay código fuente ejecutable, el usuario recibe la orden para ejecutarlo en modo depuración.

**Non-Goals:**
- Que el plugin ejecute tests o decida algo con su resultado.
- Cambiar las revisiones de los artefactos del plan y de los cambios en el plan.
- Cambiar el agente de la revisión.

## Decisions

### D1. Un bloque de verificación en `reviewPrompt` para `of: 'task'` y `of: 'verify'`

`reviewPrompt` añade, solo cuando `step.of` es `task` o `verify`, un párrafo que pide:
- localizar en las specs del change (`openspec/changes/<change>/specs/`) los escenarios que cubren lo revisado (en el verify, todos) y recorrerlos con el usuario como guion de lo que hay que comprobar;
- ejecutarlos con el runner de aceptación del proyecto (el que documente su suite) y explicar qué pasa y qué falla;
- que las ejecuciones no dejen archivos que git no ignore.

El texto no nombra comandos de este repositorio: el plugin sirve a cualquier proyecto de la plantilla, y el runner lo dice su suite.

Alternativa: que el plugin calcule qué escenarios cubren la task (por ejemplo, de los comentarios `<!-- feature: step -->` de `tasks.md`) y los pase en la instrucción. Se descarta: el formato de `tasks.md` no lo garantiza y el modelo ya lee el change.

### D2. La ejecución en modo depuración la lanza el usuario

En el mismo bloque, si lo revisado incluye código fuente que se puede ejecutar, el modelo ofrece al usuario la orden exacta para lanzarlo con el depurador del stack (por ejemplo, el escenario de aceptación que lo ejercita bajo `node --inspect-brk`) y dónde poner los puntos de ruptura. La orden la ejecuta el usuario en su terminal.

Alternativa: que la lance el modelo. Se descarta: un proceso que espera al depurador deja colgada la orden del modelo, y la sesión de depuración es del usuario.

### D3. Lo que deja una ejecución en el árbol

El cierre por git compara el estado al empezar la revisión. Un archivo nuevo no ignorado cambia la firma del árbol: si el usuario después lo saca todo del stage, la revisión se cierra como ko con ese archivo como material del update. Por eso la instrucción pide que las ejecuciones no dejen archivos fuera de los que git ignora. Los informes y los `.feature` extraídos de la suite de la plantilla ya están ignorados.

## Risks / Trade-offs

- **[El agente `plan` pide permiso para cada orden de shell]** → Es lo esperado: el usuario aprueba cada ejecución. No se ha comprobado con OpenCode real que `plan` pueda ejecutar el runner; si no puede, el modelo da la orden al usuario como con la depuración. Queda como comprobación manual (task 3.2).
- **[La suite tarda]** → El modelo ejecuta los escenarios que cubren lo revisado, no la suite entera, salvo en el verify.
- **[Un modelo que no sigue la instrucción]** → La suite solo comprueba la instrucción; el resultado lo juzga el usuario, que sigue cerrando la revisión con git.

## Migration Plan

Nada que migrar: las revisiones que se abran tras fusionar reciben la instrucción nueva. La vuelta atrás es revertir el commit del código.

## Open Questions

Ninguna.
