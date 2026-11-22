## Context

En `openspec-autopilot` (ADR-0014), cada rama tiene como mucho una sesión operativa, y cualquier otra ventana de la TUI muestra un modal de un solo botón que lleva a ella. La proposal explica por qué eso impide trabajar en otro change y por qué la rama de cada sesión resuelve el problema.

### Lo comprobado en OpenCode 2.3.2 antes de diseñar

Todo con OpenCode 2.3.2, la TUI `--standalone` en tmux, la web con Playwright, git 2.43 y un plugin sonda, en un banco fuera del repositorio. Las etiquetas son dos: **[comprobado]**, visto en marcha; **[código]**, leído en el binario, en los bundles de la web o en el wiki.

1. **Saltar a una sesión de otro directorio** [comprobado]. `ui.router.navigate({ type: "session", sessionID })` lleva la TUI a una sesión de otro worktree o de otro repositorio. Al hacerlo:
   - `context.location` de la parte de TUI pasa a ser la de esa sesión, sin recargar la TUI, y la barra muestra `<directorio>:<rama>`;
   - OpenCode carga en el mismo proceso otra instancia de la parte de servidor del plugin para ese directorio, y las anteriores siguen vivas.
2. **Los worktrees son del mismo proyecto** [comprobado]: tienen el mismo `projectID`, y cada sesión guarda su directorio en `location.directory`.
3. **La pantalla de inicio tiene ubicación** [comprobado]: la ruta es `{ type: "home", location: { directory } }`. Pero un `/new` desde una sesión de un worktree abre la pantalla de inicio del directorio principal del clon, no la del worktree [comprobado en las pruebas de la sección 7 de tasks]. El modal de D4 sale, por tanto, según la rama del directorio principal.
4. **Los worktrees de OpenCode nacen con HEAD separado** [comprobado]. La estrategia git incluida ejecuta `git worktree add --detach -- <dir> <ref ?? HEAD>`, y su `branch` es la referencia de partida, no una rama nueva. Esto coincide con el concepto [worktrees-de-opencode](../../../.wiki/wiki/concepts/worktrees-de-opencode.md) del wiki de `main`.
5. **Un plugin puede registrar una estrategia de worktree** [comprobado] con `ctx.worktree.transform((s) => s.add({ id, create, remove, list }))`. La última registrada queda seleccionada, y «Manage workspaces → New worktree» de la TUI la usa:
   - `create` recibe `{ directory, sourceDirectory, branch? }`. Con `git worktree add -b <nombre>`, o con la rama existente, el worktree nació en su rama;
   - `remove` se usó al quitar el worktree, y la rama se conservó;
   - según el wiki [código], la web llama a la misma `worktree.create`, al descargar el plugin se vuelve a la estrategia git, y `remove` puede pedir confirmación lanzando `Worktree.OperationError` con `forceRequired`.
6. **El diálogo de nombre se puede abrir desde el plugin** [comprobado]: `context.keymap.dispatch("session.move")` abre «Manage workspaces», y `dispatch("dialog.move_session.new")` abre después «Name worktree», con `tab` para generar el nombre. Desde una sesión, al confirmarlo la TUI crea el worktree y abre una sesión nueva en él. Desde la pantalla de inicio, la TUI no lo crea hasta el primer mensaje del usuario (la barra muestra «(new worktree)»), y entonces lo crea con una sesión que contiene ese mensaje (D10). Los dos `dispatch` no pueden ir seguidos: el segundo llega antes de que «Manage workspaces» esté montado y no hace nada (D4) [comprobado en las pruebas de la sección 7].
7. **La web no se puede mover desde el servidor** [comprobado]. Solo la TUI escucha `tui.session.select`, y `session.view` solo marca la sesión como vista. Un enlace `/server/<base64 de la dirección del servidor>/session/<id>` abre la sesión en la web.
8. **La rama publicable sin tocar el clon** [comprobado con git 2.43]: con `branch.<rama>.remote=origin` y `branch.<rama>.merge=refs/heads/<rama>`, el primer `git push` crea `origin/<rama>` y la deja como upstream. `push.autoSetupRemote` no cambia.
9. **La parte de TUI fija la ubicación al arrancar** [código]: `tui.js:57` calcula una sola vez la ubicación de sus llamadas RPC, así que en otro worktree preguntaría a la instancia equivocada.
10. **Lo que mostraron las pruebas de la sección 7 de tasks** [comprobado con `@opencode/cli` 2.3.2, salvo lo marcado]:
    - El proyecto está en `ctx.location.project.id`; `ctx.project` no existe. El contexto no trae la dirección del servidor: solo las `options` del plugin. `session.create` acepta `location: { directory }`.
    - `remove` de la estrategia recibe solo `{ directory, force }`, sin `sourceDirectory`.
    - [código] OpenCode solo conserva `forceRequired` si el error es de sus propias clases (`instanceof`); cualquier otro lo envuelve en «Worktree strategy … failed to remove», y la TUI no pide confirmación para forzar. El plugin no puede importar `@opencode/schema`, y una copia de npm no pasaría `instanceof`.
    - Al arrancar en un worktree, `prepare_git` del arranque de sesión adelantaba con `update-ref` el `main` sacado en el directorio principal, y su índice quedaba en el commit anterior (D11).
    - Al arrancar con `autopilot` desde la pantalla de inicio, la sesión quedó una vez con `role: "free"` y `phase: "running"` (D1).

