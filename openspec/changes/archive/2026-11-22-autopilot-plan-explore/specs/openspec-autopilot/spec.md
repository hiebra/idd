# openspec-autopilot

## REMOVED Requirements

### Requirement: Una sesión por paso
**Reason**: Su escenario "Cambiar de agente no inyecta nada" deja de valer: cambiar a plan carga el flujo de `openspec-explore`, y volver a build, un recordatorio del paso. OpenSpec no deja quitar un escenario desde un requisito modificado.
**Migration**: Lo sustituye "Una sesión por paso, con el agente build", con el mismo contenido salvo el agente con que nacen las sesiones y lo que se inyecta al cambiar de agente, que pasa a "El agente plan explora en la sesión operativa".

## ADDED Requirements

### Requirement: Una sesión por paso, con el agente build
Cada paso del ciclo DEBE hacerse en una sesión nueva que crea el plugin, con el workflow que elige el plugin para ese paso y con el agente build, y que nace como sesión operativa. Los pasos son: cada artefacto del plan, cada task, el verify, el archive y la resincronización del wiki, y en el modo normal también las sesiones de revisión y de `openspec-update-change`. El plugin DEBE arrancar cada paso con un mensaje en la sesión, para que la instrucción del paso siga en su historial, y DEBE recordársela al modelo en cada petición de la sesión operativa con el agente build. El paso DEBE terminar cuando la sesión queda en reposo con producto evaluable, haya llamado o no a `openspec_handoff`. Al terminar su paso, la sesión DEBE pasar el control a la siguiente y quedar archivada. Las sesiones archivadas DEBEN conservar su metadata, de modo que el change guarde qué sesiones ha tenido, qué paso hizo cada una y, en las de revisión, su resultado y sus conclusiones. Lo que el plugin inyecta cuando el usuario cambia de agente dentro de la sesión operativa lo fija el requisito "El agente plan explora en la sesión operativa".

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

### Requirement: El agente plan explora en la sesión operativa
Cuando el usuario cambia la sesión operativa al agente plan, el plugin DEBE tratarlo como una petición de explorar el paso en curso. La primera petición con el agente plan después de una con el agente build DEBE incluir la instrucción de seguir la skill `openspec-explore` sobre el change y el paso en curso (o la revisión en curso), como compañero de pensamiento y sin implementar nada; esa petición NO DEBE incluir el recordatorio del paso. Las peticiones siguientes con el agente plan DEBEN incluir solo un recordatorio de ese flujo de exploración. Cada nuevo cambio de build a plan DEBE volver a incluir la instrucción completa. La primera petición con el agente build después de una con el agente plan DEBE incluir solo un recordatorio del paso que había antes del cambio a plan, que dice que se vuelve de explorar, y NO DEBE repetir la instrucción completa del paso ni añadir mensajes a la sesión. Lo que el plugin inyecta al cambiar de agente NO DEBE quedar en el historial de la sesión. En las sesiones que no son la operativa, cambiar de agente NO DEBE cambiar lo que inyecta el plugin.

#### Scenario Outline: Pasar a plan carga el flujo de exploración

```gherkin
Given una sesión operativa de `exportar-datos` que hace <lo que hace>, con el agente build
When el usuario cambia la sesión al agente plan y escribe un mensaje
Then la petición al modelo incluye la instrucción de seguir `openspec-explore` sobre <lo que hace>
And la petición no incluye el recordatorio del paso

Examples:
  | lo que hace                     |
  | el artefacto `design`           |
  | la revisión de la task 3        |
```

#### Scenario: Seguir en plan solo recuerda la exploración

```gherkin
Given una sesión operativa que crea el artefacto `design` de `exportar-datos`
And el usuario ya ha escrito un mensaje en ella con el agente plan
When el usuario escribe otro mensaje con el agente plan
Then la petición al modelo incluye el recordatorio de la exploración
And la petición no incluye la instrucción completa de `openspec-explore`
```

#### Scenario: Volver a build solo recuerda el paso previo

```gherkin
Given una sesión operativa que crea el artefacto `design` de `exportar-datos`
And el usuario ya ha escrito un mensaje en ella con el agente plan
When el usuario cambia la sesión al agente build y escribe un mensaje
Then la petición al modelo incluye el recordatorio del paso del artefacto `design`, que dice que se vuelve de explorar
And la petición no incluye ninguna instrucción de `openspec-explore`
And el plugin no añade ningún mensaje a la sesión
```

