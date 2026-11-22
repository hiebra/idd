# Tasks: autopilot-plan-explore

La suite ya existe (`acceptance-tests/`, `stack: javascript`), así que no hace falta montarla. Las tasks de las secciones 3 a 5 siguen el mismo ciclo: definir los pasos, ver que el escenario falla por la razón esperada, implementar, ver que pasa y hacer commit. Los commits no mezclan `openspec/` con el resto, salvo este `tasks.md`.

## 1. Comprobaciones con OpenCode 2.3.2 real, antes de implementar (fuera del repositorio)

- [ ] 1.1 Con el banco de la lección 9 (`.wiki/raw/notes/2026-11-21-ll-sesiones-opencode-autopilot.md`) y un plugin sonda, comprobar que la entrada del hook `context` trae el agente de la petición (`input.agent`), y que cambia con Tab entre `build` y `plan` en la misma sesión. Comprobar también que las peticiones que siguen a una tool, dentro del mismo turno, llevan el mismo agente. Anotar aquí el resultado. Si no llega, detenerse y actualizar el design (D2) con otra fuente del agente antes de seguir.
- [ ] 1.2 En el mismo banco, comprobar que una sesión con el agente plan puede cargar la skill `openspec-explore` con la tool `skill`. Anotar aquí el resultado. Si no puede, actualizar D3 para que el texto lleve el flujo resumido.
- [ ] 1.3 En el mismo banco, comprobar que la TUI puede tener abierto un `dialog.select` mientras el servidor espera la respuesta de una petición sin el límite corto de las demás (la operación `notice` de D5), y que una recarga en caliente con el modal abierto no deja la petición sin respuesta ni rompe la TUI. Anotar aquí el resultado.

## 2. Simulador (zona de código)

- [ ] 2.1 En `acceptance-tests/support/agents/opencode-sim.mjs` y `opencode-sim-process.mjs`, según D6:
  - la operación `notice` en la TUI simulada: muestra un modal que queda abierto hasta que el escenario lo cierra, y responde con `reply` al cerrarse;
  - poder cerrar ese modal desde el World y consultar los modales abiertos;
  - poder guionizar que el modelo escriba o modifique archivos en un turno con el agente plan.

  Los escenarios y `core-tests` que ya existen siguen en verde.
- [ ] 2.2 Ejecutar la suite con los deltas del change: los escenarios nuevos salen con pasos sin definir o fallan por lo que el change cambia, y el resto pasa. Anotar aquí cuáles fallan, en particular los pasos que hoy comprueban que la revisión nace con el agente plan (`autopilot.steps.js`).

## 3. openspec-autopilot: las sesiones nacen en build (zona de código)

- [ ] 3.1 "Toda sesión del ciclo nace con el agente build", con sus dos ejemplos: definir los pasos y ver que falla para la revisión, que hoy nace con plan. Implementar D1: `WORKFLOW.review.agent` a `build` en `lib/prompts.mjs`. Cambiar las aserciones de `autopilot.steps.js` que esperan el agente plan en la revisión.
- [ ] 3.2 "El siguiente paso en una sesión nueva" y "La instrucción del paso sigue en los mensajes siguientes" siguen en verde con el requisito renombrado.

## 4. openspec-autopilot: el agente plan explora (zona de código)

- [ ] 4.1 En `lib/prompts.mjs`, según D3: `explorePrompt`, `exploreReminderPrompt`, `returnPrompt` y `planNoticeText`. En `core-tests/`, que cada texto nombra el paso o la revisión, que `explorePrompt` nombra la skill `openspec-explore` y que ninguno pide commits.
- [ ] 4.2 En un módulo puro (por ejemplo `lib/agent-turn.mjs`), según D2: la clave del turno a partir de los mensajes de la petición, sin contar los que llevan la marca del plugin, y la tabla de transiciones (`step`, `explore`, `explore-reminder`, `return`), con un agente ausente o desconocido tratado como build. Probarlo en `core-tests/` con varias peticiones del mismo turno.
- [ ] 4.3 "Pasar a plan carga el flujo de exploración", con sus dos ejemplos: definir los pasos y ver que falla con el recordatorio del paso de hoy. Implementar D2 en `onContext` de `server.js`, con `agentTurn` en la metadata (leer, combinar y escribir).
- [ ] 4.4 "Seguir en plan solo recuerda la exploración": rojo → verde.
- [ ] 4.5 "Volver a build solo recuerda el paso previo": rojo → verde. Comprobar que el plugin no añade mensajes a la sesión.
- [ ] 4.6 "Cada paso a plan vuelve a cargar la exploración": rojo → verde.
- [ ] 4.7 "En una sesión ajena, plan no carga la exploración": definir los pasos y ver que pasa sin cambios en el plugin; si falla, corregir `onContext` para que la rama de las sesiones ajenas no mire el agente.
- [ ] 4.8 En `core-tests/autopilot-plugin.test.js`: dentro de un turno en plan con varias tools, todas las peticiones llevan la instrucción completa; y un fallo al escribir `agentTurn` no bloquea la petición ni lanza hacia OpenCode.

