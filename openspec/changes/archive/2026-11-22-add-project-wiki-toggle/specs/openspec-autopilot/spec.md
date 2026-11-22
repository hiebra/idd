# openspec-autopilot

## ADDED Requirements

### Requirement: Sin paso del wiki con el wiki deshabilitado
Con el wiki del proyecto deshabilitado, tras el commit del archive el plugin NO DEBE crear la sesión de resincronización del wiki y DEBE dar el ciclo del change por terminado. Las lecciones candidatas del change DEBEN quedarse solo en la metadata de sus sesiones. El plugin DEBE leer el ajuste del wiki del proyecto al terminar el archive, de modo que habilitar o deshabilitar el wiki durante el change valga para ese change.

#### Scenario: El ciclo termina en el archive

```gherkin
Given una rama temporal con el change `exportar-datos` en un proyecto con el wiki deshabilitado
And la sesión operativa ha terminado el archive de `exportar-datos`
When el usuario hace el commit del archive
Then no se crea ninguna sesión para resincronizar el wiki
And se avisa de que el ciclo de `exportar-datos` ha terminado y de que queda fusionar la rama
And el aviso no menciona el commit del wiki
```

#### Scenario: Con el wiki habilitado sigue el paso del wiki

```gherkin
Given una rama temporal con el change `exportar-datos` en un proyecto con el wiki habilitado
And la sesión operativa ha terminado el archive de `exportar-datos`
When el usuario hace el commit del archive
Then se crea una sesión nueva con el control para resincronizar el wiki
```

## MODIFIED Requirements

### Requirement: Una sesión por paso, con el agente build
Cada paso del ciclo DEBE hacerse en una sesión nueva que crea el plugin, con el workflow que elige el plugin para ese paso y con el agente build, y que nace como sesión operativa. Los pasos son: cada artefacto del plan, cada task, el verify, el archive y, con el wiki del proyecto habilitado, la resincronización del wiki, y en el modo normal también las sesiones de revisión y de `openspec-update-change`. El plugin DEBE arrancar cada paso con un mensaje en la sesión, para que la instrucción del paso siga en su historial, y DEBE recordársela al modelo en cada petición de la sesión operativa con el agente build. El paso DEBE terminar cuando la sesión queda en reposo con producto evaluable, haya llamado o no a `openspec_handoff`. Al terminar su paso, la sesión DEBE pasar el control a la siguiente y quedar archivada. Las sesiones archivadas DEBEN conservar su metadata, de modo que el change guarde qué sesiones ha tenido, qué paso hizo cada una y, en las de revisión, su resultado y sus conclusiones. Lo que el plugin inyecta cuando el usuario cambia de agente dentro de la sesión operativa lo fija el requisito "El agente plan explora en la sesión operativa".

#### Scenario: El siguiente paso en una sesión nueva

```gherkin
Given una rama temporal con el change en curso `exportar-datos`, en modo auto
And la sesión operativa está creando el artefacto `proposal`
When la sesión termina el artefacto `proposal`
Then se crea una sesión nueva con el control, para el siguiente artefacto que indique `openspec status`
And la sesión anterior queda archivada
And la sesión archivada conserva en su metadata que hizo el artefacto `proposal`
```

#### Scenario: La instrucción del paso sigue en los mensajes siguientes

```gherkin
Given una sesión operativa que crea el artefacto `design` de `exportar-datos`
When el usuario escribe un segundo mensaje en la sesión
Then la petición al modelo incluye el recordatorio del paso
```

#### Scenario Outline: Toda sesión del ciclo nace con el agente build

```gherkin
Given una rama temporal con el change en curso `exportar-datos`, en modo normal
And la sesión operativa está creando <lo que produce>
When la sesión termina <lo que produce>
Then se crea la sesión siguiente con el agente build

Examples:
  | lo que produce         |
  | el artefacto `design`  |
  | la task 3              |
```

### Requirement: Lecciones candidatas, registradas en el archive
Al pasar el control, cada sesión PUEDE dar a la tool del plugin lecciones candidatas: lo que comprobó o le corrigieron en su paso y servirá en otra ocasión. El plugin DEBE guardarlas en la metadata de la sesión y NO DEBE escribirlas en el repositorio. Con el wiki del proyecto habilitado, la sesión que resincroniza el wiki tras el archive DEBE recibir las lecciones candidatas de todas las sesiones del change, y el wiki DEBE registrar solo las que el usuario confirme, en el commit del wiki.

#### Scenario: Las candidatas no tocan el repositorio

```gherkin
Given una sesión dueña que termina el artefacto `design` de `exportar-datos`
When pasa el control con una lección candidata
Then la lección queda en la metadata de la sesión
And el árbol de trabajo no tiene cambios nuevos
```

#### Scenario: La resincronización del wiki recibe las candidatas del change

```gherkin
Given un change `exportar-datos` de un proyecto con el wiki habilitado, cuyas sesiones dejaron tres lecciones candidatas
When se crea la sesión que resincroniza el wiki tras el archive
Then la sesión recibe las tres lecciones candidatas
And el wiki solo registra las que el usuario confirma
```

### Requirement: Árbol limpio al empezar un paso
Antes de que el modelo empiece un paso, la sesión operativa DEBE comprobar que el árbol de trabajo está limpio (sin cambios sin commit) cuando la sesión se crea al arrancar o al validar, y en cada cambio de zona. Si no lo está, NO DEBE empezar y DEBE esperar a que el usuario haga el commit. Tras una revisión satisfactoria el árbol ya está limpio, y tras una no satisfactoria `openspec-update-change` DEBE empezar con el árbol sucio a propósito, sin esperar. Las zonas son las de `spec-as-source`: la de specs es `openspec/`, salvo los `tasks.md`, y la de código es todo lo demás. Los cambios de zona del ciclo son tres: del plan a las tasks, de las tasks al archive y, con el wiki del proyecto habilitado, del archive a la resincronización del wiki. Tras la resincronización del wiki, el plugin DEBE esperar también el commit del wiki. Con el wiki deshabilitado, los cambios de zona son dos y no hay commit del wiki.

#### Scenario Outline: Comprobación del árbol al empezar un paso

```gherkin
Given una rama temporal con el change en curso `exportar-datos`, en modo <modo>
And el árbol de trabajo tiene cambios sin commit
When una sesión operativa empieza <paso>
Then <resultado>

Examples:
  | modo   | paso                                   | resultado                                       |
  | auto   | el artefacto `design`, tras `specs`    | empieza                                         |
  | auto   | la task 1, tras el plan                | no empieza y espera a que el usuario haga el commit |
  | normal | `openspec-update-change`, tras una revisión no satisfactoria | empieza                   |
```
