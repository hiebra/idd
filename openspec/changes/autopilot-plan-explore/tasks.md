# Tasks: autopilot-plan-explore

La suite ya existe (`acceptance-tests/`, `stack: javascript`), así que no hace falta montarla. Las tasks de las secciones 3 a 5 siguen el mismo ciclo: definir los pasos, ver que el escenario falla por la razón esperada, implementar, ver que pasa y hacer commit. Los commits no mezclan `openspec/` con el resto, salvo este `tasks.md`.

## 1. Comprobaciones con OpenCode 2.3.2 real, antes de implementar (fuera del repositorio)

- [x] 1.1 Con el banco de la lección 9 (`.wiki/raw/notes/2026-11-21-ll-sesiones-opencode-autopilot.md`) y un plugin sonda, comprobar que la entrada del hook `context` trae el agente de la petición (`input.agent`), y que cambia con Tab entre `build` y `plan` en la misma sesión. Comprobar también que las peticiones que siguen a una tool, dentro del mismo turno, llevan el mismo agente. Anotar aquí el resultado. Si no llega, detenerse y actualizar el design (D2) con otra fuente del agente antes de seguir.
  - Resultado (2026-11-22, OpenCode 2.3.2, proveedor falso y sonda del hook `context`, con `opencode run --standalone --agent <agente> -s <sesión>` en la misma sesión): la entrada del hook trae `agent` (`"build"` o `"plan"`, como cadena) junto a `sessionID`, `model`, `system`, `messages`, `options` y `tools`, y cambia de un mensaje al siguiente. Las dos peticiones de un turno en plan con una tool llevan `agent: "plan"`. Hallazgo que invalida la clave del turno de D2: en plan, OpenCode añade su recordatorio (`<system-reminder> You are in Plan mode…`) como mensaje `user`, antes del mensaje del usuario en la primera petición del turno y al final, tras el resultado de la tool, en las siguientes. La clave de `lib/agent-turn.mjs` cambia entonces dentro del turno. El simulador no lo reproduce.
- [x] 1.2 En el mismo banco, comprobar que una sesión con el agente plan puede cargar la skill `openspec-explore` con la tool `skill`. Anotar aquí el resultado. Si no puede, actualizar D3 para que el texto lleve el flujo resumido.
  - Resultado: sí. La skill está en la lista de la tool `skill` (`<id>openspec-explore</id>`, leída de `.claude/skills/`) y, con el agente plan, la llamada `skill({ id: "openspec-explore" })` devuelve su contenido (`<skill_content name="openspec-explore">`). D3 no cambia.
- [x] 1.3 En el mismo banco, comprobar que la TUI puede tener abierto un `dialog.select` mientras el servidor espera la respuesta de una petición sin el límite corto de las demás (la operación `notice` de D5), y que una recarga en caliente con el modal abierto no deja la petición sin respuesta ni rompe la TUI. Anotar aquí el resultado.
  - Resultado (misma fecha y versión, TUI `--standalone` en un pseudoterminal de Python y una sonda con servidor y TUI): el `emit` del servidor vuelve enseguida, sin esperar a la TUI, y la TUI tiene el `dialog.select` abierto 20 s mientras el servidor espera su respuesta, sin romperse. La recarga en caliente (editar `tui.js`) recarga las dos partes, la de TUI y la de servidor, y ejecuta la limpieza de la TUI, pero el modal de la carga anterior sigue abierto. Al cerrarlo, la carga anterior responde y la respuesta llega al servidor nuevo, que no conoce la petición: la espera del servidor anterior no se resuelve nunca y la sesión queda ocupada (un segundo mensaje no llegó a ejecutarse). Consecuencias para D5: el acuse debe identificarse por la sesión en `plan-notice` y no por una petición pendiente en memoria, y tras una recarga (el mismo PID) no hay que volver a pedir el aviso, porque el modal anterior sigue en pantalla.
