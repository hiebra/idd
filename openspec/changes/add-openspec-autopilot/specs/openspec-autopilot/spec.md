# openspec-autopilot

## ADDED Requirements

### Requirement: Dónde actúa el plugin
El plugin DEBE actuar solo en sesiones de OpenCode con interfaz de terminal (TUI), en una rama temporal con un change o sin ninguno. En una rama permanente, con HEAD separado o sin TUI (`opencode run`, OpenCode Desktop) NO DEBE crear, archivar ni encadenar sesiones. Si la rama tiene varios changes, NO DEBE hacer nada de eso y DEBE avisar al usuario, nombrando los changes, hasta que en la rama quede uno solo. El proyecto NO DEBE tener nada del plugin en Claude Code.

#### Scenario Outline: El plugin no actúa

```gherkin
Given un clon del proyecto en <situación>
When se abre una sesión de OpenCode en la TUI
Then el plugin no crea, archiva ni encadena ninguna sesión

Examples:
  | situación                                  |
  | la rama de origen                          |
  | un commit con HEAD separado                |
```

#### Scenario: Varios changes en la misma rama

```gherkin
Given una rama temporal con los changes en curso `exportar-datos` e `importar-datos`
When se abre una sesión de OpenCode en la TUI
Then el plugin no crea, archiva ni encadena ninguna sesión
And se avisa de que la rama tiene los changes `exportar-datos` e `importar-datos`
```

#### Scenario: Claude Code no tiene nada del plugin

```gherkin
Given un clon del proyecto
When se abre una sesión de Claude Code en el proyecto
Then no hay ningún hook, skill ni comando del plugin
```

### Requirement: Una sola sesión con el control del change
En cada rama temporal DEBE haber como mucho una sesión con el control del change: la sesión no archivada que su metadata de OpenCode marca como dueña de esa rama. Ese estado DEBE vivir solo en la metadata de las sesiones, nunca en el repositorio. Además de la dueña, en la rama PUEDE haber sesiones libres, que el plugin no orquesta ni archiva.

#### Scenario: El control sobrevive a reiniciar OpenCode

```gherkin
Given una rama temporal cuyo change tiene una sesión dueña parada
When se cierra OpenCode y se vuelve a abrir en el proyecto
Then esa sesión sigue siendo la dueña del change
And el repositorio no tiene ningún archivo nuevo que lo registre
```

### Requirement: Qué pasa al abrir una sesión a mano
Al abrir el usuario una sesión nueva en una rama temporal (en la TUI, una sesión se crea con su primer mensaje), el plugin DEBE decidir según el estado de la rama y de la sesión dueña, sea cual sea el agente con el que se abre. Si la rama no tiene change, la sesión DEBE tomar el control y arrancar `openspec-new-change`. Si el change está en curso y no tiene dueña, la sesión DEBE tomar el control sin preguntar y seguir por el paso que indique `openspec status`. Si la dueña está trabajando, la sesión nueva DEBE quedar libre y avisar de qué sesión tiene el control. Si la dueña está parada sin haber terminado su paso, el plugin DEBE preguntar al usuario si quiere ir a la dueña o archivarla y seguir en la sesión nueva; si cierra la pregunta sin elegir, la sesión nueva queda libre. Si la rama tiene un change archivado, la sesión DEBE quedar libre.

#### Scenario Outline: Sesión nueva según el estado de la rama

```gherkin
Given una rama temporal <estado de la rama>
When el usuario escribe el primer mensaje de una sesión nueva en la TUI
Then <resultado>

Examples:
  | estado de la rama                                   | resultado                                                    |
  | sin change                                          | la sesión toma el control y arranca `openspec-new-change`     |
  | con un change en curso sin sesión dueña             | la sesión toma el control y sigue por el paso de `openspec status` |
  | con un change en curso cuya dueña está trabajando   | la sesión queda libre y se avisa de qué sesión tiene el control |
  | con un change archivado                             | la sesión queda libre                                         |
```

#### Scenario Outline: La dueña está parada sin haber terminado

```gherkin
Given una rama temporal con un change en curso cuya sesión dueña está parada sin haber terminado su paso
When el usuario escribe el primer mensaje de una sesión nueva en la TUI
Then se le pregunta si quiere ir a la sesión dueña o archivarla y seguir en la nueva
And si <respuesta>, <resultado>

Examples:
  | respuesta                          | resultado                                                        |
  | elige ir a la dueña                | la TUI pasa a la sesión dueña y la nueva queda libre             |
  | elige archivarla y seguir aquí     | la dueña queda archivada y la nueva toma el control              |
  | cierra la pregunta sin elegir      | la dueña conserva el control y la nueva queda libre              |
```

