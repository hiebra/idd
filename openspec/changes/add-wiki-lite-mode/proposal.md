## Why

El flujo del wiki tiene hoy una sola forma: ante cada petición que requiere conocimiento, el agente consulta el wiki antes de responder, y si el wiki no responde se detiene a preguntar al usuario. Es lo que se quiere cuando el conocimiento del wiki importa, pero se paga en cada petición: lecturas del wiki y, si no responde, una pregunta. La única alternativa es `PROJECT_WIKI=off`, que lo quita todo: el motor, la guía y el recordatorio. No hay término medio para quien quiere tener el wiki a mano y al día, pero decidir él cuándo se consulta.

El usuario pide que el wiki tenga dos modos: **lite**, en el que el wiki no se consulta si no se pide expresamente, y **full**, el actual.

## What Changes

- **Dos modos del wiki**, `full` y `lite`:
  - **`full`** es el flujo actual, sin ningún cambio: el agente consulta el wiki antes de responder a una petición que requiere conocimiento, y discierne cuáles lo requieren.
  - **`lite`**: el agente no consulta el wiki por iniciativa propia, aunque la petición requiera conocimiento. Lo consulta solo cuando el usuario se lo pide expresamente, y entonces igual que en `full`: en solo lectura, primero el wiki del proyecto y después el hub, citando los artículos y preguntando al usuario si el wiki no responde.
- **Lo demás es igual en los dos modos**: el motor instalado con sus operaciones, dónde registrar, modificar el wiki solo con su operación de escritura y con confirmación, apuntar las lecciones candidatas y proponerlas en un punto de cierre, proponer la ingesta de lo encontrado en internet, los productos del proyecto como fuentes y la resincronización al archivar un change.
- **El modo lo elige cada usuario en local**, con la misma variable que hoy desactiva el wiki: `PROJECT_WIKI=lite`. Sin valor, o con `full`, el modo es `full`, así que nada cambia para quien no elija. `PROJECT_WIKI=off` sigue desactivando el wiki. Elegir un modo no toca ningún archivo versionado.
- **Un valor que no es un modo** (por ejemplo, `PROJECT_WIKI=light`) no se ignora en silencio: el arranque de sesión avisa, nombra los modos que existen y usa `full`.
- **La guía y el recordatorio siguen teniendo una única fuente cada uno** (`.agents/wiki/guide.md` y `.agents/wiki/reminder.md`). Lo propio de cada modo va marcado dentro del mismo archivo, y el núcleo del arranque entrega lo que corresponde al modo. En el modo `full`, el agente recibe exactamente los mismos textos que hoy.
- **El recordatorio de cada mensaje sigue al modo**: en `lite` recuerda no consultar el wiki salvo petición expresa, en lugar de consultar antes de responder. Lo demás del recordatorio no cambia.

**Supuestos de esta propuesta.** El usuario ha fijado qué es cada modo, pero no estos tres puntos. La propuesta los resuelve así, y pueden cambiarse al revisarla:

1. **El modo por defecto es `full`**, porque es el comportamiento actual: quien no elige nada no nota el change.
2. **El modo es una preferencia de cada usuario, no del proyecto**, como `PROJECT_WIKI=off` (ADR-0005, ADR-0010) y el modo auto del autopilot. Por eso no se declara en ningún archivo versionado.
3. **`lite` solo cambia cuándo se consulta el wiki.** El registro de lo que se descubre y la resincronización al archivar siguen igual, para que el wiki no se quede atrás y sirva cuando se consulte.

Fuera de alcance:

- Un modo por defecto por proyecto, declarado en un archivo versionado.
- Cambiar de modo dentro de una sesión: el modo es el que hay al abrirla. En `lite`, pedir la consulta expresamente ya cubre el caso puntual.
- Que el agente consulte o no de verdad: como hasta ahora, la plantilla garantiza qué flujo recibe el agente, no cómo razona el modelo (ADR-0004).

## Capabilities

### New Capabilities

### Modified Capabilities
- `llm-wiki`: el wiki pasa a tener dos modos, y cada usuario elige el suyo en local, sin cambiar archivos versionados. Sin elección, el modo es `full`. En `lite`, el motor y sus operaciones siguen disponibles. Un modo que no existe produce un aviso y deja el wiki en `full`.
- `wiki-first-knowledge`: los cambios son cuatro:
  - la guía sigue siendo un único archivo, con lo propio de cada modo dentro, y el agente recibe solo lo del modo del usuario;
  - consultar antes de responder y discernir qué peticiones requieren conocimiento pasan a ser requisitos del modo `full`;
  - en el modo `lite`, la guía indica consultar solo a petición expresa del usuario, y el resto de la guía es igual que en `full`;
  - el recordatorio de cada mensaje tiene una versión por modo.

## Impact

- `.agents/wiki/guide.md` y `.agents/wiki/reminder.md`: las partes propias de cada modo, marcadas.
- `.agents/hooks/session-bootstrap.sh`: el núcleo lee el modo de `PROJECT_WIKI`, entrega la guía y el recordatorio de ese modo y avisa de un valor que no es un modo.
- Adaptadores (`.claude/hooks/`, `.opencode/plugins/session-bootstrap/`): no deberían cambiar, porque ya piden los textos al núcleo con el entorno de la sesión. La suite lo comprueba en los dos agentes.
- Suite: steps de `wiki.steps.js` para los modos, la guía "tal como se entrega" según el modo, el entorno de la máquina simulada y tests del núcleo para los bloques de modo y los valores de `PROJECT_WIKI`.
- README: los dos modos y cómo elegir uno en cada agente.
- Un ADR nuevo: ADR-0004 decide «wiki primero» sin excepciones, y el modo `lite` es una excepción que elige el usuario.
- El artículo del wiki `flujo-wiki-first` describe el flujo actual. Se resincroniza al archivar.