- [x] 1.4 En el mismo banco (proveedor falso y una sonda que registre en un archivo la entrada de los hooks `prompt` y `context` y de `experimental.idle`, con la hora), comprobar qué trae el hook `prompt` en estos casos y en qué orden llegan los tres hooks:
  1. un mensaje normal del usuario en la TUI, con la sesión en reposo;
  2. un mensaje que el usuario envía mientras el turno anterior sigue (el proveedor falso tarda unos segundos en responder, para dar tiempo a escribirlo): en la TUI y, si se puede, con `opencode run -s <sesión>` desde otro terminal;
  3. el mensaje que un plugin envía con `ctx.session.prompt` a otra sesión.

  Anotar en cada caso el `messageID`, el `delivery` y si el `messageID` aparece en algún sitio de la entrada del hook `context` (en `messages` o en otro campo). Para el caso 2, anotar también si el hook `prompt` llega al entrar el mensaje, al empezar su turno o en los dos momentos, y si el `messageID` es el mismo en los dos.

  Criterio, que decide la clave de D2: si `delivery` (u otro dato del hook `prompt`) distingue el mensaje pendiente del que abre turno ya, o si el hook vuelve a llegar al empezar el turno pendiente, D2 guarda solo la clave de los mensajes que abren turno. Si no, guarda la clave pendiente aparte y la toma como clave del turno en la primera petición de `context` después de que la sesión quede en reposo. Si el `messageID` no llega en el hook `prompt`, detenerse y revisar D2. Anotar aquí el resultado; la task 2.4 lleva al simulador lo que se vea.

  - Resultado (2026-11-22, OpenCode 2.3.2, TUI `--standalone` en un pseudoterminal de Python, proveedor falso que tarda cuando el mensaje lo pide, y una sonda que registra en un archivo, con la hora y el PID, la entrada de los tres hooks):
    - Entrada del hook `prompt`, igual en los tres casos: `{ sessionID, messageID, prompt: { text, files, agents? }, metadata, delivery }`. El `messageID` llega siempre (`msg_…`). `delivery` es siempre `"steer"`, también con el mensaje que entra mientras el turno sigue, así que no distingue nada.
    - Orden: el hook `prompt` llega una sola vez, al entrar el mensaje; después llegan las peticiones de `context` y, al final, `experimental.idle`.
    - Caso 1, el mensaje normal en reposo: `prompt`, `context`, `idle`, en ~0,1 s.
    - Caso 2 en la TUI: el mensaje enviado mientras sigue el turno pasa por el hook `prompt` al entrar y no vuelve a pasar. No espera detrás del turno: OpenCode lo mete en el mismo bucle del turno en curso (`steer`). Con una tool en curso, la petición que sigue a la tool lleva el resultado de la tool y, después, el mensaje nuevo como último mensaje `user`. Sin tool, la petición siguiente es la suya. En ningún caso llega `experimental.idle` entre el mensaje anterior y el nuevo: un solo reposo al final.
    - Caso 2 con `opencode run -s <sesión>`: lo atiende otro proceso (otro PID y otra instancia del plugin) sobre la misma sesión, a la vez que el turno de la TUI, con su propio `prompt`, `context` e `idle`. Las dos instancias leen y escriben la misma metadata.
    - Caso 3, el mensaje que el plugin envía con `ctx.session.prompt`: el hook `prompt` de la sesión destino llega antes de que `prompt()` resuelva, con el `messageID` que `prompt()` devuelve (`{ id, sessionID, type: 'user', payload, delivery: 'steer' }`). Después vienen `context` e `idle` de esa sesión.
    - Dentro de la entrada de `context`, cada mensaje guardado lleva su `id` (`messages[i].id`, el `messageID` del hook `prompt` para los mensajes del usuario). Los resultados de tool no llevan id. El recordatorio del agente plan no lleva id en la primera petición del turno. En las que siguen a una tool, ya guardado, lleva un id propio que no ha pasado por el hook `prompt`.
  - Consecuencia para D2: no se cumple ninguna de las dos ramas del criterio. Nada distingue el mensaje pendiente, y tampoco existe "la primera petición después del reposo", porque no hay reposo entre los dos mensajes. Propuesta para la update-change:
    - el hook `prompt` guarda el último `messageID` en `turnMessage`;
    - en cada petición, `context` toma como clave `turnMessage` solo si un mensaje de `input.messages` tiene ese `id`; si no, sigue con la clave anterior (`agentTurn.key`).
    
    Así, un mensaje que entra a mitad de turno cambia la clave justo en la primera petición que lo lleva. Esa es la primera petición en la que el modelo lo ve, y desde ella la inyección es la suya. Los ids del recordatorio de plan no estorban, porque nunca pasan por el hook `prompt`. Queda abierto qué agente lleva la petición cuando el mensaje entra a mitad de turno y el usuario ha pulsado Tab antes de enviarlo; no se ha comprobado (el Tab enviado al pseudoterminal no cambió el agente).

