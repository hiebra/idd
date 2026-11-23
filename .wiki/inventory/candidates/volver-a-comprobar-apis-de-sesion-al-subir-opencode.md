---
title: "Volver a comprobar las APIs de sesión del plugin al subir de versión OpenCode"
kind: watch
status: active
priority: p2
created: 2026-11-21
updated: 2026-11-22
last_checked: 2026-11-22
next_action: "Al subir de versión OpenCode, repetir con el banco de la lección 9 las pruebas de archivado desde el plugin, de tools con codemode, del contrato de limpieza de los plugins (la función que devuelve setup, ejecutada antes de cada recarga y al cerrar, y el signal de events.on), de que no salgan trazas ECONNRESET al cerrar con --standalone y de que tras dos recargas solo reciba eventos la carga nueva, y del contrato de sesión que simula la suite (list por páginas, context, prompt con skills), y, desde autopilot-sesion-operativa, del hook prompt con el texto mutable, de ui.router.current() y los eventos focus del renderer, de las llamadas RPC de la TUI con la ubicación de que la web siga sin cargar la interfaz de los plugins, y, desde autopilot-rama-por-sesion, de ctx.location.project, de remove de una estrategia con solo { directory, force } y sin forceRequired, y de la pausa entre los dos keymap.dispatch y, desde autopilot-plan-explore, del agent en la entrada del hook context, del recordatorio de plan como mensaje user, de que plan cargue openspec-explore con la tool skill, del emit del servidor sin esperar a la TUI y del modal que sobrevive a una recarga, y del hook prompt una vez por mensaje con messageID igual al id del mensaje en context; y actualizar el plugin y acceptance-tests/support/agents/opencode-sim.mjs si algo cambia."
sources:
  - raw/notes/2026-11-22-ll-pruebas-opencode-real-autopilot.md
  - raw/repos/2026-11-22-idd-9eae630-autopilot-plan-explore.md
  - raw/repos/2026-11-22-idd-6d6e79c-autopilot-sesion-operativa.md
  - raw/notes/2026-11-21-ll-sesiones-opencode-autopilot.md
  - raw/notes/2026-11-22-ll-suscripciones-tui-opencode.md
tags: [opencode, watch, plugins, sessions]
confidence: high
summary: "El plugin de add-openspec-autopilot se apoya en tres comportamientos de OpenCode 2.3.2 que parecen accidentales y pueden cambiar."
---

# Volver a comprobar las APIs de sesión del plugin al subir de versión OpenCode

## Why Track This

Con OpenCode 2.3.2 se comprobaron tres comportamientos que obligan a rodeos o a cuidado en los plugins del proyecto (lecciones 1 y 3 de la nota del 2026-11-21, y lección 2 de la [nota del 2026-11-22](../../raw/notes/2026-11-22-ll-suscripciones-tui-opencode.md)):

- `ctx.session.update` ignora `archived`, así que se archiva desde la parte de TUI.
- Las tools de un plugin solo existen en Code Mode salvo `options: { codemode: false }`.
- OpenCode ejecuta como limpieza la función que devuelve el `setup` de cada parte, antes de cada recarga en caliente y al cerrar, y `events.on(nombre, manejador, { signal })` se da de baja al abortarse el `signal`. Los plugins lo usan para liberar sus suscripciones (ADR-0011). Sin eso, el escuchador de la carga anterior sigue vivo tras cada recarga (lo que registró la lección 5 del 2026-11-21) y, con `--standalone`, cada suscripción viva deja una traza `ECONNRESET` al cerrar.

Además, el plugin y el OpenCode simulado de la suite (`acceptance-tests/support/agents/opencode-sim.mjs`) se apoyan en este contrato, comprobado al implementar el change (tasks 1.1 a 1.5 y 12.2 de add-openspec-autopilot):

