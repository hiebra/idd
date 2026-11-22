# openspec-change-lifecycle

El ciclo de una rama y una sola fusión (ADR-0007) pasa a ser la forma recomendada, y se admite también la forma canónica de intent-driven. Además se adapta a clones con la rama de origen local atrasada, a sesiones en contenedores efímeros, donde el agente hace commit y push en la rama de la sesión, al squash y a ramas concurrentes que crean ADRs.

## MODIFIED Requirements

### Requirement: El change de una rama temporal se lee de git
El change de una rama temporal DEBE ser el que aparece en `openspec/changes/` entre el merge-base de la rama con la rama de origen y el árbol de trabajo, contando los cambios sin commit. Un change está en curso si su directorio es `openspec/changes/<nombre>/`, y archivado si es `openspec/changes/archive/<fecha>-<nombre>/`. Ese estado NO DEBE guardarse en ningún otro sitio del repositorio ni depender del nombre de la rama. Si existen la rama de origen local y `origin/<rama de origen>`, el merge-base DEBE calcularse contra la más avanzada de las dos, cuando una contiene a la otra; si han divergido, contra la local, con un aviso. Un change cuyo directorio, en curso o archivado, ya está en la rama de origen con el mismo contenido que en el árbol de trabajo NO DEBE contar como change de la rama temporal, aunque los commits de la rama no hayan llegado a la de origen, como pasa tras un squash.

#### Scenario Outline: Estado de la rama según lo que ha cambiado en openspec/changes/

```gherkin
Given una rama temporal que sale de la rama de origen
And desde su merge-base ha cambiado en `openspec/changes/` <contenido>
When se consulta el change de la rama
Then la rama está <estado>

Examples:
  | contenido                                         | estado                          |
  | nada                                              | sin change                      |
  | `exportar-datos/`, sin commit                     | con el change en curso `exportar-datos` |
  | `exportar-datos/`, con commit                     | con el change en curso `exportar-datos` |
  | `archive/2026-11-21-exportar-datos/`              | con el change archivado `exportar-datos` |
  | `exportar-datos/` y `importar-datos/`             | con varios changes              |
```

#### Scenario: Los changes de la rama de origen no cuentan

```gherkin
Given una rama de origen con el change en curso `importar-datos`
And una rama temporal que sale de ella después de ese change
When se consulta el change de la rama temporal
Then la rama está sin change
```

#### Scenario: La rama de origen local está atrasada respecto a la remota

```gherkin
Given una rama de origen remota con el change archivado `importar-datos`
And la rama de origen local está atrasada y no tiene ese change
And una rama temporal que sale de la rama de origen remota
When se consulta el change de la rama temporal
Then la rama está sin change
```

#### Scenario: Tras un squash, el change fusionado no cuenta en la rama temporal

```gherkin
Given una rama temporal con el change archivado `exportar-datos`
And la rama temporal se ha fusionado con squash con la rama de origen
And en la rama temporal se crea después el change `importar-datos`
When se consulta el change de la rama temporal
Then la rama está con el change en curso `importar-datos`
```

#### Scenario: La rama de origen local y la remota han divergido

```gherkin
Given la rama de origen local y la remota han divergido
And una rama temporal que sale de la rama de origen local
When se consulta el change de la rama temporal
Then el merge-base se calcula contra la rama de origen local
And se avisa de que la rama de origen local y la remota han divergido
```

### Requirement: Un change, una rama y una sola fusión
La forma recomendada del ciclo es hacer todo el change (propuesta, implementación, archive y resincronización del wiki) en una sola rama temporal, archivar en ella y llevarla a la rama de origen en una única fusión con `--no-ff`. La skill de disciplina de git DEBE recomendarla, y el ciclo DEBE poder hacerse entero así. Los workflows de OpenSpec NO DEBEN exigir que la propuesta haya llegado a la rama de origen antes del apply. DEBE admitirse además la forma canónica de intent-driven: fusionar la propuesta con la rama de origen antes del apply, y archivar en la rama de origen después de fusionar la implementación. Un change en curso en la rama de origen DEBE poder archivarse allí solo si todas sus tasks están hechas.

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
Given una rama temporal con el change `exportar-datos` implementado
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
Fuera de un contenedor efímero, ningún workflow de OpenSpec ni ningún componente del proyecto DEBE hacer commits ni fusiones por su cuenta: cuando un paso del ciclo necesita un commit, DEBE pedírselo al usuario. En un contenedor efímero, los commits y el push los hace el agente, según el requisito «En un contenedor efímero, el agente hace commit y push en la rama de la sesión». Las fusiones las hace siempre el usuario. En los dos casos, el commit del wiki DEBE ir aparte y después del commit del archive.

