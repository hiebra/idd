## Why

Las partes de TUI de los dos plugins de OpenCode (`openspec-autopilot` y `session-bootstrap`) se suscriben a los eventos de su RPC y nunca se dan de baja. Al cerrar la TUI con `opencode --standalone`, cada suscripción viva imprime en el terminal una traza `ClientError: Transport … ECONNRESET` sobre `/api/event`. Tras cada recarga en caliente, el escuchador de la instancia anterior sigue recibiendo eventos.

Lo segundo es la lección 5 de `.wiki/raw/notes/2026-11-21-ll-sesiones-opencode-autopilot.md`, que ADR-0008 y la decisión D13 de `add-openspec-autopilot` tomaron como un comportamiento fijo de OpenCode 2.3.2. No lo es. Las pruebas del 2026-11-21 con OpenCode 2.3.2 lo demuestran:

- `events.on(nombre, manejador, { signal })` permite darse de baja.
- OpenCode ejecuta como limpieza la función que devuelve el `setup` de un plugin, en la parte de servidor y en la de TUI, antes de cada recarga y al cerrar.

Con esa limpieza, no queda ninguna traza al cerrar y solo la instancia nueva recibe eventos tras recargar.

## What Changes

- **Las partes de TUI liberan sus suscripciones**: cada `client.events.on(...)` de `openspec-autopilot/tui.js` y de `session-bootstrap/tui.js` recibe el `signal` de un `AbortController` de la instancia. El `setup` devuelve una función que lo aborta.
- **El simulador de OpenCode de la suite modela la limpieza**: ejecuta la función que devuelve `setup` al recargar y al cerrar, respeta el `signal` de `events.on`, y trata como error una suscripción que siga viva cuando el servidor se cierra.
- **Un ADR nuevo corrige la premisa de ADR-0008**: los escuchadores no sobreviven a una recarga si el plugin los libera. ADR-0008 queda matizado, no sustituido.
- **D13 se mantiene**: el identificador de instancia, la generación y la respuesta única siguen como defensa ante carreras durante una recarga y ante peticiones en vuelo.

Queda fuera de alcance simplificar o retirar D13. Si se plantea, irá en otro change, cuando haya experiencia con la limpieza.

## Capabilities

### New Capabilities

### Modified Capabilities
- `openspec-autopilot`: un requisito nuevo. Al recargarse o al cerrarse la TUI, el plugin libera sus suscripciones. Tras una recarga solo atiende los eventos la instancia nueva, y al cerrar no deja errores en el terminal.
- `session-bootstrap`: un requisito nuevo para el adaptador de OpenCode. Su parte de TUI libera la suscripción a los avisos al recargarse y al cerrarse, sin dejar errores en el terminal.

## Impact

- `.opencode/plugins/openspec-autopilot/tui.js` y `.opencode/plugins/session-bootstrap/tui.js`. Las partes de servidor no cambian.
- `acceptance-tests/support/agents/opencode-sim.mjs` y los pasos de la suite que manejan la recarga y el cierre de la TUI.
- `adr/`: un ADR nuevo que matiza ADR-0008.
- El wiki del proyecto, en la resincronización tras el archive:
  - la regla de la lección 5 se queda en lo que se observó sin limpieza;
  - el artículo `ciclo-de-un-change-y-autopilot.md` ya no dice que los escuchadores anteriores siguen vivos;
  - se registra la limpieza de `setup` como API de plugin de OpenCode 2.3.2.
- Claude Code: nada. Ninguno de los dos plugins existe allí, y la asimetría de ADR-0006 no cambia.
