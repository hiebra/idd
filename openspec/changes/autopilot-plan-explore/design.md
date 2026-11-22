## Context

El plugin `openspec-autopilot` (ADR-0014) da una sesión a cada paso y le recuerda el paso en cada petición desde el hook `context` (`reminderPrompt`, `server.js`, `onContext`). Hoy ese recordatorio es el mismo con cualquier agente, y las revisiones nacen con el agente plan (`WORKFLOW.review.agent` en `lib/prompts.mjs`), una elección de D6 del design de `add-openspec-autopilot` para que el modelo de la revisión no pudiera editar. La proposal explica por qué se cambia: en la sesión operativa, Tab a plan es una petición de explorar, y lo que se modifica en plan no debe pasar desapercibido.

Lo que ya se sabe de OpenCode 2.3.2 y condiciona el diseño:

- El hook `context` se ejecuta en **cada petición al modelo**, también en las que siguen a una tool dentro del mismo turno, y lo que añade no queda en el historial ni se acumula (`.wiki/wiki/concepts/hook-context-opencode.md`). Por eso lo que se inyecta se decide **por turno** (por mensaje del usuario), no por petición, como ya hace `session-bootstrap` con `lastUserText`.
- La entrada del hook `context` trae el agente de la petición, `input.agent` (`"build"` o `"plan"`), junto a `sessionID`, `model`, `system`, `messages`, `options` y `tools`; cambia de un mensaje al siguiente, y todas las peticiones de un turno llevan el mismo (task 1.1, comprobado con OpenCode 2.3.2 real).
- Con el agente plan, OpenCode añade su propio recordatorio (`<system-reminder> You are in Plan mode…`) como mensaje `user`: antes del mensaje del usuario en la primera petición del turno y al final, tras el resultado de la tool, en las siguientes (task 1.1). Ninguna clave sacada de la lista de mensajes de la petición es estable dentro del turno.
- El hook de servidor `prompt` llega con cada mensaje que entra en una sesión, también el que envía el plugin con `session.prompt`, antes de la petición al modelo, con `{ sessionID, messageID, prompt, delivery }`; también llega cuando el mensaje queda pendiente detrás del turno en curso (design de `autopilot-sesion-operativa`, Context 3). Qué distingue ese caso está por comprobar (task 1.4).
- El agente plan carga la skill `openspec-explore` con la tool `skill` (task 1.2).
- El `emit` del servidor vuelve sin esperar a la TUI, y la TUI puede tener un `dialog.select` abierto mientras el servidor espera. Una recarga en caliente recarga las dos partes y ejecuta la limpieza de la TUI, pero el modal de la carga anterior sigue abierto; al cerrarlo, la carga anterior responde y la respuesta llega al servidor nuevo, que no conoce la petición pendiente del anterior (task 1.3).
- La metadata de la sesión se sustituye entera: se escribe leyendo, combinando y volviendo a escribir (`writeMeta`, lección 2 de `.wiki/raw/notes/2026-11-21-ll-sesiones-opencode-autopilot.md`).
- La TUI vuelve al agente build al abrirse aunque el último fuera plan (lección 7 de la misma nota): el agente de la sesión no es un estado fiable entre arranques; el de cada petición, sí.
- El servidor solo se comunica con la TUI por el RPC del plugin (D1 de `autopilot-sesion-operativa`): peticiones `request` con límite de tiempo y una sola respuesta, guardadas en la memoria del servidor, y directivas de `screen`. Hoy el modal informativo (`notice`) solo sale como directiva de `screen`, sin acuse.
- `experimental.idle` encadena el paso (`onIdle` → `finishStep`) y solo actúa con la fase `running` o `handed-off`.

