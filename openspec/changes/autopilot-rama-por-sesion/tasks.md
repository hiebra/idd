# Tasks: autopilot-rama-por-sesion

La suite ya existe (`acceptance-tests/`, `stack: javascript`), así que no hace falta montarla. Cada task de las secciones 3 a 5 sigue el mismo ciclo: el escenario falla por la razón esperada, se implementa, pasa y se hace commit. Los commits no mezclan `openspec/` con el resto, salvo este `tasks.md`. Los pasos del requisito retirado («Las ventanas ajenas llevan a la sesión operativa») se borran en la task que implementa su sustituto (4.3).

## 1. Simulador (zona de código)

- [x] 1.1 En `acceptance-tests/support/agents/opencode-sim.mjs`, según D9:
  - varios directorios (el principal y worktrees) con una instancia de la parte de servidor del plugin por directorio, cargada al entrar la TUI en él;
  - `context.location` de la TUI que cambia al saltar a una sesión de otro directorio, y rutas `home` con `location`;
  - `ctx.worktree.transform` con `add` de una estrategia, y `worktree.create` y `remove` que la usan, como la TUI, la web y el modelo;
  - `keymap.dispatch` con `session.move` y `dialog.move_session.new`, que abre el diálogo de nombre y, al confirmarlo, crea el worktree y una sesión en él;
  - un remoto git local (repositorio desnudo) y la opción de dejarlo inaccesible;
  - respuestas del modelo que hacen checkout dentro de una sesión.

  Los escenarios y `core-tests` que no cambian de comportamiento siguen en verde.
- [x] 1.2 En `acceptance-tests/support/autopilot.js` y `support/branches.js`: preparar worktrees, ramas sacadas en otro directorio, el remoto y su rama de origen; leer la rama de cada directorio, los avisos y las opciones del modal.
- [x] 1.3 Ejecutar la suite con los deltas del change. Los escenarios nuevos salen con pasos sin definir, y los de los requisitos modificados que cambian de comportamiento fallan; el resto pasa. Anotar aquí el recuento.
  - Recuento: 221 escenarios, 194 pasan, 25 con pasos sin definir y 2 fallan («El plugin no actúa» en la rama de origen y «En la rama de origen no se arranca nada»: el plugin todavía crea la sesión operativa en la rama permanente).

## 2. Núcleo puro (zona de código), con `core-tests`

- [x] 2.1 `lib/worktree.mjs` (D5): `create`, `remove` y `list` de la estrategia sobre git, con la rama de origen de `readPermanent`. Tests con repositorios reales y un remoto desnudo en `core-tests/autopilot-worktree.test.js`:
  - rama nueva desde `origin/<rama de origen>`, `--no-track`, y push sin argumentos que crea `origin/<rama>`, sin cambiar `push.autoSetupRemote`;
  - rama existente;
  - rama sacada en otro directorio;
  - `fetch` fallido;
  - `branch` ignorado;
  - `remove` que conserva la rama y pide `forceRequired` con cambios.
- [x] 2.2 `lib/screen.mjs` (D3, D4): la directiva al entrar en una sesión (`toast`, checkout, `back`) y en una pantalla de inicio o una sesión nueva (`modal` con sus opciones según el árbol), con la ruta anterior. Tests en `core-tests/autopilot-product.test.js`.
- [x] 2.3 `lib/state.mjs` (D1): la rama de trabajo en la metadata, el cambio de rama detectado dentro de una sesión y el paso a `free`. Tests en `core-tests/autopilot-product.test.js`.

## 3. Ramas (zona de código): `openspec-change-lifecycle`

- [x] 3.1 «Volver a la rama de origen con el árbol limpio» y «No se vuelve con el árbol sucio»: pasos rojos; implementar el subcomando `origin` en `.agents/openspec/branch-change.mjs` (D7); verde. Ampliar `core-tests/branch-change.test.js`.

## 4. Servidor y TUI (zona de código): `openspec-autopilot`

