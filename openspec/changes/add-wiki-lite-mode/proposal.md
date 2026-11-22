## Why

Con el wiki del proyecto habilitado (ADR-0021), el flujo tiene una sola forma: ante cada petición que requiere conocimiento, el agente consulta el wiki antes de responder y, si el wiki no responde, se detiene a preguntar al usuario. Es lo que se quiere cuando el conocimiento del wiki importa, pero se paga en cada petición: lecturas del wiki y, si no responde, una pregunta. La única alternativa es deshabilitar el wiki con `/toggle-wiki`, que lo quita todo: el motor, la guía, el recordatorio y la resincronización al archivar. No hay término medio para un proyecto que quiere tener el wiki a mano y al día, pero que se consulte solo cuando se pide.

El usuario pide que el wiki tenga dos modos: **lite**, en el que el wiki no se consulta si no se pide expresamente, y **full**, el actual.

## What Changes

- **Dos modos del wiki habilitado**, `full` y `lite`:
  - **`full`** es el flujo actual, sin ningún cambio: el agente consulta el wiki antes de responder a una petición que requiere conocimiento, y discierne cuáles lo requieren.
  - **`lite`**: el agente no consulta el wiki por iniciativa propia, aunque la petición requiera conocimiento. Lo consulta solo cuando el usuario se lo pide expresamente, y entonces igual que en `full`: en solo lectura, primero el wiki del proyecto y después el hub, citando los artículos y preguntando al usuario si el wiki no responde.
- **Lo demás es igual en los dos modos**: el motor instalado con sus operaciones, dónde registrar, modificar el wiki solo con su operación de escritura y con confirmación, apuntar las lecciones candidatas y proponerlas en un punto de cierre, proponer la ingesta de lo encontrado en internet, los productos del proyecto como fuentes y la resincronización al archivar un change.
- **El modo es un ajuste del proyecto**, como `enabled` (ADR-0021): `"mode"` en `.agents/wiki/engine.json`, versionado y el mismo para todos los que usan el repositorio. Si falta, el modo es `full`, así que nada cambia para un proyecto que no lo declara. Ninguna preferencia local lo cambia.
- **`/toggle-wiki lite` y `/toggle-wiki full` cambian el modo.** Como el `/toggle-wiki` de siempre, que sin argumento sigue habilitando o deshabilitando el wiki: no hacen commit, dejan el cambio en el stage y dicen desde cuándo vale. Cambiar el modo no habilita ni deshabilita el wiki.
- **Un valor de `"mode"` que no es un modo** (por ejemplo, `"light"`) no se ignora en silencio: el arranque de sesión avisa, nombra los modos que existen y usa `full`.
- **La guía y el recordatorio siguen teniendo una única fuente cada uno** (`.agents/wiki/guide.md` y `.agents/wiki/reminder.md`). Lo propio de cada modo va marcado dentro del mismo archivo, y el núcleo del arranque entrega lo que corresponde al modo. En el modo `full`, el agente recibe exactamente los mismos textos que hoy.
- **El recordatorio de cada mensaje sigue al modo**: en `lite` recuerda no consultar el wiki salvo petición expresa, en lugar de consultar antes de responder. Lo demás del recordatorio no cambia.

**Supuestos de esta propuesta.** El usuario ha fijado qué es cada modo y que el modo es del proyecto. Lo demás se resuelve así, y puede cambiarse al revisarla:

1. **El modo por defecto es `full`**, porque es el comportamiento actual: un proyecto que no declara el modo no nota el change.
2. **`lite` solo cambia cuándo se consulta el wiki.** El registro de lo que se descubre y la resincronización al archivar siguen igual, para que el wiki no se quede atrás y sirva cuando se consulte.
3. **El modo se cambia con el mismo comando que habilita el wiki**, con un argumento, en lugar de con un comando nuevo: ADR-0021 hace de `/toggle-wiki` la única forma prevista de cambiar el ajuste del wiki.

Fuera de alcance:

- Un modo por usuario o por sesión. En `lite`, pedir la consulta expresamente ya cubre el caso puntual.
- Que `/toggle-wiki lite` habilite el wiki si está deshabilitado: son dos cambios distintos del proyecto, y cada uno tiene su forma.
- Que el agente consulte o no de verdad: como hasta ahora, la plantilla garantiza qué flujo recibe el agente, no cómo razona el modelo (ADR-0004).

## Capabilities

### New Capabilities

### Modified Capabilities
- `llm-wiki`: el wiki habilitado tiene dos modos, declarados en el ajuste del proyecto y, si no, `full`. `/toggle-wiki` cambia el modo con un argumento. Un modo que no existe produce un aviso y deja el wiki en `full`.
- `wiki-first-knowledge`: los cambios son cuatro:
  - la guía sigue siendo un único archivo, con lo propio de cada modo dentro, y el agente recibe solo lo del modo del proyecto;
  - consultar antes de responder y discernir qué peticiones requieren conocimiento pasan a ser requisitos del modo `full`;
  - en el modo `lite`, la guía indica consultar solo a petición expresa del usuario, y el resto de la guía es igual que en `full`;
  - el recordatorio de cada mensaje tiene una versión por modo.

## Impact

- `.agents/wiki/guide.md` y `.agents/wiki/reminder.md`: las partes propias de cada modo, marcadas.
- `.agents/wiki/engine.json`: admite `"mode"`. La plantilla no lo declara, así que su modo es `full`.
- `.agents/hooks/session-bootstrap.sh`: el núcleo lee el modo de `engine.json`, entrega la guía y el recordatorio de ese modo, avisa de un modo que no existe, y su modo `wiki` gana `mode <full|lite>` y el dato `mode=` en `status`.
- `.claude/commands/toggle-wiki.md` y `.opencode/commands/toggle-wiki.md`: el argumento `lite` o `full`.
- Adaptadores (`.claude/hooks/`, `.opencode/plugins/session-bootstrap/`): no deberían cambiar, porque ya piden los textos al núcleo.
- Suite: steps de `wiki.steps.js` para los modos, el estado del clon de prueba con su modo, la guía "tal como se entrega" según el modo, los pasos de `/toggle-wiki` con argumento y tests del núcleo para los bloques de modo y los valores de `"mode"`.
- README: los dos modos y cómo cambiarlos.
- Un ADR nuevo: ADR-0021 mantiene «wiki primero» de ADR-0004 con el wiki habilitado, y el modo `lite` es una excepción que declara el proyecto.
- El artículo del wiki `flujo-wiki-first` describe el flujo actual. El wiki de este repositorio está deshabilitado, así que el archive no lo resincroniza.