ADRs en vigor que acotan el diseño: ADR-0006 (asimetría: nada en Claude Code), ADR-0011 (el plugin libera lo que registra), ADR-0013 (el plugin pasa al stage, el usuario hace el commit), ADR-0014 (producto por el CLI, cierre de las revisiones por git, lógica en el servidor y degradación sin TUI) y ADR-0015 (ciclo git). Ninguno fija el agente de las revisiones ni prohíbe inyectar al cambiar de agente: esas decisiones están solo en el design y la proposal de `add-openspec-autopilot`.

## Goals / Non-Goals

**Goals:**

- Que el modelo reciba el flujo de `openspec-explore` al pasar a plan, y un recordatorio del paso al volver a build, sin tocar el historial.
- Que un turno en plan que cambia git no encadene la sesión siguiente sin que el usuario lo sepa, con cualquier cliente.
- Que nada de esto pueda bloquear OpenCode ni dejar la cadena retenida para siempre.

**Non-Goals:**

- Impedir que el modelo modifique archivos en plan: el plugin avisa, no bloquea.
- Cambiar lo que reciben las sesiones que no son la operativa.
- Cualquier contrapartida en Claude Code (ADR-0006).

## Decisions

### D1. Las sesiones nacen en build; la revisión se protege con su instrucción

`WORKFLOW.review.agent` pasa a `build`, como los demás pasos. La revisión mantiene en su mensaje de arranque y en su recordatorio la instrucción de no modificar archivos ni pedir commits, y su cierre sigue siendo de git. Con eso, el agente plan dentro de la sesión operativa siempre significa "el usuario quiere explorar", también en una revisión.

Alternativa descartada: dejar las revisiones en plan y no inyectar `openspec-explore` en ellas. Daba a Tab dos significados según el paso, y el usuario no podría explorar dentro de una revisión.

### D2. El cambio de agente se decide por turno

La clave del turno es el `messageID` del mensaje que lo abre, tal como llega al hook `prompt` de la sesión operativa. El hook la guarda en la metadata (`turnMessage`) antes de decidir nada más, también con los mensajes que llevan la marca del plugin (el mensaje con el que el plugin arranca cada paso abre el primer turno). En las peticiones del turno, el hook `context` lee esa clave de la metadata y no mira la lista de mensajes de la petición. Un mensaje que queda pendiente detrás del turno en curso no debe cambiar la clave del turno en curso: cómo distinguirlo lo decide la task 1.4 (si `delivery` u otro dato lo distingue, solo se guarda la clave de los mensajes que abren turno ya; si no, se guarda como clave pendiente y pasa a ser la del turno en la primera petición después de que la sesión quede en reposo). La metadata guarda `agentTurn: { key, agent, kind }`, donde `kind` es lo que se inyecta en todo el turno:

| agente del turno anterior | agente de este turno | `kind`                      |
| ------------------------- | -------------------- | --------------------------- |
| build (o ninguno)         | build                | `step` (recordatorio de hoy) |
| build (o ninguno)         | plan                 | `explore` (instrucción completa) |
| plan                      | plan                 | `explore-reminder`          |
| plan                      | build                | `return` (recordatorio del paso, "vuelves de explorar") |

Al empezar un turno nuevo (la clave cambia), el plugin calcula `kind`, lo escribe en la metadata y lo inyecta; en las peticiones siguientes del mismo turno (tras cada tool) lee `kind` y repite la misma inyección, sin volver a calcularla ni a escribir. Si `input.agent` no llega o no es `build` ni `plan`, se trata como build, que es el comportamiento de hoy.

Alternativa descartada: decidir por petición comparando con la petición anterior. Dentro de un turno en plan, la segunda petición (tras una tool) ya vería "plan → plan" y perdería la instrucción completa, que no queda en el historial.

Alternativas descartadas para la clave:

- Sacarla de los mensajes de la petición (el último mensaje `user`, o los mensajes del modelo antes de él, con su texto). El recordatorio del agente plan, insertado como mensaje `user` al final de la petición tras una tool, la cambia dentro del turno (task 1.1).
- Lo mismo saltando los mensajes que empiezan por `<system-reminder>`. Depende del formato de una inyección de OpenCode y no protege de las de otros plugins.
- Contar los mensajes guardados de la sesión. Una lectura de la sesión por petición, y tiene el mismo problema con los mensajes pendientes.

