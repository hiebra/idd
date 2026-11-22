# Tests de aceptación

Suite de aceptación del proyecto, montada según la skill `acceptance-test-authoring` (`stack: javascript`). Ejecuta con [cucumber-js](https://github.com/cucumber/cucumber-js) el Gherkin de cada `spec.md` de `openspec/specs/` y de los changes activos en `openspec/changes/`; los changes archivados nunca se ejecutan.

## Ejecutar

Las dependencias las instala el arranque de sesión de Claude Code u OpenCode. Si no se ha ejecutado, instálalas a mano:

```bash
npm install
```

Suite efectiva (specs vigentes con los deltas de los changes activos aplicados):

```bash
npm test
```

Solo las specs vigentes de `openspec/specs/`, tal cual:

```bash
npm run test:specs
```

Pruebas del núcleo del arranque que no están en las specs (conflictos de nombres con el motor del wiki, `.wiki/` ignorado por otra regla y marcadores de operación en la guía y el recordatorio), con `node --test`:

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
- **Qué ve cada agente** (`support/skills.js`): las skills, con las reglas de arriba, y los comandos de Claude Code, `.claude/commands/<cmd>.md` como `/<cmd>` y `.claude/commands/<ns>/<cmd>.md` como `/<ns>:<cmd>`. La consulta de solo lectura es `/wiki:query` en Claude Code y la skill `wiki-query` en OpenCode; la gestión, la skill `wiki-manager` en los dos. Además, se ejecuta `"$CLAUDE_PLUGIN_ROOT/bin/llm-wiki"` como un comando de la sesión.
- **Guía y recordatorio en Claude Code.** El adaptador ejecuta los hooks registrados en `.claude/settings.json`, con el `env` de `settings.json` y `settings.local.json`, como Claude Code. La guía es el `additionalContext` del hook `SessionStart`. Un mensaje del usuario ejecuta los hooks `UserPromptSubmit` con el JSON que Claude Code pasa por stdin, y su `additionalContext` es el recordatorio. El mensaje se bloquea si un hook sale con 2 o devuelve `decision: "block"`.
- **Guía y recordatorio en OpenCode.** El servidor falso ofrece `ctx.session.hook("context")`. Tras abrir la sesión, `opencode-host.mjs` construye una petición al modelo con un mensaje del usuario y ejecuta sobre ella los hooks `context`. La guía es lo que se añade al system, y el recordatorio, lo que se inserta antes del último mensaje del usuario. Si un hook lanza una excepción, la petición falla, como en OpenCode. Enviar un mensaje abre de nuevo el host con ese mensaje, sobre el proyecto tal como esté entonces. El host espera a que terminen los procesos hijo del plugin antes de informar.
- **Recordatorio que no se puede generar.** Se sustituye `.agents/wiki/reminder.md` por un directorio. En OpenCode se prueba además una petición cuyos mensajes no se pueden cambiar, para que falle el propio hook. En los dos casos, el mensaje del usuario tiene que llegar.
- **Guía.** Cada parte del flujo tiene en `guide.md` un identificador de sección (`<!-- wiki-guide:<id> -->`), y los pasos de revisión comprueban esos identificadores, no la redacción. La guía entregada es `guide.md` sin ellos, y tiene que ocupar menos de 6.000 caracteres. En OpenCode va precedida de `.agents/wiki/opencode-note.md`.
- **Hub del usuario.** Una máquina sin hub es un `HOME` vacío (con la caché de npm de siempre).
- **Desactivación.** En Claude Code, `PROJECT_WIKI=off` en `.claude/settings.local.json`; en OpenCode, en el entorno desde el que se lanza.
- **`.wiki/` ignorado.** Se simula la inicialización del motor durante una sesión (crea `.wiki/` y lo añade a `.gitignore`) y se abre la siguiente, que es cuando lo corrige el núcleo.
- **Indicaciones de archivado** (`support/openspec.js`). Se crea en la copia un change listo para archivar y se ejecuta `openspec instructions archive --change <change> --json` con el CLI del proyecto. Cada paso de la tabla se busca en `operationGuidance` por la operación del motor que lo hace, en orden.

El contrato de `context` de OpenCode y la entrega del `additionalContext` en Claude Code se comprobaron con OpenCode 2.3.2 y Claude Code 2.1.330 reales (tareas 1.1 y 1.2 del change `add-llm-wiki-support`).

## Escenarios de `openspec-change-lifecycle`

Tampoco arrancan los agentes. Cada escenario monta el estado de git que necesita sobre la copia del proyecto, que ya es un repositorio con la rama `main` (`support/branches.js`): `x-main` con o sin valor, ramas temporales con changes en curso o archivados, con commit o sin él, HEAD separado, un `tasks.md` con tasks marcadas o no, y el `openspec status` real de la copia, con el CLI del proyecto. Antes, la copia se deja con `openspec/changes/` solo con el archivo, como en `main`.

El change de la rama sale de `.agents/openspec/branch-change.mjs` de la copia, ejecutado como lo ejecutan los workflows, y las puertas del ciclo, de su subcomando `check`. La suite no puede ejecutar el modelo de los workflows, así que comprueba la puerta y que la skill `openspec-git-discipline` la usa, por sus identificadores de sección (`<!-- lifecycle:<id> -->`). Los subcomandos `list`, `start` y `switch` se ejecutan sobre la copia, como los ejecuta el modelo. Los casos que no están en las specs (otras formas de `x-main`, la rama de origen solo en `origin/`, `start` desde `origin/<rama>`, ramas con varios changes en `list`) están en `core-tests/branch-change.test.js`.

## Escenarios de `openspec-autopilot`

El plugin `.opencode/plugins/openspec-autopilot/` se prueba en un OpenCode simulado con varias sesiones (`support/agents/opencode-sim.mjs`). Es un proceso hijo de larga duración, como el de OpenCode, que el World maneja por IPC operación a operación (`support/agents/opencode-sim.js`). Reiniciar OpenCode es un proceso nuevo sobre el mismo almacén de sesiones, un archivo JSON. Simula lo que usa el plugin, con el contrato comprobado con OpenCode 2.3.2 real (tareas 1.1 a 1.5 de `add-openspec-autopilot` y la nota de lecciones de esas pruebas en `.wiki/raw/notes/`):

- **Sesiones:** `create`, `get`, `list` (con las archivadas, salvo que se filtre, y por páginas `{ data, cursor }`, como OpenCode 2.3.2) y `update`. La metadata se sustituye entera, y el `ctx.session` del servidor ignora `archived`: solo archiva el cliente de la TUI.
- **Ejecución:** `prompt` y `command` arrancan un turno en segundo plano. Con cada mensaje de usuario, también con los que envía el plugin, se ejecutan antes los hooks `prompt`, que pueden cambiar su texto. Antes de cada petición al modelo se ejecutan los hooks `context`, y si uno lanza una excepción la petición falla. Si el modelo llama a una tool, se ejecuta y se le vuelve a preguntar; cuando responde con texto, la sesión queda parada y se ejecutan los hooks `experimental.idle`, salvo tras una interrupción. `time.busy` y `time.idle` dicen si una sesión trabaja, `context({ sessionID })` da los mensajes de cualquier sesión y la compactación ejecuta su hook.
- **Tools:** solo llegan al modelo las declaradas con `options.codemode === false`.
- **TUI:** una pantalla propia (`ui.router.current()`), que cambia al navegar, al abrir la pantalla de inicio, al saltar a una sesión y al escribir el primer mensaje desde la pantalla de inicio; el foco del terminal (`renderer.on/off('focus' | 'blur')`); `ui.dialog.select` con respuestas guionizadas, Enter (la primera opción) o Esc (`undefined`), y `alert`; toasts y `client.session.update`. Un diálogo puede quedarse abierto hasta que el paso siguiente del escenario lo responda. Tras cambiar la pantalla o el foco, el escenario espera más que la consulta de la TUI (300 ms). Sin TUI no se carga `tui.js`, y una TUI que no contesta se simula sin entregarle los eventos.
- **Arranque o recarga:** la TUI se presenta con el PID del proceso, así que un reinicio es un arranque y una recarga conserva el PID. Para los escenarios que empiezan con OpenCode ya abierto (`alreadyOpen`), el simulador da por presentado ese PID en el registro que el plugin guarda en `globalThis`. Con `rpcLate`, la parte de TUI se carga antes de que el servidor registre su RPC, y sus llamadas fallan con `rpc.unavailable` hasta entonces. Lo que el plugin escribe en `console.error` queda en `logs`.
- **Recargas:** vuelven a ejecutar `setup`, de las dos partes. Antes, como OpenCode 2.3.2, se ejecuta la limpieza que devolvió el `setup` anterior de cada parte, si devolvió una función; si falla, sale un toast "cleanup failed". El servidor solo conserva los hooks, tools y manejadores RPC de la última generación. Los escuchadores de eventos de la TUI de cargas anteriores siguen vivos solo si el plugin no los libera: `events.on(nombre, manejador, { signal })` deja de entregar eventos al abortarse el `signal` (ADR-0011).
- **Cierre de la TUI** con su propio servidor (`--standalone`): ejecuta las limpiezas y cierra el servidor. Cada suscripción que sigue viva deja una traza `ECONNRESET` en el terminal, como hace el cliente de OpenCode, y también lo que el plugin escriba en `console.error` durante el cierre. El estado expone las suscripciones vivas, con la carga de la TUI a la que pertenecen.
- **Fallos:** se inyectan por operación (por ejemplo, `session.create`).

El modelo es un guion por escenario: reglas por sesión, cada una con una cola de respuestas (texto o una llamada a tool con sus argumentos). Una respuesta puede escribir o borrar archivos del proyecto (`files`) y ejecutar órdenes de git (`git`) antes de contestar: así un workflow escribe un artefacto o marca una task, y el plugin lo encuentra como producto al quedar la sesión en reposo. Las revisiones se alcanzan como en OpenCode: el paso produce, el plugin lo pasa al stage y abre la revisión, y los pasos hacen el commit o sacan el stage con git. De cada petición se registra lo que recibe el modelo (system, mensajes, skills y tools), y los pasos comprueban sobre eso las instrucciones que inyecta el plugin.

Los casos que no están en las specs están en `core-tests/autopilot-next-step.test.js` (el paso siguiente, las esperas de commit, las discrepancias con `openspec status` y las tasks del CLI), `core-tests/autopilot-product.test.js` (el producto, la cola de revisiones, el veredicto por git con repositorios reales y la directiva de cada pantalla) y `core-tests/autopilot-plugin.test.js`: recargas sin duplicados, el arranque con `autopilot` sin TUI, dos sesiones que toman el control a la vez, la tool llamada sin producto, el árbol comprobado otra vez en el mensaje siguiente, el modo auto dentro de una zona y tras un cambio de zona, ninguna excepción hacia OpenCode, esperas con límite, `openspec_session` y la limpieza que devuelve el `setup` de la parte de TUI, que aborta sus suscripciones, para la consulta de la pantalla, deja de escuchar el foco y no lanza ni cuando falla el RPC.

El banco con OpenCode real con el que se comprobó el contrato está descrito en la lección 9 de esa nota y no forma parte del repositorio. Al subir de versión OpenCode, hay que repetir las pruebas con él y actualizar el simulador si algo cambia (inventario del wiki: `volver-a-comprobar-apis-de-sesion-al-subir-opencode`).

## Escenarios de `spec-lint`

Los escenarios del lint de las specs no ejecutan `npm run lint:specs` tal cual, porque reconstruye `.extracted/`, que es de donde lee cucumber-js la suite en curso. `support/spec-lint.js` ejecuta los mismos dos comandos del script sobre otros directorios: `extract-gherkin.cjs <openspec> <salida>` y el `gplint` de `node_modules` con `-c .gplintrc -f json`, del que lee el código de salida y la línea de cada error.

- **Un defecto en un escenario**: el World escribe en un directorio temporal un `openspec/` con una sola spec, de un requisito cuyo escenario tiene el defecto del ejemplo, y guarda la línea en la que lo escribió. El paso comprueba que hay un error en esa línea y en ninguna otra.
- **Las specs del proyecto**: extrae el `openspec/` del proyecto, con los deltas de los changes activos, en un directorio temporal. Además de que no haya errores, comprueba que gplint dio un informe, porque sin él no ha revisado nada.

`core-tests/spec-lint-script.test.js` comprueba que `lint:specs` sigue siendo `node extract-gherkin.cjs && gplint .extracted`, que `.gplintrc` solo usa `"error"` y `"off"` y que es igual que la configuración fijada de la skill.
