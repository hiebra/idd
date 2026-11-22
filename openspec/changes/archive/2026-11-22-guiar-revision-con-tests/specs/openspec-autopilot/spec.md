# openspec-autopilot

## ADDED Requirements

### Requirement: Revisión guiada con los tests de aceptación
En el modo normal, la instrucción de la sesión de revisión de una task y la de la revisión del verify DEBEN pedir al modelo que guíe la verificación con los escenarios de aceptación del change que cubren lo revisado (todos los del change, en el verify): recorrerlos con el usuario como guion de lo que hay que comprobar, ejecutarlos con el runner de aceptación del proyecto y explicar el resultado. La instrucción DEBE pedir que las ejecuciones no dejen en el árbol de trabajo archivos que git no ignore. Si lo revisado incluye código fuente que se puede ejecutar, la instrucción DEBE pedir al modelo que ofrezca al usuario la orden para ejecutarlo en modo depuración, con el depurador del stack del proyecto, y que esa orden la ejecute el usuario. La instrucción de la revisión de un artefacto del plan y la de los cambios en el plan NO DEBEN pedir ejecutar los tests de aceptación ni el código.

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
