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

- [ ] 2.1 `lib/worktree.mjs` (D5): `create`, `remove` y `list` de la estrategia sobre git, con la rama de origen de `readPermanent`. Tests con repositorios reales y un remoto desnudo en `core-tests/autopilot-worktree.test.js`:
  - rama nueva desde `origin/<rama de origen>`, `--no-track`, y push sin argumentos que crea `origin/<rama>`, sin cambiar `push.autoSetupRemote`;
  - rama existente;
  - rama sacada en otro directorio;
  - `fetch` fallido;
  - `branch` ignorado;
  - `remove` que conserva la rama y pide `forceRequired` con cambios.
- [ ] 2.2 `lib/screen.mjs` (D3, D4): la directiva al entrar en una sesión (`toast`, checkout, `back`) y en una pantalla de inicio o una sesión nueva (`modal` con sus opciones según el árbol), con la ruta anterior. Tests en `core-tests/autopilot-product.test.js`.
- [ ] 2.3 `lib/state.mjs` (D1): la rama de trabajo en la metadata, el cambio de rama detectado dentro de una sesión y el paso a `free`. Tests en `core-tests/autopilot-product.test.js`.

## 3. Ramas (zona de código): `openspec-change-lifecycle`

- [ ] 3.1 «Volver a la rama de origen con el árbol limpio» y «No se vuelve con el árbol sucio»: pasos rojos; implementar el subcomando `origin` en `.agents/openspec/branch-change.mjs` (D7); verde. Ampliar `core-tests/branch-change.test.js`.

## 4. Servidor y TUI (zona de código): `openspec-autopilot`

- [ ] 4.1 «Dónde actúa el plugin» y «Arranque de la sesión operativa» (modificados): pasos rojos; quitar `permanent` de `actionable()` para crear y arrancar (D8); verde.
- [ ] 4.2 «La TUI habla con el plugin del directorio de la ventana»: paso rojo; ubicación por llamada y `hello` por directorio en `tui.js` (D2), con limpieza en `setup` (ADR-0011); verde.
- [ ] 4.3 «Pasar a una sesión es pasar a su rama» (sus tres escenarios): pasos rojos; implementar D3 en `server.js` y `tui.js` (ruta anterior, checkout con `branch-change.mjs`, `back` y avisos); borrar los pasos del requisito retirado; verde.
- [ ] 4.4 «Cada sesión tiene una rama de trabajo» (sus dos escenarios): pasos rojos; implementar D1 (detección en `screen`, `prompt` e `idle`, sin contar los checkouts del plugin) y la sesión que retoma el paso; verde.
- [ ] 4.5 «Validación al volver a la sesión operativa» (modificado) sigue en verde con D1 y D3.
- [ ] 4.6 «Una sesión nueva en una rama temporal con sesión operativa» (sus cuatro escenarios): pasos rojos; implementar D4 (modal, `keymap.dispatch` y vuelta a la sesión anterior, sin bucle); verde.
- [ ] 4.7 «Los worktrees de OpenCode nacen en una rama» (sus cinco escenarios): pasos rojos; registrar la estrategia de D5 en `server.js`, con su limpieza (ADR-0011); verde.
- [ ] 4.8 «En el ciclo del autopilot, el modelo no cambia de rama»: paso rojo; quitar `start` y `switch` del prompt del paso `new` en `lib/prompts.mjs` (D8); verde.
- [ ] 4.9 «Funcionamiento sin TUI» (modificado): pasos rojos; implementar la tool `openspec_worktree` (D6) y el aviso que la ofrece en el contexto de las sesiones ajenas; verde. Resolver cómo conoce el servidor su dirección para el enlace (Open Questions del design) y anotarlo aquí.
- [ ] 4.10 Los escenarios que no cambian de comportamiento siguen en verde.

## 5. Documentación (zona de código)

- [ ] 5.1 `.agents/skills/openspec-git-discipline/SKILL.md` (copia reescrita a propósito), a mano: en una sesión del autopilot, el modelo no crea ramas ni cambia de rama; fuera de él, como antes.
- [ ] 5.2 `README.md`: «Automatizar el ciclo en OpenCode», con:
  - la rama de cada sesión;
  - los worktrees y su estrategia;
  - el modal de `/new`;
  - la web;
  - la recomendación de `worktree.symlinkDirectories`;
  - ADR-0022.
- [ ] 5.3 `acceptance-tests/README.md`: lo nuevo del simulador y de `core-tests`.

## 6. Suite completa

- [ ] 6.1 Ejecutar la suite completa con los deltas del change, `npm run test:core` y `npm run lint:specs`: todos los escenarios pasan, cero pasos pendientes o sin definir, informe HTML generado. Ejecutar `openspec validate autopilot-rama-por-sesion --type change --strict`.

## 7. Pruebas end-to-end en OpenCode 2.3.2 real (fuera del repositorio)

Con el banco del design: clon desechable de esta rama, TUI `--standalone` en tmux, web con Playwright y una contraseña de servidor, y un remoto desnudo local. Anotar aquí cada resultado; lo que no se pueda automatizar queda como verificación manual pendiente, con sus pasos.

- [ ] 7.1 TUI: crear un worktree desde «Manage workspaces» (con nombre escrito y generado con `tab`) y desde el modal de `/new`; comprobar la rama, su origen y el primer push.
- [ ] 7.2 TUI: saltar entre la sesión de la rama de origen y la operativa de un worktree, y entre dos sesiones del mismo directorio (checkout, árbol sucio, otra sesión trabajando).
- [ ] 7.3 TUI: un checkout dentro de la sesión operativa (merge asistido) y la vuelta a la rama, que retoma el paso.
- [ ] 7.4 Web: crear un worktree con su botón y pidiéndoselo al modelo; comprobar la sesión operativa nueva y el enlace o el título y el id.
- [ ] 7.5 Recarga en caliente del plugin: la estrategia no se duplica, y al descargar el plugin OpenCode vuelve a la estrategia git.

## 8. Cierre

- [ ] 8.1 Revisar que todas las tasks están marcadas y que la suite y `core-tests` siguen en verde.