#### Scenario: El agente con el que se abre la sesión no cuenta

```gherkin
Given una rama temporal sin change
When el usuario escribe el primer mensaje de una sesión nueva en la TUI con el agente plan
Then la sesión toma el control y arranca `openspec-new-change`
```

### Requirement: Una sesión por paso
Cada paso del ciclo DEBE hacerse en una sesión nueva que crea el plugin, con el workflow y el agente que elige el plugin para ese paso, y que nace con el control. Los pasos son: cada artefacto del plan, cada task, el verify, el archive y la resincronización del wiki, y en el modo normal también las sesiones de revisión y de `openspec-update-change`. Al terminar su paso, la sesión DEBE pasar el control a la siguiente y quedar archivada. Las sesiones archivadas DEBEN conservar su metadata, de modo que el change guarde qué sesiones ha tenido, qué paso hizo cada una y, en las de revisión, su resultado y sus conclusiones. Cambiar de agente dentro de la sesión dueña NO DEBE hacer que el plugin inyecte nada.

#### Scenario: El siguiente paso en una sesión nueva

```gherkin
Given una rama temporal con el change en curso `exportar-datos`, en modo auto
And la sesión dueña está creando el artefacto `proposal`
When la sesión termina el artefacto `proposal`
Then se crea una sesión nueva con el control, para el siguiente artefacto que indique `openspec status`
And la sesión anterior queda archivada
And la sesión archivada conserva en su metadata que hizo el artefacto `proposal`
```

#### Scenario: Cambiar de agente no inyecta nada

```gherkin
Given una sesión dueña que trabaja con el agente build
When el usuario cambia esa sesión al agente plan y después de vuelta a build
Then el plugin no añade ningún mensaje ni instrucción a la sesión
```

### Requirement: Revisión humana guiada en el modo normal
En el modo normal, tras cada artefacto del plan, cada task y el verify, el plugin DEBE abrir una sesión de revisión, en la que el LLM guía al usuario por la revisión. La sesión de revisión DEBE terminar llamando a una tool del plugin con el resultado: satisfactoria o no satisfactoria, y en ese caso con las conclusiones de la revisión. Si es satisfactoria, el plugin DEBE pasar al paso que indique `openspec status`. Si no lo es, DEBE pasar a una sesión de `openspec-update-change` que recibe esas conclusiones, seguida de una revisión del plan. Una revisión satisfactoria del verify DEBE llevar al archive.

#### Scenario Outline: Resultado de una revisión

```gherkin
Given una rama temporal con el change en curso `exportar-datos`, en modo normal
And una sesión de revisión de <lo revisado>
When la revisión termina con la tool y el resultado <resultado>
Then se crea una sesión nueva con el control para <siguiente>
And la sesión de revisión queda archivada

Examples:
  | lo revisado            | resultado          | siguiente                                                   |
  | el artefacto `design`  | satisfactoria      | el paso que indique `openspec status`                       |
  | la task 3              | satisfactoria      | el paso que indique `openspec status`                       |
  | la task 3              | no satisfactoria   | `openspec-update-change`, con las conclusiones de la revisión |
  | el verify              | satisfactoria      | el archive                                                  |
```

#### Scenario: Tras un update-change viene una revisión del plan

```gherkin
Given una sesión de `openspec-update-change` lanzada por una revisión no satisfactoria de la task 3
When la sesión termina
Then se crea una sesión de revisión de los cambios en el plan
```

#### Scenario: Tras la última task viene el verify

```gherkin
Given una rama temporal con el change en curso `exportar-datos`, en modo normal
When la revisión de la última task termina satisfactoria
Then se crea una sesión nueva con el control para `openspec-verify-change`
```

### Requirement: Índice de sesiones para openspec-update-change
La sesión de `openspec-update-change` DEBE recibir, además de las conclusiones de la revisión que la lanzó, un índice de las sesiones del change, sacado de su metadata: qué paso hizo cada sesión y, en las de revisión, su resultado y sus conclusiones. El índice NO DEBE incluir las transcripciones de las sesiones, y la sesión DEBE poder pedir al plugin el contenido de una sesión concreta del índice.

