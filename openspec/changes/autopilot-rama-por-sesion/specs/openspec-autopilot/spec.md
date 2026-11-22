# openspec-autopilot

## MODIFIED Requirements

### Requirement: Dónde actúa el plugin
El plugin DEBE actuar con cualquier cliente de OpenCode (TUI, UI web, OpenCode Desktop u `opencode run`), en una rama temporal con un change o sin ninguno. En una rama permanente NO DEBE crear, arrancar, archivar ni encadenar sesiones: sus sesiones son libres, puede haber varias y ninguna toma el control. Con HEAD separado NO DEBE crear, archivar ni encadenar sesiones. Si la rama tiene varios changes, NO DEBE hacer nada de eso y DEBE avisar al usuario, nombrando los changes, hasta que en la rama quede uno solo. El proyecto NO DEBE tener nada del plugin en Claude Code.

#### Scenario Outline: El plugin no actúa

```gherkin
Given un clon del proyecto en <situación>
When se abre una sesión de OpenCode en la TUI
Then el plugin no crea, archiva ni encadena ninguna sesión

Examples:
  | situación                                  |
  | un commit con HEAD separado                |
  | la rama de origen                          |
```

#### Scenario: Varias sesiones libres en la rama de origen

```gherkin
Given el clon está en la rama de origen con una sesión de OpenCode
When el usuario escribe el primer mensaje de una sesión nueva
Then ninguna de las dos sesiones toma el control
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

### Requirement: Arranque de la sesión operativa
Al presentarse por primera vez un cliente con interfaz (una TUI que arranca, no una recarga en caliente), si la rama es temporal y no tiene sesión operativa, el plugin DEBE crearla y arrancarla sola, sin esperar al primer mensaje del usuario: con el paso que indique `openspec status` si la rama tiene change, o con `openspec-new-change` si no lo tiene. En una rama permanente, con HEAD separado o con varios changes en la rama NO DEBE crearla. Si el paso tiene que esperar el commit del usuario (árbol sucio), la sesión DEBE crearse esperándolo. Tras una recarga en caliente del plugin NO DEBE crear ni arrancar nada.

#### Scenario Outline: Al arrancar sin sesión operativa

```gherkin
Given <rama> sin sesión operativa
When el usuario abre OpenCode en la TUI
Then se crea una sesión operativa que arranca <paso> sin que el usuario escriba nada
And la TUI pasa a esa sesión

Examples:
  | rama                                                      | paso                                    |
  | una rama temporal sin change                              | `openspec-new-change`                   |
  | una rama temporal con el change en curso `exportar-datos` | el paso que indique `openspec status`   |
```

#### Scenario: En la rama de origen no se arranca nada

```gherkin
Given el clon está en la rama de origen
When el usuario abre OpenCode en la TUI
Then no se crea ninguna sesión
And la TUI muestra la pantalla de inicio
```

#### Scenario: Una recarga en caliente no arranca nada

```gherkin
Given OpenCode abierto en la TUI en una rama temporal sin change ni sesión operativa
When OpenCode recarga el plugin
Then no se crea ninguna sesión
```

### Requirement: Validación al volver a la sesión operativa
Cada vez que la TUI entra en la sesión operativa o recupera el foco en ella, si la sesión no está trabajando y su directorio está en su rama, el plugin DEBE validarla contra el repositorio. Si su change ya no está en la rama, DEBE quitarle el control, archivarla y actuar como al arrancar en una rama sin change. Si esperaba el árbol limpio y ya lo está, DEBE arrancar el paso. Si su paso no encaja con `openspec status`, DEBE mostrar un modal que explique la discrepancia, sin arreglarla. Que el producto del paso ya exista NO DEBE contar como discrepancia.

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
La lógica del ciclo (producto evaluable, stage de git, cierre de las revisiones por git, sesión operativa, validación y encadenado) DEBE funcionar con cualquier cliente, aunque no haya ninguna TUI presentada: la UI web de OpenCode, OpenCode Desktop u `opencode run`. Lo que solo puede hacer la TUI DEBE degradarse así: en una sesión que no es la operativa de una rama temporal, el contexto del modelo DEBE decir que ahí no se opera, nombrar la sesión operativa y ofrecer crear un worktree nuevo; sin TUI, las sesiones que terminan su paso DEBEN quedar marcadas para archivarse y archivarse cuando se presente una TUI; y, sin cliente con interfaz, una sesión nueva solo DEBE pasar a ser la operativa si la rama no tiene ninguna y el primer mensaje del usuario es exactamente `autopilot`. Si el usuario pide un worktree nuevo, el modelo DEBE poder crearlo, con las reglas de «Los worktrees de OpenCode nacen en una rama», y crear en él una sesión que pasa a ser la operativa de su rama y arranca `openspec-new-change` sola. Como el plugin no puede llevar la UI web a otra sesión, el modelo DEBE dar al usuario el enlace a esa sesión si conoce la dirección del servidor, o su título y su id si no la conoce.

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
And el contexto del modelo ofrece crear un worktree nuevo
And la sesión nueva no toma el control
```

