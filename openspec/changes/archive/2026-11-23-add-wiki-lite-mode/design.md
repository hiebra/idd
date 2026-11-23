## Context

Con el wiki habilitado (ADR-0021), la guía (`.agents/wiki/guide.md`) y el recordatorio (`.agents/wiki/reminder.md`) los prepara el núcleo del arranque (`.agents/hooks/session-bootstrap.sh`, modos `guide` y `reminder`) y los entregan los adaptadores: en Claude Code, los hooks `SessionStart` y `UserPromptSubmit`; en OpenCode, el hook `context` del plugin `session-bootstrap`. El núcleo lee `enabled` de `.agents/wiki/engine.json` (`wiki_enabled`, sin Node) y con el wiki deshabilitado no entrega nada. El comando `/toggle-wiki` (uno por agente, con la misma estructura de pasos con marca `<!-- toggle-wiki:<id> -->`) delega lo determinista en el modo `wiki <status|on|off>` del núcleo, que cambia `enabled` con `set_enabled`, edita `openspec/config.yaml` y pasa al stage, sin commit.

La guía tiene un identificador por sección (`<!-- wiki-guide:<id> -->`), que el núcleo quita al entregarla y que la suite usa para revisar qué cubre sin depender de la redacción. Sus marcadores de operación (`{{query}}`, `{{ingest}}`) los rellena el núcleo según el agente.

ADRs en vigor que acotan el diseño (los de `adr/` que no sustituye otro posterior):

- ADR-0021: el wiki se enciende para todo el proyecto con un ajuste versionado en `engine.json`; no hay apagado por usuario ni variable local; `/toggle-wiki` es la única forma prevista de cambiar el ajuste; del proyecto solo se lee el ajuste, `config.yaml` y `.wiki/`; «wiki primero» sigue vigente con el wiki encendido. Sustituye a ADR-0004, ADR-0005 y ADR-0010.
- ADR-0009: consultar y modificar son operaciones distintas, y los textos nombran cada operación como se invoca en cada agente.
- ADR-0002: la lógica está en el núcleo y los adaptadores son finos.
- ADR-0018: en OpenCode, el wiki sigue en `session-bootstrap`.

## Goals / Non-Goals

**Goals:**
- Dos modos del wiki habilitado, `full` y `lite`, declarados por el proyecto en `engine.json` y cambiados con `/toggle-wiki lite|full`.
- En `full`, la guía y el recordatorio entregados son exactamente los de hoy, y un `engine.json` sin `"mode"` es `full`.
- Una sola fuente para la guía y otra para el recordatorio, con lo propio de cada modo dentro.
- Aviso ante un valor de `"mode"` que no es un modo.

**Non-Goals:**
- Un modo por usuario o por sesión, o una variable de entorno que lo cambie (ADR-0021 quitó `PROJECT_WIKI`).
- Que cambiar el modo habilite o deshabilite el wiki.
- Cambiar el motor, sus operaciones, la resincronización al archivar o el registro de lo descubierto.
- Cambiar los adaptadores.

## Decisions

### D1. El modo es el campo `"mode"` de `engine.json`

| `"mode"` en `engine.json` | Resultado |
|---|---|
| falta | modo `full` |
| `"full"` | modo `full` |
| `"lite"` | modo `lite` |
| cualquier otra cosa (`"light"`, `"Lite"`, `""`, `lite` sin comillas, un número) | aviso y modo `full` |

