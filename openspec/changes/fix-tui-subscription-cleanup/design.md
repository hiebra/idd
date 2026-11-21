## Context

Los dos plugins locales de OpenCode del proyecto, `openspec-autopilot` (ADR-0008) y `session-bootstrap` (ADR-0002), tienen una parte de TUI que se suscribe a los eventos de su RPC con `context.client.rpc(RPC).events.on(...)`. Ninguna de las dos se da de baja. Las pruebas del 2026-11-21 con OpenCode 2.3.2, hechas en un banco fuera del repositorio y con la TUI manejada por un pseudoterminal, muestran el contrato real:

- **Cada `events.on` es una suscripción propia a `/api/event`.** El cliente la consume en un bucle cuyo error acaba en `console.error`. Si una TUI que lleva su propio servidor (`--standalone`) se cierra con la suscripción viva, esta recibe `ECONNRESET` y se imprime una traza `ClientError: Transport`. Hoy salen tres, una por cada `events.on`: dos de `openspec-autopilot` y una de `session-bootstrap`. Sin plugins no sale ninguna. Sin `--standalone` tampoco, porque el servidor sigue vivo.
- **`events.on(nombre, manejador, { signal })` acepta un `AbortSignal` y devuelve una función para darse de baja.** Abortar no imprime nada.
- **OpenCode ejecuta como limpieza la función que devuelve `setup`**, en la parte de servidor y en la de TUI. Lo hace antes de cada recarga en caliente (al editar `server.js` o `tui.js`, o al cambiar `options`) y al cerrar. Editar `tui.js` recarga también la parte de servidor.
- **Con la limpieza, tras dos recargas solo la carga nueva recibe eventos.** Sin ella, las reciben las tres. Esa es la lección 5 de `.wiki/raw/notes/2026-11-21-ll-sesiones-opencode-autopilot.md`, que por tanto no es un comportamiento fijo de OpenCode.

D13 de `add-openspec-autopilot` (identificador de instancia, generación y una sola respuesta por petición) se diseñó sobre esa lección. Funciona: los duplicados de `openspec-autopilot` no llegan al usuario. `session-bootstrap` no tiene esa defensa: tras una recarga, cada instancia viva muestra el toast de un aviso nuevo, porque cada una lleva su propio registro de avisos mostrados. Esto se deduce del código; no se ha visto en una TUI.

La suite prueba los dos plugins con simuladores que no modelan nada de esto:

- `acceptance-tests/support/agents/opencode-sim.mjs` (el del autopilot) recarga, pero no ejecuta ninguna limpieza, no respeta `signal` y no tiene cierre. Su cabecera da por hecho que los escuchadores sobreviven.
- `acceptance-tests/support/agents/opencode-host.mjs` (el de session-bootstrap) carga el plugin una sola vez y no recarga ni cierra.

## Goals / Non-Goals

**Goals:**
- Las dos partes de TUI liberan sus suscripciones al descargarse. Tras una recarga, solo recibe eventos la carga nueva, y al cerrar con `--standalone` no queda ningún error en el terminal.
- Los dos simuladores modelan el contrato comprobado: limpieza de `setup`, `signal` en `events.on`, recarga y cierre. Así los escenarios nuevos fallan sin el arreglo y pasan con él.
- Queda registrado en un ADR que los plugins del proyecto liberan lo que registran, y por qué ya no se acepta como premisa que los escuchadores sobreviven.

**Non-Goals:**
- Simplificar o retirar D13.
- Cambiar las partes de servidor. Lo que registran con `ctx` (hooks, tools, RPC) ya lo sustituye OpenCode en cada recarga. Fuera de `ctx` solo tienen temporizadores de cada operación y procesos hijos que terminan solos, ninguna suscripción que dure.
- Evitar trazas de otros plugins o del propio OpenCode al cerrar.

## Decisions

### D1. Un `AbortController` por carga y `setup` que devuelve su `abort`

Cada `setup` de TUI crea un `AbortController` y pasa su `signal` a cada `events.on`. Devuelve `() => controller.abort()` siempre, también si algo falló a mitad de `setup`. La función se crea antes del primer `events.on` y se devuelve fuera del `try`, así que nunca lanza.

Alternativas:
- **Guardar las funciones que devuelve cada `events.on` y llamarlas una a una.** Es equivalente, pero con un solo `signal` no hay que llevar la cuenta, y vale también para lo que se suscriba en el futuro.
- **Darse de baja en `process.on('exit')`.** El servidor ya ha muerto cuando llega y no sirve para las recargas.
- **Filtrar `ECONNRESET` en un `unhandledRejection` global.** Ocultaría errores reales de todo el proceso de la TUI, no arreglaría las recargas y la traza ni siquiera es un rechazo sin manejar.
- **No hacer nada, porque solo es ruido.** Las recargas dejan instancias vivas con efectos reales: avisos duplicados en `session-bootstrap` y trabajo inútil en `openspec-autopilot`.

