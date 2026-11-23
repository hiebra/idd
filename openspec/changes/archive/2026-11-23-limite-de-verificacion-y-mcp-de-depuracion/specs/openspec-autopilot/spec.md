# openspec-autopilot

## MODIFIED Requirements

### Requirement: Revisión guiada con los tests de aceptación
En el modo normal, la instrucción de la sesión de revisión de una task y la de la revisión del verify DEBEN pedir al modelo que guíe la verificación con los escenarios de aceptación del change que cubren lo revisado (todos los del change, en el verify): recorrerlos con el usuario como guion de lo que hay que comprobar, ejecutarlos con el runner de aceptación del proyecto y explicar el resultado. La instrucción DEBE pedir que las ejecuciones no dejen en el árbol de trabajo archivos que git no ignore. Si lo revisado incluye código fuente que se puede ejecutar, la instrucción DEBE pedir al modelo que ofrezca al usuario depurarlo y le diga dónde le conviene poner los puntos de ruptura. Si la sesión tiene un MCP de depuración (las tools `debug_targets` y `debug_launch_plan` del contrato `debug-mcp-contract`), la instrucción DEBE pedir usarlo: consultar qué se puede depurar de los archivos revisados, pedir el plan con esos puntos de ruptura y con los escenarios que ejercitan el código, enseñar el plan al usuario antes de ejecutar ningún paso, ejecutar el modelo solo los pasos de `agent`, decir al usuario los de `user` y seguir los pasos de limpieza cuando el usuario termine de depurar. Si la sesión no lo tiene, o el MCP no da ningún objetivo para lo revisado, la instrucción DEBE pedir al modelo que ofrezca al usuario la orden para ejecutarlo en modo depuración, con el depurador del stack del proyecto, y que esa orden la ejecute el usuario. La instrucción de la revisión de un artefacto del plan y la de los cambios en el plan NO DEBEN pedir ejecutar los tests de aceptación ni el código.

#### Scenario Outline: Las revisiones de código se guían con los tests de aceptación

```gherkin
Given una rama temporal con el change en curso `exportar-datos`, en modo normal
When el plugin abre la revisión de <lo revisado>
Then la instrucción de la revisión pide guiar la verificación con los escenarios de aceptación del change y ejecutarlos
And la instrucción pide que las ejecuciones no dejen archivos que git no ignore
And la instrucción pide ofrecer al usuario la orden para ejecutar en modo depuración el código generado, si lo hay

Examples:
  | lo revisado |
  | la task 3   |
  | el verify   |
```

#### Scenario Outline: Las revisiones de código usan el MCP de depuración si la sesión lo tiene

```gherkin
Given una rama temporal con el change en curso `exportar-datos`, en modo normal
When el plugin abre la revisión de <lo revisado>
Then la instrucción pide usar las tools `debug_targets` y `debug_launch_plan` si la sesión tiene un MCP de depuración
And la instrucción pide enseñar el plan al usuario antes de ejecutar ningún paso
And la instrucción pide que el modelo ejecute solo los pasos de `agent` y diga al usuario los de `user`
And la instrucción pide seguir los pasos de limpieza cuando el usuario termine de depurar

Examples:
  | lo revisado |
  | la task 3   |
  | el verify   |
```

#### Scenario Outline: Las revisiones del plan no ejecutan tests ni código

```gherkin
Given una rama temporal con el change en curso `exportar-datos`, en modo normal
When el plugin abre la revisión <de lo revisado>
Then la instrucción de la revisión no pide ejecutar los tests de aceptación ni el código

Examples:
  | de lo revisado            |
  | del artefacto `design`    |
  | de los cambios en el plan |
```

## ADDED Requirements

### Requirement: La revisión dice cuánto cuesta verificar
En el modo normal, la instrucción de la revisión del artefacto `tasks` y la de los cambios en el plan DEBEN pedir al modelo que compruebe que cada task lleva su estimación de verificación y que ninguna pasa del límite de `rules.tasks` de `openspec/config.yaml`, que señale las que no la lleven o lo pasen, y que dé el total de verificación del change. La instrucción de la revisión de una task DEBE pedir al modelo que empiece por la estimación de verificación de esa task y por el límite, y que avise al usuario si lo que hay que verificar los supera con claridad, recordándole que puede rechazar la revisión para que la task se divida. La instrucción de las demás revisiones NO DEBE hablar de la estimación ni del límite.

#### Scenario Outline: Las revisiones del plan de tasks comprueban las estimaciones

```gherkin
Given una rama temporal con el change en curso `exportar-datos`, en modo normal
When el plugin abre la revisión <de lo revisado>
Then la instrucción pide comprobar que cada task lleva su estimación de verificación y que ninguna pasa del límite
And la instrucción pide dar el total de verificación del change

Examples:
  | de lo revisado            |
  | del artefacto `tasks`     |
  | de los cambios en el plan |
```

#### Scenario: La revisión de una task empieza por su estimación y por el límite

```gherkin
Given una rama temporal con el change en curso `exportar-datos`, en modo normal
When el plugin abre la revisión de la task 3
Then la instrucción pide empezar por la estimación de verificación de la task y por el límite
And la instrucción pide avisar si lo que hay que verificar los supera con claridad
```

#### Scenario Outline: Las demás revisiones no hablan del límite de verificación

```gherkin
Given una rama temporal con el change en curso `exportar-datos`, en modo normal
When el plugin abre la revisión <de lo revisado>
Then la instrucción no habla de la estimación ni del límite de verificación

Examples:
  | de lo revisado         |
  | del artefacto `design` |
  | del verify             |
```