#### Scenario: Un artefacto terminado queda sin commit

```gherkin
Given una rama temporal con el change en curso `exportar-datos`
When un workflow termina un artefacto de `exportar-datos`
Then el artefacto queda sin commit
And se pide al usuario que haga el commit
```

#### Scenario: El commit del wiki va después del commit del archive

```gherkin
Given la skill de disciplina de git del proyecto
When se revisa qué indica sobre los commits del archive y del wiki
Then indica hacer el commit del archive aparte
And indica hacer el commit del wiki después del commit del archive
```

## ADDED Requirements

### Requirement: En un contenedor efímero, el agente hace commit y push en la rama de la sesión
Un contenedor efímero es una sesión con `CLAUDE_CODE_CONTAINER_ID` no vacía y `CLAUDE_CODE_REMOTE=true`. En un contenedor efímero, el agente DEBE hacer commit y push en la rama de la sesión sin preguntar. Lo hace en los momentos de commit del ciclo y cada vez que el entorno avisa al final de un turno de que hay cambios pendientes. Antes de cada commit DEBE ejecutar `node .agents/openspec/branch-change.mjs check commit`, que imprime `{ ok, message }` y sale con 0 solo si:
- la sesión está en un contenedor efímero;
- hay una rama de la sesión guardada en `git config idd.sessionBranch` y el clon está en ella;
- esa rama es temporal;
- los cambios pendientes son de una sola zona de `spec-as-source`.

Si no sale con 0, el agente NO DEBE hacer el commit. El push DEBE ir solo a `origin/<rama de la sesión>`. El agente NO DEBE fusionar, cambiar de rama, crear ramas ni hacer push a ninguna otra.

#### Scenario Outline: Cuándo deja hacer commit la puerta check commit

```gherkin
Given un clon en la rama temporal `claude/exportar` con cambios pendientes en una sola zona
And <situación>
When se ejecuta la puerta `check commit`
Then la puerta <resultado>

Examples:
  | situación                                                       | resultado     |
  | la sesión está en un contenedor efímero con `claude/exportar` guardada como rama de la sesión | deja seguir   |
  | la sesión no está en un contenedor efímero                      | no deja seguir |
  | la sesión está en un contenedor efímero sin rama de la sesión guardada | no deja seguir |
  | la sesión está en un contenedor efímero con `claude/otra` guardada como rama de la sesión | no deja seguir |
```

#### Scenario: La puerta no deja hacer commit en una rama permanente

```gherkin
Given un contenedor efímero con `main` guardada como rama de la sesión
And el clon está en la rama `main` con cambios pendientes
When se ejecuta la puerta `check commit`
Then la puerta no deja seguir
And se indica que los commits del agente van solo a una rama temporal
```

#### Scenario: Fuera de un contenedor efímero, los commits los hace el usuario

```gherkin
Given una sesión que no está en un contenedor efímero
When se ejecuta la puerta `check commit`
Then la puerta no deja seguir
And se indica que los commits los hace el usuario
```

#### Scenario: La skill indica cuándo hace el agente commit y push

```gherkin
Given la skill de disciplina de git del proyecto
When se revisa qué indica sobre los commits en un contenedor efímero
Then indica ejecutar la puerta `check commit` antes de cada commit
And indica hacer commit y push en los momentos de commit y cuando avisa el final de un turno
And indica hacer el push solo a la rama de la sesión
And indica no fusionar, no cambiar de rama y no hacer push a otras ramas
```

