## Context

El arranque de sesión (ADR-0002) ya entrega instrucciones al agente: la guía del wiki al empezar la sesión y su recordatorio con cada mensaje (ADR-0005). Hoy funciona así:

- **El núcleo** (`.agents/hooks/session-bootstrap.sh`) tiene los modos `guide` y `reminder`, que imprimen el texto ya preparado para cada agente (`claude-code` u `opencode`), o nada si el wiki está desactivado (`PROJECT_WIKI=off`) o el texto no es válido. Nunca falla: sale siempre con 0.
- **Claude Code**: el hook `SessionStart` (`.claude/hooks/session-start.sh`) entrega la guía como `additionalContext`, y el `UserPromptSubmit` (`.claude/hooks/user-prompt-submit.sh`) entrega el recordatorio igual. Este segundo hook descarta el mensaje que Claude Code le pasa por stdin (un JSON con el campo `prompt`), porque el recordatorio no depende de él. Los hooks no usan Node, que puede faltar; `json.sh` solo sabe escribir cadenas JSON, no leerlas.
- **OpenCode**: el hook `context` del plugin (`.opencode/plugins/session-bootstrap/server.js`) añade la guía al `system` de cada petición al modelo y el recordatorio como un mensaje de usuario justo antes del último. Pide los dos textos al núcleo una sola vez, al cargar el plugin.
- **La suite** simula los dos agentes (`acceptance-tests/support/agents/`): `sendMessage` devuelve los textos que el agente recibe junto con el mensaje (`reminders`). En Claude Code, el `additionalContext` de cada hook; en OpenCode, los mensajes añadidos antes del último. `alwaysLoadedInstructions` lista los archivos de instrucciones que cada agente carga siempre (`CLAUDE.md`, `AGENTS.md`, las `instructions` de `opencode.json`).

ADRs en vigor que acotan el diseño: ADR-0002 (un núcleo neutral y un adaptador por agente), ADR-0005 (las instrucciones al agente llegan por el arranque, no por archivos que se cargan siempre, y se desactivan en local) y ADR-0006 (asimetrías entre agentes). No hay ADRs sustituidos.

## Goals / Non-Goals

**Goals:**
- Una sola fuente para la regla de comentarios y su recordatorio, entregada por el arranque en los dos agentes.
- Decidir de forma determinista, en una sola pieza común a los dos agentes, si un mensaje activa el recordatorio.
- Desactivar la regla en local, sin tocar archivos versionados e independiente del wiki.

**Non-Goals:**
- Comprobar que el modelo sigue la regla: la suite comprueba lo que el agente recibe, como con la guía del wiki.
- Llevar en el núcleo la cuenta de los comentarios acumulados: la lleva el agente en la conversación.
- Interceptar el mensaje o generar la frase fija sin el modelo (por ejemplo, bloqueando el mensaje desde el hook).

## Decisions

### D1. La regla y su recordatorio viven en `.agents/comments/`

- `.agents/comments/rule.md`: la regla completa (marca de comentario, frase fija, acumulación, "ya" y "reformula"). Lleva identificadores de sección `<!-- comments-rule:<id> -->`, que el núcleo quita al entregarla, para que la suite compruebe cada parte sin depender de la redacción, igual que la guía del wiki.
- `.agents/comments/reminder.md`: un resumen de pocas líneas, con la frase fija literal, que remite a la regla. Límite de 600 caracteres, como el del wiki.

Los textos son iguales en los dos agentes: no nombran operaciones de ninguno, así que no necesitan marcadores.

- *Alternativa: añadir la regla a la guía del wiki.* Se desactivaría con `PROJECT_WIKI=off`, y no tiene nada que ver con el wiki.
- *Alternativa: `AGENTS.md` y `CLAUDE.md`.* Descartada en la propuesta: no se desactivan en local (ADR-0005).

### D2. El núcleo gana dos modos, `comments-rule` y `comments-reminder`

- `session-bootstrap.sh comments-rule <agente> <dir>` imprime la regla sin los identificadores de sección.
- `session-bootstrap.sh comments-reminder <agente> <dir>` lee el mensaje del usuario, en texto plano, por stdin, e imprime el recordatorio solo si el mensaje lo activa.

Los dos imprimen nada si la regla está desactivada o el archivo falta o queda vacío, y salen siempre con 0, como los modos del wiki.

La decisión sobre el mensaje es una función de bash del núcleo, la única copia. Quien la necesita, en los dos agentes, llama al núcleo:

1. **Comentario**: el mensaje, sin los espacios iniciales, empieza por `'`, seguido de al menos un carácter que no es `'` y de otra `'`.
2. Se quita esa cadena inicial, si la hay, y del resto se buscan **"ya" o "reformula" como palabra completa**, sin distinguir mayúsculas (`grep -qiwE '(ya|reformula)'`, que en una locale UTF-8 trata las letras acentuadas como parte de la palabra).
3. El mensaje activa el recordatorio si se cumple 1 o 2.

