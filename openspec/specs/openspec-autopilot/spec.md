# openspec-autopilot Specification

## Purpose
En OpenCode 2, el plugin `openspec-autopilot` automatiza el ciclo del change de una rama temporal. Da una sesión nueva a cada paso, con el workflow y el agente que tocan, y guarda el control del change en la metadata de las sesiones. En el modo normal hace una revisión humana guiada tras cada paso; en el modo auto, que elige cada usuario, no la hace. El plugin nunca bloquea OpenCode y no deja nada en Claude Code, donde los mismos workflows se lanzan a mano.

## Requirements

### Requirement: Dónde actúa el plugin
El plugin DEBE actuar con cualquier cliente de OpenCode (TUI, UI web, OpenCode Desktop u `opencode run`), en una rama temporal con un change o sin ninguno, y en una rama permanente solo para empezar un change nuevo, cuya rama temporal crea el modelo. Con HEAD separado NO DEBE crear, archivar ni encadenar sesiones. Si la rama tiene varios changes, NO DEBE hacer nada de eso y DEBE avisar al usuario, nombrando los changes, hasta que en la rama quede uno solo. El proyecto NO DEBE tener nada del plugin en Claude Code.

#### Scenario Outline: El plugin no actúa

```gherkin
Given un clon del proyecto en <situación>
When se abre una sesión de OpenCode en la TUI
Then el plugin no crea, archiva ni encadena ninguna sesión

Examples:
  | situación                                  |
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
En cada rama DEBE haber como mucho una sesión viva en autopilot: la sesión operativa, que es la sesión no archivada que su metadata de OpenCode marca como dueña de esa rama. Ese estado DEBE vivir solo en la metadata de las sesiones, nunca en el repositorio. Mientras la rama tenga una sesión operativa válida, ninguna otra sesión DEBE tomar el control; las demás sesiones de la rama son ajenas, y el plugin no las orquesta. Al pasar el control de un paso al siguiente, la sesión anterior DEBE quedar archivada. Si dos sesiones toman el control a la vez, DEBE quedarse con él la más antigua.

#### Scenario: El control sobrevive a reiniciar OpenCode

```gherkin
Given una rama temporal cuyo change tiene una sesión operativa parada
When se cierra OpenCode y se vuelve a abrir en el proyecto
Then esa sesión sigue siendo la operativa del change
And el repositorio no tiene ningún archivo nuevo que lo registre
```

#### Scenario: Una sesión nueva no quita el control a la operativa

```gherkin
Given una rama temporal con el change en curso `exportar-datos` y su sesión operativa parada
When el usuario escribe el primer mensaje de una sesión nueva
Then la sesión operativa conserva el control
And la sesión nueva no toma el control
```

### Requirement: Una sesión por paso
Cada paso del ciclo DEBE hacerse en una sesión nueva que crea el plugin, con el workflow y el agente que elige el plugin para ese paso, y que nace como sesión operativa. Los pasos son: cada artefacto del plan, cada task, el verify, el archive y la resincronización del wiki, y en el modo normal también las sesiones de revisión y de `openspec-update-change`. El plugin DEBE arrancar cada paso con un mensaje en la sesión, para que la instrucción del paso siga en su historial, y DEBE recordársela al modelo en cada petición de la sesión operativa. El paso DEBE terminar cuando la sesión queda en reposo con producto evaluable, haya llamado o no a `openspec_handoff`. Al terminar su paso, la sesión DEBE pasar el control a la siguiente y quedar archivada. Las sesiones archivadas DEBEN conservar su metadata, de modo que el change guarde qué sesiones ha tenido, qué paso hizo cada una y, en las de revisión, su resultado y sus conclusiones. Cambiar de agente dentro de la sesión operativa NO DEBE hacer que el plugin inyecte nada nuevo.

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

### Requirement: Índice de sesiones para openspec-update-change
La sesión de `openspec-update-change` DEBE recibir como conclusiones el prompt con el que el usuario cerró la revisión no satisfactoria; si ese prompt está vacío o es de una sola palabra, DEBE recibir las conclusiones que dio el modelo de la revisión. Además, DEBE recibir un índice de las sesiones del change, sacado de su metadata: qué paso hizo cada sesión y, en las de revisión, su resultado y sus conclusiones. El índice NO DEBE incluir las transcripciones de las sesiones, y la sesión DEBE poder pedir al plugin el contenido de una sesión concreta del índice.

#### Scenario: update-change recibe el índice del change

```gherkin
Given una rama temporal con el change en curso `exportar-datos`, en modo normal
And la revisión del artefacto `design` fue no satisfactoria una vez antes
When el usuario cierra como no satisfactoria la revisión de la task 3 con el prompt "Falta validar el formato de fecha"
Then la sesión de `openspec-update-change` recibe como conclusiones "Falta validar el formato de fecha"
And recibe un índice con cada sesión del change, su paso y el resultado de cada revisión
And el índice incluye las conclusiones de la revisión no satisfactoria del artefacto `design`
And no recibe la transcripción de ninguna sesión
```

#### Scenario: Un prompt de una palabra toma las conclusiones del modelo

```gherkin
Given una sesión de revisión de la task 3 de `exportar-datos` en la que el modelo ha dado sus conclusiones
When el usuario saca todo del stage y envía el prompt "no"
Then la sesión de `openspec-update-change` recibe como conclusiones las del modelo
```

### Requirement: Lecciones candidatas, registradas en el archive
Al pasar el control, cada sesión PUEDE dar a la tool del plugin lecciones candidatas: lo que comprobó o le corrigieron en su paso y servirá en otra ocasión. El plugin DEBE guardarlas en la metadata de la sesión y NO DEBE escribirlas en el repositorio. La sesión que resincroniza el wiki tras el archive DEBE recibir las lecciones candidatas de todas las sesiones del change, y el wiki DEBE registrar solo las que el usuario confirme, en el commit del wiki.

#### Scenario: Las candidatas no tocan el repositorio

```gherkin
Given una sesión dueña que termina el artefacto `design` de `exportar-datos`
When pasa el control con una lección candidata
Then la lección queda en la metadata de la sesión
And el árbol de trabajo no tiene cambios nuevos
```

#### Scenario: La resincronización del wiki recibe las candidatas del change

```gherkin
Given un change `exportar-datos` cuyas sesiones dejaron tres lecciones candidatas
When se crea la sesión que resincroniza el wiki tras el archive
Then la sesión recibe las tres lecciones candidatas
And el wiki solo registra las que el usuario confirma
```

### Requirement: Árbol limpio al empezar un paso
Antes de que el modelo empiece un paso, la sesión operativa DEBE comprobar que el árbol de trabajo está limpio (sin cambios sin commit) cuando la sesión se crea al arrancar o al validar, y en cada cambio de zona. Si no lo está, NO DEBE empezar y DEBE esperar a que el usuario haga el commit. Tras una revisión satisfactoria el árbol ya está limpio, y tras una no satisfactoria `openspec-update-change` DEBE empezar con el árbol sucio a propósito, sin esperar. Las zonas son las de `spec-as-source`: la de specs es `openspec/`, salvo los `tasks.md`, y la de código es todo lo demás. Los cambios de zona del ciclo son tres: del plan a las tasks, de las tasks al archive y del archive a la resincronización del wiki. Tras la resincronización del wiki, el plugin DEBE esperar también el commit del wiki.

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

### Requirement: Modo auto
El plugin DEBE tener un modo auto, que cada usuario activa con la opción `auto` del plugin en su propia configuración de OpenCode, y que está desactivado si no se indica. El proyecto NO DEBE fijar esa opción. En el modo auto NO DEBE haber sesiones de revisión: el producto evaluable decide si el paso ha terminado, y el plugin lo pasa al stage de git y sigue con el paso siguiente. El ciclo DEBE pararse cuando un workflow pregunta algo al usuario (la sesión queda en reposo sin producto), en cada cambio de zona, hasta que el usuario haga el commit, y cuando el verify encuentra problemas críticos. La sesión de verify del modo auto DEBE terminar llamando a la tool del plugin con su veredicto. Si no hay problemas críticos, el plugin DEBE pasar al archive. Si los hay, DEBE pararse y dejar la sesión de verify como una revisión del modo normal, que se cierra con git.

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

#### Scenario: En un cambio de zona se espera el commit

```gherkin
Given una rama temporal con el change en curso `exportar-datos`, en modo auto
And la sesión operativa está creando el artefacto `tasks`
When el modelo escribe el artefacto `tasks` y la sesión queda en reposo
Then el artefacto `tasks` queda en el stage de git
And la sesión de la task 1 espera a que el usuario haga el commit
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