- `ctx.session.list()` devuelve `{ data, cursor }` por páginas, no un array, y lista las sesiones de todos los proyectos.
- `ctx.session.context({ sessionID })` da los mensajes de cualquier sesión, también archivada.
- `ctx.session.prompt({ sessionID, text, skills: [{ id }] })` arranca la sesión con el contenido de la skill.
- Una sesión con el agente plan ve y llama a una tool con `codemode: false`.
- El hook `context` puede esperar al menos 300 s a un diálogo de la TUI sin que falle la petición.
- Tras una recarga en caliente solo siguen vivos los hooks, tools y manejadores RPC de la última generación del servidor.

Desde `autopilot-sesion-operativa` (ADR-0014, `idd@6d6e79c:openspec/changes/archive/2026-11-22-autopilot-sesion-operativa/design.md`), el plugin depende también de: el hook `prompt` con el texto mutable, `ui.router.current()` consultado cada 300 ms, los eventos `focus` del renderer, las llamadas RPC de la TUI con `{ location }`, y que la UI web no cargue la interfaz de los plugins de un proyecto.

Desde `autopilot-rama-por-sesion` ([pruebas en OpenCode real](../../raw/notes/2026-11-22-ll-pruebas-opencode-real-autopilot.md), lecciones 3 a 5), también de:

- `ctx.location.project.id` como único sitio del proyecto en el contexto del plugin (no hay `ctx.project`), y que `worktree.create` exija `projectID`;
- `remove` de una estrategia llamado solo con `{ directory, force }`, y que OpenCode descarte `forceRequired` de los errores que no son de sus clases, así que la TUI no ofrece forzar;
- la pausa que necesita `keymap.dispatch("dialog.move_session.new")` tras `dispatch("session.move")`, y que desde la pantalla de inicio el worktree nazca con el primer mensaje.

Desde `autopilot-plan-explore` (ADR-0019, `idd@9eae630:openspec/changes/archive/2026-11-22-autopilot-plan-explore/tasks.md`, tasks 1.1 a 1.4 y 7.2), el plugin depende además de:

- la entrada del hook `context` trae `agent` (`"build"` o `"plan"`), que cambia con Shift+Tab y es el mismo en todas las peticiones de un turno; sin él, el plugin se comporta como antes de ADR-0019;
- en plan, OpenCode añade su recordatorio como mensaje `user`, en una posición que no es estable, y el plugin no depende de ella;
- una sesión con el agente plan carga `openspec-explore` con la tool `skill`;
- el `emit` del servidor a la TUI vuelve sin esperarla, la TUI mantiene abierto un `dialog.select` mientras tanto, y tras una recarga en caliente el modal anterior sigue en pantalla y su respuesta llega al servidor nuevo;
- el hook `prompt` llega una sola vez por mensaje, al entrar, con `delivery: "steer"` y un `messageID` igual al `id` de ese mensaje en `context`, y un mensaje enviado a mitad de turno entra en el mismo bucle, sin reposo entre medias;
- en plan, `write` solo escribe en el directorio de planes y `shell` modifica el proyecto; el aviso mira git, así que no depende de esto, pero sí las pruebas.

La suite simula OpenCode, así que no detectaría que cambien.

## Current State

Comprobado el 2026-11-21 con OpenCode 2.3.2 y el proveedor falso, también con el plugin de add-openspec-autopilot en la TUI, en modo normal y en modo auto (task 12.2). El contrato de limpieza, el 2026-11-22 con OpenCode 2.3.2 y `alibaba/qwen3.8-flash` (task 5.2 de fix-tui-subscription-cleanup): 0 `ECONNRESET` al cerrar, sin recargas y tras dos, y tras dos recargas el `select` y el `navigate` atendidos solo por la última carga. Lo de `autopilot-plan-explore`, el 2026-11-22 con OpenCode 2.3.2 y el proveedor falso (tasks 1.1 a 1.4 y 7.2).

## Next Action

Al subir OpenCode: repetir esas tres pruebas. Si el plugin ya puede archivar, el archivado deja de depender de la TUI; si deja de ejecutarse la limpieza de `setup` o cambia `events.on`, vuelven las trazas al cerrar y los escuchadores duplicados, y la protección de D13 contra duplicados vuelve a ser necesaria en `openspec-autopilot`.