#### Scenario: Cada paso a plan vuelve a cargar la exploración

```gherkin
Given una sesión operativa que crea el artefacto `design` de `exportar-datos`
And el usuario ha pasado por el agente plan y ha vuelto a build
When el usuario cambia otra vez la sesión al agente plan y escribe un mensaje
Then la petición al modelo incluye la instrucción completa de `openspec-explore`
```

#### Scenario: En una sesión ajena, plan no carga la exploración

```gherkin
Given una rama temporal con el change en curso `exportar-datos` y su sesión operativa
When el usuario escribe con el agente plan en una sesión que no es la operativa
Then el contexto del modelo dice que esa sesión no es la operativa y nombra la sesión operativa
And la petición no incluye ninguna instrucción de `openspec-explore`
```

### Requirement: Aviso de lo modificado con el agente plan
Cuando la sesión operativa queda en reposo tras un turno con el agente plan, el plugin DEBE comparar el estado de git (HEAD, stage y árbol de trabajo) con el que había al empezar ese turno. Si ha cambiado, el plugin DEBE avisar al usuario de que con el agente plan se han hecho modificaciones que, por el enfoque del workflow y la naturaleza del agente plan, deberían haberse reservado al agente build. En la TUI, el aviso DEBE ser un modal de un solo botón, "Entendido". Si el turno ha dejado producto evaluable, el plugin NO DEBE crear la sesión siguiente hasta que el usuario cierre el modal, de cualquier forma (Enter o Esc), y al cerrarlo DEBE encadenar como lo habría hecho sin el aviso; si no hay producto, la sesión sigue como estaba. Sin TUI, el plugin NO DEBE esperar: DEBE encadenar como siempre, y el aviso DEBE ir en el mensaje con el que arranca la sesión siguiente o, si no hay producto, en el contexto de la siguiente petición de la misma sesión. Un aviso pendiente DEBE mostrarse cuando se presente una TUI. Un turno con el agente plan que no cambia el estado de git, o un turno con el agente build, NO DEBE dar ningún aviso.

#### Scenario: Lo producido en plan detiene la cadena hasta el aviso

```gherkin
Given una rama temporal con el change en curso `exportar-datos`, en modo normal, en la TUI
And la sesión operativa está creando el artefacto `design`
When el usuario, con el agente plan, pide al modelo que escriba el artefacto `design` y la sesión queda en reposo
Then se muestra un modal de un solo botón que avisa de que con el agente plan se han hecho modificaciones
And no se crea ninguna sesión nueva
```

#### Scenario: Al cerrar el aviso, la cadena sigue

```gherkin
Given una sesión operativa de `exportar-datos` con el aviso de lo modificado con el agente plan en pantalla
And el turno en plan dejó escrito el artefacto `design`
When el usuario cierra el modal
Then el artefacto `design` queda en el stage de git
And se crea una sesión de revisión del artefacto `design` con el control
```

#### Scenario: Una modificación en plan sin producto también avisa

```gherkin
Given una sesión operativa que crea el artefacto `design` de `exportar-datos`, en la TUI
When el modelo, con el agente plan, modifica el README y la sesión queda en reposo
Then se muestra el modal que avisa de que con el agente plan se han hecho modificaciones
And la sesión sigue siendo la operativa del artefacto `design`
```

#### Scenario: Sin TUI, el aviso va en la sesión siguiente

```gherkin
Given una rama temporal con el change en curso `exportar-datos`, en modo normal, sin ninguna TUI
And la sesión operativa está creando el artefacto `design`
When el modelo, con el agente plan, escribe el artefacto `design` y la sesión queda en reposo
Then se crea una sesión de revisión del artefacto `design` con el control
And el mensaje con el que arranca la revisión avisa de que con el agente plan se han hecho modificaciones
```

#### Scenario: Explorar sin modificar nada no avisa

```gherkin
Given una sesión operativa que crea el artefacto `design` de `exportar-datos`, en la TUI
When el usuario conversa con el agente plan sin que cambie nada en git y la sesión queda en reposo
Then no se muestra ningún modal
And no se crea ninguna sesión nueva
```