- *Alternativa: decidir en cada adaptador (bash en Claude Code, JS en OpenCode).* Son dos copias de la misma regla, que pueden divergir; ADR-0002 pone lo común en el núcleo.
- *Alternativa: recordatorio con cada mensaje, sin detectar nada.* Más simple, pero cada mensaje carga con él, y la spec pide no entregarlo con los demás.

### D3. Claude Code: el `UserPromptSubmit` lee el campo `prompt`

El hook deja de descartar stdin: extrae el valor del campo `prompt` del JSON y se lo pasa al núcleo. Como no hay Node, `json.sh` gana `json_field NAME`, que extrae el valor de texto de un campo de primer nivel y deshace los escapes JSON (`\"`, `\\`, `\n`, `\t`, `\r`, `\/` y `\uXXXX`). Un JSON que no entiende da una cadena vacía, y entonces no hay recordatorio de comentarios.

El hook entrega un solo `additionalContext` (Claude Code no admite más de uno por salida): el recordatorio del wiki y el de comentarios, si los hay, separados por una línea en blanco. El `SessionStart` hace lo mismo con la guía del wiki y la regla.

- *Alternativa: un segundo hook `UserPromptSubmit` solo para los comentarios.* Duplica el registro en `.claude/settings.json` y la lectura del núcleo, sin ganar nada.
- *Alternativa: `python3` o `jq` para leer el JSON.* Pueden faltar, igual que Node.

### D4. OpenCode: el hook `context` pregunta al núcleo por el último mensaje

El plugin pide la regla al núcleo una vez, al cargarse, y la añade al `system` junto a la guía del wiki. En cada `context`, toma el texto del último mensaje del usuario y, si no es el mismo que la vez anterior, llama a `comments-reminder` con ese texto por stdin. Guarda el resultado por texto, porque el hook se ejecuta en cada petición al modelo, también en las que siguen a una herramienta dentro del mismo turno. Si hay recordatorio, lo inserta como un mensaje de usuario justo antes del último, junto al del wiki.

Como en el resto del hook, cualquier error queda en `try/catch`: sin recordatorio de comentarios, pero la petición sigue.

### D5. Desactivación con `PROJECT_COMMENTS=off`

La misma forma que `PROJECT_WIKI=off`: una variable de entorno del usuario, que en Claude Code puede ir en `.claude/settings.local.json` (no versionado) y en OpenCode en el entorno de la shell. Con ella, los dos modos del núcleo no imprimen nada. Es independiente del wiki: cada una desactiva solo lo suyo.

### D6. La suite

- Steps nuevos en `acceptance-tests/step-definitions/comments.steps.js`. Reusan los mundos de los agentes simulados (`se abre una sesión de <agente>`, `ningún archivo versionado del proyecto ha cambiado`) y `alwaysLoadedInstructions`.
- "el agente recibe el mensaje junto con el recordatorio de la regla de comentarios" comprueba que algún texto de `reminders` contiene el recordatorio de `.agents/comments/reminder.md`; en Claude Code, dentro del `additionalContext` combinado.
- Los escenarios que revisan la regla la leen tal como la entrega el núcleo y la comprueban por sus identificadores de sección.
- Los escenarios del wiki no cambian: su mensaje por defecto no activa la regla, así que sigue llegando un solo recordatorio.

## Risks / Trade-offs

- [El modelo puede no seguir la regla, o perder la cuenta de los comentarios acumulados en una sesión larga o tras una compactación] → El recordatorio con cada mensaje que la activa refuerza la regla justo cuando importa. La plantilla garantiza que el agente recibe la regla, no que la cumpla.
- [Falsos positivos: un mensaje normal que empieza por `'` o contiene "ya" como palabra, como "ya lo veo"] → Entonces el agente recibe un recordatorio de más. La propia regla define qué es un comentario y qué hace "ya", así que es el modelo quien decide si aplica. Es la razón de usar comillas simples, menos comunes.
- [El extractor de `json_field` en bash no cubre todo JSON] → Solo necesita un campo de texto de primer nivel; si falla, no hay recordatorio de comentarios y el resto sigue. La suite lo prueba con prompts que llevan comillas, saltos de línea y acentos.
- [Una llamada al núcleo por mensaje en OpenCode] → Solo cuando cambia el último mensaje del usuario, y el núcleo no hace nada pesado en ese modo.
- [La regla ocupa contexto en todas las sesiones] → Es corta, y quien no la quiera la desactiva.

## Migration Plan

No hay datos que migrar. La regla llega con la siguiente sesión, cuando el arranque la entrega. Para volver atrás, basta con revertir los commits del change.

## Open Questions

- **ADR-0005** decidió que la guía del wiki llega por el arranque, no por archivos que se cargan siempre. Este change aplica la misma decisión a una segunda instrucción. Propuesta para el paso `adr`: un ADR nuevo que generalice esa decisión a cualquier instrucción que el proyecto entregue al agente, cada una con su fuente en `.agents/` y su desactivación en local, sin sustituir ADR-0005.
- **ADR-0006** no aplica: la regla existe igual en los dos agentes.
