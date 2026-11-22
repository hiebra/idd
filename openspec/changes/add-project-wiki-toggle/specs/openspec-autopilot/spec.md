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

### Requirement: Una sesión por paso
Cada paso del ciclo DEBE hacerse en una sesión nueva que crea el plugin, con el workflow y el agente que elige el plugin para ese paso, y que nace como sesión operativa. Los pasos son: cada artefacto del plan, cada task, el verify, el archive y, con el wiki del proyecto habilitado, la resincronización del wiki, y en el modo normal también las sesiones de revisión y de `openspec-update-change`. El plugin DEBE arrancar cada paso con un mensaje en la sesión, para que la instrucción del paso siga en su historial, y DEBE recordársela al modelo en cada petición de la sesión operativa. El paso DEBE terminar cuando la sesión queda en reposo con producto evaluable, haya llamado o no a `openspec_handoff`. Al terminar su paso, la sesión DEBE pasar el control a la siguiente y quedar archivada. Las sesiones archivadas DEBEN conservar su metadata, de modo que el change guarde qué sesiones ha tenido, qué paso hizo cada una y, en las de revisión, su resultado y sus conclusiones. Cambiar de agente dentro de la sesión operativa NO DEBE hacer que el plugin inyecte nada nuevo.

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

#### Scenario: Cambiar de agente no inyecta nada

```gherkin
Given una sesión operativa que trabaja con el agente build
When el usuario cambia esa sesión al agente plan y después de vuelta a build
Then el plugin no añade ningún mensaje ni instrucción a la sesión
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