#### Scenario: Sin TUI, el modelo crea un worktree con su sesión operativa

```gherkin
Given una rama temporal con el change en curso `exportar-datos` y su sesión operativa, sin ninguna TUI
When el usuario pide al modelo, en una sesión nueva, un worktree nuevo llamado `importar-datos`
Then existe un worktree en la rama nueva `importar-datos`
And una sesión de ese worktree es la operativa de `importar-datos` y arranca `openspec-new-change`
And el modelo responde con el enlace, o el título y el id, de esa sesión
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

## REMOVED Requirements

### Requirement: Las ventanas ajenas llevan a la sesión operativa
**Reason**: El modal de un solo botón obligaba a operar solo con la sesión operativa de la rama en curso. Lo sustituyen la rama de trabajo de cada sesión, el paso a su rama al cambiar de sesión y el modal de `/new`, que ofrece un worktree nuevo.
**Migration**: Para trabajar en otro change, crea un worktree (en la TUI, «Manage workspaces» o el modal de `/new`; en la web, su botón o pidiéndoselo al modelo). Para volver a un change, entra en su sesión: el plugin pone su rama.

## ADDED Requirements

### Requirement: Cada sesión tiene una rama de trabajo
La rama de trabajo de una sesión DEBE ser la que tiene HEAD en el directorio de la sesión mientras se trabaja en ella: la que tenía al crearse, y la nueva si se hace un checkout dentro de la sesión. El plugin DEBE guardarla en la metadata de la sesión y actualizarla cuando detecte el checkout. Si la sesión era la operativa de una rama temporal y su rama de trabajo cambia, DEBE dejar de ser la operativa, sin archivarse. Cuando el directorio vuelva a esa rama temporal sin sesión operativa, el plugin DEBE crear una sesión operativa que retome el paso donde se quedó, con las reglas de «Arranque de la sesión operativa».

#### Scenario: Un checkout dentro de la sesión le cambia la rama

```gherkin
Given una rama temporal con el change en curso `exportar-datos` y su sesión operativa
When el modelo hace checkout de la rama de origen en la sesión operativa para un merge asistido
Then esa sesión pasa a ser de la rama de origen
And `exportar-datos` se queda sin sesión operativa
```

#### Scenario: Al volver a la rama, se retoma el paso

```gherkin
Given una rama temporal `exportar-datos` que se quedó sin sesión operativa a mitad de la task 3
When el directorio vuelve a la rama `exportar-datos` y la TUI entra en él
Then se crea una sesión operativa que retoma la task 3 de `exportar-datos`
```

### Requirement: Pasar a una sesión es pasar a su rama
Cuando la TUI entra en una sesión, el plugin DEBE dejar el directorio de esa sesión en la rama de trabajo de la sesión. Si la sesión está en otro directorio (otro worktree u otro repositorio), ese directorio ya está en su rama: el plugin NO DEBE hacer checkout y DEBE avisar de la rama y del directorio. Si la sesión está en el mismo directorio que la ventana anterior y su rama no es la de HEAD, el plugin DEBE hacer checkout de la rama de la sesión y avisar de ello. Con cambios sin commit, o con otra sesión de ese directorio trabajando, NO DEBE hacer checkout: la TUI DEBE volver a la sesión anterior, o a la pantalla de inicio si no la hay, con un aviso que diga el motivo y, con cambios sin commit, que se puede hacer el commit o usar un worktree. Esto NO DEBE ocurrir justo después de que el plugin salte solo a una sesión al encadenar.

#### Scenario Outline: Entrar en una sesión pone su rama

```gherkin
Given la TUI está en una sesión de la rama de origen, con el árbol limpio
And la sesión operativa de `exportar-datos` está en <dónde>
When la TUI entra en la sesión operativa de `exportar-datos`
Then el directorio de esa sesión está en la rama `exportar-datos`
And se avisa de que se está en la rama `exportar-datos` <cómo>

