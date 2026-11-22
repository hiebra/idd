# openspec-change-lifecycle Specification

## Purpose
El ciclo git de un change es el mismo en los dos agentes soportados (Claude Code y OpenCode 2). La regla es la de la skill estándar de intent-driven: la propuesta llega a la rama de origen (la última de `x-main`, o `main`) antes del apply, y el archive se hace en la rama de origen después de fusionar la implementación. La única excepción, cuando `openspec/config.yaml` declara con `x-main-protected: true` que el acceso directo a las ramas permanentes está vetado, es hacer el change entero en una rama temporal y llevarlo a la rama de origen en una sola fusión. El change de cada rama se lee de git, sin apuntarlo en ningún sitio, y las puertas de `branch-change.mjs` deciden cada paso.

## Requirements

### Requirement: Ramas permanentes configurables
Las ramas permanentes DEBEN ser las de la lista ordenada `x-main` de `openspec/config.yaml`, o `["main"]` si no está. Su último elemento es la rama de origen, de la que salen todas las ramas temporales. Una rama temporal es cualquier rama local fuera de la lista; con HEAD separado no hay ninguna. La clave NO DEBE hacer fallar ningún comando de OpenSpec.

#### Scenario: Sin x-main, la única rama permanente es main

```gherkin
Given un proyecto cuyo `openspec/config.yaml` no tiene la clave `x-main`
When se consultan las ramas permanentes del proyecto
Then la única rama permanente es `main`
And la rama de origen es `main`
```

#### Scenario: La rama de origen es la última de x-main

```gherkin
Given un proyecto con `x-main: [main, develop]` en `openspec/config.yaml`
When se consultan las ramas permanentes del proyecto
Then las ramas permanentes son `main` y `develop`
And la rama de origen es `develop`
```

#### Scenario Outline: Qué rama es temporal

```gherkin
Given un proyecto con `x-main: [main, develop]` en `openspec/config.yaml`
When el clon está en <posición>
Then <resultado>

Examples:
  | posición                      | resultado                    |
  | la rama `main`                | no hay rama temporal         |
  | la rama `develop`             | no hay rama temporal         |
  | la rama `feature/exportar`    | la rama temporal es la suya  |
  | un commit con HEAD separado   | no hay rama temporal         |
```

#### Scenario: OpenSpec acepta la clave x-main

```gherkin
Given un proyecto con `x-main: [main, develop]` en `openspec/config.yaml`
When se ejecutan `openspec list`, `openspec status`, `openspec instructions` y `openspec validate`
Then ninguno falla ni avisa por la clave `x-main`
```

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

### Requirement: Los commits y las fusiones los hace el usuario
Fuera de un contenedor efímero, ningún workflow de OpenSpec ni ningún componente del proyecto DEBE hacer commits ni fusiones por su cuenta: los hace el usuario. Solo con la excepción, el modelo PUEDE crear la rama temporal del change y cambiar entre ramas temporales, y solo con `branch-change.mjs`; sin ella, NO DEBE crear ni cambiar de rama salvo que el usuario lo pida. El plugin `openspec-autopilot` PUEDE pasar al stage de git el producto de un paso, y en sus sesiones el modelo NO DEBE pedir commits, porque el plugin espera el commit del usuario. Fuera del autopilot, cuando un paso del ciclo necesita un commit, el workflow DEBE pedírselo al usuario. En un contenedor efímero, los commits y el push los hace el agente, según el requisito «En un contenedor efímero, el agente hace commit y push en la rama de la sesión». Las fusiones las hace siempre el usuario. En todos los casos, el commit del wiki DEBE ir aparte y después del commit del archive.

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

### Requirement: En un contenedor efímero, el agente hace commit y push en la rama de la sesión
Un contenedor efímero es una sesión con `CLAUDE_CODE_CONTAINER_ID` no vacía y `CLAUDE_CODE_REMOTE=true`. En un contenedor efímero, el agente DEBE hacer commit y push en la rama de la sesión sin preguntar, en los momentos de commit del ciclo y cada vez que el entorno avisa al final de un turno de que hay cambios pendientes. El push DEBE ir solo a `origin/<rama de la sesión>`. El agente NO DEBE fusionar, cambiar de rama, crear ramas ni hacer push a ninguna otra.

#### Scenario: La skill indica cuándo hace el agente commit y push

```gherkin
Given la skill de disciplina de git del proyecto
When se revisa qué indica sobre los commits en un contenedor efímero
Then indica ejecutar la puerta `check commit` antes de cada commit
And indica hacer commit y push en los momentos de commit y cuando avisa el final de un turno
And indica hacer el push solo a la rama de la sesión
And indica no fusionar, no cambiar de rama y no hacer push a otras ramas
```