### Requirement: La parte de TUI libera sus suscripciones
La parte de TUI del plugin DEBE dar de baja todas sus suscripciones a los eventos del plugin cuando OpenCode la descarga: antes de cada recarga en caliente y al cerrarse la TUI. Tras una recarga, solo la carga nueva de la parte de TUI DEBE recibir los eventos del plugin. Al cerrar una TUI que lleva su propio servidor (`opencode --standalone`), el plugin NO DEBE dejar ningún error en el terminal.

#### Scenario: Tras recargar, solo recibe eventos la carga nueva

```gherkin
Given OpenCode abierto en la TUI en una rama temporal
When OpenCode recarga el plugin dos veces
Then solo la última carga de la parte de TUI del plugin recibe sus eventos
```

#### Scenario Outline: Al cerrar la TUI no queda ningún error

```gherkin
Given OpenCode abierto en la TUI con su propio servidor, en una rama temporal
And OpenCode ha recargado el plugin <recargas>
When el usuario cierra la TUI
Then el terminal no muestra ningún error del plugin

Examples:
  | recargas    |
  | ninguna vez |
  | dos veces   |
```

### Requirement: Verificación por producto
Al empezar cada paso, el plugin DEBE guardar en la metadata de la sesión una foto del change según el CLI de OpenSpec: los artefactos en `done` y las tasks marcadas. Cuando la sesión operativa queda en reposo, haya llamado o no a `openspec_handoff`, el plugin DEBE volver a consultar el CLI y comparar: lo que ha cambiado es el producto evaluable. Sin producto, el plugin NO DEBE abrir ninguna revisión ni encadenar ningún paso, y `openspec_handoff` DEBE rechazarse con "no hay producto evaluable". Con producto, el plugin DEBE pasarlo al stage de git y seguir: en el modo normal, con una revisión por producto, en el orden de los artefactos del schema y con las tasks de un mismo paso como un solo producto; en el modo auto, con el paso siguiente. Si hay specs en el change, los errores de `openspec validate <change> --json` DEBEN pasarse a la revisión. Las tasks DEBEN identificarse como las identifica `openspec instructions apply --json`.