Examples:
  | dónde                           | cómo             |
  | un worktree de `exportar-datos` | en su worktree   |
  | el mismo directorio             | tras un checkout |
```

#### Scenario Outline: Con cambios sin commit no se cambia de rama

```gherkin
Given la TUI venía de <origen>, en el mismo directorio que la sesión operativa de `exportar-datos`
And el directorio está en la rama de origen con cambios sin commit
When la TUI entra en la sesión operativa de `exportar-datos`
Then el directorio sigue en la rama de origen
And la TUI vuelve a <destino>
And se avisa de que hay cambios sin commit y de que se puede hacer el commit o usar un worktree

Examples:
  | origen                          | destino                         |
  | una sesión de la rama de origen | esa sesión de la rama de origen |
  | ninguna sesión                  | la pantalla de inicio           |
```

#### Scenario: Con otra sesión trabajando no se cambia de rama

```gherkin
Given la TUI está en una sesión de la rama de origen, con el árbol limpio, en el mismo directorio que la sesión operativa de `exportar-datos`
And otra sesión de ese directorio está trabajando
When la TUI entra en la sesión operativa de `exportar-datos`
Then el directorio sigue en la rama de origen
And la TUI vuelve a esa sesión de la rama de origen
And se avisa de que hay una sesión trabajando en ese directorio
```

### Requirement: Una sesión nueva en una rama temporal con sesión operativa
Cuando la TUI muestra la pantalla de inicio o una sesión nueva en el directorio de una rama temporal que ya tiene sesión operativa, el plugin DEBE mostrar un modal. Con el árbol sucio, el modal DEBE ofrecer solo «Crear un worktree nuevo». Con el árbol limpio, DEBE ofrecer además «Cambiar a la rama de origen», que hace checkout de la rama de origen en ese directorio. «Crear un worktree nuevo» DEBE abrir el diálogo de nombre de worktree de OpenCode, con el que el usuario escribe el nombre o lo genera. Cerrar el modal sin elegir DEBE llevar a la sesión de la que se venía. El modal NO DEBE salir en una rama permanente, en una rama temporal sin sesión operativa, ni en la propia sesión operativa, y NO DEBE volver a abrirse en bucle.

#### Scenario Outline: Opciones del modal según el árbol

```gherkin
Given una rama temporal con el change en curso `exportar-datos` y su sesión operativa, con <estado del árbol>
When el usuario hace `/new` desde la sesión operativa
Then se muestra un modal con las opciones <opciones>

Examples:
  | estado del árbol    | opciones                                                     |
  | el árbol sucio      | «Crear un worktree nuevo»                                    |
  | el árbol limpio     | «Crear un worktree nuevo» y «Cambiar a la rama de origen»    |