## 2. Simulador (zona de código)

- [x] 2.1 En `acceptance-tests/support/agents/opencode-sim.mjs` y `opencode-sim-process.mjs`, según D6:
  - la operación `notice` en la TUI simulada: muestra un modal que queda abierto hasta que el escenario lo cierra, y responde con `reply` al cerrarse;
  - poder cerrar ese modal desde el World y consultar los modales abiertos;
  - poder guionizar que el modelo escriba o modifique archivos en un turno con el agente plan.

  Los escenarios y `core-tests` que ya existen siguen en verde.
  - Resultado: el simulador ya tenía casi todo. Tenía los modales que quedan abiertos hasta que el escenario los contesta (`dialogWait`, `answers`, `waitDialog`, `dialogs[].open`), las reglas del modelo por agente (`match.agent`, con `switchAgent`) y los efectos `files` y `git` de una respuesta. Su RPC es genérico, así que la operación `notice` de `tui.js` le llegará sin cambios. Faltaba una cosa: si un evento RPC esperaba un modal abierto en la TUI, `settle()` esperaba hasta su límite (20 s), cuando en OpenCode el `emit` del servidor no espera a la TUI. Ahora una entrega que espera un modal abierto no cuenta como trabajo pendiente (`AsyncLocalStorage`). Lo prueba `core-tests/opencode-sim.test.js` con un plugin sonda: falló por el límite y ahora pasa. `npm run test:core`: 110 de 110.
- [x] 2.2 Ejecutar la suite con los deltas del change: los escenarios nuevos salen con pasos sin definir o fallan por lo que el change cambia, y el resto pasa. Anotar aquí cuáles fallan, en particular los pasos que hoy comprueban que la revisión nace con el agente plan (`autopilot.steps.js`).
  - Resultado: 215 escenarios, 202 pasan, 13 con pasos sin definir y ninguno falla. Los 13 son los escenarios nuevos del change (los dos ejemplos de "Toda sesión del ciclo nace con el agente build", los seis de "El agente plan explora en la sesión operativa" y los cinco del aviso). Los pasos que comprueban que la revisión nace con plan siguen pasando, porque el plugin aún no ha cambiado; se cambian en 3.1.
- [x] 2.3 En `opencode-sim.mjs`, según lo comprobado en la task 1.1: con el agente plan, cada petición lleva el recordatorio de OpenCode (`<system-reminder> You are in Plan mode…`) como mensaje `user`, antes del último mensaje del usuario en la primera petición del turno y al final, tras el resultado de la tool, en las siguientes. Probarlo en `core-tests/opencode-sim.test.js` con un turno en plan con una tool. Los escenarios y `core-tests` que ya existen siguen en verde.
  - Resultado: el test nuevo falló sin el recordatorio y pasa con él. `npm run test:core`: 115 de 115 en las repeticiones; en una ejecución, en paralelo con la suite, falló "two sessions taking control at once", que pasa siempre aislado, con el cambio y sin él (el mismo fallo intermitente que en la 4.1). Suite con los deltas: 215 escenarios, 204 pasan, 11 sin definir, ninguno falla.
