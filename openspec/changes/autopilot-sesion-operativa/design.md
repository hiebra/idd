## Context

`openspec-autopilot` (ADR-0008) encadena una sesión por paso del change de una rama. Hasta ahora cada paso terminaba cuando el modelo llamaba a `openspec_handoff`, la instrucción del paso se inyectaba solo en la primera petición (hook `context`), las revisiones las cerraba el modelo con la tool y las confirmaba el usuario en un diálogo de la TUI, y el servidor solo orquestaba con la TUI presentada (`tui.ready()`). La proposal recoge por qué eso falla con un modelo que no obedece (`alibaba/qwen3.8-flash`) y por qué no hace nada en la UI web.

### Lo comprobado en OpenCode 2.3.2 antes de diseñar

Todo con OpenCode 2.3.2 en esta máquina, el servicio en segundo plano, un clon desechable del repositorio fuera de él y `alibaba/qwen3.8-flash`. Las etiquetas: **[comprobado]** en marcha; **[código]** leído en el binario, en los bundles de la web o en los tipos de `@opencode/plugin@2.3.2`.

1. **La UI web no ejecuta nada de la interfaz de un plugin local.** [comprobado] Con un `gui-experimental.cjs` sonda en el plugin y el proyecto abierto en la web (Playwright, enlace de `opencode pair`), la web no pidió `/api/plugin/gui` ni ejecutó la sonda; tampoco carga `tui.js`, que lo ejecuta el proceso de la TUI. [código] La web es el mismo frontend que OpenCode Desktop y tiene un *host* de plugins GUI (`./gui-experimental`, `@opencode/plugin/gui`: `ctx.dialogs`, `ctx.toast`, `ctx.tabs.open`, `ctx.sessions.current()`…), pero solo carga los de terceros a través del *bridge* de la app de escritorio (`bridge.pluginGuis()`); en el navegador ese *bridge* no existe y solo corren los paneles integrados.
2. **`experimental.browser/attach`** [código] es el navegador integrado de la app de escritorio (panel Review, tools `browser.*` del modelo), no una interfaz para plugins.
3. **El hook de servidor `prompt`** [comprobado] llega con cada mensaje que entra en una sesión, antes de la petición al modelo y antes de que la TUI cambie de ruta, con `{ sessionID, messageID, prompt: { text, … }, delivery }`, y su `prompt.text` es mutable: reescribirlo cambia lo que recibe el modelo. Es el punto donde comprobar git "antes de pasar el prompt al modelo", con cualquier cliente.
4. **El servidor sigue sin poder archivar** [comprobado]: `ctx.session.update({ archived: true })` no da error ni archiva (lección 1 de `.wiki/raw/notes/2026-11-21-ll-sesiones-opencode-autopilot.md`, vigente).
5. **TUI** [comprobado] con un controlador de pseudoterminal propio (`script` + `@xterm/headless`, porque en la máquina no hay tmux ni pip):
   - `context.ui.router.current()` da `{ type: "home" }` y, tras el primer mensaje, `{ type: "session", sessionID }`; no hay evento de cambio de ruta, así que se consulta periódicamente;
   - `context.renderer.on("focus" | "blur", …)` llega con las secuencias de foco del terminal (`ESC[I`, `ESC[O`);
   - `context.ui.dialog` tiene `show`, `set`, `clear`, `alert`, `confirm`, `prompt` y `select` (sí hay `alert`).
6. **Los 400 del arranque** [comprobado]: en el log del servicio, `POST /api/rpc/openspec-autopilot/hello` y `/api/rpc/session-bootstrap/warnings` responden 400 `{"type":"rpc.unavailable"}` justo al arrancar la TUI. La hipótesis inicial (la TUI llama antes de que la parte de servidor registre su RPC) resultó incompleta en las pruebas end-to-end: con la TUI en la pantalla de inicio, sus llamadas RPC **no llevan la ubicación** del proyecto, y el servidor no sabe a qué parte de servidor dirigirlas; la misma llamada con `?location[directory]=…` responde bien. Después "funcionaba" porque, con una sesión abierta, las llamadas sí llevan la ubicación. Ver D14.
7. **Tasks** [comprobado]: `openspec instructions apply --change X --json` numera las tasks en orden (`"1"`, `"2"`…) y deja el número de `tasks.md` al principio de `description` (`"1.2 En …"`).
8. `opencode run -m alibaba/qwen3.8-flash` carga la parte de servidor del plugin y ningún cliente con interfaz [comprobado].