#### Scenario: Sin producto no hay revisión

```gherkin
Given una rama temporal con el change en curso `exportar-datos`, en modo normal
And la sesión operativa está creando el artefacto `design`
When la sesión queda en reposo sin haber escrito el artefacto `design`
Then no se crea ninguna sesión nueva
And la sesión operativa conserva el control
```

#### Scenario: La tool se rechaza sin producto

```gherkin
Given una rama temporal con el change en curso `exportar-datos`, en modo normal
And la sesión operativa está creando el artefacto `design`
When el modelo llama a `openspec_handoff` sin haber escrito el artefacto `design`
Then la tool responde que no hay producto evaluable
```

#### Scenario: El producto se revisa aunque el modelo no llame a la tool

```gherkin
Given una rama temporal con el change en curso `exportar-datos`, en modo normal
And la sesión operativa está creando el artefacto `design`
When el modelo escribe el artefacto `design` y la sesión queda en reposo sin llamar a `openspec_handoff`
Then el artefacto `design` queda en el stage de git
And se crea una sesión de revisión del artefacto `design` con el control
```

#### Scenario: El modelo hace más de lo que tocaba

```gherkin
Given una rama sin change, en modo normal
And la sesión operativa está creando el change
When el modelo crea el change `exportar-datos` y escribe los artefactos `proposal` y `specs` en la misma respuesta
Then se crea una sesión de revisión del artefacto `proposal` con el control
And la revisión del artefacto `specs` queda pendiente para después de la del `proposal`
```

#### Scenario: La revisión de specs recibe los errores de validación

```gherkin
Given una rama temporal con el change en curso `exportar-datos`, en modo normal
And la sesión operativa está creando el artefacto `specs`
When el modelo escribe unas specs que `openspec validate` da por inválidas y la sesión queda en reposo
Then la sesión de revisión del artefacto `specs` recibe los errores de `openspec validate`
```

