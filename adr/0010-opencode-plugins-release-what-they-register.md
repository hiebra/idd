# ADR-0010: Los plugins de OpenCode del proyecto liberan al descargarse lo que registran

- Status: accepted
- Date: 2026-11-22
- Supersedes: -

## Context

El proyecto tiene dos plugins locales de OpenCode 2: el adaptador del arranque de sesión (`session-bootstrap`, ADR-0002) y `openspec-autopilot` (ADR-0008). Los dos tienen una parte de TUI que se suscribe a los eventos de su RPC, y ninguna se daba de baja. Eso tenía dos efectos:

- Al cerrar una TUI que lleva su propio servidor (`opencode --standalone`), cada suscripción viva imprimía en el terminal una traza `ClientError: Transport … ECONNRESET`.
- Tras cada recarga en caliente, las cargas anteriores de la parte de TUI seguían recibiendo eventos.

ADR-0008 toma lo segundo como una restricción de OpenCode 2.3.2 ("cada recarga en caliente deja vivos los escuchadores RPC anteriores"), y por ella `add-openspec-autopilot` diseñó un RPC con identificador de instancia, generación y una sola respuesta por petición. Las pruebas del 2026-11-21 con OpenCode 2.3.2 desmienten esa premisa:

- `events.on(nombre, manejador, { signal })` permite darse de baja.
- OpenCode ejecuta como limpieza la función que devuelve el `setup` de un plugin, en la parte de servidor y en la de TUI, antes de cada recarga en caliente y al cerrar.

Con esa limpieza, tras una recarga solo recibe eventos la carga nueva, y al cerrar no queda ninguna traza. Los escuchadores sobrevivían porque los plugins no los liberaban.

La decisión de ADR-0008 sigue en vigor: el plugin, una sesión por paso, el estado en la metadata y los modos. Lo que cambia es una de las restricciones de su contexto y la consecuencia que se deriva de ella. Por eso este ADR matiza ADR-0008 y no lo sustituye.

Alternativas consideradas:

- **Aceptar las trazas como ruido de OpenCode y seguir neutralizando los duplicados en cada plugin.** Obliga a que cada plugin con eventos tenga su propia defensa. `session-bootstrap` no la tiene, y cada carga viva mostraría el mismo aviso.
- **Silenciar `ECONNRESET` con un manejador global.** Oculta errores reales de todo el proceso de la TUI y no resuelve las recargas.
- **Sustituir ADR-0008 por una versión corregida.** Repetiría una decisión que no cambia para corregir una frase de su contexto.

## Decision

- **Cada parte de un plugin de OpenCode del proyecto devuelve desde `setup` una función de limpieza** que libera lo que esa carga ha registrado y que OpenCode no libera por sí mismo. En la parte de TUI, eso incluye todas sus suscripciones a eventos. La función se devuelve siempre, también si `setup` falla a medias, y nunca lanza una excepción.
- **Las suscripciones de una carga se atan a un único `AbortSignal`**, y la limpieza lo aborta.
- **No se da por hecho que algo sobrevive a una recarga** si el plugin puede liberarlo. Lo que se diga en el futuro sobre lo que sobrevive tiene que comprobarse con la limpieza en marcha.
- **La suite simula ese contrato**: la limpieza de `setup` en cada recarga y al cerrar, y una traza en el terminal por cada suscripción que siga viva cuando se cierra el servidor.

Las defensas que ya existen ante cargas duplicadas, como el RPC con identificador y generación de `openspec-autopilot`, se mantienen. Ya no sostienen el caso normal, pero siguen protegiendo de las carreras durante una recarga.

El comportamiento está especificado en `openspec/specs/openspec-autopilot/spec.md` y `openspec/specs/session-bootstrap/spec.md`.

## Consequences

- Al cerrar OpenCode con `--standalone`, los plugins del proyecto no dejan errores en el terminal, y tras una recarga cada evento lo atiende una sola carga.
- Un plugin nuevo del proyecto, o una suscripción nueva en uno existente, tiene que pasar por la limpieza de su carga. Si no lo hace, la suite lo detecta al cerrar.
- De la lista de comportamientos de OpenCode 2.3.2 de los que depende ADR-0008 y que hay que volver a comprobar al subir de versión, salen los escuchadores RPC que sobreviven y entra el contrato de limpieza: la función de `setup` y el `signal` de `events.on`.
- La primera recarga tras actualizar un plugin a esta versión deja viva la carga anterior, que no tiene limpieza, hasta que se reinicia OpenCode.