- [x] 2.4 En `opencode-sim.mjs`, según lo comprobado en la task 1.4:
  - el hook `prompt` llega una vez con cada mensaje, con `delivery: "steer"` y un `messageID` que es el `id` del mensaje guardado;
  - en la entrada de `context`, cada mensaje guardado lleva su `id`; los resultados de tool no; el recordatorio del agente plan, ninguno en la primera petición del turno y uno propio en las siguientes;
  - un mensaje enviado mientras el turno sigue pasa por el hook `prompt` al entrar y se mete en el mismo bucle: es el último mensaje `user` de la petición siguiente (tras el resultado de la tool, si la hay), sin `experimental.idle` entre medias, y un solo reposo al final.

  Probarlo en `core-tests/opencode-sim.test.js`. Los escenarios y `core-tests` que ya existen siguen en verde.
  - Resultado: hecho (commit `782d94c`), con dos tests nuevos en `core-tests/opencode-sim.test.js` que fallaron antes (los mensajes sin `id`; el segundo mensaje abría un turno en paralelo, con dos reposos) y pasan después. Las respuestas guionizadas admiten `delayMs`, para que el usuario escriba con el turno en curso. `npm run test:core`: 117 de 117. Suite: 215 escenarios, 204 pasan, 11 sin definir, ninguno falla.

## 3. openspec-autopilot: las sesiones nacen en build (zona de código)

- [x] 3.1 "Toda sesión del ciclo nace con el agente build", con sus dos ejemplos: definir los pasos y ver que falla para la revisión, que hoy nace con plan. Implementar D1: `WORKFLOW.review.agent` a `build` en `lib/prompts.mjs`. Cambiar las aserciones de `autopilot.steps.js` que esperan el agente plan en la revisión.
  - Resultado: los dos ejemplos fallaron porque la revisión nacía con `plan`; con `WORKFLOW.review.agent = 'build'` pasan. Se han cambiado a `build` las tres aserciones que esperaban `plan` en la revisión.
- [x] 3.2 "El siguiente paso en una sesión nueva" y "La instrucción del paso sigue en los mensajes siguientes" siguen en verde con el requisito renombrado.
  - Resultado: siguen en verde. Suite con los deltas: 215 escenarios, 204 pasan, 11 con pasos sin definir (los de las secciones 4 y 5) y ninguno falla; `npm run test:core`: 110 de 110.

## 4. openspec-autopilot: el agente plan explora (zona de código)

- [x] 4.1 En `lib/prompts.mjs`, según D3: `explorePrompt`, `exploreReminderPrompt`, `returnPrompt` y `planNoticeText`. En `core-tests/`, que cada texto nombra el paso o la revisión, que `explorePrompt` nombra la skill `openspec-explore` y que ninguno pide commits.
  - Resultado: hecho, con los tests en `core-tests/autopilot-agent-turn.test.js` (rojo sin las funciones, verde con ellas).
- [x] 4.2 En un módulo puro (`lib/agent-turn.mjs`), según D2: la tabla de transiciones (`step`, `explore`, `explore-reminder`, `return`), con un agente ausente o desconocido tratado como build, y la decisión una vez por turno a partir de la clave de D2: `turnMessage`, el último `messageID` que guarda el hook `prompt`, solo si algún mensaje de la petición lleva ese `id`, y si no la clave anterior. Probar también un mensaje que entra a mitad de turno. Probarlo en `core-tests/` con varias peticiones del mismo turno, también con el recordatorio del agente plan al final de la petición (task 2.3).
  - Primera versión (commit `1c585fd`): `transition` y `agentTurn` siguen valiendo. `turnKey`, que sacaba la clave de los mensajes de la petición, queda invalidado por el recordatorio del agente plan que añade OpenCode (task 1.1) y hay que sustituirlo.
  - Resultado: `turnKey(messages, { turnMessage, previous })` sustituye a la primera versión: devuelve `turnMessage` si algún mensaje de la petición lleva ese `id`, y si no la clave anterior. El test de la clave, reescrito con los `id` que da OpenCode, falló con la versión anterior y pasa con la nueva; cubre el primer mensaje del paso, una petición tras una tool con el recordatorio del agente plan al final, y un mensaje que entra a mitad de turno antes y después de que la petición lo lleve. `npm run test:core`: 117 de 117.
