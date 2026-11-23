# suite-run-policy

## Purpose
Cuándo se lanza la suite de aceptación completa (`npm test` en `acceptance-tests/`) y cuándo solo una parte. La suite tarda unos 10 minutos en un contenedor de la nube y crece con cada change, así que se lanza completa una sola vez por change, en la task final y con `origin/main` ya traído a la rama; antes, cada task ejecuta solo sus escenarios. Las reglas viven en `openspec/config.yaml` y llegan al modelo por el CLI de OpenSpec, igual en Claude Code y en OpenCode.

## ADDED Requirements

### Requirement: Solo la última task lanza la suite completa
Las reglas de `tasks` de `openspec/config.yaml` DEBEN pedir que el `tasks.md` de un change tenga una sola task que lance la suite completa, que sea la última, y que no haya ninguna task que la lance antes de implementar. DEBEN pedir también que, antes de esa pasada, se haga `git fetch` y, si la rama de origen ha avanzado, se proponga al usuario traerla a la rama del change, para que la pasada pruebe lo que llegará a la rama de origen. Las demás tasks DEBEN ejecutar solo los escenarios que cubren.

#### Scenario: El CLI da las reglas de la pasada única al planificar las tasks

```gherkin
Given un change en curso `exportar-datos`
When se piden las instrucciones del artefacto `tasks` con `openspec instructions tasks --change exportar-datos`
Then las reglas piden una sola task que lance la suite completa, la última
And las reglas piden no incluir una task que la lance antes de implementar
And las reglas piden hacer `git fetch` antes de esa pasada y proponer traer la rama de origen si ha avanzado
```

### Requirement: Durante una task se ejecutan solo sus escenarios
Las indicaciones de apply de `openspec/config.yaml` DEBEN pedir que, al implementar una task, se ejecuten solo los escenarios que esa task cubre, acotados con `--name`, y que la suite completa quede para la última task. Esa indicación DEBE estar con las indicaciones de una task por sesión del autopilot y sin ellas, y NO DEBE depender del modo del autopilot.

#### Scenario Outline: El CLI da la indicación de apply con y sin las indicaciones del autopilot

```gherkin
Given un clon del proyecto cuyo `openspec/config.yaml` <estado> las indicaciones de una task por sesión
When se piden las instrucciones de `apply` con `openspec instructions apply --change exportar-datos`
Then las indicaciones piden ejecutar solo los escenarios de la task en curso, con `--name`
And las indicaciones piden dejar la suite completa para la última task

Examples:
  | estado       |
  | tiene        |
  | no tiene     |
```

#### Scenario: Cargar el plugin del autopilot conserva la indicación

```gherkin
Given un usuario con el plugin en modo normal
And un clon del proyecto cuyo `openspec/config.yaml` no tiene las indicaciones de una task por sesión
When se carga el plugin
Then `openspec/config.yaml` tiene las indicaciones de una task por sesión
And las instrucciones de `apply` siguen pidiendo ejecutar solo los escenarios de la task en curso
```
