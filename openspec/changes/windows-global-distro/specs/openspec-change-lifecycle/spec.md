# openspec-change-lifecycle

`branch-change.mjs` deja la ruta fija del proyecto (`.agents/openspec/`) y viaja con la skill `openspec-git-discipline`, para que la instalación global lleve el script junto a la skill que lo usa.

## ADDED Requirements

### Requirement: branch-change.mjs viaja con la skill openspec-git-discipline
`branch-change.mjs` DEBE estar en el directorio `scripts/` de la skill `openspec-git-discipline`, esté la skill en el proyecto o instalada de forma global, y NO DEBE haber otra copia en el proyecto. El `SKILL.md` de la skill DEBE dar la ruta con la que se ejecuta: en la plantilla completa, `.agents/skills/openspec-git-discipline/scripts/branch-change.mjs`, relativa al proyecto; en la instalación global, la ruta absoluta del script instalado. Ejecutado desde cualquier proyecto, el script DEBE actuar sobre ese proyecto y leer su `openspec/config.yaml`.

#### Scenario: En la plantilla completa, el script está con la skill

```gherkin
Given un clon de la plantilla completa
When se busca `branch-change.mjs` en el proyecto
Then solo está en `.agents/skills/openspec-git-discipline/scripts/`
And el `SKILL.md` de la skill lo ejecuta por esa ruta
```

#### Scenario: El script global actúa sobre el proyecto desde el que se ejecuta

```gherkin
Given la skill `openspec-git-discipline` instalada de forma global
And un proyecto con `x-main` igual a `develop` en su `openspec/config.yaml`
When se consulta el change de la rama con la ruta que da el `SKILL.md` de la skill, desde el proyecto
Then la consulta usa `develop` como rama de origen
```

## MODIFIED Requirements

### Requirement: La puerta check commit autoriza cada commit del agente
Antes de cada commit en un contenedor efímero, el agente DEBE ejecutar `node <ruta de branch-change.mjs> check commit`, con la ruta que da la skill `openspec-git-discipline`, que imprime `{ ok, message }` y sale con 0 solo si:
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

### Requirement: El modelo crea la rama temporal del change y cambia entre ramas temporales
`branch-change.mjs`, de la skill `openspec-git-discipline`, DEBE permitir, a los dos agentes, listar las ramas temporales con el change de cada una, crear la rama temporal de un change y cambiar a una rama temporal existente. La rama nueva DEBE salir siempre de la rama de origen (la última de `x-main`, o `main`) y llamarse como el change. Crear o cambiar de rama NO DEBE hacerse con el árbol de trabajo sucio, ni a una rama permanente, ni sobre una rama que ya exista al crearla. Los workflows DEBEN usar estos subcomandos en lugar de leer o escribir git a mano. En un contenedor efímero, el agente trabaja solo en la rama de la sesión, y `start` y `switch` NO DEBEN crear ni cambiar de rama: salen con 1 y su mensaje dice que se siga en la rama de la sesión y que, si hace falta otra rama, se le pida al usuario.

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

### Requirement: La puerta check merge decide las fusiones del ciclo
Antes de una fusión, el agente DEBE ejecutar `node <ruta de branch-change.mjs> check merge <rama de destino> [<rama permanente>]`, con la ruta que da la skill `openspec-git-discipline`, que imprime `{ ok, message }` y sale con 0 si se puede seguir y con 1 si no. Con el árbol de trabajo sucio, o en un contenedor efímero fuera de la rama de la sesión, NO DEBE dejar seguir.
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
Tras el commit del archive y el del wiki, el agente DEBE proponer al usuario fusionar la rama del change con cada rama de `x-main`, en el orden de la lista, y el usuario PUEDE saltarse cualquiera o todas. NO DEBE proponer una rama cuyo `origin/<rama>` ya contiene la rama del change (`git merge-base --is-ancestor`). `node <ruta de branch-change.mjs> merge-targets [--json]`, con la ruta que da la skill `openspec-git-discipline`, DEBE dar esas ramas, en ese orden, y para cada una si la rama del change ya contiene `origin/<rama>` o hay que traerla antes. Cada fusión que acepte el usuario sigue la puerta `check merge`: si hay que traer antes `origin/<rama>`, se trae con el ok de la resolución, y en un contenedor efímero la fusión con la rama permanente se hace por PR. La skill de disciplina de git y las indicaciones de archivado de `openspec/config.yaml` DEBEN indicarlo.

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
