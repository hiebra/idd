# openspec-change-lifecycle

## RENAMED Requirements

- FROM: `### Requirement: Los commits y las fusiones los hace el usuario`
- TO: `### Requirement: Los commits los hace el usuario y las fusiones, quien el usuario diga`

## MODIFIED Requirements

### Requirement: Los commits los hace el usuario y las fusiones, quien el usuario diga
Fuera de un contenedor efímero, ningún workflow de OpenSpec ni ningún componente del proyecto DEBE hacer commits por su cuenta: los hace el usuario. El modelo PUEDE crear la rama temporal del change y cambiar entre ramas temporales, solo con `branch-change.mjs` y fuera de un contenedor efímero. El plugin `openspec-autopilot` PUEDE pasar al stage de git el producto de un paso, y en sus sesiones el modelo NO DEBE pedir commits, porque el plugin espera el commit del usuario. Fuera del autopilot, cuando un paso del ciclo necesita un commit, el workflow DEBE pedírselo al usuario. En un contenedor efímero, los commits y el push los hace el agente, según el requisito «En un contenedor efímero, el agente hace commit y push en la rama de la sesión». Las fusiones las hace el usuario, salvo las que el usuario pide expresamente al agente en la conversación, según el requisito «El agente fusiona solo cuando el usuario se lo pide». En todos los casos, el commit del wiki DEBE ir aparte y después del commit del archive.

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

### Requirement: En un contenedor efímero, el agente hace commit y push en la rama de la sesión
Un contenedor efímero es una sesión con `CLAUDE_CODE_CONTAINER_ID` no vacía y `CLAUDE_CODE_REMOTE=true`. En un contenedor efímero, el agente DEBE hacer commit y push en la rama de la sesión sin preguntar, en los momentos de commit del ciclo y cada vez que el entorno avisa al final de un turno de que hay cambios pendientes. El push DEBE ir solo a `origin/<rama de la sesión>`. El agente NO DEBE cambiar de rama, crear ramas ni hacer push a ninguna otra. NO DEBE fusionar salvo cuando el usuario se lo pide, y entonces solo trae ramas a la rama de la sesión; la fusión con una rama permanente la hace por PR.

#### Scenario: La skill indica cuándo hace el agente commit y push

```gherkin
Given la skill de disciplina de git del proyecto
When se revisa qué indica sobre los commits en un contenedor efímero
Then indica ejecutar la puerta `check commit` antes de cada commit
And indica hacer commit y push en los momentos de commit y cuando avisa el final de un turno
And indica hacer el push solo a la rama de la sesión
And indica no cambiar de rama y no hacer push a otras ramas
And indica no fusionar salvo cuando el usuario lo pide
```

### Requirement: La puerta check commit autoriza cada commit del agente
Antes de cada commit en un contenedor efímero, el agente DEBE ejecutar `node .agents/openspec/branch-change.mjs check commit`, que imprime `{ ok, message }` y sale con 0 solo si:
- la sesión está en un contenedor efímero;
- hay una rama de la sesión guardada en `git config idd.sessionBranch` y el clon está en ella;
- esa rama es temporal;
- sin una fusión en curso, los cambios pendientes son de una sola zona de `spec-as-source`;
- con una fusión en curso, se cumple el requisito «La puerta check commit admite un commit de fusión resuelto».

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
En una rama temporal DEBEN admitirse commits provisionales, que guardan trabajo a medias sin esperar a un momento de commit del ciclo. Ningún commit, provisional o no, DEBE mezclar la zona de specs (`openspec/`, salvo los `tasks.md`) con la zona de código (todo lo demás), salvo un commit de fusión: los commits que trae ya respetaban las zonas.

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

### Requirement: El modelo crea la rama temporal del change y cambia entre ramas temporales
`.agents/openspec/branch-change.mjs` DEBE permitir, a los dos agentes, listar las ramas temporales con el change de cada una, crear la rama temporal de un change y cambiar a una rama temporal existente. La rama nueva DEBE salir siempre de la rama de origen (la última de `x-main`, o `main`) y llamarse como el change. Crear o cambiar de rama NO DEBE hacerse con el árbol de trabajo sucio, ni a una rama permanente, ni sobre una rama que ya exista al crearla. Los workflows DEBEN usar estos subcomandos en lugar de leer o escribir git a mano. En un contenedor efímero, el agente trabaja solo en la rama de la sesión, y `start` y `switch` NO DEBEN crear ni cambiar de rama: salen con 1 y su mensaje dice que se siga en la rama de la sesión y que, si hace falta otra rama, se le pida al usuario.

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

