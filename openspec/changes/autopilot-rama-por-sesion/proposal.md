## Why

Hoy, en el autopilot de OpenCode, cualquier ventana que no es la sesión operativa de la rama muestra un modal que solo lleva a esa sesión. No hay forma de trabajar en otro change sin salir de la rama a mano, y el modal interrumpe incluso cuando el usuario solo quiere preguntar algo en `main`.

Las pruebas con OpenCode 2.3.2 real muestran que se puede hacer mejor:

- La TUI salta a una sesión de otro directorio (otro worktree u otro repositorio), cambia su ubicación y carga la instancia del plugin de ese directorio.
- Los worktrees de OpenCode nacen con HEAD separado. Pero un plugin puede registrar su propia estrategia de worktree, y con ella el worktree nace en una rama, tanto desde la TUI como desde la web.

Con eso, cada sesión puede tener su rama, y cada change su worktree.

## What Changes

- **Cada sesión tiene una rama de trabajo**: la que tiene HEAD en su directorio mientras se trabaja en ella. Es la que tenía al crearse, y cambia si se hace un checkout dentro de la sesión. Por ejemplo, si el modelo pasa a `main` para un merge asistido, la sesión pasa a ser de `main`.
- **Pasar a una sesión es pasar a su rama** (**BREAKING**: desaparece el modal de un solo botón).
  - Si la sesión está en otro directorio, basta con saltar: el plugin solo avisa de la rama y del directorio.
  - Si está en el mismo directorio y en otra rama, el plugin hace el checkout de su rama.
  - Si hay cambios sin commit, el plugin no hace el checkout: vuelve a la sesión anterior (o a la pantalla de inicio, si no la hay) y avisa del motivo.
- **Una sesión que deja de estar en su rama deja de ser la operativa.** Al volver a esa rama, el plugin crea una sesión operativa nueva que retoma el paso donde se quedó.
- **`/new` en una rama temporal que ya tiene sesión operativa** abre un modal.
  - Con el árbol sucio, solo ofrece «Crear un worktree nuevo», que abre el diálogo de nombre de worktree de OpenCode.
  - Con el árbol limpio, ofrece además «Cambiar a la rama de origen».
  - Si se cierra sin elegir, se vuelve a la sesión de la que se venía.
- **Los worktrees de OpenCode nacen en una rama.** El plugin registra una estrategia de worktree:
  - la rama se llama como el worktree, se haya escrito el nombre o lo haya generado OpenCode;
  - si la rama existe, el worktree se abre en ella, y si ya está sacada en otro sitio, se rechaza diciendo dónde;
  - si no existe, se crea desde la rama de origen del remoto, tras un `git fetch`, con `--no-track` y con su push configurado hacia `origin/<rama>`, sin tocar la configuración del clon;
  - si el `fetch` falla, no se crea, y se avisa del motivo;
  - se ignora la referencia de partida que manda la web;
  - al quitar el worktree, la rama se conserva.
- **El autopilot no arranca nunca `openspec-new-change` en una rama permanente** (**BREAKING**). Un change nuevo empieza en una rama temporal: creando un worktree, o con un checkout de una rama temporal y una sesión nueva.
- **En el ciclo del autopilot, el modelo no cambia de rama**: sus instrucciones dejan de usar `start` y `switch`. Fuera del ciclo puede hacerlo; por ejemplo, para un merge asistido.
- **Web**: el modelo puede crear un worktree cuando el usuario se lo pide. También crea en él una sesión, que pasa a ser la operativa y arranca sola. Como el plugin no puede mover la web, el modelo da el enlace a esa sesión si conoce la dirección del servidor, o su título y su id.
- **Corrección**: la parte de TUI manda cada llamada con la ubicación del momento, no con la del arranque.
- **El primer mensaje de un worktree nuevo llega a la sesión operativa.** Desde la pantalla de inicio, OpenCode crea el worktree con el primer mensaje del usuario, en una sesión propia. La sesión operativa del worktree lo recibe como descripción del change, en lugar de volver a preguntar qué construir.
- **Con cambios sin commit, un worktree no se quita**: se dice que hay que hacer antes el commit o quitarlo con `git worktree remove --force`. Un plugin de OpenCode 2.3.2 no puede hacer que la TUI pida confirmación para forzar.
- **Corrección en el arranque de sesión**: no se pone al día ninguna rama permanente sacada en un directorio del clon (el principal o un worktree), no solo la del directorio en que arranca la sesión. Las pruebas con OpenCode real mostraron que, al arrancar en un worktree, se adelantaba el `main` sacado en el directorio principal y su índice quedaba desfasado.

## Fuera de alcance

- Claude Code: sigue sin plugin (ADR-0006).
- Borrar ramas, o quitar worktrees, después de la fusión.
- Guardar cambios sin commit al cambiar de rama (`git stash`): para eso está el worktree.

## Capabilities

### New Capabilities

### Modified Capabilities
- `openspec-autopilot`:
  - cambian «Dónde actúa el plugin», «Arranque de la sesión operativa», «Validación al volver a la sesión operativa», «Funcionamiento sin TUI» y «Las ventanas ajenas llevan a la sesión operativa», que se sustituye;
  - se añaden la rama de trabajo de cada sesión, el paso a su rama, el modal de `/new` y la estrategia de worktree.
- `openspec-change-lifecycle`: `branch-change.mjs` permite volver a la rama de origen con el árbol limpio. La regla de que el modelo no cambia de rama en el ciclo del autopilot va en `openspec-autopilot`.
- `session-bootstrap`: cambia «Clon completo y ramas permanentes al día al abrir sesión», que no toca ninguna rama sacada en un directorio del clon.

## Impact

- `.opencode/plugins/openspec-autopilot/`: `server.js`, `tui.js` y `lib/*`: la estrategia de worktree, la tool para crear un worktree con su sesión, la rama de cada sesión, el checkout al pasar de sesión, el modal de `/new` y la ubicación por llamada.
- `.agents/openspec/branch-change.mjs`: volver a la rama de origen con el árbol limpio, porque `switch` no admite ramas permanentes.
- `.agents/hooks/session-bootstrap.sh`: `prepare_git` salta las ramas sacadas en cualquier directorio del clon.
- `.claude/skills/openspec-git-discipline/SKILL.md` y los prompts del autopilot: el modelo no cambia de rama en el ciclo del autopilot.
- `adr/`: un ADR nuevo que sustituye la parte de ADR-0014 sobre las ventanas ajenas y la de ADR-0013 sobre las ramas que crea el modelo en el autopilot.
- `README.md` y `acceptance-tests/`: el simulador de OpenCode con directorios por sesión, la estrategia de worktree, el diálogo de nombre y los checkouts.