```

#### Scenario: Crear un worktree nuevo desde el modal

```gherkin
Given el modal de `/new` en la rama temporal `exportar-datos`
When el usuario elige «Crear un worktree nuevo»
Then se abre el diálogo de nombre de worktree de OpenCode
```

#### Scenario: Cambiar a la rama de origen desde el modal

```gherkin
Given el modal de `/new` en la rama temporal `exportar-datos`, con el árbol limpio
When el usuario elige «Cambiar a la rama de origen»
Then el directorio queda en la rama de origen
And la sesión operativa de `exportar-datos` sigue siendo la operativa
```

#### Scenario: Cerrar el modal sin elegir

```gherkin
Given el usuario hizo `/new` desde la sesión operativa de `exportar-datos` y se muestra el modal
When el usuario cierra el modal sin elegir
Then la TUI vuelve a la sesión operativa de `exportar-datos`
```

### Requirement: Los worktrees de OpenCode nacen en una rama
El plugin DEBE registrar en OpenCode una estrategia de worktree que sirva a la TUI, a la web y al modelo. Un worktree nuevo DEBE estar en una rama con su mismo nombre, tanto si lo escribe el usuario como si lo genera OpenCode. Si esa rama ya existe, el worktree DEBE abrirse en ella; si está sacada en otro directorio, NO DEBE crearse y DEBE decirse en cuál. Si no existe, la rama DEBE crearse desde la rama de origen del remoto, después de un `git fetch`, sin seguir a la rama de origen y con su push configurado hacia `origin/<rama>`, sin cambiar la configuración git del clon. Si el `git fetch` falla, NO DEBE crearse el worktree y DEBE decirse el motivo. La referencia de partida que mande el cliente DEBE ignorarse. Al quitar un worktree, su rama DEBE conservarse.

#### Scenario Outline: Crear un worktree

```gherkin
Given el remoto tiene la rama de origen y <rama existente>
When se crea un worktree llamado `importar-datos`
Then el worktree está en la rama `importar-datos`
And <origen de la rama>

Examples:
  | rama existente                              | origen de la rama                                         |
  | no existe la rama `importar-datos`          | la rama `importar-datos` sale de la rama de origen del remoto |
  | existe la rama `importar-datos` sin sacar   | la rama `importar-datos` conserva sus commits             |
```

#### Scenario: La rama nueva se publica sin tocar el clon

```gherkin
Given un worktree recién creado en la rama nueva `importar-datos`
When el usuario hace un commit y un `git push` sin argumentos en el worktree
Then el remoto tiene la rama `importar-datos`
And la rama de origen del remoto no ha cambiado
And la configuración git del clon no ha cambiado
```

#### Scenario: La rama ya está sacada en otro directorio

```gherkin
Given la rama `importar-datos` está sacada en el directorio principal del clon
When se crea un worktree llamado `importar-datos`
Then no se crea ningún worktree
And se dice que la rama `importar-datos` está sacada en el directorio principal del clon
```

#### Scenario: Sin acceso al remoto no se crea

```gherkin
Given el remoto no está accesible
When se crea un worktree llamado `importar-datos`
Then no se crea ningún worktree
And se dice que no se ha podido actualizar la rama de origen del remoto
```

#### Scenario: Quitar un worktree conserva su rama

```gherkin
Given un worktree en la rama `importar-datos`
When se quita ese worktree
Then la rama `importar-datos` sigue existiendo
```

### Requirement: En el ciclo del autopilot, el modelo no cambia de rama
Las instrucciones de los pasos del autopilot NO DEBEN pedir al modelo que cree una rama ni que cambie de rama. La rama de un change nuevo la DEBEN dar el worktree o el usuario. Fuera de esas instrucciones, por ejemplo en un merge asistido, el modelo PUEDE cambiar de rama, con las reglas de «Cada sesión tiene una rama de trabajo».

#### Scenario: El paso new no crea la rama

```gherkin
Given una rama temporal sin change ni sesión operativa
When el plugin arranca la sesión operativa con `openspec-new-change`
Then la instrucción del paso no pide crear ni cambiar de rama
```

### Requirement: La TUI habla con el plugin del directorio de la ventana
Cada llamada de la parte de TUI a la parte de servidor DEBE ir dirigida a la instancia del plugin del directorio en que está la TUI en ese momento, no al directorio en que arrancó.

#### Scenario: La TUI arrancó en otro directorio

```gherkin
Given la TUI arrancó en el directorio principal, en la rama de origen
And la rama temporal `exportar-datos` está en un worktree con su sesión operativa
When la TUI entra en la sesión operativa de `exportar-datos`
Then el plugin del worktree de `exportar-datos` valida esa sesión
And no se muestra ningún modal
```
