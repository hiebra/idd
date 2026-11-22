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

### Requirement: El modelo crea la rama temporal del change y cambia entre ramas temporales
`branch-change.mjs`, de la skill `openspec-git-discipline`, DEBE permitir, a los dos agentes, listar las ramas temporales con el change de cada una, crear la rama temporal de un change y cambiar a una rama temporal existente. La rama nueva DEBE salir siempre de la rama de origen (la última de `x-main`, o `main`) y llamarse como el change. Crear o cambiar de rama NO DEBE hacerse con el árbol de trabajo sucio, ni a una rama permanente, ni sobre una rama que ya exista al crearla. Los workflows DEBEN usar estos subcomandos en lugar de leer o escribir git a mano. En un contenedor efímero, el agente NO DEBE usarlos: trabaja solo en la rama de la sesión.

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