- **El modo solo importa con el wiki habilitado.** Con `enabled` distinto de `true`, el núcleo no lee el modo ni avisa: no existe nada del wiki (ADR-0021).
- El núcleo tiene `wiki_current_mode`, que devuelve `full` o `lite` y usan los modos `guide`, `reminder`, `status` y el principal. Lee el campo con `engine_field` (sin Node) y distingue «falta» de «tiene un valor inválido» comprobando por separado si la clave aparece: `engine_field` devuelve vacío tanto para `"mode": ""` como para `"mode": lite`, y los dos deben avisar.
- El valor se compara tal cual, sin pasar a minúsculas: `"Lite"` produce el aviso. Así hay una sola forma de cada modo.
- **El aviso lo dan el modo principal del núcleo (el de la sesión) y `wiki status`**, por stderr con el prefijo `session-start:`, porque el stderr del principal es el que llega al usuario en los dos agentes, y `status` es lo que lee `/toggle-wiki`. Los modos `guide` y `reminder` usan `full` sin avisar, para no repetirlo en cada mensaje. El aviso nombra el valor recibido, los modos que existen (`full` y `lite`) y cómo corregirlo: `/toggle-wiki full` o `/toggle-wiki lite`.
- *Alternativa: guardar el modo en otro archivo o en `openspec/config.yaml`.* Rechazada por ADR-0021: `engine.json` es el sitio del ajuste del wiki, y OpenSpec valida `config.yaml`.
- *Alternativa: un modo por usuario, en una variable local.* Fuera de alcance: ADR-0021 quitó el apagado por usuario para que el wiki sea igual para todo el proyecto, y en `lite` pedir la consulta expresamente ya cubre el caso puntual.

### D2. Bloques de modo en la guía y en el recordatorio

Lo propio de un modo va entre dos líneas de marca, cada una sola en su línea:

```markdown
<!-- wiki-mode:full -->
…líneas solo del modo full…
<!-- wiki-mode:end -->
```

y lo mismo con `<!-- wiki-mode:lite -->`. Lo que está fuera de un bloque es común. El núcleo, al preparar el texto de un modo, quita las líneas de los bloques del otro modo y todas las líneas de marca, antes de quitar los identificadores de sección y rellenar los marcadores de operación.

- **El texto del modo `full` es el de hoy, carácter a carácter.** Los bloques solo rodean líneas que ya existen y añaden las de `lite`, colocados para que, al quitarlos, las líneas en blanco queden donde estaban. Un test del núcleo lo comprueba contra la guía y el recordatorio anteriores al change.
- **El recordatorio** es un solo párrafo. En el archivo, las marcas van en líneas propias, y el núcleo, tras quitar lo del otro modo, junta las líneas que quedan con un espacio. En `full` sale el mismo párrafo de hoy.
- **Un bloque sin cerrar, una marca de un modo que no existe o un bloque dentro de otro** hacen que el texto no se entregue, como hoy un marcador de operación sin rellenar: mejor no entregar la guía que entregar la de los dos modos. El test del núcleo lo cubre.
- *Alternativa: un archivo por modo* (`guide-lite.md`). Duplica casi toda la guía, y la spec exige una única fuente.
- *Alternativa: un marcador `{{consulta}}` relleno por el núcleo*, como los de operación. Metería en el núcleo párrafos de la guía, y la guía dejaría de leerse entera en su archivo.

### D3. Qué cambia en la guía

Solo las secciones de cuándo consultar:

- **En bloques `full`**: el encabezado `## Cuándo consultar` con sus tres secciones (`peticiones-con-conocimiento`, `operaciones-sin-conocimiento`, `discernir-peticiones`) y el encabezado `## Consultar antes de responder` con la sección `consultar-antes`.
- **En bloques `lite`**: un encabezado `## Cuándo consultar` con dos secciones nuevas, `consultar-a-peticion` (consulta solo cuando el usuario lo pide expresamente, en solo lectura) y `no-consultar-por-iniciativa` (no por iniciativa propia, aunque la petición requiera conocimiento), y un encabezado `## Cómo consultar`.
- **Comunes**: `orden-de-consulta` y `consultar-con-lectura`, que en los dos modos dicen cómo se consulta, y todo lo demás. «Si el wiki no responde» vale igual en `lite`: se aplica cuando el usuario pidió la consulta.

La guía de `lite` ocupa menos que la de `full`, así que sigue por debajo de los 6.000 caracteres que exige la suite.

### D4. Qué cambia en el recordatorio

