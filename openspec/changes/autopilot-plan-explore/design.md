## Context

El plugin `openspec-autopilot` (ADR-0014) da una sesión a cada paso y le recuerda el paso en cada petición desde el hook `context` (`reminderPrompt`, `server.js`, `onContext`). Hoy ese recordatorio es el mismo con cualquier agente, y las revisiones nacen con el agente plan (`WORKFLOW.review.agent` en `lib/prompts.mjs`), una elección de D6 del design de `add-openspec-autopilot` para que el modelo de la revisión no pudiera editar. La proposal explica por qué se cambia: en la sesión operativa, Tab a plan es una petición de explorar, y lo que se modifica en plan no debe pasar desapercibido.

Lo que ya se sabe de OpenCode 2.3.2 y condiciona el diseño:

- El hook `context` se ejecuta en **cada petición al modelo**, también en las que siguen a una tool dentro del mismo turno, y lo que añade no queda en el historial ni se acumula (`.wiki/wiki/concepts/hook-context-opencode.md`). Por eso lo que se inyecta se decide **por turno** (por mensaje del usuario), no por petición, como ya hace `session-bootstrap` con `lastUserText`.
- La entrada del hook trae el agente de la petición (`input.agent`) en el simulador de la suite (`opencode-sim.mjs`, `request()`); en OpenCode real no está comprobado (ver Open Questions).
- La metadata de la sesión se sustituye entera: se escribe leyendo, combinando y volviendo a escribir (`writeMeta`, lección 2 de `.wiki/raw/notes/2026-11-21-ll-sesiones-opencode-autopilot.md`).
- La TUI vuelve al agente build al abrirse aunque el último fuera plan (lección 7 de la misma nota): el agente de la sesión no es un estado fiable entre arranques; el de cada petición, sí.
- El servidor solo se comunica con la TUI por el RPC del plugin (D1 de `autopilot-sesion-operativa`): peticiones `request` con límite de tiempo y una sola respuesta, y directivas de `screen`. Hoy el modal informativo (`notice`) solo sale como directiva de `screen`, sin acuse.
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

En el hook `context` de la sesión operativa, el turno es el último mensaje `user` que no lleva la marca del plugin (`[openspec-autopilot]`), identificado por su posición entre los mensajes del usuario y su texto. La metadata guarda `agentTurn: { key, agent, kind }`, donde `kind` es lo que se inyecta en todo el turno:

| agente del turno anterior | agente de este turno | `kind`                      |
| ------------------------- | -------------------- | --------------------------- |
| build (o ninguno)         | build                | `step` (recordatorio de hoy) |
| build (o ninguno)         | plan                 | `explore` (instrucción completa) |
| plan                      | plan                 | `explore-reminder`          |
| plan                      | build                | `return` (recordatorio del paso, "vuelves de explorar") |

Al empezar un turno nuevo (la clave cambia), el plugin calcula `kind`, lo escribe en la metadata y lo inyecta; en las peticiones siguientes del mismo turno (tras cada tool) lee `kind` y repite la misma inyección, sin volver a calcularla ni a escribir. Si `input.agent` no llega o no es `build` ni `plan`, se trata como build, que es el comportamiento de hoy.

Alternativa descartada: decidir por petición comparando con la petición anterior. Dentro de un turno en plan, la segunda petición (tras una tool) ya vería "plan → plan" y perdería la instrucción completa, que no queda en el historial.

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