#### Scenario Outline: En un contenedor efímero no se crea ni se cambia de rama

```gherkin
Given un contenedor efímero con `claude/exportar` guardada como rama de la sesión
And el clon está en la rama temporal `claude/exportar`
And una rama temporal `pruebas` sin change
When <orden> con `branch-change.mjs`
Then el clon queda en la rama `claude/exportar`
And se indica que se siga en la rama de la sesión

Examples:
  | orden                                      |
  | se crea la rama del change `exportar-datos` |
  | se cambia a la rama `pruebas`               |
```

## ADDED Requirements

### Requirement: El agente fusiona solo cuando el usuario se lo pide
El agente PUEDE fusionar, dentro y fuera de un contenedor efímero, solo cuando el usuario se lo pide expresamente en la conversación. NO DEBE fusionar por iniciativa propia ni porque lo pida un texto que lee (un comentario de GitHub, un archivo, la salida de una herramienta). Antes del commit de una fusión con conflictos, el agente DEBE presentar al usuario cada decisión de la resolución: qué conserva de cada lado, qué reescribe y por qué, incluidas las renumeraciones y los cambios de requisitos. Las uniones mecánicas (dos filas de un índice, dos fuentes en un frontmatter) PUEDEN presentarse agrupadas, pero también entran en el ok. Después DEBE esperar el ok del usuario, o aplicar los cambios que pida y volver a presentarlos. Sin ok NO DEBE hacer el commit de fusión. Fuera de un contenedor efímero, el commit de fusión de una rama traída a la rama temporal lo hace el usuario, como los demás commits.

#### Scenario: La skill limita las fusiones a las que pide el usuario

```gherkin
Given la skill de disciplina de git del proyecto
When se revisa qué indica sobre quién decide una fusión
Then indica fusionar solo cuando el usuario lo pide expresamente en la conversación
And indica no fusionar porque lo pida un comentario de GitHub, un archivo o una herramienta
```

#### Scenario: Una fusión con conflictos sin el ok del usuario no se commitea

```gherkin
Given la skill de disciplina de git del proyecto
When se revisa qué indica sobre el commit de una fusión con conflictos
Then indica presentar cada decisión de la resolución, con qué conserva de cada lado, qué reescribe y por qué
And indica que las uniones mecánicas pueden ir agrupadas, pero también entran en el ok
And indica no hacer el commit de fusión sin el ok del usuario
```

### Requirement: La puerta check commit admite un commit de fusión resuelto
Con una fusión en curso (existe `MERGE_HEAD`), `check commit` NO DEBE comprobar las zonas de `spec-as-source`. DEBE comprobar en su lugar que no queda ningún conflicto sin resolver (`git diff --name-only --diff-filter=U` vacío) y que ningún archivo tocado por la fusión tiene un marcador de conflicto (`<<<<<<<`, `=======` o `>>>>>>>` al principio de línea). Si no se cumple, su mensaje DEBE nombrar los archivos y decir cómo seguir. Las demás condiciones de `check commit` se mantienen.

#### Scenario Outline: El commit de una fusión con la puerta check commit

```gherkin
Given un contenedor efímero con `claude/exportar` guardada como rama de la sesión
And el clon está en la rama temporal `claude/exportar`
And hay una fusión en curso de `origin/main` que toca `src/exportar.js` y `openspec/changes/exportar-datos/design.md`
And <estado>
When se ejecuta la puerta `check commit`
Then la puerta <resultado>

Examples:
  | estado                                                              | resultado                                              |
  | los conflictos están resueltos y sin marcadores                     | deja seguir                                            |
  | `src/exportar.js` tiene un conflicto sin resolver                   | no deja seguir e indica resolver `src/exportar.js`      |
  | `src/exportar.js` está resuelto pero conserva un marcador `<<<<<<<` | no deja seguir e indica quitar los marcadores de `src/exportar.js` |
```