## Goals / Non-Goals

**Goals:**

- Que lo producido en cada paso y el cierre de cada revisión no dependan del modelo: los decide el plugin con el CLI de OpenSpec y con git.
- Una sola sesión viva por rama en autopilot, la sesión operativa, a la que llevan todas las demás ventanas de la TUI.
- Que la lógica funcione con cualquier cliente y la interfaz se degrade donde no la hay.
- Que el modelo pueda crear la rama temporal del change o saltar a otra sin leer git a mano.

**Non-Goals:**

- Un bundle `./gui-experimental` para OpenCode Desktop: es una API experimental, en la web no se carga y aquí no hay app de escritorio para probarlo. Desktop queda con la misma degradación que la web.
- Que el plugin haga commits o fusiones: siguen siendo del usuario.
- Cambiar la asimetría con Claude Code (ADR-0006).

## Decisions

### D1. La lógica en el servidor; la interfaz, en cada cliente

`server.js` orquesta sin mirar si hay TUI. Lo que necesita interfaz se pide por el RPC del plugin a los clientes presentados, y si no hay ninguno se degrada (D13). El RPC (`lib/rpc.mjs`) queda así:

- Cliente → servidor: `hello({ instance, pid, client })`, `screen({ instance, route, reason })` y `reply({ id, instance, value, error })`.
- Servidor → cliente (evento `request`): `toast`, `navigate`, `archive`, `modal` (un botón, con la sesión a la que lleva) y `notice` (un modal informativo de un botón, para las discrepancias).

La lógica está en módulos puros que se prueban con `node --test`: `lib/next-step.mjs` (paso siguiente), `lib/product.mjs` (foto del change, producto y orden de las revisiones), `lib/screen.mjs` (qué hacer con cada pantalla) y `lib/git.mjs` (estado de git, firma, veredicto y stage).

Alternativa descartada: un adaptador por cliente con su propia lógica. Duplicaría el ciclo y la web no ejecuta código del plugin.

### D2. La sesión operativa

Es la sesión no archivada con `metadata.openspec.role === "owner"` para el `worktree` y la `branch` actuales. Es válida si su change sigue en la rama (o si es del paso `new` y la rama no tiene change). Mientras haya una válida, ninguna otra sesión toma el control: el hook `prompt` ya no decide en las sesiones nuevas, como hacía el hook `context` (se retiran "queda libre", "la dueña está trabajando" y el diálogo de ir a la dueña o archivarla). Si al crear una sesión operativa aparece otra a la vez (dos TUIs), se mantiene "escribir y comprobar; gana la más antigua".

### D3. Arranque al presentarse un cliente

En `hello`, el servidor guarda la instancia como destino de las peticiones. En `globalThis` (que sobrevive a las recargas del servidor) guarda los PID ya presentados y la generación de la carga, los dos **por directorio del proyecto**: el servicio de OpenCode carga el plugin una vez por proyecto en el mismo proceso, y una generación única hacía que la carga de un segundo proyecto diera por recargada la del primero, que dejaba de atender sus hooks (encontrado en las pruebas end-to-end). El identificador de instancia de la TUI lleva su PID. Un PID nuevo es un arranque de la TUI. Una recarga en caliente conserva el PID y no arranca nada. En el arranque:

1. archiva las sesiones marcadas con `archivePending` (D13);
2. con HEAD separado o varios changes, nada (con varios, el aviso de siempre);
3. si no hay sesión operativa válida, la crea con el paso que indique `openspec status`, o con `new` si la rama no tiene change (también en una rama permanente), y navega a ella. Si el árbol está sucio y el paso no es `update`, la crea en `waiting-commit` (D9). Si no, la arranca con `prompt` (D6).

### D4. Las ventanas ajenas: el modal de un botón

La TUI consulta `ui.router.current()` cada 300 ms y escucha `renderer` `focus`. En cada cambio de ruta, y al recuperar el foco, llama a `screen`. El servidor responde con una directiva (`lib/screen.mjs`):