- [x] 4.3 "Pasar a plan carga el flujo de exploración", con sus dos ejemplos: definir los pasos y ver que falla con el recordatorio del paso de hoy. Implementar D2 en `onPrompt` (guardar el `messageID` en `turnMessage`, antes de cualquier otra decisión del hook) y en `onContext` de `server.js` (la clave, solo si la petición lleva ese mensaje), con `agentTurn` en la metadata (leer, combinar y escribir).
  - Resultado: los dos ejemplos fallaron con el recordatorio del paso de hoy y pasan con D2 en `onPrompt` (`rememberTurn`, que guarda `turnMessage` antes de cualquier otra decisión, también con los mensajes marcados y al tomar el control con `autopilot`) y en `onContext` (`turnText`, con `turnKey` y `agentTurn`).
- [x] 4.4 "Seguir en plan solo recuerda la exploración": rojo → verde.
  - Resultado: falló con el recordatorio del paso y pasa.
- [x] 4.5 "Volver a build solo recuerda el paso previo": rojo → verde. Comprobar que el plugin no añade mensajes a la sesión.
  - Resultado: falló con el recordatorio del paso y pasa; el historial solo tiene los mensajes del usuario.
- [x] 4.6 "Cada paso a plan vuelve a cargar la exploración": rojo → verde.
  - Resultado: falló con el recordatorio del paso y pasa.
- [x] 4.7 "En una sesión ajena, plan no carga la exploración": definir los pasos y ver que pasa sin cambios en el plugin; si falla, corregir `onContext` para que la rama de las sesiones ajenas no mire el agente.
  - Resultado: pasa sin cambios en el plugin, también con el servidor anterior a la 4.3: la rama de las sesiones ajenas no mira el agente.
- [x] 4.8 En `core-tests/autopilot-plugin.test.js`: dentro de un turno en plan con varias tools, todas las peticiones llevan la instrucción completa; y un fallo al escribir `agentTurn` no bloquea la petición ni lanza hacia OpenCode.
  - Resultado: tres tests en `core-tests/autopilot-plugin.test.js`: un turno en plan con dos tools (las tres peticiones llevan la instrucción completa, también tras el recordatorio del agente plan, y el mensaje siguiente solo el recordatorio); un mensaje enviado a mitad de turno tras un Tab a plan, que recibe la exploración desde la primera petición que lo lleva; y un fallo de `session.update`, con el que la petición sale sin error y se decide como si el turno anterior fuera build.

## 5. openspec-autopilot: el aviso de lo modificado con el agente plan (zona de código)

- [x] 5.1 Según D4: guardar `planTurn` con el estado de git al empezar un turno con el agente plan, y borrarlo en un turno con build. Un fallo de git se registra y deja el turno sin `planTurn`. Probarlo en `core-tests/`.
  - Resultado: `planTurn` se guarda en `turnText` al empezar un turno nuevo con el agente plan, si no hay uno pendiente, y se borra en un turno con build y al quedar en reposo. Lo prueba un test de `core-tests/autopilot-plugin.test.js` que lee la metadata a mitad de un turno en plan. El fallo de git se registra y deja el turno sin `planTurn` (`try`/`catch` alrededor de `gitState`), pero no tiene test: el simulador no puede hacer fallar git.
- [x] 5.2 "Lo producido en plan detiene la cadena hasta el aviso": definir los pasos y ver que falla, porque hoy la cadena sigue. Implementar D5 en `onIdle`: comparar firmas, la fase `plan-notice` con `planNotice`, la operación `notice` del RPC, que no espera respuesta, y el método `ack({ instance, sessionID })` de la TUI al servidor (`lib/rpc.mjs`; `tui.js`, con el modal de un botón "Entendido" que llama a `ack` al cerrarse, liberado en la limpieza de `setup` según ADR-0011). El servidor acepta el acuse si la sesión sigue en `plan-notice`, sin ninguna petición pendiente en memoria.
  - Resultado: falló porque la cadena seguía (la revisión se creaba sin modal) y pasa con D5: `changedInPlan` y la fase `plan-notice` en `onIdle`, la operación `notice` (la TUI abre el modal y responde enseguida) y `ack` por la sesión (`releaseNotice`).
- [x] 5.3 "Al cerrar el aviso, la cadena sigue": rojo → verde. Al recibir el acuse, volver a `running` y llamar a `finishStep` con el producto recalculado.
  - Resultado: falló sin D5 y pasa.