### Requirement: La puerta check commit autoriza cada commit del agente
Antes de cada commit en un contenedor efímero, el agente DEBE ejecutar `node .agents/openspec/branch-change.mjs check commit`, que imprime `{ ok, message }` y sale con 0 solo si:
- la sesión está en un contenedor efímero;
- hay una rama de la sesión guardada en `git config idd.sessionBranch` y el clon está en ella;
- esa rama es temporal;
- los cambios pendientes son de una sola zona de `spec-as-source`.

Si no sale con 0, el agente NO DEBE hacer el commit.

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
Given un proyecto con `x-main-protected: true`
And una rama temporal con el change `exportar-datos` implementado
And la rama temporal añade el ADR `adr/0011-exportar-en-csv.md`
And la rama de origen tiene <adr>
When se lanza la puerta `check archive` de `exportar-datos`
Then la puerta <resultado>

Examples:
  | adr                                          | resultado                                     |
  | hasta `adr/0010-otra-decision.md`            | deja seguir                                   |
  | `adr/0011-importar-en-lote.md`               | no deja seguir e indica renumerar `0011`      |
```

### Requirement: El modelo crea la rama temporal del change y cambia entre ramas temporales
`.agents/openspec/branch-change.mjs` DEBE permitir, a los dos agentes, listar las ramas temporales con el change de cada una, crear la rama temporal de un change y cambiar a una rama temporal existente. La rama nueva DEBE salir siempre de la rama de origen (la última de `x-main`, o `main`) y llamarse como el change. Crear o cambiar de rama NO DEBE hacerse con el árbol de trabajo sucio, ni a una rama permanente, ni sobre una rama que ya exista al crearla. Los workflows DEBEN usar estos subcomandos en lugar de leer o escribir git a mano. En un contenedor efímero, el agente NO DEBE usarlos: trabaja solo en la rama de la sesión.

#### Scenario: Crear la rama del change desde cualquier rama

```gherkin
Given el clon está en una rama temporal con el change en curso `importar-datos`, con el árbol limpio
When se crea la rama del change `exportar-datos` con `branch-change.mjs`
Then el clon queda en la rama `exportar-datos`
And la rama `exportar-datos` sale de la rama de origen
```

#### Scenario: No se crea la rama con el árbol sucio

```gherkin
Given el clon está en la rama de origen con cambios sin commit
When se crea la rama del change `exportar-datos` con `branch-change.mjs`
Then no se crea ninguna rama
And se indica que hay que hacer antes el commit o guardar los cambios
```

#### Scenario: Listar las ramas temporales con su change

```gherkin
Given una rama temporal `exportar-datos` con el change en curso `exportar-datos`
And una rama temporal `pruebas` sin change
When se listan las ramas temporales con `branch-change.mjs`
Then la lista tiene la rama `exportar-datos` con el change `exportar-datos`
And la lista tiene la rama `pruebas` sin change
And la lista no tiene la rama de origen
```

#### Scenario: Cambiar a otra rama temporal

```gherkin
Given una rama temporal `exportar-datos` con el change en curso `exportar-datos`
And el clon está en la rama de origen con el árbol limpio
When se cambia a la rama `exportar-datos` con `branch-change.mjs`
Then el clon queda en la rama `exportar-datos`
```

### Requirement: El veto del acceso directo a las ramas permanentes se declara en la configuración
El veto del acceso directo a las ramas permanentes DEBE declararse con la clave `x-main-protected: true` en `openspec/config.yaml`. Sin la clave, o con cualquier otro valor, no hay veto. La excepción a la regla del ciclo DEBE estar disponible solo con el veto declarado. La clave NO DEBE hacer fallar ningún comando de OpenSpec.

#### Scenario Outline: Cuándo hay excepción

```gherkin
Given un proyecto <veto>
When se consulta si el proyecto tiene la excepción a la regla del ciclo
Then <resultado>

Examples:
  | veto                          | resultado                  |
  | con `x-main-protected: true`  | la excepción está disponible    |
  | con `x-main-protected: false` | la excepción no está disponible |
  | sin la clave `x-main-protected` | la excepción no está disponible |