### D2. D13 se mantiene

Con la limpieza, D13 deja de ser necesario en el caso normal, pero sigue protegiendo dos casos:
- la ventana entre que la carga vieja sigue viva y la nueva ya está presentada;
- una petición en vuelo durante una recarga.

Hay un caso concreto en la primera recarga tras actualizar el plugin: la carga anterior es la de antes del arreglo, que no devuelve limpieza, y sigue viva hasta reiniciar OpenCode.

Retirarlo tocaría código probado y no es lo que pide este change. Su descripción en el design archivado sigue siendo cierta como defensa, aunque no como premisa.

### D3. Los simuladores modelan la limpieza, la recarga y el cierre como OpenCode 2.3.2

- **`opencode-sim.mjs`:**
  - guarda la función que devuelve cada `setup`, de servidor y de TUI;
  - en la recarga, ejecuta las limpiezas de la carga anterior antes de los `setup` nuevos;
  - `events.on` respeta `signal` y devuelve una función para darse de baja;
  - tiene una operación nueva, cerrar la TUI con su propio servidor, que ejecuta las limpiezas y después cierra el servidor;
  - cada suscripción que siga viva al cerrar se registra como una traza en el terminal, igual que hace el `console.error` de OpenCode, y también cuenta como error lo que el plugin escriba en `console.error` durante el cierre;
  - la cabecera deja de decir que los escuchadores sobreviven: sobreviven solo si el plugin no los libera.
- **`opencode-host.mjs`:**
  - opciones nuevas para recargar la parte de TUI un número de veces, emitir después un aviso con un índice nuevo por el RPC del plugin y cerrar con su propio servidor, con el mismo registro de trazas;
  - aquí la recarga es solo de la parte de TUI. En OpenCode se recargan las dos, pero volver a ejecutar la parte de servidor relanza el núcleo del arranque (instalación incluida), y lo que se prueba es la suscripción de la TUI. La recarga de las dos partes ya la cubre `opencode-sim.mjs`;
  - el aviso nuevo es sintético: lo emite el host por el RPC, no lo produce el núcleo. La spec habla de lo que pasa con un aviso nuevo, no de cómo nace.

Los escenarios se escriben antes que el arreglo (`spec-as-source`). Con los simuladores al día y los `tui.js` sin cambiar, tienen que fallar por la razón esperada: suscripciones vivas, toasts duplicados y trazas al cerrar.

### D4. Un ADR nuevo, sin sustituir a ADR-0008

El paso `adr` registra una decisión para todos los plugins de OpenCode del proyecto: cada parte devuelve desde `setup` una limpieza que libera lo que registra fuera de `ctx`, y en la TUI eso incluye sus suscripciones. También deja escrito que la premisa de ADR-0008 sobre los escuchadores que sobreviven a una recarga era la consecuencia de no liberarlos.

La decisión de ADR-0008 no cambia, así que no se sustituye (ver Open Questions).

## Risks / Trade-offs

- **[Otra versión de OpenCode cambia el contrato de limpieza o de `signal`]** → Mitigación: la suite no lo detectaría, porque simula OpenCode. Se añade al registro de vigilancia del wiki (`volver-a-comprobar-apis-de-sesion-al-subir-opencode`) repetir las dos pruebas con el banco: las trazas al cerrar con `--standalone` y las instancias que reciben eventos tras dos recargas.
- **[Los simuladores se apartan de OpenCode]**: por ejemplo, el host recarga solo la TUI y el aviso es sintético → Mitigación: se dice en la cabecera de cada simulador y en D3. El comportamiento real se comprobó en el banco, y se repite en la task de prueba final con OpenCode real.
- **[Una limpieza que lanzara una excepción]**: OpenCode la mostraría como un toast de "cleanup failed" → Mitigación: la limpieza solo llama a `abort()`, que no lanza.
- **[La primera recarga tras actualizar el plugin deja viva la carga anterior]**, que no tiene limpieza → Mitigación: D13 la neutraliza en `openspec-autopilot`, y en `session-bootstrap` se arregla reiniciando OpenCode. No merece código propio.

## Migration Plan

Nada que migrar. Al fusionar, la siguiente apertura de OpenCode carga los `tui.js` nuevos, o la siguiente recarga en caliente con la salvedad del último riesgo. La vuelta atrás es revertir el commit del código. No hay estado ni datos afectados.

## Open Questions

- **¿Cómo se corrige la premisa de ADR-0008?** El proyecto solo registra `Supersedes`, y su decisión sigue en vigor, así que este design propone no sustituirlo. El ADR nuevo lo cita y matiza dos frases: la del Context ("cada recarga en caliente deja vivos los escuchadores RPC anteriores") y la de las Consequences ("los escuchadores RPC que sobreviven"). Lo decide el paso `adr`: un ADR nuevo con referencia, o sustituir ADR-0008 por una versión corregida.
