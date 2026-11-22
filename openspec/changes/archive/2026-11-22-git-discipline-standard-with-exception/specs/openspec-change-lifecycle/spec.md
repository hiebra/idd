# openspec-change-lifecycle

## ADDED Requirements

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

## REMOVED Requirements

### Requirement: Un change, una rama y una sola fusión
**Reason**: Presentaba la forma de una rama como la recomendada y la regla estándar de intent-driven como una forma admitida, y detenía el archive en la rama de origen con tasks sin hacer, que la regla permite.

**Migration**: Lo sustituyen «La regla estándar del ciclo» y «La excepción: el change entero en una rama temporal»: la regla es la estándar, y la forma de una rama es la excepción, disponible con `x-main-protected: true`.

### Requirement: Cuándo conviene cada forma del ciclo, donde se archiva
**Reason**: Explicaba las dos formas como opciones equivalentes, cada una con sus ventajas, en lugar de una regla y una excepción con su causa.

**Migration**: Lo sustituye «La forma de una rama se presenta como excepción justificada».

### Requirement: Las puertas admiten las dos formas del ciclo
**Reason**: Pedía avisar al proponer en la rama de origen, que la regla permite sin avisos, y admitía los pasos de la forma de una rama sin que se diera su causa.

**Migration**: Lo sustituye «Las puertas admiten la regla sin avisos y la excepción solo con su causa».

## MODIFIED Requirements

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
