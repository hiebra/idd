# openspec-change-lifecycle

## MODIFIED Requirements

### Requirement: Un change, una rama y una sola fusión
La forma recomendada del ciclo es hacer todo el change (propuesta, implementación, archive y, con el wiki del proyecto habilitado, resincronización del wiki) en una sola rama temporal, archivar en ella y llevarla a la rama de origen en una única fusión con `--no-ff`. La skill de disciplina de git DEBE recomendarla, y el ciclo DEBE poder hacerse entero así. Los workflows de OpenSpec NO DEBEN exigir que la propuesta haya llegado a la rama de origen antes del apply. DEBE admitirse además la forma canónica de intent-driven: fusionar la propuesta con la rama de origen antes del apply, y archivar en la rama de origen después de fusionar la implementación. Un change en curso en la rama de origen DEBE poder archivarse allí solo si todas sus tasks están hechas.

#### Scenario: El apply empieza con la propuesta solo en la rama temporal

```gherkin
Given una rama temporal con el change en curso `exportar-datos`
And la propuesta de `exportar-datos` tiene commit en la rama temporal y no está en la rama de origen
When se lanza el apply de `exportar-datos`
Then el apply no se detiene porque la propuesta no esté en la rama de origen
```

#### Scenario: El apply empieza con la propuesta ya fusionada en la rama de origen

```gherkin
Given una rama de origen con el change en curso `exportar-datos` sin tasks hechas
And una rama temporal que sale de ella después de ese change
When se lanza el apply de `exportar-datos` en la rama temporal
Then el apply no se detiene
```

#### Scenario: El archive se hace en la rama temporal

```gherkin
Given un proyecto con el wiki habilitado
And una rama temporal con el change `exportar-datos` implementado
And la implementación no está fusionada con la rama de origen
When se lanza el archive de `exportar-datos` en la rama temporal
Then el change queda archivado en la rama temporal
And la resincronización del wiki se hace en la rama temporal, después del commit del archive
```

#### Scenario: El archive no se hace en una rama permanente

```gherkin
Given el clon está en la rama de origen
And la rama de origen no tiene el change en curso `exportar-datos`
When se lanza el archive de un change
Then el archive se detiene
And se indica que el archive se hace en la rama temporal del change
```

#### Scenario Outline: El archive en la rama de origen

```gherkin
Given el clon está en la rama de origen
And la rama de origen tiene el change en curso `exportar-datos` con <tasks>
When se lanza la puerta `check archive` de `exportar-datos`
Then la puerta <resultado>

Examples:
  | tasks                 | resultado                                          |
  | todas las tasks hechas | deja seguir                                        |
  | tasks sin hacer        | no deja seguir e indica que faltan tasks por hacer |
```

#### Scenario: La skill recomienda la fusión con --no-ff

```gherkin
Given la skill de disciplina de git del proyecto
When se revisa qué indica sobre la fusión de la rama temporal
Then recomienda la forma de una rama con una fusión con `--no-ff`
And indica que la forma canónica y el squash también se admiten
```

### Requirement: Los commits y las fusiones los hace el usuario
Fuera de un contenedor efímero, ningún workflow de OpenSpec ni ningún componente del proyecto DEBE hacer commits ni fusiones por su cuenta: los hace el usuario. El modelo PUEDE crear la rama temporal del change y cambiar entre ramas temporales, solo con `branch-change.mjs`. El plugin `openspec-autopilot` PUEDE pasar al stage de git el producto de un paso, y en sus sesiones el modelo NO DEBE pedir commits, porque el plugin espera el commit del usuario. Fuera del autopilot, cuando un paso del ciclo necesita un commit, el workflow DEBE pedírselo al usuario. En un contenedor efímero, los commits y el push los hace el agente, según el requisito «En un contenedor efímero, el agente hace commit y push en la rama de la sesión». Las fusiones las hace siempre el usuario. En todos los casos, con el wiki del proyecto habilitado, el commit del wiki DEBE ir aparte y después del commit del archive.

#### Scenario: Un artefacto terminado queda sin commit

```gherkin
Given una rama temporal con el change en curso `exportar-datos`
When un workflow termina un artefacto de `exportar-datos` fuera del autopilot
Then el artefacto queda sin commit
And se pide al usuario que haga el commit
```

#### Scenario: El commit del wiki va después del commit del archive

```gherkin
Given la skill de disciplina de git del proyecto
When se revisa qué indica sobre los commits del archive y del wiki
Then indica hacer el commit del archive aparte
And indica hacer el commit del wiki después del commit del archive
And indica que el commit del wiki solo existe con el wiki del proyecto habilitado
```

#### Scenario: En el autopilot, el modelo no pide commits

```gherkin
Given una sesión del autopilot que crea un artefacto de `exportar-datos`
When se lee la instrucción del paso
Then la instrucción no pide al usuario ningún commit
And la instrucción dice que el modelo no haga commits ni pase nada al stage
```