- [x] 4.1 «Dónde actúa el plugin» y «Arranque de la sesión operativa» (modificados): pasos rojos; quitar `permanent` de `actionable()` para crear y arrancar (D8); verde.
- [x] 4.2 «La TUI habla con el plugin del directorio de la ventana»: paso rojo; ubicación por llamada y `hello` por directorio en `tui.js` (D2), con limpieza en `setup` (ADR-0011); verde.
- [x] 4.3 «Pasar a una sesión es pasar a su rama» (sus tres escenarios): pasos rojos; implementar D3 en `server.js` y `tui.js` (ruta anterior, checkout con `branch-change.mjs`, `back` y avisos); borrar los pasos del requisito retirado; verde.
- [x] 4.4 «Cada sesión tiene una rama de trabajo» (sus dos escenarios): pasos rojos; implementar D1 (detección en `screen`, `prompt` e `idle`, sin contar los checkouts del plugin) y la sesión que retoma el paso; verde.
- [x] 4.5 «Validación al volver a la sesión operativa» (modificado) sigue en verde con D1 y D3.
- [x] 4.6 «Una sesión nueva en una rama temporal con sesión operativa» (sus cuatro escenarios): pasos rojos; implementar D4 (modal, `keymap.dispatch` y vuelta a la sesión anterior, sin bucle); verde.
- [x] 4.7 «Los worktrees de OpenCode nacen en una rama» (sus cinco escenarios): pasos rojos; registrar la estrategia de D5 en `server.js`, con su limpieza (ADR-0011); verde.
- [x] 4.8 «En el ciclo del autopilot, el modelo no cambia de rama»: paso rojo; quitar `start` y `switch` del prompt del paso `new` en `lib/prompts.mjs` (D8); verde.
- [x] 4.9 «Funcionamiento sin TUI» (modificado): pasos rojos; implementar la tool `openspec_worktree` (D6) y el aviso que la ofrece en el contexto de las sesiones ajenas; verde. Resolver cómo conoce el servidor su dirección para el enlace (Open Questions del design) y anotarlo aquí.
  - Resuelto: OpenCode 2.3.2 no da al plugin la dirección con que se conectó el navegador, así que el enlace sale de la opción `serverUrl` del plugin en `opencode.json` (por ejemplo, `http://localhost:4096`). Sin ella, la tool devuelve el título y el id de la sesión. Queda por comprobar en la 7.4 si el contexto del plugin trae alguna dirección.
- [x] 4.10 Los escenarios que no cambian de comportamiento siguen en verde.

## 5. Documentación (zona de código)

- [x] 5.1 `.agents/skills/openspec-git-discipline/SKILL.md` (copia reescrita a propósito), a mano: en una sesión del autopilot, el modelo no crea ramas ni cambia de rama; fuera de él, como antes.
- [x] 5.2 `README.md`: «Automatizar el ciclo en OpenCode», con:
  - la rama de cada sesión;
  - los worktrees y su estrategia;
  - el modal de `/new`;
  - la web;
  - la recomendación de `worktree.symlinkDirectories`;
  - ADR-0022.
- [x] 5.3 `acceptance-tests/README.md`: lo nuevo del simulador y de `core-tests`.

## 6. Suite completa

- [x] 6.1 Ejecutar la suite completa con los deltas del change, `npm run test:core` y `npm run lint:specs`: todos los escenarios pasan, cero pasos pendientes o sin definir, informe HTML generado. Ejecutar `openspec validate autopilot-rama-por-sesion --type change --strict`.
  - Resultado (2026-11-22): 221 escenarios y 1157 pasos, todos en verde, sin pendientes ni sin definir, e informe HTML en `acceptance-tests/reports/`; `test:core`, 119 de 119; `lint:specs`, sin errores. `openspec validate` sin `--strict` da el change por válido; con `--strict`, ningún `[ERROR]` y 43 avisos de los tipos que ya dan las specs vigentes, como en los changes anteriores: 28 escenarios en bloques `gherkin` sin WHEN/GIVEN ni THEN, 11 requisitos con «DEBE» en lugar de SHALL/MUST y 4 de más de 500 caracteres.
  - Al ejecutar `test:core` salió intermitente «two sessions taking control at once» (también con el plugin anterior, 1 de cada 6): la sesión que toma el control podía comprobar antes de que otra que lo tomaba a la vez escribiera su metadata. El plugin comprueba ahora otra vez tras una pausa breve (`lostTo` en `server.js`); 10 de 10.

## 7. Pruebas end-to-end en OpenCode 2.3.2 real (fuera del repositorio)

Con el banco del design: clon desechable de esta rama, TUI `--standalone` en tmux, web con Playwright y una contraseña de servidor, y un remoto desnudo local. Anotar aquí cada resultado; lo que no se pueda automatizar queda como verificación manual pendiente, con sus pasos.