- `home`, o una sesión que no es la operativa ni está archivada, con sesión operativa válida → `modal` con la sesión operativa;
- la sesión operativa → validación (D5);
- una sesión archivada, o sin sesión operativa → nada.

La TUI muestra el modal con `ui.dialog.select` de una sola opción ("Ir a la sesión del change") y, se cierre como se cierre (`undefined` con Esc), navega a la sesión operativa. Para que no se repita en bucle, la TUI no abre otro mientras hay uno abierto, y no vuelve a mostrarlo para la misma ruta hasta que cambia de ruta o recupera el foco. Tras una navegación pedida por el servidor (el encadenado), la TUI no consulta `screen` para esa ruta.

### D5. Validación al volver a la sesión operativa

Si la sesión operativa no está trabajando (`time.busy` frente a `time.idle`), en `screen` y en el hook `prompt` (para cualquier cliente):

- si HEAD ya no está en su `branch`: se aplican las reglas de la rama actual (D3 si no tiene sesión operativa, o el modal si la tiene);
- si su change ya no está en la rama: `role: "free"`, se archiva (o se marca, D13) y se actúa como en D3 en una rama sin change;
- en `waiting-commit` con el árbol limpio: arranca el paso (D6);
- si su paso es `artifact`, `task` o `new` y no encaja con `stepFromState(openspec status)`, y su producto no existe ya: `notice` con la discrepancia, sin cambiar nada.

### D6. Cómo empieza un paso y cómo se le recuerda

El plugin crea la sesión con su agente y su metadata, y la arranca con `session.prompt` (texto del paso y la skill del workflow adjunta). Así la instrucción queda en el historial y no depende de una inyección en la primera petición. Además, el hook `context` añade en cada petición de la sesión operativa un recordatorio corto, antes del último mensaje del usuario:

- el paso;
- que no haga commits ni pase nada al stage;
- que no empiece el paso siguiente;
- que llame a `openspec_handoff` al terminar.

Al empezar el paso, la metadata guarda la foto del change (D7) y la firma de git (D8). Lo que el usuario escribe en la sesión del paso `new` (la descripción del change) se guarda en la metadata y acompaña a las instrucciones de los artefactos siguientes; sin ello, en las pruebas end-to-end la sesión del `proposal` no sabía para qué era el change y volvía a preguntar. Los prompts (`lib/prompts.mjs`) ya no piden commits: dicen que el plugin prepara el stage y el usuario hace el commit. En el paso `new`, sin descripción, el modelo la pide. En una rama permanente, crea la rama con `branch-change.mjs start <change>` (D12).

### D7. El producto evaluable

`lib/product.mjs`:

- **Foto** (`snapshot`): `{ change, artifacts: [ids en done], tasks: [ids marcadas], archived, git }`, con `openspec status --change X --json`, `openspec instructions apply --change X --json` y la firma de git.
- **Producto** = foto actual − foto inicial, según el paso:

| Paso | Producto |
|---|---|
| `new` | la rama tiene ahora un change, y los artefactos que ya estén en `done` |
| `artifact`, `task` | artefactos que han pasado a `done` (en el orden del schema), y las tasks recién marcadas como un solo producto |
| `verify` | el veredicto dado con `openspec_handoff` (`clean` o `critical`) |
| `archive` | el change está archivado en la rama |
| `update`, `wiki` | la firma de git ha cambiado |

- Se evalúa en `experimental.idle` de la sesión operativa en `running`, haya o no `openspec_handoff`. Sin producto no pasa nada. Con producto:
  - en el modo normal, la metadata guarda la cola de productos y se abre la revisión del primero;
  - en el modo auto, se pasa todo al stage y se sigue (D9).
- `openspec_handoff` evalúa el producto en el momento. Sin producto responde "No hay producto evaluable: …". Con producto guarda lecciones, conclusiones y veredicto, y responde que el plugin lo revisará al terminar la respuesta. Lo que el modelo escriba después en la misma respuesta entra en el producto, porque la evaluación es en `idle`.
- **Stage por producto**: un artefacto pasa al stage con sus `existingOutputPaths` y el `.openspec.yaml` del change. El último producto de la cola, las tasks y `update`/`wiki` pasan con `git add -A`, porque no hay otra forma de saber qué tocaron.
- Si el change tiene specs, la revisión recibe los errores (no los avisos) de `openspec validate <change> --json`.

