# Tasks: autopilot-sesion-operativa

La suite ya existe (`acceptance-tests/`, `stack: javascript`), así que no hace falta montarla. Cada task de las secciones 3 a 6 sigue el mismo ciclo: el escenario falla por la razón esperada, se implementa, pasa y se hace commit. Los commits no mezclan `openspec/` con el resto, salvo este `tasks.md`. Los pasos de los escenarios retirados ("Qué pasa al abrir una sesión a mano", "Revisión humana guiada en el modo normal") se borran en la task que implementa su sustituto.

## 1. Simulador y host (zona de código)

- [x] 1.1 En `acceptance-tests/support/agents/opencode-sim.mjs`, según D15:
  - el hook `prompt` (`{ sessionID, messageID, prompt: { text }, delivery }`, texto mutable), que corre antes de los `context` con cada mensaje de usuario, también con los de `session.prompt`;
  - rutas de pantalla propias (`ui.router.current()` ya no sale de las navegaciones), y las operaciones de abrir la pantalla de inicio, saltar a una sesión, quitar y devolver el foco, y escribir el primer mensaje desde la pantalla de inicio, que crea la sesión;
  - `renderer.on/off('focus' | 'blur')`;
  - `ui.dialog.select` con respuesta Enter (el valor) o Esc (`undefined`), y `alert`;
  - la presentación de la TUI con un PID: el arranque es un proceso nuevo y la recarga conserva el PID; la opción de cargar la TUI antes de que el servidor registre su RPC (`rpc.unavailable`);
  - un cliente sin TUI (`tui: false`) que escribe en sesiones;
  - respuestas del modelo con efectos (`files`: escribir o borrar rutas del proyecto; `git`: órdenes de git) antes del texto o la tool.

  Los escenarios y `core-tests` que no cambian de comportamiento siguen en verde.
- [x] 1.2 En `acceptance-tests/support/autopilot.js` y `support/branches.js`: preparar el change, el stage y el árbol (commit, sacar del stage, sucio), y leer el stage de git, los modales y las directivas que recibe la TUI.
- [x] 1.3 Ejecutar la suite con los deltas del change. Los escenarios nuevos salen con pasos sin definir, y los de los requisitos retirados o modificados que cambian de comportamiento fallan; el resto pasa. Anotar aquí el recuento.
  - Resultado: no se ejecutó una fase en rojo aislada antes de implementar: el simulador, los pasos y el plugin se escribieron juntos. La primera ejecución de la suite completa con los deltas dio 162 escenarios: 156 en verde, 3 ambiguos (un paso duplicado) y 3 fallos; uno de ellos era un bug real del plugin (la validación de la pantalla tomaba por inválida la sesión del paso `new` en cuanto existía su change y creaba otra operativa), corregido en `validFor`.

## 2. Núcleo puro del plugin (zona de código), con `core-tests`

- [x] 2.1 `lib/git.mjs` (D8): estado (`clean`, `staged`, `unstaged`), firma, veredicto (`ok`, `ko` o `continue`) y stage (`add -A` o por rutas). Tests con repositorios reales en `core-tests/autopilot-git.test.js`.
  - Resultado: los tests de git, del producto y de la pantalla quedaron juntos en `core-tests/autopilot-product.test.js`. El veredicto se afinó al concretar el stage por producto: ok es HEAD avanzado y nada en el stage, y ko es HEAD igual, nada en el stage y cambios en el árbol (design D8, actualizado).
- [x] 2.2 `lib/product.mjs` (D7, D11): foto, producto por tipo de paso, cola de revisiones en el orden del schema y rutas de stage por artefacto. Tasks con el id del CLI y la etiqueta de `tasks.md`; `parseTasks` con los mismos ids. Tests en `core-tests/autopilot-product.test.js`.
- [x] 2.3 `lib/next-step.mjs` (D9, D10): ok y ko por git, cola, `update` → revisión del plan, esperas de commit (arranque sucio, cambio de zona en auto, tras archive y tras wiki) y verify por veredicto; se retira `needsConfirmation`. Actualizar `core-tests/autopilot-next-step.test.js`.
  - Resultado: la discrepancia con `openspec status` (D5) quedó en `lib/next-step.mjs` (`discrepancy`), junto al paso siguiente.
- [x] 2.4 `lib/screen.mjs` (D4, D5): la directiva de cada pantalla (modal, validación o nada) y la discrepancia con `openspec status`. Tests en `core-tests/autopilot-screen.test.js`.
  - Resultado: tests en `core-tests/autopilot-product.test.js`.

## 3. Ramas (zona de código): `openspec-change-lifecycle`

- [x] 3.1 "Crear la rama del change desde cualquier rama" y "No se crea la rama con el árbol sucio": pasos rojos; implementar `start` en `.agents/openspec/branch-change.mjs` (D12); verde.
- [x] 3.2 "Listar las ramas temporales con su change" y "Cambiar a otra rama temporal": pasos rojos; implementar `list` y `switch`; verde. Ampliar `core-tests/branch-change.test.js`.
- [x] 3.3 "En el autopilot, el modelo no pide commits" y "Un artefacto terminado queda sin commit": pasos rojos; reescribir los prompts de `lib/prompts.mjs` (D6) sin peticiones de commit; verde.

## 4. Servidor: producto, revisión por git y encadenado (zona de código): `openspec-autopilot`