Estado (2026-11-22): en la sesión que implementó las secciones 1 a 6 no había OpenCode 2.3.2, porque se buscó en `opencode-ai` (1.19.6). La serie 2 se publica en npm como `@opencode/cli` (lección 9 de `.wiki/raw/notes/2026-11-21-ll-sesiones-opencode-autopilot.md`). Ejecutadas el mismo día con `@opencode/cli@2.3.2`, con el banco de arriba. El clon desechable tiene como `main` esta rama, y el remoto desnudo tiene un commit más en `main` que el clon, para comprobar el `fetch`. El proveedor falso responde con la llamada a tool `@@TOOL <nombre> <json>` y con `@@SLOW <s>` tarda. La web se manejó por su API HTTP (`opencode api`, la misma `POST /api/worktree` que el botón) y Playwright solo abrió el enlace. 7.2 y 7.3 pasan; 7.1, 7.4 y 7.5 encuentran fallos, anotados en cada una.

- [ ] 7.1 TUI: crear un worktree desde «Manage workspaces» (con nombre escrito y generado con `tab`) y desde el modal de `/new`; comprobar la rama, su origen y el primer push.
  - Pasos: en `main`, «Manage workspaces → New worktree» con el nombre `prueba-a` y otro generado con `tab`; en una rama temporal con sesión operativa, `/new` y «Crear un worktree nuevo». En cada uno: `git status -sb` da la rama con el nombre del worktree, sin upstream; `git rev-parse HEAD` es el de `origin/main` tras el fetch; un commit y `git push` sin argumentos crean `origin/<rama>`; `git config --get push.autoSetupRemote` sigue igual. Al entrar en el worktree, la TUI pasa a una sesión operativa que arranca `openspec-new-change`.
  - Resultado: falla. Lo que pasa:
    - `prueba-a` (escrito), `quick-meadow` (generado con `tab`) y `desde-modal` (desde el modal): cada uno en su rama, desde el `origin/main` del `fetch` (`59ab042`, que el clon no tenía). El primer `git push` sin argumentos crea `origin/<rama>`, y `push.autoSetupRemote` sigue sin definir. Antes del push, `status -sb` da `[origin/<rama>: gone]`, no «sin upstream», porque `branch.<rama>.merge` ya está puesto. Cada worktree tiene su sesión operativa, que arranca `openspec-new-change`.
    - **Fallo 1 (`session-bootstrap`).** Al crear `prueba-a`, `prepare_git` de `.agents/hooks/session-bootstrap.sh`, al arrancar en el worktree, adelantó con `update-ref` el `main` del clon, sacado en el directorio principal. Solo se salta la rama sacada en su propio worktree. El índice y el árbol del clon se quedaron en el commit anterior: `git status` daba `D  bench-upstream.txt` en el stage. Hay que saltar también las ramas sacadas en cualquier worktree (`git worktree list --porcelain`).
    - **Fallo 2 (modal).** «Crear un worktree nuevo» abre «Manage workspaces», pero no «Name worktree»: el segundo `keymap.dispatch` llega antes de que el diálogo esté montado. Con una pausa de 200 ms entre los dos (`tui.js:142`), se abre.
    - **Discrepancia (design, punto 3).** `/new` desde una sesión de un worktree abre la pantalla de inicio del directorio principal (`repo:<rama>`), no la del worktree, así que en un worktree el modal no sale.
    - **Discrepancia (punto 6).** Desde la pantalla de inicio, confirmar el nombre deja «(new worktree)» y no crea nada hasta el primer mensaje, que cae en una sesión libre del worktree. Desde una sesión se crea al confirmar.
    - **Carrera (`autopilot`).** De dos arranques con `autopilot` en la pantalla de inicio, en uno la sesión quedó con `role: free` y `phase: running`, sin dueña en la rama. Al entrar la TUI en la sesión nueva, `trackBranch` (desde `screen`) la vio sin metadata y escribió `role: 'free'` sobre la que el hook `prompt` acababa de poner `owner`.