### Requirement: Arranque de la sesión operativa
Al presentarse por primera vez un cliente con interfaz (una TUI que arranca, no una recarga en caliente), si la rama no tiene sesión operativa, el plugin DEBE crearla y arrancarla sola, sin esperar al primer mensaje del usuario: con el paso que indique `openspec status` si la rama tiene change, o con `openspec-new-change` si no lo tiene, también en una rama permanente. Con HEAD separado o con varios changes en la rama NO DEBE crearla. Si el paso tiene que esperar el commit del usuario (árbol sucio), la sesión DEBE crearse esperándolo. Tras una recarga en caliente del plugin NO DEBE crear ni arrancar nada.

#### Scenario Outline: Al arrancar sin sesión operativa

```gherkin
Given <rama> sin sesión operativa
When el usuario abre OpenCode en la TUI
Then se crea una sesión operativa que arranca <paso> sin que el usuario escriba nada
And la TUI pasa a esa sesión

Examples:
  | rama                                                   | paso                                      |
  | una rama temporal sin change                           | `openspec-new-change`                     |
  | la rama de origen                                      | `openspec-new-change`                     |
  | una rama temporal con el change en curso `exportar-datos` | el paso que indique `openspec status`   |
```

#### Scenario: Una recarga en caliente no arranca nada

```gherkin
Given OpenCode abierto en la TUI en una rama temporal sin change ni sesión operativa
When OpenCode recarga el plugin
Then no se crea ninguna sesión
```

### Requirement: Validación al volver a la sesión operativa
Cada vez que la TUI entra en la sesión operativa o recupera el foco en ella, si la sesión no está trabajando, el plugin DEBE validarla contra el repositorio. Si HEAD ya no está en su rama, DEBE aplicar las reglas de la rama actual. Si su change ya no está en la rama, DEBE quitarle el control, archivarla y actuar como al arrancar en una rama sin change. Si esperaba el árbol limpio y ya lo está, DEBE arrancar el paso. Si su paso no encaja con `openspec status`, DEBE mostrar un modal que explique la discrepancia, sin arreglarla. Que el producto del paso ya exista NO DEBE contar como discrepancia.

#### Scenario: El change de la sesión operativa ya no está en la rama

```gherkin
Given una rama temporal con el change en curso `exportar-datos` y su sesión operativa
And el usuario borra el change `exportar-datos` de la rama
When la TUI recupera el foco en la sesión operativa
Then la sesión deja de ser la operativa y queda archivada
And se crea una sesión operativa que arranca `openspec-new-change`
```

#### Scenario: Esperaba el commit y el árbol ya está limpio

```gherkin
Given una sesión operativa que espera el commit del usuario para empezar el artefacto `design` de `exportar-datos`
And el usuario hace el commit
When la TUI recupera el foco en la sesión operativa
Then la sesión empieza el artefacto `design` sin que el usuario escriba nada
```

#### Scenario: El paso no encaja con openspec status

```gherkin
Given una sesión operativa parada que hace el artefacto `tasks` de `exportar-datos`
And `openspec status` da como siguiente el artefacto `specs`
When la TUI entra en la sesión operativa
Then se muestra un modal que explica que el paso de la sesión no encaja con `openspec status`
And no se crea ni se archiva ninguna sesión
```

#### Scenario: El producto ya existe

```gherkin
Given una sesión operativa parada que hace el artefacto `design` de `exportar-datos`
And el artefacto `design` ya está escrito
When la TUI entra en la sesión operativa
Then no se muestra ningún modal
```

### Requirement: Funcionamiento sin TUI
La lógica del ciclo (producto evaluable, stage de git, cierre de las revisiones por git, sesión operativa, validación y encadenado) DEBE funcionar con cualquier cliente, aunque no haya ninguna TUI presentada: la UI web de OpenCode, OpenCode Desktop u `opencode run`. Lo que solo puede hacer la TUI DEBE degradarse así: en una sesión que no es la operativa, el contexto del modelo DEBE decir que ahí no se opera y cuál es la sesión operativa; sin TUI, las sesiones que terminan su paso DEBEN quedar marcadas para archivarse y archivarse cuando se presente una TUI; y, sin cliente con interfaz, una sesión nueva solo DEBE pasar a ser la operativa si la rama no tiene ninguna y el primer mensaje del usuario es exactamente `autopilot`.