- **Con producto y TUI presentada**: la sesión pasa a la fase `plan-notice`, con `planNotice: { chain: true }`, y el servidor pide a la TUI la operación nueva `notice` (servidor → cliente, en el evento `request`). La TUI muestra el modal de un botón, "Entendido", y responde con `reply` al cerrarse de cualquier forma. Con el acuse, el servidor vuelve a la fase `running` y llama a `finishStep` con el producto recalculado: stage y revisión (modo normal) o paso siguiente (modo auto), como si no hubiera aviso.
- **Sin producto y TUI presentada**: la misma operación `notice`, sin retener nada: `planNotice` no se guarda y la sesión sigue en su fase.
- **Sin TUI**: el plugin encadena sin esperar. Con producto, el mensaje con el que arranca la sesión siguiente (`stepPrompt`, `reviewPrompt`) empieza con el aviso, y lo ve el usuario en el historial; sin producto, la sesión guarda `planNotice: { next: true }` y el hook `context` de la siguiente petición de esa sesión lo añade, para que el modelo lo transmita, y lo borra.
- **Nunca retenida para siempre**: `notice` no tiene el límite corto de las demás operaciones (la TUI espera al usuario); si vence, si la TUI se recarga o se cierra, la sesión sigue en `plan-notice`, y el servidor vuelve a pedir el aviso cuando una TUI se presenta (`hello`, junto a `archivePending`) o vuelve a esa sesión (`screen`). Si en `plan-notice` el usuario envía un prompt en esa sesión (por ejemplo desde la web), el hook `prompt` lo toma como acuse: encadena, y la sesión siguiente arranca con el aviso como sin TUI.

Alternativa descartada: la directiva `notice` de `screen` que ya existe. No tiene acuse, solo sale al cambiar de pantalla o recuperar el foco, y la cadena no sabría cuándo seguir.

### D6. El simulador

`opencode-sim.mjs` ya tiene `switchAgent` y pasa `agent` en la entrada de `context`. Le falta la operación `notice` en la TUI simulada, con un modal que el escenario cierra cuando quiere (para comprobar que la cadena espera), y poder guionizar que el modelo escriba archivos en un turno con plan.

## Risks / Trade-offs

- [El modelo de la revisión, ahora en build, puede editar] → La instrucción de la revisión lo prohíbe, el cierre sigue siendo de git y una edición inesperada cambia la firma, así que el usuario la ve en `git status` antes de su commit. Es la contrapartida asumida de D1.
- [Un turno en plan en una revisión cambia git y confunde el veredicto del cierre] → El aviso (D4) sale en la revisión igual, antes del siguiente prompt del usuario, que es el que cierra la revisión: el usuario sabe que el árbol ha cambiado antes de decidir.
- [El usuario cambia git a mano en otro terminal durante un turno en plan] → Da un aviso que no se debe al modelo. Se acepta: el texto dice que se han hecho modificaciones, no que las hiciera el modelo, y el turno en plan suele ser corto.
- [Calcular el estado de git en el hook `context` retrasa la primera petición de un turno en plan] → Solo una vez por turno en plan, con el límite de tiempo de `lib/git.mjs`; un fallo se registra y el turno sigue sin `planTurn` (sin aviso), sin bloquear la petición.
- [`input.agent` no llega en OpenCode real] → Todo se trata como build y el plugin se comporta como hoy; la task de comprobación con OpenCode real lo detecta antes de implementar.
- [La TUI no muestra el modal y la cadena queda en `plan-notice`] → Se vuelve a pedir al presentarse una TUI o volver a la sesión, y un prompt del usuario la libera (D5).

## Migration Plan

Sin migración de datos. Las sesiones operativas vivas al instalar la versión nueva no tienen `agentTurn` ni `planTurn`: su primer turno se trata como si el anterior fuera build. Una revisión creada antes con el agente plan sigue con plan hasta cerrarse; su primer turno en plan recibe la exploración. Para volver atrás basta la versión anterior del plugin: los campos nuevos de la metadata se ignoran.

## Open Questions

- **`input.agent` en OpenCode 2.3.2 real**: el simulador lo pasa, pero no está comprobado en el banco de la lección 9. Es la primera task: si no llega, hay que sacar el agente de otro sitio (el último mensaje del asistente o `session.agent`) antes de seguir.
- **La skill `openspec-explore` con el agente plan**: hay que comprobar que plan puede cargar una skill con la tool `skill` en la sesión operativa; si no, el texto de D3 incluye el flujo resumido en lugar de pedir la skill.
- **Supersesión**: este change no contradice ningún ADR en vigor. El ADR del change debe registrar que el autopilot trata el agente plan como exploración y avisa de lo modificado en plan, y que las revisiones nacen en build, en lugar de D6 del design y del fuera de alcance de la proposal de `add-openspec-autopilot`, que no llegaron a un ADR.