### D8. El cierre de una revisión, por git

Al empezar una revisión, la metadata guarda la firma de git: HEAD, `git status --porcelain=v1` y un hash de `git diff HEAD` y de los archivos sin seguimiento. En el hook `prompt` de una sesión de revisión, si la firma ha cambiado y no queda nada en el stage:

- **HEAD ha avanzado** (el usuario hizo el commit) → ok;
- **HEAD no ha cambiado** (el usuario lo sacó todo del stage o lo descartó) → ko;
- si queda algo en el stage → sigue, y el prompt llega al modelo tal cual.

Es la regla de la spec ("árbol limpio" / "todo fuera del stage") afinada para el stage por producto de D7: tras el commit del primer producto de una cola, los demás siguen en el árbol, fuera del stage, y el árbol no queda limpio. Con un solo producto, las dos reglas coinciden. En las pruebas end-to-end, una revisión del design con el adr pendiente se cerró como ok con esta regla.

En un ok o un ko, el plugin reescribe el prompt para que el modelo de la revisión solo conteste "Revisión cerrada". Después encadena al instante: revisión del producto siguiente de la cola, o paso siguiente, o `openspec-update-change`. En un ko, las conclusiones son el texto del prompt del usuario. Si el prompt está vacío o tiene una sola palabra, son las que dio el modelo de la revisión con `openspec_handoff`, o su último mensaje. Sin firma cambiada no se cierra nada: así una pregunta en una revisión que empezó con el árbol limpio (el verify) no la cierra. Se retira el diálogo de confirmación (`needsConfirmation`). En una revisión, `openspec_handoff` solo guarda conclusiones y lecciones.

### D9. Paso siguiente y esperas de commit

`lib/next-step.mjs` mantiene la decisión pura, con estos cambios:

- tras una revisión ok → producto siguiente de la cola, o el paso de `openspec status`; tras la del verify → archive;
- tras una ko → `update`; tras `update` → revisión del plan.

El paso nuevo nace en `waiting-commit` (espera a que el árbol esté limpio) en estos casos:

- al crearlo en el arranque o en la validación con el árbol sucio;
- en el modo auto, en cada cambio de zona;
- en los dos modos, tras el archive (para que el commit del archive vaya aparte) y tras la resincronización del wiki (para el commit del wiki, antes de terminar).

`update` nunca espera: empieza con el árbol sucio a propósito. En `waiting-commit`, el paso arranca en cuanto el árbol está limpio, al validar (D5) o en el hook `prompt`: el plugin antepone la instrucción del paso al mensaje del usuario y guarda la foto.

### D10. El verify

Su producto es el veredicto de la tool, porque el informe no se escribe en el repositorio:

- **Modo normal**: la sesión de verify pasa a una revisión del verify (sesión nueva, agente `plan`). Esa revisión empieza con el árbol limpio: un ok exige que la firma cambie y el árbol quede limpio (un commit, vacío si no hay nada que cambiar: `git commit --allow-empty`). Un ko exige dejar cambios fuera del stage.
- **Modo auto**: con `clean` pasa al archive; con `critical`, la propia sesión de verify pasa a ser esa revisión.

### D11. Las tasks se identifican con el CLI

`changeState` lee las tasks con `openspec instructions apply --json`. El id es el del CLI (`"2"`). La etiqueta es el número inicial de `description` (`"1.2"`), y es la que se usa en los prompts y en los títulos. `parseTasks` (sin CLI) da los mismos ids, por orden, y las mismas etiquetas.

### D12. Ramas: `branch-change.mjs list | start | switch`

- `list [--json]`: ramas locales que no son permanentes, cada una con su change. Se calcula como `branchChange`, con el diff entre el merge-base de esa rama con la de origen y la punta de la rama; en la rama actual, también el árbol de trabajo.
- `start <change>`: con el árbol limpio, crea `git switch -c <change> <origen>` desde la rama de origen local (o `origin/<origen>`). Se niega si la rama ya existe o si el nombre no es kebab-case.
- `switch <rama>`: con el árbol limpio, a una rama temporal que exista.

Imprimen `{ ok, message }`, como `check`. Cuando el paso `new` termina en otra rama (la que creó el modelo), el plugin actualiza la `branch` de la sesión a la de HEAD. Si el modelo salta a una rama que ya tiene sesión operativa, la ventana desde la que lo hizo pasa a ser ajena (D4).

