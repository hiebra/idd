---
title: "Lessons Learned: suscripciones de la TUI de OpenCode y su limpieza (fix-tui-subscription-cleanup)"
type: notes
source: session
ingested: 2026-11-22
tags: [lessons-learned, opencode, plugins, rpc, tui, fix-tui-subscription-cleanup]
lesson_kind: lessons-learned
lesson_count: 5
category: notes
confidence: high
summary: "Las trazas ECONNRESET al cerrar opencode --standalone y los escuchadores que sobrevivían a las recargas tenían la misma causa: las partes de TUI no liberaban sus suscripciones. OpenCode 2.3.2 ejecuta como limpieza lo que devuelve setup, y events.on acepta un signal. Incluye cómo se diagnosticó y cómo manejar la TUI real sin tmux."
---

# Lessons Learned: suscripciones de la TUI de OpenCode y su limpieza

> Sesión del 2026-11-21/22 (diagnóstico y change fix-tui-subscription-cleanup), con OpenCode 2.3.2. Todo es [comprobado] en la TUI real salvo que se indique otra cosa. Corrige la regla de la lección 5 de [la nota de las sesiones de OpenCode](2026-11-21-ll-sesiones-opencode-autopilot.md).

## Lección 1: Las trazas ECONNRESET al cerrar con --standalone vienen de las suscripciones vivas de los plugins

**Category**: gotcha
**Context**: Al cerrar `opencode --standalone` justo después de abrirlo, el terminal mostraba tres trazas `ClientError: Transport: ECONNRESET … path: "http://127.0.0.1:<puerto>/api/event"` con código minificado de `$bunfs/root/chunk-*.js`.
**Symptom**: Solo con `--standalone`. Sin él, o tras `opencode service restart` con la TUI ya cerrada, no salía nada.
**Root cause**: Cada `client.events.on(...)` de la parte de TUI de un plugin abre su propia suscripción a `/api/event`, y su bucle termina en un `.catch(console.error)`. Con `--standalone`, la TUI apaga su servidor privado con las suscripciones abiertas. Había tres: dos de `openspec-autopilot` y una de `session-bootstrap`.
**Fix**: Se aisló abriendo y cerrando la TUI en copias del proyecto con los dos plugins, con uno y sin ninguno (9, 3 y 0 `ECONNRESET`; cada traza tiene tres). Después se liberaron las suscripciones (lección 2).
**Rule**: Ante errores de OpenCode al cerrar, compara con y sin cada plugin en copias del proyecto antes de atribuirlos a OpenCode. Una traza por suscripción viva delata un `events.on` que no se da de baja.

## Lección 2: OpenCode 2.3.2 ejecuta como limpieza lo que devuelve setup, y events.on acepta un signal

**Category**: correction
**Context**: Buscar cómo darse de baja, y si eso explicaba la lección 5 (los escuchadores que sobreviven a cada recarga).
**Root cause**: `events.on(nombre, manejador, { signal })` acepta un `AbortSignal` y devuelve una función para darse de baja. Si el `setup` de una parte de un plugin, de servidor o de TUI, devuelve una función, OpenCode la ejecuta antes de cada recarga en caliente (al editar sus archivos o cambiar `options`) y al cerrar. Editar `tui.js` recarga también la parte de servidor.
**Fix**: Con un plugin sonda, tras dos recargas recibían eventos las tres cargas sin limpieza y solo la nueva con ella. Con los plugins reales, las trazas al cerrar bajaron de 9 y 27 (sin recargas y tras dos) a 0 y 0. ADR-0010 lo exige a todos los plugins del proyecto.
**Rule**: En un plugin de OpenCode 2.3.2, ata todas las suscripciones de una carga a un `AbortController` y devuelve desde `setup`, siempre y sin lanzar, la función que lo aborta. Los escuchadores no sobreviven a una recarga si el plugin los libera; la regla de la lección 5 describía lo que pasa sin liberarlos.

## Lección 3: Cuando ni los tipos ni la documentación lo dicen, se puede leer el cliente empaquetado en el binario

**Category**: discovery
**Context**: Saber qué hace `events.on` y si la TUI avisa a los plugins al cerrar. No había paquete `@opencode/plugin` con tipos en la máquina, y no se pudo instalar uno aislado.
**Fix**: `strings -n 6 ~/.opencode/bin/opencode` a un archivo, y buscar con expresiones regulares en Python los literales que salían en la traza (`/api/event`, `rpc.${`, `.setup(`). Salieron la implementación de `events.on` y el registro de plugins de la TUI, que guarda lo que devuelve `setup` en sus `cleanups` y los ejecuta al desactivarlo. `ugrep` falla con patrones como `.{0,300}` en un binario de 250 MB ("exceeds complexity limits").
**Rule**: Para saber cómo se comporta OpenCode en ejecución, lee el código empaquetado partiendo de los literales de un error y confírmalo con una prueba; no te quedes en la lectura (lección 4 de la nota anterior).

## Lección 4: La TUI real se puede manejar sin tmux, con un pseudoterminal y un archivo de órdenes

**Category**: pattern
**Context**: Comprobar en OpenCode real, sin tmux ni `pyte`, que el autopilot sigue funcionando tras dos recargas.
**Fix**:
- `pty.fork()` de Python lanza `opencode --standalone --auto`. El tamaño de ventana se fija con `TIOCSWINSZ`. Un proceso en segundo plano lee órdenes de un archivo (`type`, `key enter`, `reload`, `wait`, `dump`, `count`), y `Ctrl+C` dos veces cierra la TUI.
- El modelo de la copia se fija con un `opencode.json` que tenga `"model": "alibaba/qwen3.8-flash"`. La TUI no tiene una opción para elegirlo.
- Para saber qué atiende la parte de TUI, se instrumenta una copia del plugin para que apunte en un log, con un identificador de carga, cada `setup`, cada limpieza y cada petición.
- La copia del árbol de trabajo, con lo que no tiene commit, se saca con `git archive $(git stash create)`. Cada recarga se provoca editando `tui.js` y haciendo commit en la copia, para que el árbol siga limpio.
- En esa prueba se vio: limpieza antes de cada `setup`; el `select` de la sesión dueña parada y el `navigate` atendidos una sola vez, por la última carga, y 0 `ECONNRESET` al cerrar.
**Rule**: Para probar un plugin de TUI en OpenCode real sin tmux, maneja la TUI con un pseudoterminal y observa lo que hace el plugin con una copia instrumentada, no leyendo la pantalla.

## Lección 5: openspec-git-discipline solo rige dentro de un change

**Category**: correction
**Context**: Se dijo que un cambio de código, por pertenecer al proyecto, tenía que hacerse como change de OpenSpec. El usuario preguntó por qué no se quejó nadie de un commit hecho sin change.
**Root cause**: La skill se aplica a los workflows de OpenSpec (propose, apply, archive). No obliga a que todo cambio de código sea un change. Además, ese commit (`6199cdc`) se había hecho en la rama temporal antes de su única fusión: no rompía nada.
**Fix**: Se propuso el change porque el arreglo corregía una premisa de ADR-0008 y de D13, no porque lo exigiera la skill. Antes de afirmar que se saltó la disciplina, se comprobó en git en qué rama estaba el commit (`git branch -r --contains`).
**Rule**: Decide si algo va en un change por su alcance (si cambia comportamiento especificado o una decisión registrada), no por ser código. Antes de decir que un commit rompió el ciclo, mira en git en qué rama se hizo y cómo llegó a la rama de origen.
