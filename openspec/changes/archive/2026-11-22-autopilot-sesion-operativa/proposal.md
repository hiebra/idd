## Why

Las pruebas con OpenCode 2.3.2 y un modelo que no obedece (`alibaba/qwen3.8-flash`) muestran que el ciclo de `openspec-autopilot` depende de que el modelo haga lo que se le pide, y que eso no está garantizado:

- La sesión del paso `new` no llamó a `openspec_handoff` al crear el change y siguió con el proposal. Cuando por fin la llamó, el plugin respondió "no hagas nada más", pero en la misma respuesta escribió specs, design, adr y tasks. Como la respuesta no terminaba, `experimental.idle` no saltó: no se encadenó ninguna sesión ni hubo revisión.
- La instrucción del paso solo se inyecta en la primera petición de la sesión (hook `context`). En los mensajes siguientes el modelo ya no la tiene y sigue el flujo propio de la skill, que pide commits y avanza de artefacto.
- Una sesión dueña cuyo change se había borrado seguía con el control de la rama, y la regla "gana la más antigua" dejaba libre a cualquier sesión nueva.
- Hasta el primer prompt no ocurre nada, porque en la TUI la sesión no existe hasta entonces.
- La parte de servidor solo orquesta si la TUI se ha presentado: en la UI web (`opencode pair`, `opencode serve`) el plugin no hace nada.

El ciclo no puede depender de que el modelo obedezca: lo que se ha producido y cuándo se cierra una revisión lo tiene que decidir el plugin, con el CLI de OpenSpec y con git.

## What Changes

- **Verificación por producto.** Al empezar cada paso, el plugin guarda una foto del change según el CLI (artefactos en `done` y tasks marcadas). Cuando la sesión queda en reposo, haya llamado o no a `openspec_handoff`, compara: lo que ha cambiado es el **producto evaluable**. Sin producto no hay revisión, y `openspec_handoff` se rechaza con "no hay producto evaluable". Con producto, el plugin lo pasa al stage de git y abre una revisión por producto, en orden, aunque el modelo haya hecho más de lo que tocaba.
- **Ningún modelo pide commits** (**BREAKING** para el flujo actual del plugin): los prompts de los pasos ya no los piden, y el plugin hace el `git add`.
- **La revisión la cierra git, no el modelo** (**BREAKING**): termina cuando el usuario envía un prompt y, desde que empezó, git ha cambiado a **árbol limpio** (el usuario hizo el commit: ok) o a **todo fuera del stage** (ko). En un ko, lo sucio se queda como material de `openspec-update-change`, que recibe el prompt del usuario como conclusiones. Desaparece el diálogo de la TUI que confirmaba el cierre.
- **Sesión operativa** (**BREAKING** para "Qué pasa al abrir una sesión a mano"): una sola sesión viva por rama en autopilot. Cualquier otra ventana muestra un modal de un botón que lleva a ella. Al arrancar sin sesión operativa, el plugin la crea y la arranca. Al volver a ella, la valida contra la rama, el change y el árbol.
- **El modelo crea la rama temporal o salta a otra**, siempre desde la rama de origen y con el nombre del change, con `branch-change.mjs`, que además lista las ramas temporales con su change. El commit y la fusión siguen siendo del usuario.
- **La lógica vive en el servidor y funciona con cualquier cliente**; la TUI solo pone la interfaz (modal, foco, navegación, archivado). En la UI web, que no carga ninguna interfaz de plugins de terceros, el ciclo se degrada con dignidad: avisos por el contexto del modelo, sesiones nuevas que el usuario abre desde la lista y archivado diferido a la próxima TUI.
- **Las tasks se identifican igual en todo el plugin**: con el CLI (`openspec instructions apply`), no con el número de `tasks.md`.
- **La parte de TUI deja de registrar como error** el `hello` que llega antes de que el servidor registre su RPC (los 400 del log al arrancar).

## Capabilities

### New Capabilities

### Modified Capabilities
- `openspec-autopilot`: cambian "Dónde actúa el plugin", "Una sola sesión con el control del change", "Qué pasa al abrir una sesión a mano", "Una sesión por paso", "Revisión humana guiada en el modo normal", "Árbol limpio al empezar un paso" y "Modo auto". Se añaden la verificación por producto, la sesión operativa en las demás ventanas, su arranque y su validación, y el funcionamiento sin TUI.
- `openspec-change-lifecycle`: el modelo puede crear la rama temporal del change, siempre desde la rama de origen, y cambiar entre ramas temporales con `branch-change.mjs`, que las lista con su change. El commit y la fusión siguen siendo del usuario.

## Impact

- `.opencode/plugins/openspec-autopilot/`: `server.js`, `tui.js` y `lib/*` (estado, paso siguiente, producto, git, prompts y RPC).
- `.agents/openspec/branch-change.mjs`: subcomandos para listar, crear y cambiar de rama temporal.
- `.claude/skills/openspec-git-discipline/SKILL.md` (copia reescrita a propósito): el modelo crea ramas temporales y, en una sesión del autopilot, no pide commits.
- `adr/`: un ADR nuevo que sustituye la parte de ADR-0007 sobre ramas y commits pedidos por el modelo, y recoge la separación entre la lógica del servidor y la interfaz de cada cliente. ADR-0008 queda matizado.
- `README.md`: el ciclo, el autopilot, la UI web, OpenCode Desktop y `opencode run`.
- `acceptance-tests/`: el simulador de OpenCode con rutas de pantalla, foco, diálogo de un botón, un cliente web sin TUI y estados de git; los pasos y `core-tests` del plugin y de `branch-change`.
- Claude Code: sin plugin, como hasta ahora (ADR-0006). Los workflows siguen pidiendo el commit al usuario, y el modelo puede crear la rama temporal con el mismo `branch-change.mjs`.