- [x] 7.2 TUI: saltar entre la sesión de la rama de origen y la operativa de un worktree, y entre dos sesiones del mismo directorio (checkout, árbol sucio, otra sesión trabajando).
  - Pasos: desde una sesión de `main`, entrar en la operativa del worktree (aviso con rama y directorio, sin checkout, y la barra con `<directorio>:<rama>`); volver a la de `main`. En el mismo directorio, entrar en la operativa de otra rama con el árbol limpio (checkout y aviso), con un cambio sin commit (vuelve a la sesión anterior con el aviso) y con otra sesión del directorio trabajando (vuelve con el aviso). Comprobar que la parte de TUI llama a la instancia del worktree (el log del plugin del worktree recibe `screen`).
  - Resultado: pasa. Entrar en una sesión de otro directorio da el aviso «estás en la rama <rama>, en su directorio (<dir>)», sin checkout, y la barra con `<directorio>:<rama>`; el aviso lo calcula la instancia de ese directorio. En el mismo directorio:
    - con el árbol limpio, hace el checkout y avisa: «estás en la rama exportar-datos tras un checkout»;
    - con un cambio sin commit, vuelve a la sesión anterior y no cambia de rama: «no se cambia a la rama importar-datos de esta sesión: el directorio (…) tiene cambios sin commit…»;
    - con otra sesión del directorio trabajando, vuelve igual: «hay una sesión trabajando en ese directorio («nuevo change»). Espera a que termine, o usa un worktree».
- [x] 7.3 TUI: un checkout dentro de la sesión operativa (merge asistido) y la vuelta a la rama, que retoma el paso.
  - Pasos: en la sesión operativa a mitad de una task, pedir al modelo `git checkout main`; al quedar en reposo, la metadata de la sesión tiene `branch: main`, `role: free` y `leftFrom: <rama>`, sin archivarse. Volver a la rama (`git checkout <rama>`) y recuperar el foco de la TUI en la pantalla de inicio: se crea una sesión operativa que retoma esa task, y la anterior queda con `resumed: true`.
  - Resultado: pasa, con el paso `new` en lugar de una task. El modelo ejecuta `git checkout main` con la tool `shell`; en reposo, la sesión tiene `branch: main`, `role: free`, `phase: left` y `leftFrom: exportar-datos`, sin archivar. Tras `git checkout exportar-datos` y la pantalla de inicio (`/new`), se crea una sesión operativa con el mismo paso y `seq`, y la anterior queda con `resumed: true`.
- [ ] 7.4 Web: crear un worktree con su botón y pidiéndoselo al modelo; comprobar la sesión operativa nueva y el enlace o el título y el id.
  - Pasos: en la web, el botón de crear worktree (con y sin referencia de partida): la rama es la del nombre y la referencia se ignora. En una sesión ajena de una rama temporal con sesión operativa, el modelo ofrece el worktree; al pedírselo, llama a `openspec_worktree`, y existe una sesión del worktree operativa de su rama que arranca `openspec-new-change`. Sin `serverUrl`, el modelo da título e id; con `serverUrl`, el enlace `/server/<base64>/session/<id>` abre esa sesión. Comprobar también si el contexto del plugin trae la dirección del servidor (task 4.9), y si `ctx.session.create` acepta `location: { directory }` para crear la sesión en el worktree.
  - Resultado: falla. Lo que pasa:
    - `POST /api/worktree` con `branch` (una referencia en otro commit) o sin ella: la rama es la del nombre, desde `origin/main`, y la referencia se ignora.
    - En una sesión ajena de una rama temporal con sesión operativa, el contexto nombra la operativa y ofrece `openspec_worktree`.
    - **Fallo 3 (`openspec_worktree`).** La tool no crea nada: «Missing key at ["projectID"]». OpenCode 2.3.2 no tiene `ctx.project`; el proyecto está en `ctx.location.project.id` (`server.js:851`). Con el `projectID` tomado de ahí, crea el worktree en su rama y, en él, la sesión operativa que arranca `openspec-new-change`. Sin `serverUrl`, da título e id; con `serverUrl` (opción del plugin en la configuración global), el enlace `/server/<base64>/session/<id>`, que en la web, tras conectar con la contraseña, abre esa sesión.
    - El contexto del plugin no trae la dirección del servidor: solo `options.serverUrl`, si se da. `session.create` acepta `location: { directory }` (`SessionCreateInput` de `@opencode/client` 2.3.2).