La frase de la consulta va en un bloque por modo. En `full`, la de hoy. En `lite`: no consultar el wiki salvo que el usuario lo pida expresamente y, entonces, en solo lectura con `{{query}}`, primero el wiki del proyecto y después el hub, preguntando si no responde. Lo de las lecciones candidatas y la ingesta es común. El de `lite` también tiene que caber en 600 caracteres. Como el recordatorio se genera con cada mensaje, un cambio de modo vale desde el mensaje siguiente.

### D5. El núcleo cambia el modo: `wiki mode <full|lite>`

El modo `wiki` del núcleo gana la acción `mode`, junto a `status`, `on` y `off`: `session-bootstrap.sh wiki mode <full|lite> <directorio>`. (La función que despacha las acciones se llama ya `wiki_mode`; la nueva acción no tiene relación con ella.)

- **Qué escribe.** Solo `"mode"` en `engine.json`, sin reescribir el resto: `set_enabled` se generaliza en `set_field NOMBRE VALOR`, que cambia el campo si existe y, si no, lo inserta tras la llave de apertura, como ya hace con `enabled`. Si `engine.json` no existe o está vacío, lo crea con solo `"mode"`, de modo que el wiki sigue deshabilitado (falta `enabled`).
- **Qué no toca.** No cambia `enabled`, ni `config.yaml`, ni el motor, ni `.wiki/`. Con el wiki deshabilitado, declara el modo y nada más.
- **Cuándo no cambia nada.** Si el valor declarado ya es el pedido, o falta y el pedido es `full`, no escribe ni pasa al stage: `full` no se declara si ya es el efecto de no declarar nada. Un valor inválido sí se reescribe, aunque el pedido sea `full`: es la forma de corregirlo.
- **Qué imprime**, como las demás acciones, en líneas `clave=valor`: `changed=true|false`, `mode=<modo efectivo>`, `enabled=true|false` y, si ha cambiado, `staged=<ruta de engine.json>`. Pasa al stage solo `engine.json`, sin commit. Cualquier otro argumento no escribe nada, avisa por stderr con los modos que existen y sale con 0, como el resto del núcleo.
- **`status` gana `mode=<full|lite>`**, el efectivo, y avisa si el valor declarado no es un modo (D1).
- **`wiki on` y `wiki off` conservan `"mode"`**: `set_enabled` solo cambia `enabled`. Un test lo comprueba con los dos valores.

### D6. `/toggle-wiki` con argumento, en los dos comandos

Los dos comandos (`.claude/commands/toggle-wiki.md` y `.opencode/commands/toggle-wiki.md`) reciben el argumento con `$ARGUMENTS`, que ya admiten los dos agentes. Un paso nuevo, `<!-- toggle-wiki:mode -->`, va antes de los pasos del estado:

- **Argumento `lite` o `full`**: ejecuta `wiki mode <argumento> .`, informa con las palabras del paso 5 y para. Los pasos de habilitar y deshabilitar no se ejecutan.
- **Cualquier otro argumento**, incluido `Lite`: no ejecuta nada, dice que ese modo no existe y nombra `full` y `lite`.
- **Sin argumento**: el flujo de hoy, sin ningún cambio.

El paso 5 gana tres textos: modo cambiado («queda en el modo X; `.agents/wiki/engine.json` está en el stage, haz el commit para que valga para todos; el recordatorio cambia desde tu mensaje siguiente y la guía, desde la sesión siguiente»), modo sin cambio («el wiki ya estaba en el modo X; no he cambiado nada») y wiki deshabilitado («el modo queda declarado, pero el wiki sigue deshabilitado: `/toggle-wiki`, sin argumento, lo habilita»). Siguen el comando de cada agente sin duplicar lógica (ADR-0002); el estado de `status` también lleva `mode=`, para que el informe del comando diga el modo de partida.

### D7. Los adaptadores no cambian

Los dos adaptadores ya ejecutan los modos `guide` y `reminder` del núcleo, que leen `engine.json` cada vez, así que el modo les llega sin tocarlos. El aviso del modo principal sale como cualquier otro: `systemMessage` en Claude Code y toast en OpenCode.

### D8. Cómo lo verifica la suite