- [x] 5.4 "Una modificación en plan sin producto también avisa": rojo → verde. Comparar en reposo en todas las fases de la sesión operativa, no solo en las que encadenan.
  - Resultado: falló sin D5 (no salía modal) y pasa; la comparación se hace en todas las fases de la sesión operativa.
- [x] 5.5 "Sin TUI, el aviso va en la sesión siguiente": rojo → verde. El aviso al principio del mensaje de arranque de la sesión siguiente (`stepPrompt`, `reviewPrompt`) y, sin producto, `planNotice: { next: true }` que `onContext` añade una vez y borra.
  - Resultado: falló sin D5 (la revisión arrancaba sin aviso) y pasa: `noticeAtStart` en la sesión siguiente, que `startStep` pone al principio del mensaje de arranque; sin producto, `planNotice: { next: true }`.
- [x] 5.6 "Explorar sin modificar nada no avisa": rojo → verde.
  - Resultado: pasa también sin D5, como se esperaba.
- [x] 5.7 En `core-tests/autopilot-plugin.test.js`, los casos de D5 que no están en las specs:
  - un aviso pendiente (fase `plan-notice`) se vuelve a pedir cuando se presenta una TUI con otro PID, y no tras una recarga en caliente (el mismo PID) ni en cada `screen`;
  - tras una recarga en caliente con el modal abierto, cerrar ese modal (el de la carga anterior) llega al servidor nuevo como acuse y encadena, una sola vez;
  - un acuse de una sesión que ya no está en `plan-notice` se ignora;
  - en `plan-notice`, un prompt del usuario en la sesión cuenta como acuse y encadena con el aviso en la sesión siguiente;
  - nada lanza hacia OpenCode en ninguno de estos casos;
  - un turno con build no da aviso aunque git cambie.
  - Resultado: cinco tests en `core-tests/autopilot-plugin.test.js`, además del de la 5.1. Al escribir el del prompt con el aviso pendiente apareció un fallo del simulador de la 2.1: el modal se abre en una promesa separada de la entrega RPC, pero hereda su contexto, y el contador tomaba por esperando al usuario otra llamada pendiente. `settle()` volvía antes de que terminara el turno. Ahora cada entrega guarda su propio estado, y solo cuenta como esperando la entrega que de verdad espera el modal. Suite con los deltas: 215 escenarios, los 215 pasan, sin pasos sin definir. `npm run test:core`: 124 de 125; falla "two sessions taking control at once", una carrera anterior a este change (también falló en la 4.1, antes de tocar `onPrompt`): con dos sesiones que dicen `autopilot` a la vez, si la más antigua escribe su metadata después de que la nueva compruebe, quedan las dos como operativas. Queda fuera de este change.

## 6. Documentación (zona de código)

- [x] 6.1 README, sección del autopilot: las revisiones nacen en build, qué pasa con Tab a plan y al volver a build, y el aviso de lo modificado en plan (con TUI y sin ella). Enlazar ADR-0019.
  - Resultado: sección del autopilot: el agente plan (Tab), lo modificado en plan avisado y el aviso sin TUI, con el enlace a ADR-0019.
- [x] 6.2 `acceptance-tests/README.md`: la operación `notice` de la TUI simulada, los turnos guionizados con el agente plan y los casos nuevos de `core-tests`.
  - Resultado: la ejecución (hook `prompt` con su `messageID`, mensajes a mitad de turno, recordatorio del agente plan, `switchAgent`), las entregas RPC con un modal abierto, `match.agent` y `delayMs`, y los casos nuevos de `core-tests`.
- [x] 6.3 Comentarios de cabecera de `server.js`, `lib/prompts.mjs` y `lib/rpc.mjs`: la inyección por turno según el agente, el aviso y la operación `notice`.
  - Resultado: `server.js` con la inyección por turno y el aviso; `lib/prompts.mjs` y `lib/rpc.mjs` ya se actualizaron con su código (4.1 y 5.2), y `lib/agent-turn.mjs` es nuevo con su cabecera.

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