### D13. Sin TUI: la UI web, OpenCode Desktop y `opencode run`

- Funciona igual: producto, stage, cierre por git, encadenado (el servidor crea la sesión siguiente y la pone a trabajar), validación en el hook `prompt` y recordatorio en el contexto.
- **Sesión ajena**: el hook `context` dice al modelo que esa sesión no es la operativa, con el título y el id de la operativa, y que no haga cambios.
- **Archivado**: sin cliente, la sesión que termina queda con `archivePending: true` y `role: "free"`, y se archiva cuando se presenta una TUI (D3).
- **Arranque**: sin cliente con interfaz no hay "primera presentación". Una sesión nueva pasa a ser la operativa solo si la rama no tiene ninguna y su primer mensaje es exactamente `autopilot`. El texto se sustituye por la instrucción del paso. Así `opencode run "…"` en una rama temporal no arranca un change por accidente.
- **Navegar, modales y avisos**: no existen. La sesión nueva aparece en la lista, con su paso en el título. Los avisos van al log del servidor.

### D14. La TUI se presenta sin ruido

Cada llamada RPC de la parte de TUI lleva la ubicación del proyecto (`{ location: { directory: context.location.directory } }`): sin ella, en la pantalla de inicio no llega a la parte de servidor (Context, punto 6). Si aun así `hello` falla con `rpc.unavailable` (la parte de servidor todavía no ha registrado su RPC), la TUI lo reintenta (a los 200, 400 y 800 ms… hasta 10 s) sin escribir nada. Cualquier otro error se sigue registrando. El `hello-request` del servidor se mantiene. En `session-bootstrap/tui.js` la causa es la misma; se aplican la ubicación y el reintento a `warnings`. Comprobado en OpenCode real: tras el arreglo, el log del servicio no tiene ningún 400 al arrancar la TUI.

### D15. La suite

El simulador (`acceptance-tests/support/agents/opencode-sim.mjs`) se amplía con:

- el hook `prompt`, que corre antes de los `context` con el texto mutable;
- rutas de pantalla (`ui.router.current()`, que ya no deriva de las navegaciones), el foco (`renderer.on/off`) y la apertura de la pantalla de inicio;
- `ui.dialog.select` de un botón con respuesta Enter o Esc;
- la presentación de la TUI con un PID, el arranque frente a la recarga, y una TUI que llama a la RPC antes del registro;
- un cliente sin TUI (`tui: false`) que escribe en sesiones;
- respuestas del modelo con efectos en archivos (`files`) y en git (`git`).

`branch-change` se prueba con repositorios reales en `core-tests`. La suite no usa OpenCode real ni Playwright: eso son tasks aparte.

### Metadata `openspec` (v: 1, compatible hacia atrás)

`{ worktree, branch, change, role, step, seq, phase, zone, snapshot, queue, review: { result, conclusions, git }, handoff, lessons, archivePending, description }`

`phase`:

- `running`: el modelo trabaja en el paso;
- `waiting-commit`: espera el árbol limpio;
- `review`: revisión abierta;
- `chaining`: encadenando;
- `done`: terminada.

Las sesiones de versiones anteriores con `handed-off` se tratan como `running` con producto pendiente de evaluar.

## Lo comprobado en las pruebas end-to-end

Con OpenCode 2.3.2, el servicio, `alibaba/qwen3.8-flash` y dos clones desechables (detalle en las tasks 8.x):

- El hook `prompt` llega cuando el mensaje entra en la sesión, aunque quede "pendiente" detrás del turno en curso: una revisión se cerró por git con su modelo todavía trabajando.
- Las sesiones que crea el plugin usan el modelo por defecto de la configuración, no el que el usuario tiene elegido en la TUI.
- `qwen3.8-flash` siguió la instrucción del paso en todos los pasos probados, pero tarda (de 1 a 7 minutos por paso con estas skills), y en un `update-change` terminó con una respuesta sin relación (la de la regla de comentarios) tras hacer bien su trabajo: el producto se evaluó igual.

## Decisiones tomadas en batch

El prompt del usuario pedía no preguntar; estas son las decisiones que en un flujo normal se habrían consultado:

