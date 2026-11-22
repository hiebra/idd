# ADR-0014: El autopilot decide por el producto y por git, con la lógica en el servidor y una sesión operativa por rama

- Status: accepted, supersedes ADR-0008
- Date: 2026-11-22
- Supersedes: ADR-0008

## Context

ADR-0008 automatizó el ciclo de un change en OpenCode 2 con el plugin `openspec-autopilot`. ADR-0011 lo matizó en una premisa: los escuchadores que sobrevivían a las recargas. Tres de sus decisiones no aguantan las pruebas con OpenCode 2.3.2 y un modelo que no obedece (`alibaba/qwen3.8-flash`, change `autopilot-sesion-operativa`):

- **Cada paso se cerraba con una tool que llama el modelo.** El modelo no la llamó al crear el change. Cuando la llamó, siguió escribiendo artefactos en la misma respuesta, y nada se encadenó ni se revisó.
- **Las decisiones del usuario se confirmaban en un diálogo de la TUI**, y el plugin solo actuaba con TUI. La UI web (`opencode pair`, `opencode serve`) no carga ninguna interfaz de plugins de terceros, así que en ella el plugin no hacía nada.
- **Una sesión abierta a mano podía tomar el control**, y gana la más antigua. Una dueña cuyo change se había borrado seguía con el control, y cualquier sesión nueva quedaba libre sin que el usuario supiera dónde operar.

Lo comprobado (design de `autopilot-sesion-operativa`) da las piezas para otra decisión:

- el CLI de OpenSpec dice qué artefactos están en `done` y qué tasks están marcadas;
- el hook de servidor `prompt` llega antes de que el prompt del usuario vaya al modelo;
- la TUI sabe en qué pantalla está y cuándo recupera el foco.

Alternativas consideradas:

- **Endurecer los prompts para que el modelo obedezca.** Es lo que ha fallado.
- **Seguir con la confirmación en la TUI y añadir otra interfaz para la web.** La web no ejecuta código de plugins, y OpenCode Desktop solo con una API experimental.
- **Que el plugin haga los commits.** Contradice ADR-0013: el historial es del usuario.

## Decision

- **Un plugin local propio**, `.opencode/plugins/openspec-autopilot/`, sin dependencias, solo con módulos `node:` y sin lanzar nunca una excepción hacia OpenCode. Su estado vive solo en la metadata de las sesiones de OpenCode. Hay una sesión nueva por paso, con el workflow y el agente que elige el plugin, y la anterior queda archivada.
- **La lógica vive en la parte de servidor y funciona con cualquier cliente**: el producto, el stage, el cierre de las revisiones, la sesión operativa, su validación y el encadenado. Cada cliente con interfaz pone lo que solo él puede hacer (modales, foco, navegación y archivado) y lo recibe por el RPC del plugin. Donde no hay interfaz, el ciclo se degrada así:
  - el contexto del modelo avisa en las sesiones que no son la operativa;
  - las sesiones terminadas se archivan cuando llega una TUI;
  - el arranque necesita un mensaje explícito.
- **El producto evaluable decide si un paso ha terminado.** Es lo que ha cambiado en el change desde que empezó el paso, según el CLI de OpenSpec o, donde el CLI no lo ve, según git. Se evalúa cuando la sesión queda en reposo, haya llamado el modelo a la tool o no. Sin producto no se avanza.
- **El plugin pasa el producto al stage; el usuario decide con git.** En el modo normal, una revisión por producto se cierra cuando el usuario envía un prompt y git ha cambiado desde que empezó:
  - árbol limpio (hizo el commit): ok;
  - todo fuera del stage: ko, y lo sucio y su prompt van a `openspec-update-change`.

  Ningún modelo pide commits ni cierra una revisión.
- **Una sesión operativa por rama.** Cualquier otra ventana de la TUI lleva a ella con un modal de un botón. Al arrancar sin ella, el plugin la crea y la arranca. Al volver a ella, la valida contra la rama, el change y el árbol, sin arreglar discrepancias por su cuenta.
- **Dos modos**: el normal, con revisión tras cada producto; y el auto, sin revisiones, que se para cuando un workflow pregunta, en cada cambio de zona hasta el commit del usuario y ante un verify con problemas críticos. El modo auto es una opción de cada usuario.
- **En Claude Code no hay nada del plugin** (ADR-0006).

ADR-0011 sigue en vigor para la parte de TUI: incluye el temporizador de la ruta y la escucha del foco en la limpieza de `setup`.

El comportamiento está especificado en `openspec/specs/openspec-autopilot/spec.md`.

## Consequences

- El ciclo avanza aunque el modelo no llame a la tool o haga de más. Lo que haga de más se revisa igual, producto a producto.
- El usuario cierra cada revisión con un commit o sacando todo del stage, sin diálogos. Un ok del verify sin cambios exige un commit vacío.
- La UI web, OpenCode Desktop y `opencode run` funcionan con la lógica completa, pero sin modal, sin navegación y con el archivado diferido. Desktop podría tener interfaz con un bundle `./gui-experimental`, que queda fuera por ser experimental.
- El plugin depende de más comportamientos de OpenCode 2.3.2: el hook `prompt` con el texto mutable, `ui.router.current()` y los eventos de foco del renderer. Al subir de versión hay que volver a comprobarlos con el banco de pruebas.
- `git add -A` puede llevar al stage cambios ajenos al paso. La revisión los enseña y el usuario decide.
- Se mantienen las consecuencias de ADR-0008 que no cambian:
  - el historial del change vive en OpenCode, no en el repositorio;
  - la suite necesita un OpenCode simulado al día con el contrato real;
  - con varios changes en una rama no se hace nada.
