# openspec-change-lifecycle Specification

## Purpose
El ciclo git de un change es el mismo en los dos agentes soportados (Claude Code y OpenCode 2): cada change se hace entero en una rama temporal, que sale de la rama de origen (la última de `x-main`, o `main`) y llega a ella en una sola fusión, con el archive hecho en la rama. El change de cada rama se lee de git, sin apuntarlo en ningún sitio, y los commits y las fusiones los hace siempre el usuario.

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
El change de una rama temporal DEBE ser el que aparece en `openspec/changes/` entre el merge-base de la rama con la rama de origen y el árbol de trabajo, contando los cambios sin commit. Un change aparece en curso si su directorio es `openspec/changes/<nombre>/`, y archivado si es `openspec/changes/archive/<fecha>-<nombre>/`. Ese estado NO DEBE guardarse en ningún otro sitio del repositorio ni depender del nombre de la rama.

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

### Requirement: Un change, una rama y una sola fusión
Todo el ciclo de un change (propuesta, implementación, archive y resincronización del wiki) DEBE poder hacerse en una sola rama temporal, que llega a la rama de origen en una única fusión. Los workflows de OpenSpec NO DEBEN exigir que la propuesta haya llegado a la rama de origen antes del apply, ni que el archive se haga desde una rama permanente. El archive DEBE hacerse en la rama temporal del change, antes de su fusión.

#### Scenario: El apply empieza con la propuesta solo en la rama temporal

```gherkin
Given una rama temporal con el change en curso `exportar-datos`
And la propuesta de `exportar-datos` tiene commit en la rama temporal y no está en la rama de origen
When se lanza el apply de `exportar-datos`
Then el apply no se detiene porque la propuesta no esté en la rama de origen
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
When se lanza el archive de un change
Then el archive se detiene
And se indica que el archive se hace en la rama temporal del change
```

### Requirement: Los commits y las fusiones los hace el usuario
Ningún workflow de OpenSpec ni ningún componente del proyecto DEBE hacer commits ni fusiones por su cuenta. Cuando un paso del ciclo necesita un commit, DEBE pedírselo al usuario. El commit del wiki DEBE ir aparte y después del commit del archive.

#### Scenario: Un artefacto terminado queda sin commit

```gherkin
Given una rama temporal con el change en curso `exportar-datos`
When un workflow termina un artefacto de `exportar-datos`
Then el artefacto queda sin commit
And se pide al usuario que haga el commit
```
