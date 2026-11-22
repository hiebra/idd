# openspec-change-lifecycle

## MODIFIED Requirements

### Requirement: La excepción: el change entero en una rama temporal
Solo con `x-main-protected: true`, DEBE admitirse además hacer todo el change (propuesta, implementación, archive y, con el wiki del proyecto habilitado, resincronización del wiki) en una rama temporal: el apply sin que la propuesta haya llegado a la rama de origen, el archive en la rama temporal y una sola fusión con la rama de origen con `--no-ff`. Con la excepción, cada rama temporal DEBE llevar un solo change.

#### Scenario Outline: El apply con la propuesta solo en la rama temporal

```gherkin
Given un proyecto <veto>
And una rama temporal con el change en curso `exportar-datos`
And la propuesta de `exportar-datos` tiene commit en la rama temporal y no está en la rama de origen
When se lanza la puerta `check apply` de `exportar-datos`
Then la puerta <resultado>

Examples:
  | veto                             | resultado                                                              |
  | con `x-main-protected: true`     | deja seguir                                                            |
  | sin la clave `x-main-protected` | no deja seguir e indica que la propuesta llegue antes a la rama de origen |
```

#### Scenario Outline: El archive en la rama temporal

```gherkin
Given un proyecto <veto>
And una rama temporal con el change `exportar-datos` implementado
And la implementación no está fusionada con la rama de origen
When se lanza la puerta `check archive` de `exportar-datos`
Then la puerta <resultado>

Examples:
  | veto                             | resultado                                                                     |
  | con `x-main-protected: true`     | deja seguir                                                                   |
  | sin la clave `x-main-protected` | no deja seguir e indica archivar en la rama de origen tras fusionar la implementación |
```

#### Scenario: Con la excepción, el archive y el wiki van en la rama temporal

```gherkin
Given un proyecto con el wiki habilitado
And un proyecto con `x-main-protected: true`
And una rama temporal con el change `exportar-datos` implementado
And la implementación no está fusionada con la rama de origen
When se lanza el archive de `exportar-datos` en la rama temporal
Then el change queda archivado en la rama temporal
And la resincronización del wiki se hace en la rama temporal, después del commit del archive
```

#### Scenario: La skill recomienda la fusión con --no-ff en la excepción

```gherkin
Given la skill de disciplina de git del proyecto
When se revisa qué indica sobre la fusión de la rama temporal
Then indica que, con la excepción, la rama llega a la rama de origen en una fusión con `--no-ff`
And indica que el squash también se admite
```

### Requirement: Los commits los hace el usuario y las fusiones, quien el usuario diga
Fuera de un contenedor efímero, ningún workflow de OpenSpec ni ningún componente del proyecto DEBE hacer commits por su cuenta: los hace el usuario. Solo con la excepción, el modelo PUEDE crear la rama temporal del change y cambiar entre ramas temporales, y solo con `branch-change.mjs` y fuera de un contenedor efímero; sin ella, NO DEBE crear ni cambiar de rama salvo que el usuario lo pida. El plugin `openspec-autopilot` PUEDE pasar al stage de git el producto de un paso, y en sus sesiones el modelo NO DEBE pedir commits, porque el plugin espera el commit del usuario. Fuera del autopilot, cuando un paso del ciclo necesita un commit, el workflow DEBE pedírselo al usuario. En un contenedor efímero, los commits y el push los hace el agente, según el requisito «En un contenedor efímero, el agente hace commit y push en la rama de la sesión». Las fusiones las hace el usuario, salvo las que el usuario pide expresamente al agente en la conversación, según el requisito «El agente fusiona solo cuando el usuario se lo pide». En todos los casos, con el wiki del proyecto habilitado, el commit del wiki DEBE ir aparte y después del commit del archive.

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

#### Scenario: Sin la excepción, la skill no deja al modelo crear ramas por su cuenta

```gherkin
Given la skill de disciplina de git del proyecto
When se revisa qué indica sobre crear ramas o cambiar de rama
Then indica que solo con la excepción el modelo crea o cambia de rama con `branch-change.mjs`
And indica que sin la excepción solo lo hace si el usuario lo pide
```