### Requirement: Commits provisionales de una sola zona
En una rama temporal DEBEN admitirse commits provisionales, que guardan trabajo a medias sin esperar a un momento de commit del ciclo. Ningún commit, provisional o no, DEBE mezclar la zona de specs (`openspec/`, salvo los `tasks.md`) con la zona de código (todo lo demás).

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
```

### Requirement: El ciclo no depende de que los commits de la rama lleguen a la rama de origen
Ningún paso del ciclo DEBE depender de que los commits de la rama temporal lleguen a la rama de origen, para que el squash no rompa nada.

#### Scenario: La skill admite el squash

```gherkin
Given la skill de disciplina de git del proyecto
When se revisa qué indica sobre el squash
Then indica que el squash se admite
And indica que las citas del wiki a commits de la rama se resuelven entonces por su blob
```

### Requirement: Números de ADR sin choques entre ramas
El número de un ADR nuevo DEBE ser uno más que el más alto de `adr/` en la rama de origen remota y en todas las ramas remotas, después de un `git fetch`. La puerta `check archive` NO DEBE dejar archivar si un ADR nuevo de la rama usa un número que ya tiene otro ADR en la rama de origen, y DEBE indicar que hay que renumerar los ADRs nuevos de la rama.

#### Scenario: Las reglas del artefacto adr miran todas las ramas remotas

```gherkin
Given el `openspec/config.yaml` del proyecto
When se consultan las instrucciones del artefacto `adr` de un change
Then indican hacer `git fetch` antes de numerar
And indican tomar el número más alto de `adr/` en la rama de origen remota y en todas las ramas remotas
```

#### Scenario Outline: El archive comprueba los números de los ADRs nuevos

```gherkin
Given una rama temporal con el change `exportar-datos` implementado
And la rama temporal añade el ADR `adr/0011-exportar-en-csv.md`
And la rama de origen tiene <adr>
When se lanza la puerta `check archive` de `exportar-datos`
Then la puerta <resultado>

Examples:
  | adr                                          | resultado                                     |
  | hasta `adr/0010-otra-decision.md`            | deja seguir                                   |
  | `adr/0011-importar-en-lote.md`               | no deja seguir e indica renumerar `0011`      |
```

### Requirement: Cuándo conviene cada forma del ciclo, donde se archiva
La skill de disciplina de git y las indicaciones de archivado de `openspec/config.yaml` DEBEN explicar las dos formas del ciclo y cuándo conviene cada una. La forma recomendada, con el archive en la rama temporal y una fusión con `--no-ff`, hace que el plan, el código, el archive y el wiki lleguen en una sola fusión, y que la rama permanente no reciba commits directos. La forma canónica de intent-driven permite revisar el plan aparte y reserva pronto los números de ADR, a cambio de tres fusiones y de commits del archive y del wiki en la rama permanente. Las dos DEBEN presentar la forma canónica como admitida, no como una infracción.

#### Scenario: Las dos formas del ciclo están en la skill y en las indicaciones de archivado

```gherkin
Given la skill de disciplina de git y el `openspec/config.yaml` del proyecto
When se revisa qué dicen sobre dónde se archiva
Then los dos explican la forma recomendada y la forma canónica, con cuándo conviene cada una
And ninguno trata la forma canónica como una infracción
```

### Requirement: Las puertas admiten las dos formas del ciclo
Ninguna puerta de `branch-change.mjs` DEBE impedir un paso de la forma recomendada ni de la forma canónica. `check propose` DEBE dejar proponer en la rama de origen, avisando de que la forma recomendada es proponer en una rama temporal. Cuando una puerta no deja seguir, su mensaje DEBE decir cómo seguir.

#### Scenario: Proponer en la rama de origen

```gherkin
Given el clon está en la rama de origen
And la rama de origen no tiene ningún change en curso
When se ejecuta la puerta `check propose`
Then la puerta deja seguir
And se avisa de que la forma recomendada es proponer en una rama temporal
```

#### Scenario: El mensaje de una puerta que no deja seguir dice cómo seguir

```gherkin
Given una rama temporal con los changes en curso `exportar-datos` e `importar-datos`
When se ejecuta la puerta `check propose`
Then la puerta no deja seguir
And su mensaje dice cómo dejar un solo change en la rama
```
