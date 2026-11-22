# ADR-0022: En el autopilot, cada sesión tiene su rama, y los changes nuevos empiezan en un worktree o una rama temporal

- Status: accepted, supersedes ADR-0014
- Date: 2026-11-22
- Supersedes: ADR-0014

## Context

ADR-0014 dio al autopilot una sesión operativa por rama. Cualquier otra ventana de la TUI llevaba a esa sesión con un modal de un solo botón, y en una rama permanente el plugin arrancaba solo `openspec-new-change`, y el modelo creaba la rama del change (ADR-0013). Con eso, el usuario no podía trabajar en otro change sin salir de la rama a mano, y el modal interrumpía incluso para preguntar algo en `main`.

Las pruebas con OpenCode 2.3.2 real (design de `autopilot-rama-por-sesion`) muestran tres cosas:

- la TUI salta a una sesión de otro directorio (otro worktree u otro repositorio) y carga la instancia del plugin de ese directorio;
- los worktrees de OpenCode nacen con HEAD separado, pero un plugin puede registrar una estrategia de worktree que sirve a la TUI, a la web y al modelo;
- la web no se puede mover desde el servidor, pero un enlace abre cualquier sesión.

Alternativas consideradas:

- **Mantener el modal y añadir un botón para cambiar a la rama de origen.** No resuelve trabajar en dos changes, y choca con el árbol sucio en el mismo directorio.
- **Guardar los cambios sin commit con `git stash` al cambiar de rama.** Simula worktrees, y peor: cada salto guarda y recupera, y un fallo deja conflictos.
- **El startup script `commands.start` de OpenCode para poner la rama.** No se versiona, y se ejecuta con el worktree ya creado en HEAD separado.

## Decision

- **Cada sesión tiene una rama de trabajo**: la que tiene HEAD en su directorio mientras se trabaja en ella. Un checkout dentro de la sesión le cambia la rama; si era la operativa de una rama temporal, deja de serlo, y al volver a esa rama se crea otra que retoma el paso.
- **Pasar a una sesión es pasar a su rama.** En otro directorio basta con el salto. En el mismo directorio, el plugin hace el checkout, salvo con cambios sin commit o con otra sesión trabajando: entonces vuelve a la ventana anterior y avisa. El checkout lo hace el plugin, con `branch-change.mjs`.
- **El autopilot no actúa en las ramas permanentes.** Sus sesiones son libres. Un change nuevo empieza en una rama temporal: en un worktree, o con un checkout y una sesión nueva. En el ciclo del autopilot, el modelo no crea ramas ni cambia de rama. Esto restringe ADR-0013 dentro del autopilot; fuera de él, ADR-0013 sigue en vigor.
- **Los worktrees de OpenCode nacen en una rama**, con una estrategia de worktree del plugin. La rama se llama como el worktree. Si la rama ya existe, el worktree se abre en ella. Si no existe, sale de la rama de origen del remoto, sin seguirla y publicable en `origin/<rama>`.
- **Una sesión nueva en una rama temporal con sesión operativa ofrece un worktree nuevo.** Con el árbol limpio, también la vuelta a la rama de origen. Sin TUI, lo ofrece el contexto del modelo, que puede crear el worktree y su sesión operativa y dar el enlace.
- **Se mantiene el resto de ADR-0014**:
  - el plugin local sin dependencias, con el estado en la metadata de las sesiones;
  - la lógica en el servidor para cualquier cliente;
  - el producto evaluable;
  - el stage del plugin y la revisión cerrada por git;
  - una sesión operativa por rama temporal, con su arranque y su validación;
  - los dos modos;
  - nada en Claude Code (ADR-0006).

El comportamiento está especificado en `openspec/specs/openspec-autopilot/spec.md`.

## Consequences

- Varios changes pueden avanzar a la vez, cada uno en su worktree, y el usuario cambia de change cambiando de sesión.
- Cada worktree ocupa disco y puede necesitar sus dependencias. Se mitiga con `worktree.symlinkDirectories` en la configuración de OpenCode.
- El plugin depende de APIs de OpenCode sin documentar: la estrategia de worktree, los comandos de `keymap` y la ruta de la web. Hay que comprobarlas al subir de versión.
- En el mismo directorio, cambiar de sesión puede no cambiar de rama, si hay cambios sin commit. El usuario ve el motivo y decide.
- Claude Code no cambia: el modelo sigue creando la rama del change con `branch-change.mjs` (ADR-0013). La asimetría cumple ADR-0006: el ciclo y lo versionado son los mismos, y en Claude Code lo mismo se hace a mano.