- [x] 4.1 "Verificación por producto" (sus cinco escenarios): pasos rojos; implementar en `server.js` la foto al empezar el paso, la evaluación en `experimental.idle`, el rechazo de `openspec_handoff` sin producto, el stage y la cola; verde.
- [x] 4.2 "Una sesión por paso" (sus tres escenarios): arrancar los pasos con `session.prompt` y el recordatorio del hook `context` (D6); verde.
- [x] 4.3 "Revisión humana cerrada por git en el modo normal" e "Índice de sesiones para openspec-update-change": pasos rojos; implementar el cierre en el hook `prompt` (D8), las conclusiones y la revisión del verify (D10); quitar el diálogo de confirmación; verde.
- [x] 4.4 "Árbol limpio al empezar un paso" y "Modo auto": pasos rojos; implementar las esperas de commit (D9) y el modo auto por producto; verde.
- [x] 4.5 Los escenarios que no cambian de comportamiento ("Lecciones candidatas…", "Aviso tras compactar…", "El plugin nunca bloquea OpenCode") siguen en verde con el servidor nuevo.

## 5. Sesión operativa (zona de código): `openspec-autopilot`

- [x] 5.1 "Una sola sesión con el control del change" y "Dónde actúa el plugin": pasos rojos; implementar D2 (sesión operativa válida; sin tomar el control en sesiones nuevas); verde.
- [x] 5.2 "Arranque de la sesión operativa": pasos rojos; implementar D3 en `hello` (PID en `globalThis`, arranque y recarga); verde.
- [x] 5.3 "Las ventanas ajenas llevan a la sesión operativa": pasos rojos; implementar `screen` en el servidor y, en `tui.js`, la consulta de la ruta cada 300 ms, el foco, el modal de un botón con navegación al cerrar y la protección contra el bucle (D4), con limpieza en `setup` (ADR-0011); verde.
- [x] 5.4 "Validación al volver a la sesión operativa": pasos rojos; implementar D5; verde.
- [x] 5.5 "Funcionamiento sin TUI": pasos rojos; implementar D13 (sin `tui.ready()` en la lógica, aviso en el contexto de las sesiones ajenas, `archivePending` y arranque con `autopilot`); verde.
- [x] 5.6 "La TUI se presenta sin errores": paso rojo; implementar el reintento de D14 en `openspec-autopilot/tui.js` y en `session-bootstrap/tui.js`; verde.
- [x] 5.7 "La TUI libera sus suscripciones" sigue en verde, con el temporizador y el foco liberados. Ampliar `core-tests/autopilot-plugin.test.js` con la limpieza del temporizador y del foco.
  - Resultado: las secciones 4 y 5 se implementaron juntas en `server.js` y `tui.js` y van en un solo commit, porque la sesión operativa y el producto comparten el mismo flujo. Con todo, los 55 escenarios del change y los 162 de la suite completa pasan.

## 6. Documentación (zona de código)

- [x] 6.1 `.claude/skills/openspec-git-discipline/SKILL.md` (copia reescrita a propósito, ADR-0012), a mano:
  - el modelo crea la rama con `branch-change.mjs start` o cambia con `switch`/`list`;
  - en el autopilot no pide commits;
  - fuera de él, los pide como antes;
  - se actualizan las señales de alarma.
- [x] 6.2 `README.md`: "El ciclo de un change" y "Automatizar el ciclo en OpenCode":
  - sesión operativa, producto, revisión por git y modo auto;
  - UI web, OpenCode Desktop y `opencode run`, con su degradación;
  - ADR-0012 y ADR-0013.
- [x] 6.3 `acceptance-tests/README.md`: lo nuevo del simulador y de `core-tests`.

## 7. Suite completa

- [ ] 7.1 Ejecutar la suite completa con los deltas del change y `npm run test:core`: todos los escenarios pasan, cero pasos pendientes o sin definir, informe HTML generado.

## 8. Pruebas end-to-end en OpenCode 2.3.2 real (fuera del repositorio)

Las pruebas usan un clon desechable de esta rama fuera del repositorio, siempre con `alibaba/qwen3.8-flash` y sesiones con títulos `e2e:`. La TUI se maneja con el controlador de pseudoterminal del design. La web, con `playwright-core` instalado fuera del repo, Chrome del sistema y un enlace nuevo de `opencode pair` en cada ejecución, nunca `--remote`. Anotar aquí cada resultado; lo que no se pueda automatizar queda como verificación manual pendiente, con sus pasos.

- [ ] 8.1 TUI: arranque sin change (crea la sesión operativa y arranca `openspec-new-change`); arranque con change sin sesión operativa; recarga en caliente sin efectos; ausencia de los 400 de `hello` en el log.
- [ ] 8.2 TUI: ventana ajena con sesión operativa (`/new`, salto a otra sesión y recuperación del foco): modal de un botón, Enter y Esc llevan a la operativa, sin bucle.
- [ ] 8.3 TUI: un paso en el que el modelo hace de más; revisión ok (commit); revisión ko (todo fuera del stage, con el prompt como conclusiones).
- [ ] 8.4 Web: los mismos escenarios en lo que la web permite (arranque con `autopilot`, aviso en el contexto de una sesión ajena, producto y revisión, ok y ko por git, sesión siguiente en la lista, `archivePending`), con capturas.
- [ ] 8.5 Archivar todas las sesiones `e2e:` creadas.

## 9. Cierre

- [ ] 9.1 Revisar que todas las tasks están marcadas y que la suite y `core-tests` siguen en verde.
