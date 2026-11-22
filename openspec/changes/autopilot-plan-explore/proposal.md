## Why

En la sesión operativa del autopilot, el usuario cambia a menudo al agente plan (Shift+Tab) para pensar en voz alta antes de seguir con el paso. `add-openspec-autopilot` dejó fuera de alcance tratar de forma especial el agente plan o `openspec-explore`, por ser acciones explícitas del usuario, y la spec fija que cambiar de agente no inyecta nada. En la práctica, en plan el modelo sigue recibiendo solo el recordatorio del paso, no el flujo de exploración, y al volver a build no sabe que hubo un desvío. Además, el modelo a veces modifica archivos en plan, casi siempre porque el usuario se lo pide, y si eso produce algo, el plugin encadena la sesión siguiente sin que el usuario sepa que el producto salió de plan. Se revisa ahora aquella decisión: el agente de cada petición ya llega al hook `context`, y el ciclo depende de que lo hecho en plan no pase desapercibido.

## What Changes

- **Todas las sesiones del autopilot arrancan en build**, también las de revisión, que hoy arrancan con el agente plan. La revisión conserva la instrucción de no modificar archivos ni pedir commits. Así, el agente plan dentro de la sesión operativa siempre significa que el usuario quiere explorar.
- **Shift+Tab a plan inyecta el flujo de `openspec-explore`**: la primera petición en plan después de una en build recibe la instrucción de seguir la skill `openspec-explore` sobre el change y el paso en curso, sin implementar. Las peticiones siguientes en plan reciben un recordatorio de ese flujo, en lugar del recordatorio del paso. Cada nuevo Shift+Tab a plan vuelve a inyectar el flujo completo.
- **Volver a build tras un Shift+Tab a plan solo recuerda el paso**: la primera petición en build después de una en plan recibe un recordatorio del flujo que había antes del Shift+Tab (el paso en curso, o la revisión), sin repetir la instrucción completa del paso, que sigue en el historial.
- **Lo modificado en plan se notifica antes de seguir**: si, al quedar en reposo tras un turno en plan, el estado de git (árbol, stage o HEAD) es distinto del que había al empezar ese turno, el plugin avisa al usuario de que en plan se han hecho modificaciones que deberían haberse reservado a build:
  - en la TUI, con un modal de un botón; si ese turno ha dejado producto, la sesión siguiente no se crea hasta que el usuario acepta el modal;
  - sin TUI (UI web, Desktop, `opencode run`), la cadena sigue y el aviso queda como mensaje al principio de la sesión siguiente, o en la misma sesión si no hay producto.
- **BREAKING** (de comportamiento): se sustituye el escenario "Cambiar de agente no inyecta nada" de `openspec-autopilot`, y las revisiones dejan de arrancar con plan.

Fuera de alcance: las sesiones que no son la operativa (siguen con el aviso de siempre), cualquier contrapartida en Claude Code (ADR-0006: allí no hay plugin y el modo plan es del propio agente), e impedir que el modelo modifique archivos en plan: el plugin avisa, no bloquea.

## Capabilities

### New Capabilities

### Modified Capabilities
- `openspec-autopilot`: el agente con el que nacen las sesiones (siempre build), lo que el plugin inyecta al cambiar entre build y plan en la sesión operativa (flujo de `openspec-explore`, recordatorios), y el aviso, en la TUI y sin ella, cuando un turno en plan modifica el estado de git, que en la TUI detiene la cadena hasta que el usuario lo acepta.

## Impact

- Plugin `.opencode/plugins/openspec-autopilot/`: el agente de cada paso (`lib/prompts.mjs`, `WORKFLOW`), los textos nuevos de explore, del recordatorio al volver a build y del aviso; el hook `context` (detectar el cambio de agente y guardar el estado de git al empezar un turno en plan), `experimental.idle` (comparar y retener la cadena) y la TUI (`tui.js`, el modal de aviso que libera la cadena).
- Metadata de la sesión operativa: el último agente visto y el estado de git del turno en plan, siempre leyendo y combinando antes de escribir.
- Suite de aceptación: el simulador de OpenCode (`acceptance-tests/support/agents/opencode-sim.mjs`) tiene que permitir cambiar el agente de una sesión entre peticiones y comprobar el modal que retiene la cadena; los escenarios de `openspec-autopilot` cambian.
- ADR: registra que el autopilot trata el agente plan como exploración, y sustituye dos decisiones de `add-openspec-autopilot` que no llegaron a un ADR: la revisión con el agente plan (D6 de su design) y no tratar de forma especial el agente plan ni `openspec-explore` (su proposal y D7).
- README: la sección del autopilot (las revisiones en build, Shift+Tab a plan y el aviso).
- Proyectos derivados: heredan el comportamiento nuevo del plugin.
