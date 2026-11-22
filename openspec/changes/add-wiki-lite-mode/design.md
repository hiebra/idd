## Context

La guía del wiki (`.agents/wiki/guide.md`) y su recordatorio (`.agents/wiki/reminder.md`) los prepara el núcleo del arranque (`.agents/hooks/session-bootstrap.sh`, modos `guide` y `reminder`) y los entregan los adaptadores: en Claude Code, los hooks `SessionStart` y `UserPromptSubmit`; en OpenCode, el hook `context` del plugin `session-bootstrap` (ADR-0005). El núcleo ya lee `PROJECT_WIKI`: con `off` no instala el motor y no entrega nada. Cualquier otro valor se ignora hoy en silencio.

La guía tiene un identificador por sección (`<!-- wiki-guide:<id> -->`), que el núcleo quita al entregarla y que la suite usa para revisar qué cubre sin depender de la redacción. Sus marcadores de operación (`{{query}}`, `{{ingest}}`) los rellena el núcleo según el agente.

ADRs en vigor que acotan el diseño:

- ADR-0004: el wiki se consulta primero. El modo `lite` es una excepción que elige el usuario (ver Open Questions).
- ADR-0005 y ADR-0010: la guía tiene una sola fuente, llega por el arranque y se desactiva en local con `PROJECT_<NOMBRE>=off`.
- ADR-0009: consultar y modificar son operaciones distintas, y los textos nombran cada operación como se invoca en cada agente.
- ADR-0002: la lógica está en el núcleo y los adaptadores son finos.

## Goals / Non-Goals

**Goals:**
- Dos modos, `full` y `lite`, elegidos por cada usuario con `PROJECT_WIKI`, sin tocar archivos versionados.
- En `full`, la guía y el recordatorio entregados son exactamente los de hoy.
- Una sola fuente para la guía y otra para el recordatorio, con lo propio de cada modo dentro.
- Aviso ante un valor de `PROJECT_WIKI` que no es un modo.

**Non-Goals:**
- Un modo por defecto del proyecto en un archivo versionado.
- Cambiar de modo dentro de una sesión.
- Cambiar el motor, sus operaciones, la resincronización al archivar o el registro de lo descubierto.
- Cambiar los adaptadores.

## Decisions

### D1. El modo sale de `PROJECT_WIKI`

| `PROJECT_WIKI` | Resultado |
|---|---|
| sin definir, vacía o `full` | modo `full` |
| `lite` | modo `lite` |
| `off` | wiki desactivado, como hoy |
| cualquier otro valor | aviso y modo `full` |

- El núcleo tiene una función `wiki_mode` que devuelve `full` o `lite` y la usan los modos `guide` y `reminder`.
- **El aviso lo da el modo principal del núcleo** (el que prepara el proyecto), por stderr con el prefijo `session-start:`, porque es el único cuyo stderr llega al usuario en los dos agentes. Los modos `guide` y `reminder` usan `full` sin avisar, para no repetirlo. El aviso nombra el valor recibido y los modos que existen: `full`, `lite` y `off`.
- El valor se compara tal cual, sin pasar a minúsculas: `Lite` produce el aviso. Así hay una sola forma de cada modo, como con `off`.
- *Alternativa: otra variable, `PROJECT_WIKI_MODE`.* Dos variables para lo mismo admiten combinaciones sin sentido (`PROJECT_WIKI=off` con `PROJECT_WIKI_MODE=lite`). Con una sola, cada valor es un estado del wiki, y la desactivación sigue el patrón `PROJECT_<NOMBRE>=off` de ADR-0010.

### D2. Bloques de modo en la guía y en el recordatorio

Lo propio de un modo va entre dos líneas de marca, cada una sola en su línea:

```markdown
<!-- wiki-mode:full -->
…líneas solo del modo full…
<!-- wiki-mode:end -->
```

y lo mismo con `<!-- wiki-mode:lite -->`. Lo que está fuera de un bloque es común. El núcleo, al preparar el texto de un modo, quita las líneas de los bloques del otro modo y todas las líneas de marca, antes de quitar los identificadores de sección y rellenar los marcadores de operación.

- **El texto del modo `full` es el de hoy, carácter a carácter.** Los bloques solo rodean líneas que ya existen y añaden las de `lite`, colocados para que, al quitarlos, las líneas en blanco queden donde estaban. Un test del núcleo lo comprueba contra la guía y el recordatorio antes del change.
- **El recordatorio** es un solo párrafo. En el archivo, las marcas van en líneas propias, y el núcleo, tras quitar lo del otro modo, junta las líneas que quedan con un espacio. En `full` sale el mismo párrafo de hoy.
- **Un bloque sin cerrar, una marca de un modo que no existe o un bloque dentro de otro** hacen que el texto no se entregue, como hoy un marcador de operación sin rellenar: mejor no entregar la guía que entregar la de los dos modos. El test del núcleo lo cubre.
- *Alternativa: un archivo por modo* (`guide-lite.md`). Duplica todo lo común, que es casi toda la guía, y la spec exige una única fuente.
- *Alternativa: un marcador `{{consulta}}` relleno por el núcleo*, como los de operación. Metería en el núcleo párrafos de la guía, y la guía dejaría de leerse entera en su archivo.