```

#### Scenario: OpenSpec acepta la clave x-main-protected

```gherkin
Given un proyecto con `x-main-protected: true`
When se ejecutan `openspec list`, `openspec status`, `openspec instructions` y `openspec validate`
Then ninguno falla ni avisa por la clave `x-main-protected`
```

### Requirement: La regla estándar del ciclo
La regla del ciclo DEBE ser la de la skill estándar de intent-driven: la propuesta llega a la rama de origen antes del apply; el apply PUEDE hacerse en la rama de origen, en una rama temporal o en un worktree; y el archive se hace en la rama de origen, después de fusionar la implementación. Nada de lo que la regla permite DEBE detenerse ni llevar avisos, tampoco archivar en la rama de origen con tasks sin hacer, de las que ya avisa el archive de OpenSpec. Si el usuario no dice qué forma sigue, DEBE seguirse la regla.

#### Scenario: El apply empieza con la propuesta ya fusionada en la rama de origen

```gherkin
Given una rama de origen con el change en curso `exportar-datos` sin tasks hechas
And una rama temporal que sale de ella después de ese change
When se lanza el apply de `exportar-datos` en la rama temporal
Then el apply no se detiene
```

#### Scenario: El apply en la rama de origen, sin avisos

```gherkin
Given un proyecto sin la clave `x-main-protected`
And el clon está en la rama de origen
And la rama de origen tiene el change en curso `exportar-datos` con tasks sin hacer
When se lanza la puerta `check apply` de `exportar-datos`
Then la puerta deja seguir
And la puerta no avisa de nada
```

#### Scenario: El archive no se hace en una rama permanente sin el change en curso

```gherkin
Given el clon está en la rama de origen
And la rama de origen no tiene el change en curso `exportar-datos`
When se lanza el archive de un change
Then el archive se detiene
And se indica que el change no está en curso en la rama de origen
```

#### Scenario Outline: El archive en la rama de origen, con tasks hechas o sin hacer

```gherkin
Given el clon está en la rama de origen
And la rama de origen tiene el change en curso `exportar-datos` con <tasks>
When se lanza la puerta `check archive` de `exportar-datos`
Then la puerta deja seguir
And la puerta no avisa de nada

Examples:
  | tasks                  |
  | todas las tasks hechas |
  | tasks sin hacer        |
```

### Requirement: La excepción: el change entero en una rama temporal
Solo con `x-main-protected: true`, DEBE admitirse además hacer todo el change (propuesta, implementación, archive y resincronización del wiki) en una rama temporal: el apply sin que la propuesta haya llegado a la rama de origen, el archive en la rama temporal y una sola fusión con la rama de origen con `--no-ff`. Con la excepción, cada rama temporal DEBE llevar un solo change.

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
Given un proyecto con `x-main-protected: true`
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

### Requirement: La forma de una rama se presenta como excepción justificada
La skill de disciplina de git DEBE partir del texto de la skill estándar de intent-driven y presentar sus reglas como la regla del ciclo. La forma de una rama DEBE presentarse en una sección propia, marcada como excepción a la regla, con su causa: el acceso directo a las ramas permanentes está vetado, y la regla exige archivar en la rama de origen. La sección DEBE indicar que la excepción solo vale con `x-main-protected: true`. Las indicaciones de archivado de `openspec/config.yaml` DEBEN decir lo mismo sobre dónde se archiva. Ninguna de las dos DEBE presentar la regla como una opción menos recomendable que la excepción.

#### Scenario: La regla y la excepción en la skill y en las indicaciones de archivado

```gherkin
Given la skill de disciplina de git y el `openspec/config.yaml` del proyecto
When se revisa qué dicen sobre dónde se archiva
Then los dos dicen que la regla es archivar en la rama de origen tras fusionar la implementación
And los dos presentan la forma de una rama como excepción, con su causa y la clave `x-main-protected`
And ninguno recomienda la excepción sobre la regla
```

### Requirement: Las puertas admiten la regla sin avisos y la excepción solo con su causa
Ninguna puerta de `branch-change.mjs` DEBE impedir ni llevar avisos en un paso que la regla permite. Los pasos que solo permite la excepción DEBEN dejarse seguir solo con `x-main-protected: true`. `check propose` DEBE dejar proponer en la rama de origen sin avisos. En una rama temporal, sin la excepción, DEBE dejar seguir avisando de que la regla prefiere proponer en la rama de origen, como la skill estándar. Con la excepción, NO DEBE dejar proponer en una rama temporal que ya tiene otro change. Cuando una puerta no deja seguir, su mensaje DEBE decir cómo seguir.

#### Scenario: Proponer en la rama de origen, sin avisos

```gherkin
Given el clon está en la rama de origen
And la rama de origen no tiene ningún change en curso
When se ejecuta la puerta `check propose`
Then la puerta deja seguir
And la puerta no avisa de nada
```

#### Scenario Outline: Proponer en una rama temporal

```gherkin
Given un proyecto <veto>
And una rama temporal que sale de la rama de origen
When se ejecuta la puerta `check propose`
Then la puerta deja seguir
And <aviso>

Examples:
  | veto                             | aviso                                                    |
  | con `x-main-protected: true`     | la puerta no avisa de nada                               |
  | sin la clave `x-main-protected` | se avisa de que la regla prefiere proponer en la rama de origen |
```

#### Scenario Outline: Una rama temporal con varios changes

```gherkin
Given un proyecto <veto>
And una rama temporal con los changes en curso `exportar-datos` e `importar-datos`
When se ejecuta la puerta `check propose`
Then <resultado>

Examples:
  | veto                             | resultado                                                          |
  | con `x-main-protected: true`     | la puerta no deja seguir y su mensaje dice cómo dejar un solo change en la rama |
  | sin la clave `x-main-protected` | la puerta deja seguir                                              |
```