#### Scenario: Sin TUI, el producto se revisa igual

```gherkin
Given una rama temporal con el change en curso `exportar-datos`, en modo normal, sin ninguna TUI
And la sesión operativa está creando el artefacto `design`
When el modelo escribe el artefacto `design` y la sesión queda en reposo
Then el artefacto `design` queda en el stage de git
And se crea una sesión de revisión del artefacto `design` con el control
And la sesión anterior queda marcada para archivarse
```

#### Scenario: En una sesión ajena, el modelo sabe que no se opera ahí

```gherkin
Given una rama temporal con el change en curso `exportar-datos` y su sesión operativa, sin ninguna TUI
When el usuario escribe en una sesión nueva
Then el contexto del modelo dice que esa sesión no es la operativa y nombra la sesión operativa
And la sesión nueva no toma el control
```

#### Scenario: Sin interfaz, la sesión operativa se arranca con `autopilot`

```gherkin
Given una rama temporal sin change ni sesión operativa, sin ninguna TUI
When el usuario escribe `autopilot` como primer mensaje de una sesión nueva
Then la sesión pasa a ser la operativa y arranca `openspec-new-change`
```

#### Scenario: Las sesiones marcadas se archivan al llegar una TUI

```gherkin
Given una sesión de un change marcada para archivarse mientras no había ninguna TUI
When el usuario abre OpenCode en la TUI
Then esa sesión queda archivada
```

### Requirement: La TUI se presenta sin errores
La parte de TUI DEBE presentarse al servidor aunque la parte de servidor todavía no haya registrado su RPC cuando la TUI arranca, y en ese caso NO DEBE dejar ningún error en el terminal ni en el log de la TUI.

#### Scenario: La TUI arranca antes de que el servidor registre su RPC

```gherkin
Given OpenCode arranca la parte de TUI del plugin antes de que la parte de servidor registre su RPC
When la parte de servidor registra su RPC
Then la TUI queda presentada al servidor
And el terminal no muestra ningún error del plugin
```

### Requirement: Las ventanas ajenas llevan a la sesión operativa
Cualquier ventana ajena de la TUI DEBE mostrar, mientras la rama tenga una sesión operativa, un modal de un solo botón: "Mientras se edita el change <change> en modo autopilot, solo se puede operar con su sesión operativa «<título>»", con el botón "Ir a la sesión del change". Son ventanas ajenas la pantalla de inicio al arrancar o tras `/new`, una sesión existente a la que se salta y cualquiera de ellas al recuperar el foco el terminal. Cerrar el modal de cualquier forma (Enter o Esc) DEBE llevar a la sesión operativa. El modal NO DEBE volver a abrirse en bucle, y NO DEBE salir en la propia sesión operativa, en las sesiones archivadas ni justo después de que el plugin salte solo a una sesión al encadenar. Si el modelo cambia de la rama a otra que ya tiene sesión operativa, la ventana desde la que lo hizo pasa a ser ajena.

#### Scenario Outline: Una ventana ajena lleva a la sesión operativa

```gherkin
Given una rama temporal con el change en curso `exportar-datos` y su sesión operativa
When la TUI <entra en la ventana>
Then se muestra el modal de un solo botón que nombra `exportar-datos` y la sesión operativa
And al cerrarlo con <tecla>, la TUI pasa a la sesión operativa

Examples:
  | entra en la ventana                                   | tecla |
  | muestra la pantalla de inicio tras `/new`             | Enter |
  | salta a una sesión libre                              | Esc   |
  | recupera el foco en la pantalla de inicio             | Enter |
```

#### Scenario Outline: Dónde no sale el modal

```gherkin
Given una rama temporal con el change en curso `exportar-datos` y su sesión operativa
When la TUI <entra en la ventana>
Then no se muestra ningún modal

Examples:
  | entra en la ventana                                      |
  | entra en la sesión operativa                             |
  | salta a una sesión archivada del change                  |
  | pasa sola a la sesión del paso siguiente al encadenar    |
```

#### Scenario: El modal no se repite en bucle