## Goals / Non-Goals

**Goals:**

- Que cada sesión tenga su rama, y que entrar en una sesión deje su directorio en esa rama.
- Que un change nuevo empiece en una rama temporal, a menudo en un worktree que nace en su rama, tanto desde la TUI como desde la web.
- Que el autopilot no arranque nada en las ramas permanentes.

**Non-Goals:**

- Claude Code: no tiene autopilot (ADR-0006).
- Borrar ramas o quitar worktrees después de la fusión.
- Guardar cambios sin commit al cambiar de rama (`git stash`).
- Configurar `worktree.symlinkDirectories` o `worktree.directory` en `opencode.json`. Se documentan en el README.

## Decisions

### D1. La rama de trabajo, en la metadata de la sesión

La metadata de la sesión ya guarda `worktree` (el directorio) y `branch`. `branch` pasa a significar la rama de trabajo. El plugin la compara con HEAD de su directorio en tres momentos:
- al recibir `screen` de la TUI;
- en el hook `prompt`;
- al quedar la sesión en reposo (`experimental.idle`).

Si difieren y no ha sido el plugin quien ha hecho el checkout, la sesión ha cambiado de rama dentro de sí misma: se actualiza `branch`, y si la sesión era la operativa de una rama temporal, pasa a `role: "free"` sin archivarse.

La primera vez que el plugin ve una sesión sin metadata le escribe `worktree`, `branch` y `role: "free"`. Lo decide con la sesión recién leída en `writeMeta`, no con la que recibió: si mientras tanto otra llamada (el hook `prompt` de `autopilot`) ya la ha hecho dueña, no la toca. Si no, `screen` y `prompt` sobre la misma sesión nueva pueden pisar `owner` con `free`.

- *Alternativa*: escuchar `vcs.branch.updated`. Existe en el esquema, pero no dice qué sesión hizo el checkout. Se descarta como única fuente, aunque puede servir de aviso.

### D2. Cada instancia del servidor gobierna su directorio, y la TUI llama a la del momento

Cada instancia de la parte de servidor solo crea, valida y encadena sesiones cuyo `worktree` es su directorio, como ya hace `branchSessions`. La parte de TUI calcula la ubicación en cada llamada a partir de `context.location`, y vuelve a presentarse (`hello`) a la instancia de un directorio la primera vez que entra en él. El estado global por directorio (`globalThis`) ya está separado.

### D3. Pasar a una sesión, en `lib/screen.mjs`

La TUI recuerda la ruta anterior y la manda en `screen` (`{ route, previous, reason }`). El servidor decide así:

- **La sesión es de otro directorio** que el de la ruta anterior: devuelve `toast` con la rama y el directorio.
- **Es del mismo directorio y su `branch` no es HEAD**, con el árbol limpio: hace el checkout y devuelve `toast`.
  - Si la rama es temporal, con `branch-change.mjs switch <rama>`.
  - Si es la rama de origen, con el subcomando nuevo de D7.
  - Si es otra rama permanente, no hace nada y avisa.
- **Con el árbol sucio, o con otra sesión del directorio trabajando**: devuelve `back`, que lleva a la ruta anterior o a `home` en ese directorio, con un aviso.

