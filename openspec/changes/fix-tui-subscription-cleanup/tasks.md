# Tasks: fix-tui-subscription-cleanup

La suite ya existe (`acceptance-tests/`, `stack: javascript`), así que no hace falta montarla. Cada task de las secciones 2 y 3 sigue el mismo ciclo: el escenario falla por la razón esperada, se implementa, pasa y se hace commit. Los commits no mezclan `openspec/` con el resto, salvo este `tasks.md`.

## 1. Simuladores: el contrato de limpieza de OpenCode 2.3.2 (zona de código)

- [x] 1.1 En `acceptance-tests/support/agents/opencode-sim.mjs`, según D3:
  - guardar la función que devuelve cada `setup`, de servidor y de TUI;
  - en la recarga, ejecutar las limpiezas de la carga anterior antes de los `setup` nuevos;
  - hacer que `events.on` respete `{ signal }` y devuelva una función para darse de baja;
  - añadir la operación de cerrar la TUI con su propio servidor. Ejecuta las limpiezas, cierra el servidor y registra como traza en el terminal cada suscripción viva y lo que el plugin escriba en `console.error` durante el cierre;
  - exponer las suscripciones vivas por carga, para las aserciones;
  - cambiar la cabecera: los escuchadores sobreviven a una recarga solo si el plugin no los libera.

  Los escenarios y `core-tests` que ya existen siguen en verde.
- [x] 1.2 En `acceptance-tests/support/agents/opencode-host.mjs`, según D3:
  - opciones para recargar la parte de TUI un número de veces;
  - emitir después por el RPC del plugin un aviso sintético con un índice nuevo;
  - cerrar con su propio servidor, con el mismo registro de trazas que 1.1.

  La cabecera dice que aquí la recarga es solo de la TUI y que el aviso es sintético. Los escenarios de `session-bootstrap` que ya existen siguen en verde.
- [x] 1.3 Ejecutar la suite con los deltas del change: los cinco escenarios nuevos salen con pasos sin definir y el resto pasa.

## 2. openspec-autopilot (zona de código): por escenario, rojo → implementar → verde → commit

- [x] 2.1 "Tras recargar, solo recibe eventos la carga nueva": definir los pasos y ver que falla con el `tui.js` actual, con las tres cargas suscritas. Implementar D1 en `.opencode/plugins/openspec-autopilot/tui.js`: un `AbortController` por carga, su `signal` en los dos `events.on` y `setup` que devuelve `() => controller.abort()` siempre, fuera del `try`.
- [x] 2.2 "Al cerrar la TUI no queda ningún error", con sus dos ejemplos: definir los pasos y ver que fallan sin 2.1, con el cambio guardado en un stash o revertido temporalmente. Después, ver que pasan con 2.1.
- [ ] 2.3 En `core-tests/autopilot-plugin.test.js`:
  - `setup` devuelve la limpieza también si `context.client.rpc` lanza, y la limpieza no lanza;
  - el test "a hot reload does not duplicate navigations, dialogs or archivings" sigue pasando, ahora con las cargas viejas sin suscripciones.

## 3. session-bootstrap (zona de código): por escenario, rojo → implementar → verde → commit

- [ ] 3.1 "Tras recargar, cada aviso nuevo se muestra una vez": definir los pasos y ver que falla con el `tui.js` actual, con el toast repetido una vez por cada carga viva. Anotar aquí si se confirma el duplicado, que el design deduce del código. Implementar D1 en `.opencode/plugins/session-bootstrap/tui.js`.
- [ ] 3.2 "Al cerrar la TUI no queda ningún error": definir los pasos y ver que falla sin 3.1 y pasa con 3.1.

## 4. Documentación (zona de código)

- [ ] 4.1 En `acceptance-tests/README.md`:
  - cambiar la descripción de las recargas (los escuchadores sobreviven solo si el plugin no los libera);
  - añadir el cierre con su propio servidor, las trazas en el terminal y las opciones nuevas del host;
  - añadir los casos nuevos de `core-tests`.

## 5. Cierre

- [ ] 5.1 Ejecutar la suite completa con los deltas del change, y `npm run test:core`: todos los escenarios pasan, cero pasos pendientes o sin definir, informe HTML generado.
- [ ] 5.2 Probar con OpenCode 2.3.2 real, fuera del repositorio. Usar una copia del proyecto de la rama, con la TUI `--standalone` manejada por un pseudoterminal de Python. Comprobar:
  - al cerrar enseguida, no sale ninguna traza `ECONNRESET`;
  - tras dos recargas en caliente, editando `tui.js` con un plugin sonda, solo la carga nueva recibe eventos;
  - el autopilot sigue navegando y mostrando avisos tras una recarga.

  Anotar aquí el resultado.
- [ ] 5.3 Ejecutar `openspec validate fix-tui-subscription-cleanup --type change --strict`: ningún error. Los avisos que queden son los mismos tipos que ya da `openspec validate --specs --strict`: requisitos con "DEBE" y pasos en bloques `gherkin`.
- [ ] 5.4 Commit de la zona de código pendiente, sin archivos de `openspec/`.
- [ ] 5.5 Archivar `fix-tui-subscription-cleanup` en su rama temporal, en un commit propio sin archivos de la zona de código. Después, resincronizar el wiki en un commit aparte, que propone al usuario:
  - corregir la regla de la lección 5;
  - corregir el artículo `ciclo-de-un-change-y-autopilot.md`;
  - registrar el contrato de limpieza de `setup` y el `signal` de `events.on`;
  - registrar cómo manejar la TUI con un pseudoterminal;
  - añadir al registro de vigilancia `volver-a-comprobar-apis-de-sesion-al-subir-opencode` las dos pruebas de 5.2.
