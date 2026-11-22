# openspec-change-lifecycle

El ciclo de una rama y una sola fusión (ADR-0007) se adapta a clones con la rama de origen local atrasada, a sesiones en contenedores efímeros, donde el agente hace commit y push en la rama de la sesión, a la fusión con o sin squash y a ramas concurrentes que crean ADRs.

## MODIFIED Requirements

### Requirement: El change de una rama temporal se lee de git
El change de una rama temporal DEBE ser el que aparece en `openspec/changes/` entre el merge-base de la rama con la rama de origen y el árbol de trabajo, contando los cambios sin commit. Un change está en curso si su directorio es `openspec/changes/<nombre>/`, y archivado si es `openspec/changes/archive/<fecha>-<nombre>/`. Ese estado NO DEBE guardarse en ningún otro sitio del repositorio ni depender del nombre de la rama. Si existen la rama de origen local y `origin/<rama de origen>`, el merge-base DEBE calcularse contra la más avanzada de las dos, cuando una contiene a la otra; si han divergido, contra la local, con un aviso.

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

#### Scenario: La rama de origen local y la remota han divergido

```gherkin
Given la rama de origen local y la remota han divergido
And una rama temporal que sale de la rama de origen local
When se consulta el change de la rama temporal
Then el merge-base se calcula contra la rama de origen local
And se avisa de que la rama de origen local y la remota han divergido
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

### Requirement: Fusión con o sin squash
La rama temporal PUEDE llegar a la rama de origen con una fusión normal o con squash, a elección del usuario. Ningún paso del ciclo DEBE depender de que los commits de la rama temporal lleguen a la rama de origen.

#### Scenario: La skill admite el squash

```gherkin
Given la skill de disciplina de git del proyecto
When se revisa qué indica sobre la fusión de la rama temporal
Then indica que la fusión puede ser normal o con squash, a elección del usuario
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

### Requirement: El motivo del archive en la rama temporal está donde se archiva
La skill de disciplina de git y las indicaciones de archivado de `openspec/config.yaml` DEBEN dar el motivo de archivar en la rama temporal antes de fusionar: que el plan, el código, el archive y el wiki lleguen juntos en una sola fusión, y que la rama permanente no reciba commits directos. Las dos DEBEN nombrar la regla heredada de intent-driven (archivar desde la rama permanente después de fusionar) y decir que este proyecto no la aplica.

#### Scenario: El motivo y la regla descartada están en la skill y en las indicaciones de archivado

```gherkin
Given la skill de disciplina de git y el `openspec/config.yaml` del proyecto
When se revisa qué dicen sobre dónde se archiva
Then los dos dan el motivo de archivar en la rama temporal antes de fusionar
And los dos dicen que la regla heredada de archivar desde la rama permanente no se aplica
```
