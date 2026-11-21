# ADR-0008: El ciclo de un change se automatiza en OpenCode 2 con un plugin que encadena una sesión por paso

- Status: accepted
- Date: 2026-11-21
- Supersedes: -

## Context

Con el ciclo de ADR-0007, el usuario sigue lanzando a mano cada workflow de un change: cada artefacto, cada task, el verify, el archive y la resincronización del wiki. Además, lo hace en sesiones que acumulan contexto hasta degradarse. OpenCode 2 permite que un plugin local cree sesiones con su agente y su metadata, las ponga a trabajar, navegue entre ellas, las archive y muestre diálogos en la TUI. Claude Code no lo permite; ADR-0006 fija cuándo se acepta esa asimetría.

Las pruebas con OpenCode 2.3.2 (`.wiki/raw/notes/2026-11-21-ll-sesiones-opencode-autopilot.md`) fijan las restricciones:

- solo la TUI archiva;
- la metadata se sustituye entera;
- una tool del plugin solo la ve el modelo con `codemode: false`;
- cada recarga en caliente deja vivos los escuchadores RPC anteriores;
- se puede encadenar desde `experimental.idle`;
- no hay operaciones atómicas entre TUIs;
- un modelo real cerró una revisión que el usuario no había dado por terminada.

Alternativas consideradas:

- **Una sola sesión larga que recorra el change.** Es justo lo que degrada el contexto.
- **Ampliar el plugin del arranque** (`session-bootstrap`). Mezcla un adaptador que debe funcionar siempre (ADR-0002) con una automatización opcional.
- **Guardar el estado del ciclo en el repositorio o en `ctx.storage`.** El primero ensucia el árbol que se pide limpio y el segundo no tiene atomicidad ni se archiva con la sesión.
- **Confiar en el modelo para cerrar cada paso.** La prueba con un modelo real lo descarta para las decisiones del usuario.

## Decision

- **Un plugin local propio**, `.opencode/plugins/openspec-autopilot/`, con el patrón de `session-bootstrap`: parte de servidor y parte de TUI, sin dependencias, solo módulos `node:` y nunca una excepción hacia OpenCode. La parte de TUI hace lo que solo ella puede hacer (archivar, navegar, diálogos), pedido por RPC.
- **Solo actúa con TUI**, en una rama temporal con un change o sin ninguno, según el módulo neutral de ADR-0007. Sin TUI, en una rama permanente o con varios changes, no orquesta nada.
- **Una sesión nueva por paso**: cada artefacto, cada task, el verify, el archive, la resincronización del wiki y, en el modo normal, las revisiones y las sesiones de `openspec-update-change`. El plugin elige el workflow y el agente de cada paso. Al terminar, la sesión pasa el control a la siguiente y queda archivada.
- **El estado vive solo en la metadata de las sesiones**: una sola sesión dueña del change por rama, el paso de cada sesión, el resultado de las revisiones y las lecciones candidatas. Las sesiones archivadas son el historial del change.
- **Cada paso se cierra con una tool del plugin**, y el plugin comprueba en el repositorio que el paso hizo algo antes de encadenar. Las decisiones del usuario (cerrar una revisión, aceptar un verify con problemas críticos) se confirman en la TUI, fuera del modelo.
- **Las operaciones son idempotentes y llevan identificador**, y una instancia del plugin de una recarga anterior no hace nada. Ante un fallo, el plugin avisa y deja la sesión libre, sin bloquear la petición.
- **Dos modos**:
  - el normal, con revisión humana guiada tras cada paso;
  - el auto, sin revisiones, que se para cuando un workflow pregunta, en cada cambio entre la zona de specs y la de código, y ante problemas críticos del verify.

  El modo auto es una opción de cada usuario en su configuración de OpenCode; el proyecto no la fija.
- **En Claude Code no hay nada del plugin**: los mismos workflows se lanzan a mano, con el mismo ciclo y el mismo resultado.

El comportamiento está especificado en `openspec/specs/openspec-autopilot/spec.md`.

## Consequences

- En OpenCode, un change se recorre de principio a fin sin lanzar workflows a mano. Cada paso empieza con un contexto limpio, y el usuario solo interviene para revisar, responder y hacer commits.
- El historial del change (qué sesión hizo qué y cómo acabó cada revisión) queda en OpenCode, no en el repositorio. Se pierde si se borran las sesiones, y no viaja con el clon.
- El plugin depende de comportamientos de OpenCode 2.3.2 que parecen accidentales: archivar solo desde la TUI, `codemode` y los escuchadores RPC que sobreviven. Al subir de versión hay que repetir las pruebas con el banco de pruebas (inventario del wiki: `volver-a-comprobar-apis-de-sesion-al-subir-opencode`). La suite no lo detectaría, porque simula OpenCode.
- La suite necesita un host de OpenCode simulado con varias sesiones, eventos, tools, TUI y un modelo guionizado, que hay que mantener al día con el contrato real.
- El modo normal pide un commit antes de cada paso, revisiones incluidas, y eso tiene un coste de interacción.
- Mientras una rama tenga más de un change, el plugin no hace nada en ella.
- Soportar otra versión de OpenCode con una API de sesiones incompatible exige revisar el plugin y un nuevo ADR.