## 5. openspec-autopilot: el aviso de lo modificado con el agente plan (zona de código)

- [ ] 5.1 Según D4: guardar `planTurn` con el estado de git al empezar un turno con el agente plan, y borrarlo en un turno con build. Un fallo de git se registra y deja el turno sin `planTurn`. Probarlo en `core-tests/`.
- [ ] 5.2 "Lo producido en plan detiene la cadena hasta el aviso": definir los pasos y ver que falla, porque hoy la cadena sigue. Implementar D5 en `onIdle`: comparar firmas, la fase `plan-notice` con `planNotice`, y la operación `notice` del RPC (`lib/rpc.mjs`, con su límite de tiempo, y `tui.js`, con el modal de un botón "Entendido" y la respuesta al cerrarse, liberado en la limpieza de `setup` según ADR-0011).
- [ ] 5.3 "Al cerrar el aviso, la cadena sigue": rojo → verde. Al recibir el acuse, volver a `running` y llamar a `finishStep` con el producto recalculado.
- [ ] 5.4 "Una modificación en plan sin producto también avisa": rojo → verde. Comparar en reposo en todas las fases de la sesión operativa, no solo en las que encadenan.
- [ ] 5.5 "Sin TUI, el aviso va en la sesión siguiente": rojo → verde. El aviso al principio del mensaje de arranque de la sesión siguiente (`stepPrompt`, `reviewPrompt`) y, sin producto, `planNotice: { next: true }` que `onContext` añade una vez y borra.
- [ ] 5.6 "Explorar sin modificar nada no avisa": rojo → verde.
- [ ] 5.7 En `core-tests/autopilot-plugin.test.js`, los casos de D5 que no están en las specs:
  - un aviso pendiente (fase `plan-notice`) se vuelve a pedir cuando una TUI se presenta (`hello`) y cuando vuelve a esa sesión (`screen`);
  - en `plan-notice`, un prompt del usuario en la sesión cuenta como acuse y encadena con el aviso en la sesión siguiente;
  - si la petición `notice` vence o la TUI se recarga con el modal abierto, la sesión sigue en `plan-notice` y nada lanza hacia OpenCode;
  - un turno con build no da aviso aunque git cambie.

## 6. Documentación (zona de código)

- [ ] 6.1 README, sección del autopilot: las revisiones nacen en build, qué pasa con Tab a plan y al volver a build, y el aviso de lo modificado en plan (con TUI y sin ella). Enlazar ADR-0019.
- [ ] 6.2 `acceptance-tests/README.md`: la operación `notice` de la TUI simulada, los turnos guionizados con el agente plan y los casos nuevos de `core-tests`.
- [ ] 6.3 Comentarios de cabecera de `server.js`, `lib/prompts.mjs` y `lib/rpc.mjs`: la inyección por turno según el agente, el aviso y la operación `notice`.

## 7. Cierre

- [ ] 7.1 Ejecutar la suite completa con los deltas del change, `npm run lint:specs` y `npm run test:core`: todos los escenarios pasan, cero pasos pendientes o sin definir, informe HTML generado.
- [ ] 7.2 Probar con OpenCode 2.3.2 real, fuera del repositorio, en una copia de la rama con una rama temporal y un change con solo la proposal. Comprobar:
  - las sesiones del ciclo, también la revisión, nacen en build;
  - Tab a plan carga `openspec-explore`, seguir en plan lo recuerda y volver a build recuerda el paso, viendo los cuerpos de las peticiones con el proveedor falso;
  - pedir en plan que escriba el artefacto muestra el modal, la cadena espera y sigue al cerrarlo;
  - en la UI web, el aviso aparece en el mensaje de arranque de la sesión siguiente.

  Anotar aquí el resultado.
- [ ] 7.3 Ejecutar `openspec validate autopilot-plan-explore --type change --strict`: ningún error. Los avisos que queden son los mismos tipos que ya da `openspec validate --specs --strict`.
- [ ] 7.4 Commit de la zona de código pendiente, sin archivos de `openspec/`.
- [ ] 7.5 Archivar `autopilot-plan-explore` en su rama, en un commit propio sin archivos de la zona de código, y resincronizar el wiki en un commit aparte. Proponer al usuario actualizar `ciclo-de-un-change-y-autopilot.md` (las revisiones en build, la exploración en plan y el aviso), añadir al registro de vigilancia `volver-a-comprobar-apis-de-sesion-al-subir-opencode` las comprobaciones de 1.1 a 1.3, y las lecciones candidatas de la sesión.
