# ADR-0019: En el autopilot, el agente plan es para explorar y lo que se modifica con él se avisa antes de seguir

- Status: accepted
- Date: 2026-11-22
- Supersedes: -

## Context

ADR-0014 fija que cada paso del autopilot va en una sesión nueva "con el workflow y el agente que elige el plugin", pero no dice qué agente ni qué pasa cuando el usuario cambia de agente dentro de la sesión operativa. Lo decidió el change `add-openspec-autopilot`, sin llegar a un ADR:

- las revisiones nacían con el agente plan, para que el modelo no pudiera editar (D6 de su design);
- el agente plan y `openspec-explore` quedaban fuera de alcance, por ser acciones explícitas del usuario, y cambiar de agente no inyectaba nada (su proposal y D7).

En el uso, el usuario pasa a plan (Shift+Tab) en la sesión operativa para pensar el paso antes de seguir. Ahí el modelo solo recibía el recordatorio del paso, no el flujo de exploración, y al volver a build no sabía que había habido un desvío. Además, a petición del usuario, el modelo a veces modifica archivos en plan, y si eso deja producto, el plugin encadena la sesión siguiente sin que el usuario sepa que el producto salió de plan. Con las revisiones en plan, Shift+Tab tenía además dos significados según el paso.

Alternativas consideradas:

- **Mantener la decisión anterior.** Deja sin resolver los dos problemas.
- **Impedir que el modelo modifique archivos en plan.** El plugin no controla los permisos del agente, y el usuario a veces quiere esas modificaciones: lo que necesita es saberlo.
- **Dejar las revisiones en plan y no explorar en ellas.** Mantiene los dos significados de Shift+Tab y no deja explorar dentro de una revisión.

## Decision

- **Todas las sesiones del autopilot nacen con el agente build**, también las de revisión. La revisión se protege con su instrucción (no modificar archivos ni pedir commits) y con su cierre por git (ADR-0014).
- **Dentro de la sesión operativa, el agente plan significa explorar.** Lo que el plugin inyecta se decide por turno, comparando el agente del turno con el del anterior, y nunca queda en el historial:
  - de build a plan, el flujo de `openspec-explore` sobre el paso en curso;
  - de plan a plan, un recordatorio de ese flujo;
  - de plan a build, solo el recordatorio del paso de antes del cambio.
- **Lo que se modifica con el agente plan se avisa antes de seguir.** Si un turno en plan termina con el estado de git (HEAD, stage o árbol) distinto del que tenía al empezar, el plugin avisa al usuario. En la TUI, con un modal de un botón que retiene la cadena hasta que el usuario lo cierra; sin TUI, en el mensaje con el que arranca la sesión siguiente, o en el contexto de la misma sesión si no hay producto. La cadena nunca queda retenida para siempre: el aviso se vuelve a pedir al llegar una TUI, y un prompt del usuario en la sesión cuenta como acuse.
- **En Claude Code no hay nada de esto** (ADR-0006): allí el modo plan es del propio agente y no hay plugin.

## Consequences

- Shift+Tab tiene un solo significado en toda la sesión operativa, y el modelo recibe el flujo adecuado en cada agente sin que el usuario lo pida.
- El usuario sabe siempre cuándo algo del ciclo salió de plan antes de que el plugin lo dé por producto y siga.
- El modelo de una revisión, ahora en build, puede editar si desobedece. Lo mitigan la instrucción y git: una edición inesperada se ve en el árbol antes del commit del usuario.
- El plugin depende de que el hook `context` de OpenCode le diga el agente de cada petición. Si deja de hacerlo, el plugin se comporta como antes de este ADR, y eso hay que comprobarlo al subir de versión de OpenCode, como las demás APIs del plugin.
- ADR-0014 y ADR-0011 siguen en vigor: la operación nueva de la TUI (el aviso con acuse) va por el mismo RPC y se libera en la misma limpieza.
