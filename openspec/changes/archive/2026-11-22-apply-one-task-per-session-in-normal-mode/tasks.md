# Tasks: apply-one-task-per-session-in-normal-mode

La suite ya existe (`acceptance-tests/`, `stack: javascript`), así que la sección de montaje no hace falta. Cada task de pasos sigue el mismo ciclo: el escenario falla por la razón esperada, se implementa, pasa y se hace commit. Los commits no mezclan `openspec/` con el resto, salvo este `tasks.md`. El simulador de OpenCode ya carga el plugin con `options.auto` (`world.pluginOptions`).

## 1. Núcleo puro (zona de código), con `core-tests`

- [x] 1.1 `lib/apply-guidance.mjs` (D1, D2, D3): el bloque canónico de las cuatro indicaciones y `adjust(text, mode) -> { text, changed }`, con estos casos:
  - añadir al final de `operations.apply.guidance`, creando `guidance`, `apply` u `operations` si faltan;
  - quitar el bloque y podar las claves vacías;
  - no cambiar nada si el archivo ya está como pide el modo;
  - avisar (`similar: true`) si hay texto parecido al bloque que no se reconoce.

  Tests en `core-tests/apply-guidance.test.js`, con el `openspec/config.yaml` real del proyecto, para comprobar que el resto queda byte a byte igual y que añadir y luego quitar deja el archivo como estaba.
- [x] 1.2 `syncApplyGuidance(directory, mode)` (D4): lee, ajusta y escribe solo si cambia. Sin `config.yaml` no hace nada, y si falla la lectura o la escritura devuelve el error sin lanzarlo. Tests con un directorio temporal en el mismo archivo.

## 2. Pasos de aceptación (zona de código): «Indicaciones de apply según el modo»

- [x] 2.0 Versionar el bloque en el `openspec/config.yaml` del proyecto (D7, zona de specs, en un commit aparte), con el texto que da `adjust(text, 'normal')`. Así el modo por defecto no ensucia el árbol de un clon, y los escenarios que ya existían vuelven a pasar.

- [x] 2.1 «El archivo sigue al modo» (Scenario Outline, sus cuatro filas): escribir los pasos y verlos en rojo. Llamar a `syncApplyGuidance` en `start(ctx)` de `server.js`, dentro de `guard` y antes de registrar el RPC; avisar con un toast cuando escribe. Verde.

## 3. Pasos de aceptación (zona de código): «El ajuste de config.yaml no toca nada más»

- [x] 3.1 «Sin cambio de modo no se reescribe el archivo»: rojo → verde.
- [x] 3.2 «Otras indicaciones de apply se conservan» y «Sin indicaciones de apply previas no quedan claves vacías», con el cambio de modo como recarga del plugin en el simulador: rojo → verde.
- [x] 3.3 «El CLI de OpenSpec acepta el archivo en los dos modos», con el CLI real (`openspec instructions apply --change exportar-datos --json`): rojo → verde.
- [x] 3.4 «Sin config.yaml no se crea», con el toast de aviso y OpenCode funcionando: rojo → verde.

## 4. Revisión abierta (zona de código), D6

- [x] 4.1 Si `syncApplyGuidance` escribe, actualizar la firma de inicio (`review.git.signature`) de la revisión abierta de la rama. Test en `core-tests/autopilot-plugin.test.js`: una revisión del verify con el árbol limpio no se cierra como `ko` porque se recargue el plugin con otro modo, y un commit posterior la cierra como `ok`.

## 5. Documentación (zona de código)

- [x] 5.1 README, en «Modo auto»: en modo normal, el plugin añade a `openspec/config.yaml` las indicaciones de una task por sesión, y en modo auto las quita. El cambio queda sin commit, para que lo hagas tú aparte, y Claude Code lo lee como lo dejó la última carga. Enlazar ADR-0025.

## 6. Cierre

- [x] 6.1 Ejecutar la suite completa (`npm test`, `npm run test:core` y `npm run lint:specs` en `acceptance-tests/`): todos los escenarios en verde, sin pasos pendientes ni sin definir, y con el informe HTML generado.
  - Resultado (2026-11-22): 236 escenarios y 1253 pasos en verde (los 9 de este change incluidos), sin pasos pendientes ni sin definir, e informe HTML en `acceptance-tests/reports/cucumber-report.html`; `npm run test:core`, 177 en verde; `npm run lint:specs`, sin errores. En dos de las siete ejecuciones de la suite fallaron dos escenarios del autopilot, distintos cada vez y en verde por separado; el test de núcleo «two sessions taking control at once» también falla a veces en `main` (una de tres en un worktree de `origin/main`), así que son carreras de tiempos que ya existían.
- [x] 6.2 Ejecutar `openspec validate apply-one-task-per-session-in-normal-mode --type change --strict`.
  - Resultado: ningún `[ERROR]`. Quedan 8 avisos de los tipos que ya da `openspec validate --specs --strict`: requisitos con «DEBE» en lugar de SHALL/MUST, escenarios en bloques `gherkin` sin WHEN/GIVEN ni THEN y un requisito de más de 500 caracteres. Con `--strict`, el comando sale con 1 por esos avisos, como en los changes anteriores.