### D3. Qué cambia en la guía

Solo las secciones de cuándo consultar:

- **En bloques `full`**: el encabezado `## Cuándo consultar` con sus tres secciones (`peticiones-con-conocimiento`, `operaciones-sin-conocimiento`, `discernir-peticiones`) y el encabezado `## Consultar antes de responder` con la sección `consultar-antes`.
- **En bloques `lite`**: un encabezado `## Cuándo consultar` con dos secciones nuevas, `consultar-a-peticion` (consulta solo cuando el usuario lo pide expresamente, en solo lectura) y `no-consultar-por-iniciativa` (no por iniciativa propia, aunque la petición requiera conocimiento), y un encabezado `## Cómo consultar`.
- **Comunes**: `orden-de-consulta` y `consultar-con-lectura`, que en los dos modos dicen cómo se consulta, y todo lo demás. «Si el wiki no responde» vale igual en `lite`: se aplica cuando el usuario pidió la consulta.

La guía de `lite` ocupa menos que la de `full`, así que sigue por debajo de los 6.000 caracteres que exige la suite.

### D4. Qué cambia en el recordatorio

La frase de la consulta va en un bloque por modo. En `full`, la de hoy. En `lite`: no consultar el wiki salvo que el usuario lo pida expresamente y, entonces, en solo lectura con `{{query}}`, primero el wiki del proyecto y después el hub, preguntando si no responde. Lo de las lecciones candidatas y la ingesta es común. El de `lite` también tiene que caber en 600 caracteres.

### D5. Los adaptadores no cambian

Los dos adaptadores ya ejecutan el núcleo con el entorno de la sesión: Claude Code, con el `env` de `.claude/settings.json` y `.claude/settings.local.json`; OpenCode, con el entorno desde el que se lanza. Así que `PROJECT_WIKI=lite` llega al núcleo igual que hoy llega `off`, y el aviso del modo principal sale como cualquier otro: `systemMessage` en Claude Code y toast en OpenCode.

### D6. Cómo lo verifica la suite

- **Máquina simulada**: `machine.wikiMode` pone `PROJECT_WIKI` en el entorno, como `wikiDisabled`; en Claude Code, el step lo escribe en `.claude/settings.local.json`. «Un modo que no existe» es `PROJECT_WIKI=light`.
- **La guía de un modo**: `support/` tiene una función que aplica los bloques de D2 a `guide.md`, y `guideAsDelivered(agente, modo)` la usa. Los steps de revisión de la guía (`la guía del wiki del proyecto en el modo <modo>`) revisan los identificadores de sección del texto de ese modo; `no indica …` comprueba que el identificador no está.
- **«Fuera de la consulta, la guía es la misma»**: las líneas de la guía de `lite` y la de `full` que no están en un bloque de modo son las mismas, y los identificadores de sección que solo aparecen en un modo son los de la consulta (D3).
- **«No incluye lo propio del otro modo»**: el contexto no contiene ninguna línea no vacía de los bloques del otro modo.
- **Recordatorio de `lite`**: busca «salvo que el usuario lo pida expresamente» y que no esté «consulta antes».
- **Tests del núcleo** (`core-tests/wiki-markers.test.js` o uno nuevo): los textos de `full` iguales a los de antes del change, la tabla de D1 y los bloques mal formados.

## Risks / Trade-offs

- [En `lite`, el agente responde de memoria lo que el wiki ya sabía] → Es lo que elige el usuario. La guía de `lite` lo deja claro y el recordatorio de cada mensaje lo repite; el usuario puede pedir la consulta en cualquier momento.
- [El modelo puede consultar igualmente, o no consultar cuando se le pide] → Como hasta ahora, la plantilla garantiza qué recibe el agente, no cómo razona (ADR-0004).
- [Un bloque de modo mal cerrado deja al agente sin guía] → El test del núcleo lo detecta antes del commit, y es preferible a entregar una guía con los dos modos mezclados.
- [Quien escribió `PROJECT_WIKI=Lite` cree estar en `lite`] → El aviso de D1 lo dice al abrir la sesión.

## Migration Plan

No hay datos que migrar. Quien no defina `PROJECT_WIKI` sigue en `full` con los mismos textos. Para volver atrás, se revierten los commits del change; `PROJECT_WIKI=lite` pasaría entonces a ignorarse.

## Open Questions

- **ADR-0004** decide «wiki primero» sin excepciones. El modo `lite` no lo invalida (sigue siendo el modo por defecto), pero añade una excepción que elige cada usuario. El paso de ADR registra un ADR nuevo que lo complementa, como ADR-0009, sin sustituirlo.