```gherkin
Given una rama temporal con el change en curso `exportar-datos` y su sesión operativa
And la TUI muestra el modal en la pantalla de inicio
When la TUI no consigue pasar a la sesión operativa al cerrar el modal
Then el modal no vuelve a abrirse hasta que la TUI cambie de ventana o recupere el foco
```

### Requirement: Revisión humana cerrada por git en el modo normal
En el modo normal, tras cada producto de un artefacto del plan, de una task, del verify y de `openspec-update-change`, el plugin DEBE abrir una sesión de revisión, en la que el LLM guía al usuario por la revisión sin modificar archivos y sin pedir commits. La revisión DEBE terminar cuando el usuario envía un prompt y el plugin comprueba en git, antes de pasar el prompt al modelo, que desde que empezó la revisión el estado de git ha cambiado, no queda nada en el stage y se cumple una de estas dos condiciones: HEAD ha avanzado (el usuario ha hecho el commit; con un solo producto, el árbol queda limpio), que es una revisión satisfactoria; o HEAD no ha cambiado (el usuario lo ha sacado todo del stage), que es una revisión no satisfactoria. En cualquier otro estado, la revisión DEBE seguir y el prompt DEBE llegar al modelo con normalidad. Si la revisión es satisfactoria, el plugin DEBE pasar a la revisión del producto siguiente, si queda alguno, o al paso que indique `openspec status`; una revisión satisfactoria del verify DEBE llevar al archive. Si no lo es, lo sucio DEBE quedarse en el árbol y el plugin DEBE pasar a una sesión de `openspec-update-change`, cuyo producto pasa por una revisión del plan con las mismas reglas. El plugin NO DEBE pedir en la TUI ninguna confirmación del cierre: la acción en git es la confirmación.

#### Scenario Outline: Resultado de una revisión

```gherkin
Given una rama temporal con el change en curso `exportar-datos`, en modo normal
And una sesión de revisión de <lo revisado>, con su producto en el stage
When el usuario <acción en git> y envía un prompt
Then se crea una sesión nueva con el control para <siguiente>
And la sesión de revisión queda archivada

Examples:
  | lo revisado            | acción en git                     | siguiente                                                   |
  | el artefacto `design`  | hace el commit                    | el paso que indique `openspec status`                       |
  | la task 3              | hace el commit                    | el paso que indique `openspec status`                       |
  | la task 3              | saca todo del stage               | `openspec-update-change`, con el prompt como conclusiones   |
```

#### Scenario: La revisión sigue mientras queda algo en el stage

```gherkin
Given una sesión de revisión del artefacto `design` de `exportar-datos`, con su producto en el stage
When el usuario envía un prompt sin haber hecho el commit
Then el prompt llega al modelo de la sesión de revisión
And no se crea ninguna sesión nueva
```

#### Scenario: La revisión del verify

```gherkin
Given una sesión de revisión del verify de `exportar-datos`, con el árbol limpio, en modo normal
When el usuario hace un commit y envía un prompt
Then se crea una sesión nueva con el control para el archive
```

#### Scenario: Tras un update-change viene una revisión del plan

```gherkin
Given una sesión de `openspec-update-change` lanzada por una revisión no satisfactoria de la task 3
When la sesión cambia el plan y queda en reposo
Then los cambios quedan en el stage de git
And se crea una sesión de revisión de los cambios en el plan
```

#### Scenario: Tras la última task viene el verify

```gherkin
Given una rama temporal con el change en curso `exportar-datos`, en modo normal
When la revisión de la última task termina satisfactoria
Then se crea una sesión nueva con el control para `openspec-verify-change`
```

### Requirement: Indicaciones de apply según el modo
El modo del plugin decide si el workflow de apply hace una sola task por sesión, también cuando se lanza a mano. Al cargarse su parte de servidor, el plugin DEBE dejar `openspec/config.yaml` con las indicaciones de «una task por sesión» en `operations.apply.guidance` si el modo es normal, y sin ellas si el modo es auto. Las indicaciones son estas cuatro, literales y en este orden, cada una como un elemento de la lista:

