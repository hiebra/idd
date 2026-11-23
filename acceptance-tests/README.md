# Tests de aceptación

Suite de aceptación del proyecto, montada según la skill `acceptance-test-authoring` (`stack: javascript`). Ejecuta con [cucumber-js](https://github.com/cucumber/cucumber-js) el Gherkin de cada `spec.md` de `openspec/specs/` y de los changes activos en `openspec/changes/`; los changes archivados nunca se ejecutan.

## Ejecutar

Además de Node.js con npm, git y bash, la suite necesita PowerShell 7 (`pwsh`) en el `PATH`: con él ejecuta los escenarios del diagnóstico de Windows (`windows-readiness`). Sin `pwsh`, esos escenarios fallan con un mensaje que lo dice; no se saltan. En la nube, el entorno `idd` lo instala con su script de configuración.

Las dependencias las instala el arranque de sesión de Claude Code u OpenCode. Si no se ha ejecutado, instálalas a mano:

```bash
npm install
```

Suite efectiva (specs vigentes con los deltas de los changes activos aplicados):

```bash
npm test
```

Una pasada completa tardó 9 min 49 s en un contenedor de la nube de 4 CPUs (332 escenarios, el 2026-11-22). Por eso se lanza una sola vez por change, en la última task, y mientras tanto se acota con `--name` y una expresión regular sobre los títulos de los escenarios:

```bash
npx cucumber-js --name '^(Título de un escenario|Título de otro)$'
```

Solo `--name` o los tags acotan la pasada: las rutas de `.feature` que se pasen se suman a las del perfil. Un `--name` que no casa con ningún escenario da `0 scenarios` y sale con 0, así que comprueba cuántos se ejecutaron. Con `--parallel 4`, una pasada tardó 3 min 28 s con el mismo resultado, pero el proyecto no lo usa: una sola pasada no prueba que sea estable, y una prueba del núcleo del autopilot ya falla a veces con la máquina cargada.

Solo las specs vigentes de `openspec/specs/`, tal cual:

```bash
npm run test:specs
```

Pruebas del núcleo del arranque que no están en las specs (conflictos de nombres con el motor del wiki, `.wiki/` ignorado por otra regla, marcadores de operación en la guía y el recordatorio, y el modo `wiki <status|on|off>` de `/toggle-wiki`, con la edición byte a byte de `openspec/config.yaml` y el aviso de pasos desfasados), con `node --test`:

```bash
npm run test:core
```

Lint del Gherkin de las specs, con gplint:

```bash
npm run lint:specs
```

Cada ejecución reconstruye `.extracted/` (los `.feature` extraídos de los `spec.md`, que no se editan nunca a mano) y deja el informe HTML en `reports/cucumber-report.html`. Ambos están ignorados por git.

## Estructura

- `cucumber.cjs`, `extract-gherkin.cjs`, `openspec-effective-paths.cjs` y `.gplintrc` son copias literales de la skill; sus nombres son obligatorios. `.gplintrc` es la configuración del lint con [gplint](https://github.com/gplint/gplint), y solo usa los niveles `"error"` y `"off"`: con otro nivel, gplint sale con 0 sin revisar nada.
- `support/` contiene el World y el soporte de los escenarios.
- `step-definitions/` contiene los pasos, que solo llaman a métodos de intención del World y hacen aserciones.

## Escenarios de `session-bootstrap`

Los escenarios de arranque de sesión, heredados de la plantilla, no levantan ninguna aplicación ni arrancan los agentes reales: prueban el núcleo `.agents/hooks/session-bootstrap.sh` a través del adaptador de cada agente, simulando cómo lo invoca ese agente. Por cada escenario, el World:

- crea en un directorio temporal una copia del proyecto sin `node_modules`, `.git` ni `acceptance-tests/`;
- abre la sesión con el adaptador de agente que nombra el paso (`se abre una sesión de Claude Code en el proyecto`, `... de OpenCode ...`); `se abre una sesión en el proyecto`, en los escenarios del núcleo, usa Claude Code;
- simula la máquina con el `PATH` y el entorno: un envoltorio de npm que registra cada llamada, un directorio de herramientas sin npm, un `node` falso de la versión 20 y un `openspec` global falso; un registro inaccesible se simula con `npm_config_registry` apuntando a un puerto cerrado y una caché vacía, y entonces el envoltorio añade al log de npm una línea con comillas, barras, un tabulador y un carácter de control, para comprobar cómo escapa cada adaptador el aviso que la cita. Del directorio de `node` y `npm` solo se exponen esos dos binarios (y `npx`), porque puede tener también paquetes globales, como un `openspec` real.

Los adaptadores están en `support/agents/` y dan a los pasos el mismo resultado: cómo terminó el agente, las llamadas a npm, los avisos mostrados al usuario y cómo ejecutar un comando en la sesión.

- **Claude Code** (`claude-code.js`): ejecuta `.claude/hooks/session-start.sh` como lo hace Claude Code, con `CLAUDE_PROJECT_DIR` apuntando a la copia y `CLAUDE_ENV_FILE` a un archivo temporal, que se carga antes de cada comando de la sesión. Los avisos mostrados son el `systemMessage` del JSON que el hook imprime por stdout; el stdout tiene que estar vacío o ser un único objeto JSON. "Una versión de Claude Code que no permite ajustar el PATH" es una sesión sin `CLAUDE_ENV_FILE`.
- **OpenCode 2** (`opencode.js` y `opencode-host.mjs`): un proceso hijo de Node con el entorno de la máquina simulada hace de OpenCode. Carga `server.js` y `tui.js` de `.opencode/plugins/session-bootstrap/` y llama a su `setup` con contextos falsos de servidor y de TUI, unidos por un RPC del plugin en memoria. Un comando de la sesión se ejecuta con el entorno que dejan los hooks `create.before`, y los avisos mostrados son los toasts de la parte de TUI. Además se comprueba que `setup` no espera a la instalación y que ninguna excepción sale del plugin. "Una versión de OpenCode que no permite ajustar el PATH" se simula de tres formas, que tienen que dar los mismos avisos: un contexto de servidor sin `shell`, un `shell.hook()` que lanza una excepción y un entorno del comando que no se puede cambiar.
- **Recargas y cierre de la TUI en OpenCode** (`fix-tui-subscription-cleanup`): tras el mensaje, el host puede recargar la parte de TUI un número de veces, emitir un evento del RPC del plugin y cerrar la TUI como una que lleva su propio servidor (`--standalone`). Como OpenCode 2.3.2, antes de cada recarga y al cerrar ejecuta la limpieza que devolvió el `setup` de cada parte, y `events.on(nombre, manejador, { signal })` deja de entregar eventos al abortarse el `signal`. Al cerrar, cada suscripción que sigue viva deja una traza `ECONNRESET` en el terminal, como hace el cliente de OpenCode, y también lo que el plugin escriba en `console.error` durante el cierre. A diferencia de OpenCode, solo se recarga la parte de TUI, porque volver a ejecutar la de servidor relanza el núcleo del arranque; y el aviso nuevo es sintético: lo emite el host, no el núcleo.

El contrato de OpenCode que simula el adaptador se comprobó con OpenCode 2.3.2 real (ver las tareas 1.2 y 7.2 del change `add-opencode-parity`). Si cambia la API de plugins de OpenCode, hay que actualizar `opencode-host.mjs`.

Estos escenarios ejecutan `npm install` reales: necesitan acceso al registro de npm y tardan más de un minuto, aunque la caché de npm de la máquina acelera las instalaciones repetidas.

## Escenarios de `agent-skills`

Los escenarios de skills tampoco arrancan los agentes: aplican sobre una copia del proyecto las reglas con las que cada agente descubre las skills de proyecto, que están en `support/skills.js` y son la única copia de esas reglas en el proyecto. Si un agente cambia cómo busca skills, se actualiza ese archivo.

- **Claude Code:** `.claude/skills/<id>/SKILL.md`, siguiendo symlinks.
- **OpenCode 2:** `.claude/skills`, `.agents/skills` y `.opencode/skills`, cada una como `<fuente>/<id>/SKILL.md`; si un ID aparece en varias, solo cuenta el de mayor precedencia, en ese orden.

De cada `SKILL.md` se lee el frontmatter (`name` y `metadata.generatedBy`): el nombre tiene que coincidir con el directorio, y los workflows de OpenSpec, con la versión de `@fission-ai/openspec` fijada en el `package.json` del proyecto.

## Escenarios del wiki

Los escenarios de `llm-wiki`, `wiki-first-knowledge` y los del motor en `session-bootstrap` tampoco arrancan los agentes. La suite no puede comprobar cómo razona el modelo, así que comprueba lo que garantiza la plantilla, con los mismos adaptadores de `support/agents/`:

- **Motor falso** (`support/engine.js`). Cada escenario tiene un repositorio git local que hace de `nvk/llm-wiki`, con las rutas que enlaza el núcleo y dos tags: el `ref` de `.agents/wiki/engine.json` y otro. El `engine.json` de la copia apunta a él con una URL `file://`. Cada archivo de un tag lleva la línea `fake-engine-ref: <tag>`, y el helper falso la imprime, así que la suite sabe qué versión ve cada agente sin fiarse del sello del núcleo. "Sin acceso al repositorio del motor" se simula renombrando el repositorio.
- **Copia del proyecto.** No incluye la instalación local del motor (`.agents/wiki-engine/` y sus symlinks) y se versiona en un repositorio git propio, para comprobar con `git status` que lo instalado no aparece como cambio. Un espía de `git` en la máquina simulada registra los `git clone`.
- **Qué ve cada agente** (`support/skills.js`): las skills, con las reglas de arriba, y los comandos de Claude Code, `.claude/commands/<cmd>.md` como `/<cmd>` y `.claude/commands/<ns>/<cmd>.md` como `/<ns>:<cmd>`, y los de OpenCode, `.opencode/command/<cmd>.md` y `.opencode/commands/<cmd>.md` como `/<cmd>`. La consulta de solo lectura es `/wiki:query` en Claude Code y la skill `wiki-query` en OpenCode; la gestión, la skill `wiki-manager` en los dos. Además, se ejecuta `"$CLAUDE_PLUGIN_ROOT/bin/llm-wiki"` como un comando de la sesión.
- **Guía y recordatorio en Claude Code.** El adaptador ejecuta los hooks registrados en `.claude/settings.json`, con el `env` de `settings.json` y `settings.local.json`, como Claude Code. La guía es el `additionalContext` del hook `SessionStart`. Un mensaje del usuario ejecuta los hooks `UserPromptSubmit` con el JSON que Claude Code pasa por stdin, y su `additionalContext` es el recordatorio. El mensaje se bloquea si un hook sale con 2 o devuelve `decision: "block"`.
- **Guía y recordatorio en OpenCode.** El servidor falso ofrece `ctx.session.hook("context")`. Tras abrir la sesión, `opencode-host.mjs` construye una petición al modelo con un mensaje del usuario y ejecuta sobre ella los hooks `context`. La guía es lo que se añade al system, y el recordatorio, lo que se inserta antes del último mensaje del usuario. Si un hook lanza una excepción, la petición falla, como en OpenCode. Enviar un mensaje abre de nuevo el host con ese mensaje, sobre el proyecto tal como esté entonces. El host espera a que terminen los procesos hijo del plugin antes de informar.
- **Recordatorio que no se puede generar.** Se sustituye `.agents/wiki/reminder.md` por un directorio. En OpenCode se prueba además una petición cuyos mensajes no se pueden cambiar, para que falle el propio hook. En los dos casos, el mensaje del usuario tiene que llegar.
- **Guía.** Cada parte del flujo tiene en `guide.md` un identificador de sección (`<!-- wiki-guide:<id> -->`), y los pasos de revisión comprueban esos identificadores, no la redacción. La guía entregada es `guide.md` sin ellos, y tiene que ocupar menos de 6.000 caracteres. En OpenCode va precedida de `.agents/wiki/opencode-note.md`.
- **Hub del usuario.** Una máquina sin hub es un `HOME` vacío (con la caché de npm de siempre).
- **Estado del wiki.** Es del clon, no de la máquina simulada (design D7 de `add-project-wiki-toggle`): "con el wiki habilitado" y "deshabilitado" ejecutan el modo `wiki on|off` del núcleo sobre la copia y lo pliegan en su commit, como un `/toggle-wiki` ya confirmado; lo que el modo instala para la sesión se retira, para que la copia empiece como un clon nuevo. Con el wiki habilitado, la copia tiene además un `.wiki/` versionado. `PROJECT_WIKI=off` solo aparece para comprobar que no tiene efecto (en Claude Code, en `.claude/settings.local.json`; en OpenCode, en el entorno desde el que se lanza).
- **`/toggle-wiki`.** Lo ejecuta un modelo con guion (`support/toggle-wiki.js`) que sigue el comando de cada agente tal como está escrito: lee sus secciones (`<!-- toggle-wiki:<paso> -->`), ejecuta en la sesión el bash de cada paso que toma e informa con el texto de su paso 5. Solo sustituye la parte del motor en la ingesta inicial: simula la inicialización y escribe un manifiesto con las líneas `source=` de `wiki status`, fijado a `HEAD`. El comportamiento con el motor y un modelo reales se prueba aparte, en las tareas de la sección 10 del change.
- **`.wiki/` ignorado.** Se simula la inicialización del motor durante una sesión (crea `.wiki/` y lo añade a `.gitignore`) y se abre la siguiente, que es cuando lo corrige el núcleo.
- **Indicaciones de archivado** (`support/openspec.js`). Se crea en la copia un change listo para archivar y se ejecuta `openspec instructions archive --change <change> --json` con el CLI del proyecto. Cada paso de la tabla se busca en `operationGuidance` por la operación del motor que lo hace, en orden.

El contrato de `context` de OpenCode y la entrega del `additionalContext` en Claude Code se comprobaron con OpenCode 2.3.2 y Claude Code 2.1.330 reales (tareas 1.1 y 1.2 del change `add-llm-wiki-support`).

## Escenarios de `openspec-change-lifecycle`

Tampoco arrancan los agentes. Cada escenario monta el estado de git que necesita sobre la copia del proyecto, que ya es un repositorio con la rama `main` (`support/branches.js`): `x-main` con o sin valor, ramas temporales con changes en curso o archivados, con commit o sin él, HEAD separado, un `tasks.md` con tasks marcadas o no, y el `openspec status` real de la copia, con el CLI del proyecto. Antes, la copia se deja con `openspec/changes/` solo con el archivo, como en `main`.

El change de la rama sale de `.agents/openspec/branch-change.mjs` de la copia, ejecutado como lo ejecutan los workflows, y las puertas del ciclo, de su subcomando `check`. La suite no puede ejecutar el modelo de los workflows, así que comprueba la puerta y que la skill `openspec-git-discipline` la usa, por sus identificadores de sección (`<!-- lifecycle:<id> -->`). Los subcomandos `list`, `start`, `switch` y `origin` se ejecutan sobre la copia, como los ejecuta el modelo. Los casos que no están en las specs (otras formas de `x-main`, la rama de origen solo en `origin/`, `start` y `origin` desde `origin/<rama>`, `origin` con `x-main` de varias ramas, ramas con varios changes en `list`) están en `core-tests/branch-change.test.js`.

## Escenarios de `openspec-autopilot`

El plugin `.opencode/plugins/openspec-autopilot/` se prueba en un OpenCode simulado con varias sesiones (`support/agents/opencode-sim.mjs`). Es un proceso hijo de larga duración, como el de OpenCode, que el World maneja por IPC operación a operación (`support/agents/opencode-sim.js`). Reiniciar OpenCode es un proceso nuevo sobre el mismo almacén de sesiones, un archivo JSON. Simula lo que usa el plugin, con el contrato comprobado con OpenCode 2.3.2 real (tareas 1.1 a 1.5 de `add-openspec-autopilot` y la nota de lecciones de esas pruebas en `.wiki/raw/notes/`):

- **Sesiones:** `create`, `get`, `list` (con las archivadas, salvo que se filtre, y por páginas `{ data, cursor }`, como OpenCode 2.3.2) y `update`. La metadata se sustituye entera, y el `ctx.session` del servidor ignora `archived`: solo archiva el cliente de la TUI.
- **Ejecución:** `prompt` y `command` arrancan un turno en segundo plano. Con cada mensaje de usuario, también con los que envía el plugin, se ejecutan antes los hooks `prompt`, que pueden cambiar su texto; llegan una vez por mensaje, con `delivery: "steer"` y un `messageID` que el mensaje guardado lleva como `id` en la entrada de `context`. Un mensaje enviado mientras el turno sigue entra en el mismo bucle, tras el resultado de la tool, con un solo reposo al final, como en OpenCode 2.3.2. Con el agente plan, cada petición lleva el recordatorio de OpenCode como mensaje `user`: delante del mensaje del usuario en la primera petición del turno, y al final, tras la tool, en las siguientes. El agente de la sesión se cambia como con Tab (`switchAgent`). Antes de cada petición al modelo se ejecutan los hooks `context`, y si uno lanza una excepción la petición falla. Si el modelo llama a una tool, se ejecuta y se le vuelve a preguntar; cuando responde con texto, la sesión queda parada y se ejecutan los hooks `experimental.idle`, salvo tras una interrupción. `time.busy` y `time.idle` dicen si una sesión trabaja, `context({ sessionID })` da los mensajes de cualquier sesión y la compactación ejecuta su hook.
- **Tools:** solo llegan al modelo las declaradas con `options.codemode === false`.
- **TUI:** una pantalla propia (`ui.router.current()`), que cambia al navegar, al abrir la pantalla de inicio, al saltar a una sesión y al escribir el primer mensaje desde la pantalla de inicio; el foco del terminal (`renderer.on/off('focus' | 'blur')`); `ui.dialog.select` con respuestas guionizadas, Enter (la primera opción) o Esc (`undefined`), y `alert`; toasts y `client.session.update`. Un diálogo puede quedarse abierto hasta que el paso siguiente del escenario lo responda; una entrega RPC a la TUI que espera un diálogo abierto no cuenta como trabajo pendiente, porque en OpenCode el `emit` del servidor no espera a la TUI. Tras cambiar la pantalla o el foco, el escenario espera más que la consulta de la TUI (300 ms). Sin TUI no se carga `tui.js`, y una TUI que no contesta se simula sin entregarle los eventos.
- **Arranque o recarga:** la TUI se presenta con el PID del proceso, así que un reinicio es un arranque y una recarga conserva el PID. Para los escenarios que empiezan con OpenCode ya abierto (`alreadyOpen`), el simulador da por presentado ese PID en el registro que el plugin guarda en `globalThis`. Con `rpcLate`, la parte de TUI se carga antes de que el servidor registre su RPC, y sus llamadas fallan con `rpc.unavailable` hasta entonces. Lo que el plugin escribe en `console.error` queda en `logs`.
- **Recargas:** vuelven a ejecutar `setup`, de las dos partes. Antes, como OpenCode 2.3.2, se ejecuta la limpieza que devolvió el `setup` anterior de cada parte, si devolvió una función; si falla, sale un toast "cleanup failed". El servidor solo conserva los hooks, tools y manejadores RPC de la última generación. Los escuchadores de eventos de la TUI de cargas anteriores siguen vivos solo si el plugin no los libera: `events.on(nombre, manejador, { signal })` deja de entregar eventos al abortarse el `signal` (ADR-0011).
- **Cierre de la TUI** con su propio servidor (`--standalone`): ejecuta las limpiezas y cierra el servidor. Cada suscripción que sigue viva deja una traza `ECONNRESET` en el terminal, como hace el cliente de OpenCode, y también lo que el plugin escriba en `console.error` durante el cierre. El estado expone las suscripciones vivas, con la carga de la TUI a la que pertenecen.
- **Fallos:** se inyectan por operación (por ejemplo, `session.create`).
- **Directorios y worktrees** (`autopilot-rama-por-sesion`, comprobado con OpenCode 2.3.2): cada sesión tiene su directorio (`location.directory`), el checkout principal o un worktree, y hay una instancia de la parte de servidor por directorio, que se carga la primera vez que la TUI entra en él o que trabaja una de sus sesiones; las anteriores siguen vivas. Hooks, tools y manejadores RPC son de cada instancia: el turno de una sesión usa los de su directorio, y cada llamada de la TUI va a la instancia de la ubicación que nombra (sin ella, a la del directorio en que arrancó). `context.location` de la TUI sigue a su pantalla: el directorio de su sesión, o el de la pantalla de inicio (`{ type: "home", location }`). El estado registra cada llamada RPC con su directorio (`rpcCalls`) y las instancias cargadas.
- **Estrategias de worktree:** `ctx.worktree.transform` con `add({ id, create, remove, list })`; queda seleccionada la última registrada (una con el mismo id sustituye a la anterior), y al recargar o descargar el plugin se sueltan, de vuelta a la estrategia git incluida (`git worktree add --detach`). `ctx.worktree.create`, la TUI y la web (`createWorktree`, con la referencia de partida que manda la web) crean el worktree con ella en un directorio fuera del clon, y se quita con la estrategia que lo creó (`removeWorktree`).
- **Keymap de la TUI:** `context.keymap.dispatch("session.move")` abre «Manage workspaces» y, después, `dispatch("dialog.move_session.new")` abre «Name worktree»; al confirmarlo (`nameWorktree`, con un nombre o generado), la TUI crea el worktree y abre en él la pantalla de inicio. `ui.dialog.select` acepta también elegir una opción por su título (`choose`).
- **Lo que mostraron las pruebas en OpenCode 2.3.2 real** (sección 8 de las tasks de `autopilot-rama-por-sesion`): el contexto del servidor tiene `location.project` y no `project`, y `ctx.worktree.create` exige `projectID`; `remove` de una estrategia recibe solo `{ directory, force }`, y sus errores llegan envueltos («Worktree strategy <id> failed to <operación>: …») y sin `forceRequired`; `dialog.move_session.new` no hace nada hasta que «Manage workspaces» está montado (`WORKSPACES_MOUNT_MS` tras `session.move`); y desde la pantalla de inicio, `nameWorktree` deja el worktree pendiente hasta el primer mensaje (`openHome`), que lo crea con una sesión que contiene ese mensaje. `newWorktreeDialog` abre «Name worktree» como el usuario («Manage workspaces → New worktree»).

El modelo es un guion por escenario: reglas por sesión, cada una con una cola de respuestas (texto o una llamada a tool con sus argumentos). Una regla puede limitarse a un agente (`match.agent`), y una respuesta puede tardar (`delayMs`, para que el escenario escriba con el turno en curso), escribir o borrar archivos del proyecto (`files`) y ejecutar órdenes de git (`git`, por ejemplo un checkout para un merge asistido) en el directorio de su sesión antes de contestar: así un workflow escribe un artefacto o marca una task, y el plugin lo encuentra como producto al quedar la sesión en reposo. Las revisiones se alcanzan como en OpenCode: el paso produce, el plugin lo pasa al stage y abre la revisión, y los pasos hacen el commit o sacan el stage con git. De cada petición se registra lo que recibe el modelo (system, mensajes, skills y tools), y los pasos comprueban sobre eso las instrucciones que inyecta el plugin.

Los escenarios de `autopilot-rama-por-sesion` preparan un remoto desnudo para el clon con su rama de origen (`ensureRemote`), worktrees fuera del clon, donde los crea el simulador (`addWorktree`), changes en un worktree o en una rama que no está sacada, y sesiones de un worktree; leen la rama de cada directorio, los avisos y las opciones del último modal (`support/autopilot.js`).

Los casos que no están en las specs están en `core-tests/autopilot-next-step.test.js` (el paso siguiente, las esperas de commit, las discrepancias con `openspec status` y las tasks del CLI), `core-tests/autopilot-product.test.js` (el producto, la cola de revisiones, el veredicto por git con repositorios reales, la entrada en una sesión con su checkout o la vuelta atrás, el modal de `/new` con sus opciones, la rama de trabajo de cada sesión y su primera metadata, que no pisa a una dueña escrita a la vez), `core-tests/autopilot-worktree.test.js` (la estrategia de worktree con repositorios reales y un remoto desnudo: la rama nueva desde `origin/<rama de origen>` sin seguirla y publicable con un `git push` sin argumentos, la rama de origen de `x-main`, la rama existente, la sacada en otro directorio, el `fetch` fallido, la referencia de partida ignorada y `remove`, con o sin `sourceDirectory`, que conserva la rama y, con cambios, dice que se haga el commit o se fuerce) y `core-tests/autopilot-plugin.test.js`: recargas sin duplicados, el arranque con `autopilot` sin TUI, dos sesiones que toman el control a la vez, la tool llamada sin producto, el árbol comprobado otra vez en el mensaje siguiente, el modo auto dentro de una zona y tras un cambio de zona, ninguna excepción hacia OpenCode, esperas con límite, `openspec_session`, la limpieza que devuelve el `setup` de la parte de TUI, que aborta sus suscripciones, para la consulta de la pantalla, deja de escuchar el foco y no lanza ni cuando falla el RPC, la estrategia de worktree, registrada una sola vez tras recargas y en cada instancia, que se suelta al descargar el plugin, con las llamadas de la TUI a la instancia de su directorio, y el diálogo de nombre del modal de `/new`, que se reintenta si «Manage workspaces» tarda en montarse (`workspacesMountMs` del simulador) y, si no se abre, dice cómo abrirlo. De `autopilot-plan-explore`: en `core-tests/autopilot-agent-turn.test.js`, la clave del turno, las transiciones entre build y plan y sus textos; en `core-tests/autopilot-plugin.test.js`, un turno en plan con varias tools, un mensaje a mitad de turno tras un Tab, un fallo al escribir el turno, el estado de git del turno en plan y el aviso (pedido otra vez a una TUI con otro PID y no tras una recarga, el acuse tras una recarga con el modal abierto, el prompt con el aviso pendiente y el turno con build sin aviso). `core-tests/opencode-sim.test.js` comprueba con un plugin sonda lo que el simulador reproduce de OpenCode real: la entrega RPC con un modal abierto, el recordatorio del agente plan, los `id` de los mensajes y el mensaje que entra a mitad de turno.

El banco con OpenCode real con el que se comprobó el contrato está descrito en la lección 9 de esa nota y no forma parte del repositorio. Al subir de versión OpenCode, hay que repetir las pruebas con él y actualizar el simulador si algo cambia (inventario del wiki: `volver-a-comprobar-apis-de-sesion-al-subir-opencode`).

De `limite-de-verificacion-y-mcp-de-depuracion`, los escenarios de la revisión comprueban frases de la instrucción de la revisión, como los de `guiar-revision-con-tests`: la del MCP de depuración (que pide usar `debug_targets` y `debug_launch_plan` si la sesión los tiene, enseñar el plan antes de ejecutarlo, ejecutar solo los pasos de `agent` y seguir los de `cleanup`, con la orden de terminal como alternativa), la de la estimación y el límite en la revisión de una task y la de las estimaciones en la revisión del artefacto `tasks` y de los cambios en el plan. El paso «el plugin abre la revisión…» alcanza también la revisión del artefacto `tasks` (con una rama propia en `reachReview`, que produce el `tasks.md`) y la del verify. Que las demás revisiones no hablen del límite se comprueba con la del artefacto `design` y la del verify. Ninguno de estos escenarios usa un servidor MCP: el plugin no habla con él, y la suite solo ve la instrucción.

## Escenarios de `task-verification-limit`

El límite de verificación es una regla de `rules.tasks` de `openspec/config.yaml`, y llega al modelo como las `rules` que da el CLI de OpenSpec con las instrucciones del artefacto `tasks`. El paso `` se consultan las instrucciones del artefacto `tasks` de un change `` crea en la copia del proyecto un change listo (`support/openspec.js`) y ejecuta `openspec instructions tasks --change <change> --json` con el CLI del proyecto y el `config.yaml` de la copia, como el paso del artefacto `adr` de `change-lifecycle.steps.js`. Los demás pasos buscan en esas reglas, por su sentido, el límite de 15 minutos, qué cuenta como verificar, la referencia para estimar, dónde se escribe la estimación y qué hacer con la task que pase del límite. La suite no comprueba que un modelo estime bien ni que los `tasks.md` cumplan la regla: eso lo dicen las revisiones.

## Escenarios de `debug-mcp-contract`

El contrato del MCP de depuración es `.agents/debug/contract.json`, con sus ejemplos en `.agents/debug/examples/`. La plantilla no tiene ningún servidor, así que la suite comprueba el contrato, no un servidor. `support/debug-contract.js` lee el contrato de la copia del proyecto y compila los esquemas de cada tool (`inputSchema` y `outputSchema`) con [ajv](https://ajv.js.org/), dependencia de desarrollo de la suite, como JSON Schema 2020-12 en modo estricto (`strict: true`): un esquema del que ajv solo avisaría es aquí un error. El plugin sigue sin dependencias.

- **La forma del contrato** (`step-definitions/debug-contract.steps.js`): la versión, las dos tools y ninguna más, su título, su descripción y sus esquemas, las anotaciones de solo lectura y de mundo cerrado, el parámetro `workspace`, los parámetros obligatorios, las frases obligatorias de la descripción de `debug_launch_plan` y los errores de ejecución.
- **Las respuestas.** El soporte tiene una respuesta válida de cada tool y las variantes que nombran los escenarios (`` se valida una respuesta de `<tool>` <variante> ``, como «sin objetivos» o «con un objetivo sin identificador»). Cada variante es un cambio sobre una copia de esa respuesta válida. «No cumple el contrato» exige además que la respuesta válida sí lo cumpla, para que el defecto sea lo único que falla, y una variante que no esté en el soporte hace fallar el paso diciéndolo: no pasa por omisión.
- **Los ejemplos.** Cada llamada de un ejemplo valida sus argumentos con el `inputSchema` de su tool y su resultado con el `outputSchema`, y entre todas tienen que llamar a las dos tools. Además se comprueba para qué IDE es el plan y que tiene pasos de `agent` y de `user`.

El contrato y sus ejemplos son copias literales de los anexos del design del change; la orden que lo comprueba está en su `tasks.md`.

## Escenarios de `spec-lint`

Los escenarios del lint de las specs no ejecutan `npm run lint:specs` tal cual, porque reconstruye `.extracted/`, que es de donde lee cucumber-js la suite en curso. `support/spec-lint.js` ejecuta los mismos dos comandos del script sobre otros directorios: `extract-gherkin.cjs <openspec> <salida>` y el `gplint` de `node_modules` con `-c .gplintrc -f json`, del que lee el código de salida y la línea de cada error.

- **Un defecto en un escenario**: el World escribe en un directorio temporal un `openspec/` con una sola spec, de un requisito cuyo escenario tiene el defecto del ejemplo, y guarda la línea en la que lo escribió. El paso comprueba que hay un error en esa línea y en ninguna otra.
- **Las specs del proyecto**: extrae el `openspec/` del proyecto, con los deltas de los changes activos, en un directorio temporal. Además de que no haya errores, comprueba que gplint dio un informe, porque sin él no ha revisado nada.

`core-tests/spec-lint-script.test.js` comprueba que `lint:specs` sigue siendo `node extract-gherkin.cjs && gplint .extracted`, que `.gplintrc` solo usa `"error"` y `"off"` y que es igual que la configuración fijada de la skill.

## Escenarios de `windows-readiness`

El diagnóstico `scripts/windows/Test-OfflineInstall.ps1` tiene dos partes (design D4 de `windows-support`): `Get-ReadinessFacts` recoge los hechos de la máquina y `Get-ReadinessReport` los convierte en el informe. Con `-FactsFile` evalúa unos hechos dados, sin recogerlos. La suite prueba así toda la evaluación fuera de Windows:

- **Máquinas Windows simuladas** (`support/windows-readiness.js`). Cada escenario parte de los hechos de una máquina con todo lo necesario: OpenCode 2.3.2, Node.js 22.12 con npm, git, Python 3.12 y, instalados, el motor del wiki en la versión fijada y todas las dependencias npm de los lockfiles reales de la raíz y de `acceptance-tests/`. Cada `But` cambia un hecho, por ejemplo, unas dependencias instaladas en Linux (solo las que se instalan en `linux-x64`) o el alias de Python de la Microsoft Store.
- **Ejecución.** El paso escribe los hechos en un JSON y ejecuta el script con `pwsh -NoProfile -NonInteractive -File … -FactsFile …`, una vez en texto (de la que lee el código de salida) y otra con `-Json` (de la que lee el informe). Las dos tienen que terminar igual. Cada componente tiene un `Id` estable, que es lo que comprueban los pasos.
- **Sin efectos.** El diagnóstico se ejecuta sobre un clon pequeño con el `package.json` del proyecto. Para comprobar que no cambia nada, se ejecuta además recogiendo los hechos de la máquina que ejecuta la suite.

La recogida de hechos solo se puede probar en Windows: se comprueba a mano en Windows 11 real, con Windows PowerShell 5.1 y con PowerShell 7 (trasladado al change `windows-global-distro`).

## Escenarios de Windows en `session-bootstrap` y `openspec-autopilot`

- **Finales de línea** (`step-definitions/line-endings.steps.js`): la copia del proyecto se vuelve a extraer de su propio repositorio con `core.autocrlf=true`, como Git for Windows, y se abre una sesión de OpenCode. Los scripts del arranque tienen que tener LF y la guía del wiki tiene que llegar sin sus identificadores de sección.
- **El CLI de OpenSpec en el autopilot**: el proyecto tiene su propio `node_modules/`, con el paquete real de OpenSpec del repositorio, y un `node_modules/.bin/openspec` que no es ejecutable, como en Windows. La sesión operativa tiene que arrancar con el paso de `openspec status`. `core-tests/autopilot-openspec-cli.test.js` prueba además que sin el paquete se usa el `openspec` del `PATH`.
