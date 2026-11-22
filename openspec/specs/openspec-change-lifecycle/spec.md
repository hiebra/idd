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
Ningún workflow de OpenSpec ni ningún componente del proyecto DEBE hacer commits ni fusiones por su cuenta: los hace siempre el usuario. El modelo PUEDE crear la rama temporal del change y cambiar entre ramas temporales, solo con `branch-change.mjs`. El plugin `openspec-autopilot` PUEDE pasar al stage de git el producto de un paso, y en sus sesiones el modelo NO DEBE pedir commits, porque el plugin espera el commit del usuario. Fuera del autopilot, cuando un paso del ciclo necesita un commit, el workflow DEBE pedírselo al usuario. El commit del wiki DEBE ir aparte y después del commit del archive.

#### Scenario: Un artefacto terminado queda sin commit

```gherkin
Given una rama temporal con el change en curso `exportar-datos`
When un workflow termina un artefacto de `exportar-datos` fuera del autopilot
Then el artefacto queda sin commit
And se pide al usuario que haga el commit
```

#### Scenario: En el autopilot, el modelo no pide commits

```gherkin
Given una sesión del autopilot que crea un artefacto de `exportar-datos`
When se lee la instrucción del paso
Then la instrucción no pide al usuario ningún commit
And la instrucción dice que el modelo no haga commits ni pase nada al stage
```

### Requirement: El modelo crea la rama temporal del change y cambia entre ramas temporales
`.agents/openspec/branch-change.mjs` DEBE permitir, a los dos agentes, listar las ramas temporales con el change de cada una, crear la rama temporal de un change y cambiar a una rama temporal existente. La rama nueva DEBE salir siempre de la rama de origen (la última de `x-main`, o `main`) y llamarse como el change. Crear o cambiar de rama NO DEBE hacerse con el árbol de trabajo sucio, ni a una rama permanente, ni sobre una rama que ya exista al crearla. Los workflows DEBEN usar estos subcomandos en lugar de leer o escribir git a mano.

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