### D3. Los textos nuevos, en `lib/prompts.mjs`

- `explorePrompt({ step, change })`: usa la skill `openspec-explore` sobre el paso o la revisión en curso (`describe(step, change)`), como compañero de pensamiento: investigar, comparar y aclarar, sin implementar ni escribir artefactos. Si el usuario pide expresamente modificar archivos, el modelo le recuerda que eso es del agente build (Tab) y que el plugin le avisará si lo hace en plan.
- `exploreReminderPrompt({ step, change })`: una línea con lo mismo.
- `returnPrompt({ step, change, phase })`: el recordatorio de hoy (`reminderPrompt`) precedido de "Vuelves de explorar con el agente plan; sigue con el paso". En `waiting-commit` y en una revisión, el recordatorio propio de esa fase.
- `planNoticeText()`: el texto del aviso, el mismo en el modal y en los mensajes: con el agente plan se han hecho modificaciones que, por el enfoque del workflow y la naturaleza del agente plan, deberían haberse reservado al agente build; normalmente porque el usuario lo ha pedido.

### D4. El estado de git de un turno en plan

Al empezar un turno con el agente plan (D2), el plugin guarda en la metadata `planTurn: { key, git: gitState(...) }`, con la firma de `lib/git.mjs`, que cambia con HEAD, el stage y el árbol (también los archivos sin seguimiento). Se guarda antes de la primera petición del turno al modelo, así que ninguna tool del turno ha corrido todavía. Un turno con build borra `planTurn`.

Al quedar la sesión en reposo, si hay `planTurn`, el plugin calcula el estado de git y compara firmas. Si son distintas, hay aviso (D5) y `planTurn` se borra; si son iguales, se borra sin más. Esto se hace en `experimental.idle` para todas las fases de la sesión operativa (también `review` y `waiting-commit`), no solo para las que encadenan.

Alternativa descartada: guardar el estado en el hook `prompt`. Ahí no se conoce el agente del mensaje.

### D5. El aviso retiene la cadena con un acuse de la TUI

- **Con producto y TUI presentada**: la sesión pasa a la fase `plan-notice`, con `planNotice: { chain: true, pid }` (el PID de la TUI a la que se pide), y el servidor pide a la TUI la operación nueva `notice` (servidor → cliente, en el evento `request`), que no espera respuesta: la TUI abre el modal de un botón, "Entendido", y responde enseguida. Al cerrarse el modal, de cualquier forma, la TUI llama al método nuevo `ack({ instance, sessionID })` (cliente → servidor). El acuse se identifica por la sesión, no por una petición pendiente en memoria: el servidor lo acepta si esa sesión sigue en `plan-notice`, y lo ignora si no. Así vale también tras una recarga en caliente, en la que el modal de la carga anterior sigue abierto y su acuse llega al servidor nuevo (task 1.3). Con el acuse, el servidor vuelve a la fase `running` y llama a `finishStep` con el producto recalculado: stage y revisión (modo normal) o paso siguiente (modo auto), como si no hubiera aviso.
- **Sin producto y TUI presentada**: la misma operación `notice`, sin retener nada: `planNotice` no se guarda y la sesión sigue en su fase.
- **Sin TUI**: el plugin encadena sin esperar. Con producto, el mensaje con el que arranca la sesión siguiente (`stepPrompt`, `reviewPrompt`) empieza con el aviso, y lo ve el usuario en el historial; sin producto, la sesión guarda `planNotice: { next: true }` y el hook `context` de la siguiente petición de esa sesión lo añade, para que el modelo lo transmita, y lo borra.
- **Nunca retenida para siempre**: si la TUI se cierra con el modal abierto, la sesión sigue en `plan-notice`, y el servidor vuelve a pedir el aviso cuando se presenta una TUI con otro PID que el de `planNotice.pid` (un arranque, junto a `archivePending`). No lo vuelve a pedir tras una recarga en caliente (el mismo PID), porque el modal anterior sigue en pantalla, ni en cada `screen`. Si en `plan-notice` el usuario envía un prompt en esa sesión (por ejemplo desde la web), el hook `prompt` lo toma como acuse: encadena, y la sesión siguiente arranca con el aviso como sin TUI.