### Requirement: Commits provisionales de una sola zona
En una rama temporal DEBEN admitirse commits provisionales, que guardan trabajo a medias sin esperar a un momento de commit del ciclo. Ningún commit, provisional o no, DEBE mezclar la zona de specs (`openspec/`, salvo los `tasks.md` y `openspec/config.yaml`) con la zona de código (todo lo demás), salvo un commit de fusión: los commits que trae ya respetaban las zonas. Los `tasks.md` y `openspec/config.yaml` son neutros: pueden ir en un commit de cualquiera de las dos zonas. `openspec/config.yaml` es neutro porque es la configuración de OpenSpec, no una spec, y `/toggle-wiki` lo cambia junto con archivos de la zona de código.

#### Scenario Outline: La puerta check commit comprueba las zonas

```gherkin
Given un contenedor efímero con `claude/exportar` guardada como rama de la sesión
And el clon está en la rama temporal `claude/exportar`
And hay cambios pendientes en <rutas>
When se ejecuta la puerta `check commit`
Then la puerta <resultado>

Examples:
  | rutas                                                            | resultado      |
  | `openspec/changes/exportar-datos/design.md`                      | deja seguir    |
  | `src/exportar.js`                                                | deja seguir    |
  | `src/exportar.js` y `openspec/changes/exportar-datos/tasks.md`   | deja seguir    |
  | `src/exportar.js` y `openspec/changes/exportar-datos/design.md`  | no deja seguir |
  | `.agents/wiki/engine.json` y `openspec/config.yaml`              | deja seguir    |
  | `openspec/config.yaml` y `openspec/changes/exportar-datos/design.md` | deja seguir |
```

### Requirement: Tras el archive se propone la fusión con las ramas de x-main
Tras el commit del archive y, con el wiki del proyecto habilitado, tras el del wiki, el agente DEBE proponer al usuario fusionar la rama del change con cada rama de `x-main`, en el orden de la lista, y el usuario PUEDE saltarse cualquiera o todas. NO DEBE proponer una rama cuyo `origin/<rama>` ya contiene la rama del change (`git merge-base --is-ancestor`). `node .agents/openspec/branch-change.mjs merge-targets [--json]` DEBE dar esas ramas, en ese orden, y para cada una si la rama del change ya contiene `origin/<rama>` o hay que traerla antes. Cada fusión que acepte el usuario sigue la puerta `check merge`: si hay que traer antes `origin/<rama>`, se trae con el ok de la resolución, y en un contenedor efímero la fusión con la rama permanente se hace por PR. La skill de disciplina de git y las indicaciones de archivado de `openspec/config.yaml` DEBEN indicarlo, también con el wiki deshabilitado: en las indicaciones de archivado, la propuesta de fusión DEBE ser una indicación propia, fuera de los pasos del wiki.

#### Scenario Outline: Las ramas que se proponen tras el archive

```gherkin
Given un proyecto con `x-main: [main, develop]` en `openspec/config.yaml`
And una rama temporal con el change archivado `exportar-datos`
And <fusiones>
When se consultan las ramas a las que proponer la fusión
Then <propuesta>

Examples:
  | fusiones                                              | propuesta                              |
  | ni `origin/main` ni `origin/develop` contienen la rama | se proponen `main` y `develop`, en ese orden |
  | `origin/main` ya contiene la rama                      | se propone solo `develop`              |
  | las dos ya contienen la rama                           | no se propone ninguna                  |
```

#### Scenario: La propuesta de fusión está en la skill y en las indicaciones de archivado

```gherkin
Given la skill de disciplina de git y el `openspec/config.yaml` del proyecto
When se revisa qué dicen sobre lo que sigue al archive
Then los dos indican proponer la fusión con cada rama de `x-main`, en el orden de la lista, con `merge-targets`
And los dos indican que en un contenedor efímero la fusión con una rama permanente se hace por PR
```
