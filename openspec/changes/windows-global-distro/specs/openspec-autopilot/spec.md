# openspec-autopilot

El plugin se puede instalar de forma global en OpenCode y encuentra `branch-change.mjs` junto a la skill `openspec-git-discipline`, esté en el proyecto o instalada de forma global.

## ADDED Requirements

### Requirement: El plugin encuentra branch-change.mjs con la skill
El plugin DEBE usar el `branch-change.mjs` de la skill `openspec-git-discipline` del proyecto si la tiene y, si no, el de la skill instalada de forma global. La estrategia de worktree DEBE leer la rama de origen con ese mismo script.

#### Scenario Outline: Qué script usa el plugin

```gherkin
Given un proyecto <situación>
When el plugin consulta el change de la rama
Then usa el `branch-change.mjs` <script>
And la estrategia de worktree lee la rama de origen con ese script

Examples:
  | situación                                        | script                           |
  | con la skill `openspec-git-discipline`           | de la skill del proyecto         |
  | sin skills, con la instalación global en la máquina | de la skill instalada de forma global |
```

### Requirement: El plugin global solo actúa en proyectos intent-driven
Instalado de forma global, el plugin DEBE actuar solo en proyectos cuyo `openspec/config.yaml` declara `schema: intent-driven`. En cualquier otro proyecto NO DEBE crear, archivar ni encadenar sesiones, ni mostrar avisos.

#### Scenario: Proyecto que no es intent-driven

```gherkin
Given el plugin instalado de forma global
And un proyecto sin `openspec/config.yaml`
When se abre una sesión de OpenCode en la TUI
Then el plugin no crea, archiva ni encadena ninguna sesión
And no se muestra ningún aviso del plugin
```

### Requirement: El plugin global cede ante el del proyecto
Si el proyecto tiene su propio plugin `openspec-autopilot`, el instalado de forma global NO DEBE hacer nada en ese proyecto.

#### Scenario: Proyecto de la plantilla completa en una máquina con la instalación global

```gherkin
Given el plugin instalado de forma global
And un clon de la plantilla completa, con su propio plugin `openspec-autopilot`
When se abre una sesión de OpenCode en la TUI
Then solo actúa el plugin del proyecto
```