Alternativa descartada: la directiva `notice` de `screen` que ya existe. No tiene acuse, solo sale al cambiar de pantalla o recuperar el foco, y la cadena no sabría cuándo seguir.

### D6. El simulador

`opencode-sim.mjs` ya tiene `switchAgent`, pasa `agent` en la entrada de `context`, deja modales abiertos hasta que el escenario los cierra y guioniza respuestas que escriben archivos. Le falta que una entrega RPC que espera un modal no cuente como trabajo pendiente (hecho en la task 2.1), reproducir el recordatorio del agente plan como mensaje `user` en las peticiones (task 2.3), y lo que diga la task 1.4 sobre el hook `prompt` con los mensajes pendientes.

## Risks / Trade-offs

- [El modelo de la revisión, ahora en build, puede editar] → La instrucción de la revisión lo prohíbe, el cierre sigue siendo de git y una edición inesperada cambia la firma, así que el usuario la ve en `git status` antes de su commit. Es la contrapartida asumida de D1.
- [Un turno en plan en una revisión cambia git y confunde el veredicto del cierre] → El aviso (D4) sale en la revisión igual, antes del siguiente prompt del usuario, que es el que cierra la revisión: el usuario sabe que el árbol ha cambiado antes de decidir.
- [El usuario cambia git a mano en otro terminal durante un turno en plan] → Da un aviso que no se debe al modelo. Se acepta: el texto dice que se han hecho modificaciones, no que las hiciera el modelo, y el turno en plan suele ser corto.
- [Calcular el estado de git en el hook `context` retrasa la primera petición de un turno en plan] → Solo una vez por turno en plan, con el límite de tiempo de `lib/git.mjs`; un fallo se registra y el turno sigue sin `planTurn` (sin aviso), sin bloquear la petición.
- [Una versión de OpenCode deja de pasar `input.agent` o el `messageID` del hook `prompt`] → Todo se trata como build, o como un solo turno, y el plugin se comporta como antes de este change; se vigila al subir de versión con las comprobaciones de la sección 1 de las tasks.
- [La TUI se cierra con el modal abierto y la cadena queda en `plan-notice`] → Se vuelve a pedir al presentarse una TUI nueva, y un prompt del usuario la libera (D5).
- [Un mensaje pendiente detrás del turno en curso cambia la clave del turno antes de tiempo] → El turno en curso repetiría la inyección del siguiente en sus peticiones restantes. Lo evita lo que decida la task 1.4.

## Migration Plan

Sin migración de datos. Las sesiones operativas vivas al instalar la versión nueva no tienen `agentTurn` ni `planTurn`: su primer turno se trata como si el anterior fuera build. Una revisión creada antes con el agente plan sigue con plan hasta cerrarse; su primer turno en plan recibe la exploración. Para volver atrás basta la versión anterior del plugin: los campos nuevos de la metadata se ignoran.

## Open Questions

- **El hook `prompt` con un mensaje pendiente** (task 1.4): qué `messageID` y qué `delivery` trae un mensaje que entra mientras el turno anterior sigue, y si vuelve a pasar por el hook cuando empieza su turno. Decide cómo guarda D2 la clave.
- **Supersesión**: este change no contradice ningún ADR en vigor. El ADR del change debe registrar que el autopilot trata el agente plan como exploración y avisa de lo modificado en plan, y que las revisiones nacen en build, en lugar de D6 del design y del fuera de alcance de la proposal de `add-openspec-autopilot`, que no llegaron a un ADR.
