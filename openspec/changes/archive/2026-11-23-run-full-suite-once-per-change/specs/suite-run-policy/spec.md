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

### Requirement: Cada task ejecuta solo sus escenarios
Las reglas de `tasks` de `openspec/config.yaml` DEBEN pedir que cada task que implementa un paso diga qué escenarios cubre y que se ejecuten solo esos, acotados con `--name`, y comprobar que se ejecutó el número de escenarios esperado, porque un `--name` que no casa con ninguno termina con 0 y sin error. La plantilla de tasks de la skill `spec-as-source` del proyecto DEBE indicarlo en el paso de cada task de implementación y dejar la suite completa para la task de cierre. Las indicaciones de `apply` de `openspec/config.yaml`, incluidas las que gestiona el plugin del autopilot, NO DEBEN cambiar por esto.

#### Scenario: El CLI da la regla de acotar con --name al planificar las tasks

```gherkin
Given un change en curso `exportar-datos`
When se piden las instrucciones del artefacto `tasks` con `openspec instructions tasks --change exportar-datos`
Then las reglas piden que cada task de implementación diga qué escenarios cubre
And las reglas piden ejecutar solo esos escenarios, con `--name`
And las reglas piden comprobar que se ejecutó el número de escenarios esperado
```

#### Scenario: La plantilla de tasks acota cada task y deja la suite completa para el cierre

```gherkin
Given la plantilla de tasks de la skill `spec-as-source` del proyecto
When se revisa qué indica sobre la ejecución de los escenarios
Then indica que cada task de implementación ejecuta solo sus escenarios, con `--name`
And indica que la suite completa se lanza una sola vez, en la task de cierre
```

#### Scenario: Las indicaciones de apply no cambian

```gherkin
Given un clon del proyecto con un change en curso `exportar-datos`
When se piden las instrucciones de `apply` con `openspec instructions apply --change exportar-datos`
Then las indicaciones de apply no mencionan la suite de aceptación
```