El plugin marca el checkout que hace él, para que D1 no lo tome como un cambio dentro de la sesión. La pantalla a la que acaba de navegar el propio plugin al encadenar se sigue saltando (`expected`).

### D4. El modal de `/new`

Si la ruta es `home`, o una sesión sin mensajes, en el directorio de una rama temporal con sesión operativa, `screen` devuelve `modal` con sus opciones, según el estado del árbol. La TUI las muestra con `ui.dialog.select`. Lo que hace cada opción:

- **«Crear un worktree nuevo»**: `keymap.dispatch("session.move")` y, tras una pausa breve (200 ms), `dispatch("dialog.move_session.new")`. Sin la pausa, el segundo llega antes de que «Manage workspaces» esté montado y no abre «Name worktree». Si el diálogo de nombre sigue sin abrirse, se repite una vez con una pausa mayor.
- **«Cambiar a la rama de origen»**: lo pide al servidor, que usa D7.
- **Cerrar sin elegir**: navega a la ruta anterior.

Se mantiene la protección contra el bucle del modal actual: no se abre otro mientras hay uno, ni otra vez en la misma pantalla hasta que cambie la pantalla o vuelva el foco.

### D5. La estrategia de worktree, en `lib/worktree.mjs`

`server.js` la registra en cada instancia con el id `openspec-autopilot`. Al tener el mismo id, la registración de otra instancia sustituye a la anterior. Como OpenCode crea los worktrees del proyecto desde el checkout canónico (`sourceDirectory`), da igual qué instancia la registró. Lo que hace cada parte:

- **`create`**:
  1. El nombre de la rama es `basename(directory)`.
  2. Con `git worktree list --porcelain` comprueba si la rama ya está sacada; si lo está, lanza un error que dice en qué directorio.
  3. Si la rama existe, ejecuta `git worktree add <dir> <rama>`.
  4. Si no existe, ejecuta `git fetch origin <rama de origen>`, y después `git worktree add --no-track -b <rama> <dir> origin/<rama de origen>` y `git config branch.<rama>.remote origin` / `branch.<rama>.merge refs/heads/<rama>`.
  5. Un `fetch` fallido lanza un error con su `stderr`.
  6. Ignora `branch`, la referencia de partida.
- **`remove`**: `git worktree remove`, ejecutado en `sourceDirectory` si llega y, si no, en el propio worktree (OpenCode 2.3.2 solo manda `{ directory, force }`). Con `force`, añade `--force`. Si git dice que hay cambios, lanza un error que dice que hay que hacer antes el commit o quitarlo con `git worktree remove --force`, y además lleva `forceRequired` por si una versión futura de OpenCode lo respeta. En 2.3.2 la TUI solo muestra el mensaje («Failed to delete worktree»).
- **`list`**: `git worktree list --porcelain`.

La rama de origen sale de `readPermanent` de `branch-change.mjs`, para no duplicar la lectura de `x-main`.

- *Alternativa*: `commands.start`. Se descarta porque no se versiona, y porque el worktree ya existe en HEAD separado cuando el script se ejecuta (wiki, [worktrees-de-opencode](../../../.wiki/wiki/concepts/worktrees-de-opencode.md)).

### D6. En la web: una tool para el worktree y su sesión

El plugin declara la tool `openspec_worktree` con `options: { codemode: false }`, porque `worktree_create` de OpenCode es de Code Mode y no llega directamente al modelo (lección 3 de `.wiki/raw/notes/2026-11-21-ll-sesiones-opencode-autopilot.md`). Hace cuatro cosas:
1. Llama a `ctx.worktree.create({ projectID, name })`, que pasa por la estrategia de D5. El `projectID` sale de `ctx.location.project.id` (en 2.3.2 no hay `ctx.project`) o, si falta, de la sesión que llama a la tool.
2. Crea con `ctx.session.create` una sesión en el directorio del worktree, con la metadata de dueña de la rama nueva.
3. Le envía la instrucción del paso `new`.
4. Devuelve el título, el id y, si el plugin tiene la opción `serverUrl`, el enlace `/server/<base64>/session/<id>`. OpenCode 2.3.2 no da al plugin la dirección del servidor.

El contexto de las sesiones ajenas de una rama temporal ofrece esta tool.

### D7. `branch-change.mjs origin`