1. **Borrados ajenos en el árbol**: al empezar, el clon estaba en `fix-openspec-autopilot` con 48 borrados sin commit en `openspec/changes/archive/`. Se guardaron en un stash con nombre (`git stash list`) antes de crear la rama desde `main`; no se ha tocado nada más.
2. **Arranque en una rama permanente**: la sesión operativa también se crea en una rama permanente, con `openspec-new-change`, porque el prompt pide que el modelo cree la rama "desde cualquier rama". Para no usarlo, se desactiva el plugin.
3. **Arranque sin cliente con interfaz**: solo con el mensaje `autopilot` (D13), para que `opencode run` o una sesión web cualquiera no empiecen un change por accidente.
4. **Revisiones de un producto múltiple**: una por artefacto, en el orden del schema, con stage por artefacto. Las tasks de un mismo paso son un solo producto, porque git no permite separarlas.
5. **El verify**: su producto es el veredicto. La revisión del verify se cierra también por git, con la regla de la firma cambiada; un ok sin cambios es un commit vacío.
6. **Archive y wiki**: en los dos modos, el plugin espera el commit tras el archive y tras la resincronización del wiki. No hay revisión, pero sí commits separados.
7. **Modo auto**: se mantiene tal como lo pedía el prompt. Se para en las preguntas de un workflow (reposo sin producto), en los cambios de zona hasta el commit, y con un verify crítico. No se ve incoherente.
8. **OpenCode Desktop**: no se escribe un `gui-experimental` (Non-Goals). Se documenta.
9. **Wiki**: la consulta del wiki (`.wiki/`, en solo lectura) cubrió el ciclo y las APIs de sesión ya registradas. Lo nuevo de la UI web, el hook `prompt`, el foco y los 400 sale de la investigación descrita en Context, no del wiki.
10. **ADR**: dos ADRs nuevos. ADR-0012 sustituye a ADR-0007 (ramas que crea el modelo y commits) y ADR-0013 sustituye a ADR-0008 (producto, cierre por git, sesión operativa y separación entre lógica e interfaz). Cada uno repite lo que sigue valiendo del anterior, que no se toca.
11. **Pruebas end-to-end**: las sesiones que crea el plugin llevan el título de su paso, no `e2e:`; se archivaron todas al terminar, junto con las de las sondas. Para que usaran `alibaba/qwen3.8-flash`, cada clon desechable tiene un `opencode.json` con `"model"`. Los arreglos encontrados durante las pruebas se copiaron en caliente a los clones (marcados con `git update-index --assume-unchanged` para no ensuciar su árbol).

## Risks / Trade-offs

- **[Riesgo] Un producto que el modelo deja a medias se revisa.** Si escribe el archivo de un artefacto y luego pregunta algo, el archivo ya está en `done`. → Mitigación: la revisión lo enseña y el usuario saca todo del stage (ko). El recordatorio del contexto pide no escribir el artefacto hasta tenerlo completo.
- **[Riesgo] Consultar la ruta cada 300 ms** cuesta poco, pero es un temporizador vivo. → La limpieza de `setup` lo para (ADR-0011).
- **[Riesgo] El hook `prompt` es de OpenCode 2.3.2** y se comprobó con `opencode run` y con la TUI. → Entra en la lista de lo que se vuelve a comprobar al subir de versión.
- **[Trade-off] En la web no se archiva ni se navega.** Las sesiones terminadas siguen visibles hasta que llega una TUI. → Llevan `archivePending` y el título del paso.
- **[Trade-off] Un ok del verify sin cambios exige un commit vacío.** → Está documentado en el README y en el prompt de la revisión.
- **[Riesgo] `git add -A` puede pasar al stage algo ajeno al paso.** → Es lo pedido, y la revisión lo enseña. El usuario decide con git.

## Migration Plan

Sin migración de datos. Las sesiones dueñas de versiones anteriores siguen siendo operativas. Las libres pasan a ser ajenas. Las que estaban en `handed-off` se evalúan en el siguiente reposo o validación. Para volver atrás basta con revertir la rama: la metadata nueva es un superconjunto de la anterior.

## Open Questions

Ninguna que bloquee. Queda por comprobar en real lo que se marque como pendiente en las tasks de prueba end-to-end.