```yaml
operations:
  apply:
    guidance:
      - >-
        Standing instruction from the project owner: apply runs one tracked
        task per session. Take it as given that the user interrupts after every
        completed task; this is the built-in "User interrupts" pause, declared
        in advance. So in this session the task to work on is the first one the
        CLI returns with `done: false`.
      - >-
        Implement that task in this top-level interactive session. Do not
        delegate it to a subagent or any other non-interactive agent, so that
        every built-in pause (unclear task, design issue, added scope, error or
        blocker) is asked to the user and answered in this session.
      - >-
        When the task is marked `- [x]` and the rerun of the apply instructions
        confirms it, that pause applies: go to the built-in "On completion or
        pause, show status" step instead of continuing to the next task. Show
        it as completion if the CLI now reports `all_done`; otherwise as a
        pause whose reason is the session boundary and whose way forward is a
        new session (fresh context) running this same apply workflow for this
        change. The built-in loop resumes there from the first pending task, as
        any resumed apply does.
      - >-
        Change nothing else. Steps, CLI commands, checkbox updates, pause
        conditions, status and completion output, and completion criteria stay
        exactly as the built-in workflow defines them, so the change ends up as
        a single uninterrupted apply would leave it. Add nothing on account of
        the session split: no handoff or progress files, no notes or markers in
        the tracking file, no extra commits. This guidance applies only while
        implementing tasks, not to verification or any other workflow that
        reads this output.
```

#### Scenario Outline: El archivo sigue al modo

```gherkin
Given un clon del proyecto cuyo `openspec/config.yaml` <estado previo> las indicaciones de una task por sesión
And un usuario con el plugin en modo <modo>
When se carga el plugin
Then `openspec/config.yaml` <resultado> las indicaciones de una task por sesión
And el resto de `openspec/config.yaml` no cambia

Examples:
  | estado previo | modo   | resultado |
  | no tiene      | normal | tiene     |
  | tiene         | normal | tiene     |
  | tiene         | auto   | no tiene  |
  | no tiene      | auto   | no tiene  |
```

### Requirement: El ajuste de config.yaml no toca nada más
Al añadir o quitar las indicaciones de una task por sesión, el plugin NO DEBE cambiar nada más de `openspec/config.yaml`: ni sus comentarios, ni las demás claves, ni otras indicaciones de `apply` o de `archive`. Si el archivo ya está como pide el modo, NO DEBE escribirlo. Si `operations` o `operations.apply` no existen, DEBE crearlos para añadir las indicaciones, y al quitarlas NO DEBE dejar claves vacías que no estaban. El CLI de OpenSpec DEBE seguir leyendo el archivo sin errores en los dos modos. Si no hay `openspec/config.yaml` o el plugin no puede leerlo o escribirlo, NO DEBE crearlo ni bloquear OpenCode: DEBE avisar y seguir.

#### Scenario: Sin cambio de modo no se reescribe el archivo

```gherkin
Given un clon del proyecto cuyo `openspec/config.yaml` tiene las indicaciones de una task por sesión
And un usuario con el plugin en modo normal
When se carga el plugin
Then `openspec/config.yaml` no se escribe
```

#### Scenario: Otras indicaciones de apply se conservan

```gherkin
Given un clon del proyecto cuyo `openspec/config.yaml` tiene en apply la indicación "Keep test summaries concise"
And un usuario con el plugin en modo normal
When se carga el plugin
And el usuario cambia el plugin a modo auto
Then `openspec/config.yaml` tiene en apply solo la indicación "Keep test summaries concise"
```

#### Scenario: Sin indicaciones de apply previas no quedan claves vacías

```gherkin
Given un clon del proyecto cuyo `openspec/config.yaml` no tiene la clave `operations.apply`
And un usuario con el plugin en modo normal
When se carga el plugin
And el usuario cambia el plugin a modo auto
Then `openspec/config.yaml` queda igual que antes de cargar el plugin
```

#### Scenario: El CLI de OpenSpec acepta el archivo en los dos modos

```gherkin
Given un clon del proyecto con un change en curso `exportar-datos`
And un usuario con el plugin en modo normal
When se carga el plugin
Then `openspec instructions apply --change exportar-datos` da las indicaciones de una task por sesión
```

#### Scenario: Sin config.yaml no se crea

```gherkin
Given un clon del proyecto sin `openspec/config.yaml`
And un usuario con el plugin en modo normal
When se carga el plugin
Then no existe `openspec/config.yaml`
And OpenCode sigue funcionando
```