- **Clon de prueba**: `support/machine.js` ya pone `enabled` en el `engine.json` del proyecto de prueba; gana el modo (`wikiMode`), escrito en el mismo archivo, y los pasos `con el wiki habilitado en el modo <modo>`, `... sin declarar ningún modo` y `... en un modo que no existe`. Con el wiki deshabilitado y el modo lite declarado, el paso lo escribe sin habilitar. «Un modo que no existe» es `"light"`.
- **La guía de un modo**: `support/` tiene una función que aplica los bloques de D2 a `guide.md`, y `guideAsDelivered(agente, modo)` la usa. Los steps de revisión de la guía (`la guía del wiki del proyecto en el modo <modo>`) revisan los identificadores de sección del texto de ese modo; `no indica …` comprueba que el identificador no está.
- **«Fuera de la consulta, la guía es la misma»**: las líneas de la guía de `lite` y de `full` que no están en un bloque de modo son las mismas, y los identificadores de sección que solo aparecen en un modo son los de la consulta (D3).
- **«No incluye lo propio del otro modo»**: el contexto no contiene ninguna línea no vacía de los bloques del otro modo.
- **Recordatorio de `lite`**: busca «salvo que el usuario lo pida expresamente» y que no esté «consulta antes».
- **`/toggle-wiki` con argumento**: el soporte de `toggle-wiki.js` sigue ejecutando el núcleo como lo haría el comando, y comprueba que los dos comandos tienen el paso `toggle-wiki:mode` y usan `$ARGUMENTS`.
- **Tests del núcleo** (`core-tests/wiki-markers.test.js` y `core-tests/wiki-toggle.test.js`): los textos de `full` iguales a los de antes del change, la tabla de D1 (incluidos `"mode": ""` y sin comillas), los bloques mal formados, la acción `mode` (escribe, inserta, no escribe si no cambia, corrige un valor inválido, no toca `enabled` ni `config.yaml`, con el wiki deshabilitado y con `engine.json` ausente) y que `on` y `off` conservan el modo.

## Risks / Trade-offs

- [En `lite`, el agente responde de memoria lo que el wiki ya sabía] → Es lo que declara el proyecto. La guía de `lite` lo deja claro y el recordatorio de cada mensaje lo repite; el usuario puede pedir la consulta en cualquier momento.
- [El modelo puede consultar igualmente, o no consultar cuando se le pide] → Como hasta ahora, la plantilla garantiza qué recibe el agente, no cómo razona (ADR-0021, que mantiene de ADR-0004 esa garantía).
- [Un bloque de modo mal cerrado deja al agente sin guía] → El test del núcleo lo detecta antes del commit, y es preferible a entregar una guía con los dos modos mezclados.
- [Un `"mode"` mal escrito, como `"Lite"`, deja el wiki en `full` sin que se note] → El aviso de D1 sale al abrir la sesión y en `status`, y `/toggle-wiki lite` lo corrige.
- [El modo es del proyecto, así que un usuario que prefiere `lite` solo lo tiene si el proyecto lo declara] → Es la consecuencia de ADR-0021: el wiki es igual para todos los que usan el repositorio. Pedir la consulta expresamente sigue valiendo en `full`.
- [`/toggle-wiki lite` con el wiki deshabilitado puede parecer que lo habilita] → El informe dice que el wiki sigue deshabilitado y cómo habilitarlo.

## Migration Plan

No hay datos que migrar. Un proyecto sin `"mode"` sigue en `full` con los mismos textos. Para volver atrás, se revierten los commits del change; un `"mode": "lite"` ya declarado pasaría entonces a ignorarse, y el wiki quedaría en `full`.

## Open Questions

- **ADR-0021** mantiene «wiki primero» con el wiki encendido, sin excepciones. El modo `lite` no lo invalida, porque `full` sigue siendo el modo por defecto, pero añade una excepción que declara el proyecto. El paso de ADR registra un ADR nuevo que complementa a ADR-0021 sin sustituirlo, como ADR-0009 complementó a ADR-0004.