- [ ] 7.5 Recarga en caliente del plugin: la estrategia no se duplica, y al descargar el plugin OpenCode vuelve a la estrategia git.
  - Pasos: con la TUI abierta, tocar `server.js` para que OpenCode recargue el plugin dos veces y crear un worktree: nace en su rama, una sola vez. Quitar el plugin (`"plugins": ["-openspec-autopilot"]`) y crear otro: nace con HEAD separado (la estrategia git). Comprobar que `remove` de un worktree con cambios pide confirmación para forzar (`forceRequired`).
  - Resultado: falla. Lo que pasa:
    - Tras dos recargas, `recarga-a` nace en su rama, una sola vez.
    - Con `"plugins": ["-openspec-autopilot"]` y «Reload configuration», `sin-plugin` nace con HEAD separado.
    - **Fallo 4 (`remove`).** Quitar cualquier worktree desde la TUI falla con «not a git repository». OpenCode llama a `remove` solo con `{ directory, force }`, y la estrategia ejecuta git en `path.dirname(directory)` (`lib/worktree.mjs:102`). Con `cwd = sourceDirectory ?? directory`, git da «contains modified or untracked files», que la estrategia convierte en `forceRequired`.
    - **Fallo 5 (`forceRequired`).** Aun así, la TUI no pide confirmación: muestra «Failed to delete worktree… Uncommitted changes». OpenCode solo conserva `forceRequired` si el error es de sus propias clases (`instanceof`, leído en el binario), y la estrategia lanza una imitación. El plugin no puede importar `@opencode/schema` («Cannot find package»), y una copia de npm no pasaría `instanceof`. Hay que cambiar el escenario «Quitar un worktree conserva su rama» o el mensaje: con cambios, decir que se haga el commit o se quite con `git worktree remove --force`.

## 8. Correcciones de las pruebas en OpenCode real (zona de código)

Cada una sigue el ciclo de las secciones 3 a 5: rojo por la razón esperada, implementar, verde y commit.

- [ ] 8.1 Simulador (D9): el contexto con `location.project` y sin `project`; `remove` con solo `{ directory, force }` y los errores de la estrategia envueltos sin `forceRequired`; `dialog.move_session.new` sin efecto hasta que «Manage workspaces» esté montado; el worktree de la pantalla de inicio creado con el primer mensaje en una sesión que lo contiene. Anotar qué escenarios y `core-tests` pasan a rojo.
- [ ] 8.2 `session-bootstrap`, «Una rama sacada en otro directorio del clon no se toca»: paso rojo; en `prepare_git`, saltar las ramas sacadas según `git worktree list --porcelain` (D11); verde. Ampliar `core-tests/prepare-git.test.js` con un worktree.
- [ ] 8.3 «Quitar un worktree conserva su rama» y «Con cambios sin commit no se quita»: pasos rojos; en `lib/worktree.mjs`, `remove` en `sourceDirectory ?? directory` y el mensaje con el commit o `git worktree remove --force` (D5); verde. Ampliar `core-tests/autopilot-worktree.test.js` con `remove` sin `sourceDirectory`.
- [ ] 8.4 «Sin TUI, el modelo crea un worktree con su sesión operativa» en rojo con el contexto real; `projectID` de `ctx.location.project.id` o de la sesión que llama (D6); verde.
- [ ] 8.5 «Crear un worktree nuevo desde el modal» en rojo con el diálogo que tarda en montarse; pausa y reintento entre los dos `dispatch` en `tui.js` (D4); verde.
- [ ] 8.6 «El primer mensaje de un worktree nuevo es la descripción del change»: paso rojo; ruta en `hello` y descripción de la sesión de OpenCode (D10); verde.
- [ ] 8.7 La carrera de D1: un `core-test` en el que `screen` y `prompt` (`autopilot`) llegan a la vez sobre una sesión nueva, que falla de forma reproducible; `trackBranch` decide con la sesión que acaba de leer y no escribe `role` si ya lo tiene; verde.
- [ ] 8.8 `README.md`: quitar un worktree con cambios, el primer mensaje del worktree desde la pantalla de inicio, `/new` desde un worktree y la opción `serverUrl`. `acceptance-tests/README.md`: lo nuevo del simulador.
- [ ] 8.9 Suite completa con los deltas, `npm run test:core`, `npm run lint:specs` y `openspec validate autopilot-rama-por-sesion --type change --strict`.
- [ ] 8.10 Repetir en OpenCode 2.3.2 real lo que falló en 7.1, 7.4 y 7.5, con el mismo banco, y anotar el resultado aquí; marcar 7.1, 7.4 y 7.5 si pasan.

## 9. Cierre

- [ ] 9.1 Revisar que todas las tasks están marcadas y que la suite y `core-tests` siguen en verde.