#### Scenario: update-change recibe el índice del change

```gherkin
Given una rama temporal con el change en curso `exportar-datos`, en modo normal
And la revisión del artefacto `design` fue no satisfactoria una vez antes
When una revisión no satisfactoria de la task 3 lanza `openspec-update-change`
Then la sesión de `openspec-update-change` recibe las conclusiones de la revisión de la task 3
And recibe un índice con cada sesión del change, su paso y el resultado de cada revisión
And el índice incluye las conclusiones de la revisión no satisfactoria del artefacto `design`
And no recibe la transcripción de ninguna sesión
```

### Requirement: Árbol limpio al empezar un paso
Antes de que el modelo empiece a trabajar, la sesión dueña DEBE comprobar que el árbol de trabajo está limpio (sin cambios sin commit). Si no lo está, NO DEBE empezar y DEBE pedir al usuario que haga el commit. En el modo auto, la comprobación DEBE hacerse solo en el primer paso tras un cambio de zona. Las zonas son las de `spec-as-source`: la de specs es `openspec/`, salvo los `tasks.md`, y la de código es todo lo demás. Los cambios de zona del ciclo son tres: del plan a las tasks, de las tasks al archive y del archive a la resincronización del wiki.

#### Scenario Outline: Comprobación del árbol al empezar un paso

```gherkin
Given una rama temporal con el change en curso `exportar-datos`, en modo <modo>
And el árbol de trabajo tiene cambios sin commit
When una sesión dueña empieza <paso>
Then <resultado>

Examples:
  | modo   | paso                                   | resultado                                     |
  | normal | el artefacto `design`                  | no empieza y pide al usuario que haga el commit |
  | auto   | el artefacto `design`, tras `specs`    | empieza                                       |
  | auto   | la task 1, tras el plan                | no empieza y pide al usuario que haga el commit |
```

### Requirement: Modo auto
El plugin DEBE tener un modo auto, que cada usuario activa con la opción `auto` del plugin en su propia configuración de OpenCode, y que está desactivado si no se indica. El proyecto NO DEBE fijar esa opción. En el modo auto NO DEBE haber sesiones de revisión, y el ciclo DEBE pararse solo cuando un workflow pregunta algo al usuario, en cada cambio de zona y cuando el verify encuentra problemas críticos. La sesión de verify del modo auto DEBE terminar llamando a la tool del plugin con su veredicto. Si no hay problemas críticos, el plugin DEBE pasar al archive. Si los hay, DEBE pararse y dejar la sesión esperando al usuario, que la cierra como una revisión del modo normal.

#### Scenario: Sin la opción, el modo es normal

```gherkin
Given un usuario sin la opción `auto` en su configuración de OpenCode
When el plugin decide el paso siguiente tras un artefacto
Then crea una sesión de revisión
```

#### Scenario Outline: Veredicto del verify en modo auto

```gherkin
Given una rama temporal con el change en curso `exportar-datos`, en modo auto
When la sesión de verify termina con la tool y el veredicto <veredicto>
Then <resultado>

Examples:
  | veredicto                  | resultado                                                    |
  | sin problemas críticos     | se crea una sesión nueva con el control para el archive      |
  | con problemas críticos     | la sesión de verify queda parada esperando al usuario        |
```

### Requirement: Aviso tras compactar la sesión dueña
Cuando la sesión dueña se compacta, el plugin NO DEBE reinyectar su workflow, y DEBE avisar al usuario de qué workflow estaba en curso y de cómo retomarlo.

#### Scenario: La sesión dueña se compacta

```gherkin
Given una sesión dueña que aplica la task 3 de `exportar-datos`
When la sesión se compacta
Then se avisa al usuario de que estaba aplicando `exportar-datos`
And el aviso indica el comando para retomarlo
```

### Requirement: El plugin nunca bloquea OpenCode
El plugin NO DEBE lanzar excepciones hacia OpenCode ni impedir una petición al modelo. Si algo falla, DEBE avisar al usuario en la TUI y dejar la sesión como sesión libre.

#### Scenario: Falla una operación de sesión

```gherkin
Given una sesión dueña que termina su paso
And OpenCode rechaza la creación de la sesión siguiente
When el plugin intenta encadenar la sesión siguiente
Then se avisa al usuario en la TUI de que no se ha podido crear la sesión
And la sesión actual sigue respondiendo al usuario
```