Es un subcomando nuevo que cambia a la rama de origen con el árbol limpio. `switch` sigue sin admitir ramas permanentes. Lo usan el plugin y, si hace falta, el modelo.

### D8. Nada en las ramas permanentes, y prompts sin cambio de rama

`actionable()` deja de aceptar `kind: "permanent"` para crear y arrancar sesiones. Las sesiones de una rama permanente son siempre `free`. El prompt del paso `new` (`lib/prompts.mjs`) deja de mencionar `start` y `switch`.

### D9. El simulador de OpenCode

`acceptance-tests/support/agents/opencode-sim.mjs` añade:
- varios directorios con su instancia de servidor;
- `context.location` mutable en la TUI;
- rutas `home` con ubicación;
- `ctx.worktree.transform`, `create` y `remove`;
- `keymap.dispatch` con los dos comandos de D4;
- un remoto git local.

Y, para reproducir lo que mostraron las pruebas en OpenCode real:
- el contexto del plugin con `location.project`, sin `project`;
- `remove` con solo `{ directory, force }`, y los errores de la estrategia envueltos sin `forceRequired`;
- `dialog.move_session.new` sin efecto hasta que «Manage workspaces» esté montado;
- el worktree creado desde la pantalla de inicio con el primer mensaje, en una sesión que lo contiene.

### D10. El primer mensaje de un worktree nuevo

Al presentarse la TUI por primera vez a la instancia de un directorio (`hello`), manda también su ruta. Si la ruta es una sesión de ese directorio que no es de nadie (sin paso en su metadata) y tiene mensajes del usuario, y la rama no tiene sesión operativa, el plugin crea la operativa con el paso `new` y, como `description`, el texto de esos mensajes, igual que al encadenar (`userText`). La sesión de OpenCode se queda libre.

- *Alternativa*: hacer operativa la propia sesión de OpenCode. Se descarta porque el modelo ya le ha respondido sin el prompt del paso.

### D11. `prepare_git` no toca ninguna rama sacada

Además de la rama del directorio en que arranca, `prepare_git` (`.agents/hooks/session-bootstrap.sh`) salta cada rama que `git worktree list --porcelain` da como sacada en algún directorio del clon. `update-ref` sobre una rama sacada en otro directorio mueve la referencia sin tocar su árbol ni su índice, y el usuario vería como cambios en el stage la diferencia con el commit nuevo.

## Risks / Trade-offs

- **APIs sin documentar.** `ctx.worktree.transform`, los nombres de los comandos de `keymap` y la ruta de la web pueden cambiar al subir de versión. → Se añaden a la vigilancia del inventario del wiki ([volver a comprobar APIs al subir OpenCode](../../../.wiki/inventory/candidates/volver-a-comprobar-apis-de-sesion-al-subir-opencode.md)), y la suite comprueba el contrato en el simulador.
- **Detectar el checkout por sondeo.** Un checkout se detecta en el siguiente `screen`, `prompt` o reposo, no al instante. → Basta para decidir de quién es la sesión antes de que pase nada más en ella.
- **Checkout con otra sesión trabajando en el mismo directorio.** → D3 no hace checkout y avisa, como con el árbol sucio (spec «Pasar a una sesión es pasar a su rama»).
- **Cada worktree reinstala dependencias.** → El README recomienda `worktree.symlinkDirectories: ["node_modules", "acceptance-tests/node_modules"]`.
- **El enlace de la web** depende de la dirección con que el navegador se conectó, que el plugin no conoce. → La da la opción `serverUrl`; sin ella, título e id.
- **Quitar un worktree con cambios** no pide confirmación en la TUI de 2.3.2. → El mensaje dice cómo hacerlo (D5).

## Migration Plan

Sin migración de datos. Las sesiones operativas de ramas permanentes que existan pasan a ser libres la próxima vez que se validen. Para volver atrás basta con revertir el change: la metadata no cambia de forma.

## Open Questions

- **ADR-0014** fija el modal de un solo botón en las ventanas ajenas, y **ADR-0013** deja al modelo crear las ramas temporales también en el autopilot. El paso `adr` registrará un ADR que sustituye esas dos partes.
- **Cómo conoce el servidor su dirección pública**, para el enlace de la web. Resuelto: no la conoce; la da la opción `serverUrl` del plugin (D6).