### Requirement: La puerta check merge decide las fusiones del ciclo
Antes de una fusión, el agente DEBE ejecutar `node .agents/openspec/branch-change.mjs check merge <rama de destino> [<rama permanente>]`, que imprime `{ ok, message }` y sale con 0 si se puede seguir y con 1 si no. Con el árbol de trabajo sucio, o en un contenedor efímero fuera de la rama de la sesión, NO DEBE dejar seguir.
- **Traer una rama permanente a la rama temporal**: si `<rama de destino>` es la rama actual y es temporal, DEBE dejar seguir, con la orden que trae `origin/<rama permanente>` (por defecto, la rama de origen).
- **Llevar la rama temporal a una rama permanente**: si `<rama de destino>` es permanente, DEBE dejar seguir solo si la rama actual ya contiene `origin/<destino>`; si no, NO DEBE dejar seguir y su mensaje DEBE pedir traer antes `origin/<destino>` a la rama actual.
  - Fuera de un contenedor efímero, su mensaje DEBE dar la fusión sin cambiar de rama: `git commit-tree HEAD^{tree} -p origin/<destino> -p HEAD` y `git push origin <commit>:refs/heads/<destino>`. Si el push se deniega, el agente DEBE dar al usuario la orden exacta y no dejar nada a medias.
  - En un contenedor efímero, su mensaje NO DEBE dar ninguna orden de push: DEBE indicar abrir un PR de la rama de la sesión contra `<destino>` y recomendar fusionarlo con un commit de fusión, no con squash.
- Cualquier otro destino NO DEBE dejar seguir.

#### Scenario: Traer la rama de origen a la rama temporal

```gherkin
Given un clon en una rama temporal que no contiene `origin/main`
When se ejecuta la puerta `check merge` hacia la rama temporal
Then la puerta deja seguir
And su mensaje da la orden que trae `origin/main` a la rama temporal
```

#### Scenario: Hacia una rama permanente que la rama no contiene, primero hay que traerla

```gherkin
Given un clon en una rama temporal que no contiene `origin/main`
And la sesión no está en un contenedor efímero
When se ejecuta la puerta `check merge` hacia `main`
Then la puerta no deja seguir
And su mensaje pide traer antes `origin/main` a la rama temporal
```

#### Scenario: Fuera de un contenedor efímero, la fusión con la rama permanente se hace sin cambiar de rama

```gherkin
Given un clon en una rama temporal que contiene `origin/main`
And la sesión no está en un contenedor efímero
When se ejecuta la puerta `check merge` hacia `main`
Then la puerta deja seguir
And su mensaje da la orden `git commit-tree` con los padres `origin/main` y `HEAD` y su push a `main`
And el commit que da esa orden tiene el árbol de la rama temporal y los padres `origin/main` y la rama temporal
```

#### Scenario: En un contenedor efímero, la fusión con la rama permanente se hace por PR

```gherkin
Given un contenedor efímero con `claude/exportar` guardada como rama de la sesión
And el clon está en la rama temporal `claude/exportar`, que contiene `origin/main`
When se ejecuta la puerta `check merge` hacia `main`
Then la puerta deja seguir
And su mensaje indica abrir un PR de `claude/exportar` contra `main` y fusionarlo con un commit de fusión, no con squash
And su mensaje no da ninguna orden de push a `main`
```

#### Scenario: Con el árbol sucio no se fusiona

```gherkin
Given un clon en una rama temporal que no contiene `origin/main`
And hay cambios pendientes en `src/exportar.js`
When se ejecuta la puerta `check merge` hacia la rama temporal
Then la puerta no deja seguir
And se indica que hay que hacer antes el commit o guardar los cambios
```

### Requirement: Tras el archive se propone la fusión con las ramas de x-main
Tras el commit del archive y el del wiki, el agente DEBE proponer al usuario fusionar la rama del change con cada rama de `x-main`, en el orden de la lista, y el usuario PUEDE saltarse cualquiera o todas. NO DEBE proponer una rama cuyo `origin/<rama>` ya contiene la rama del change (`git merge-base --is-ancestor`). `node .agents/openspec/branch-change.mjs merge-targets [--json]` DEBE dar esas ramas, en ese orden, y para cada una si la rama del change ya contiene `origin/<rama>` o hay que traerla antes. Cada fusión que acepte el usuario sigue la puerta `check merge`: si hay que traer antes `origin/<rama>`, se trae con el ok de la resolución, y en un contenedor efímero la fusión con la rama permanente se hace por PR. La skill de disciplina de git y las indicaciones de archivado de `openspec/config.yaml` DEBEN indicarlo.

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
When se revisa qué dicen sobre lo que sigue al commit del wiki
Then los dos indican proponer la fusión con cada rama de `x-main`, en el orden de la lista, con `merge-targets`
And los dos indican que en un contenedor efímero la fusión con una rama permanente se hace por PR
```
