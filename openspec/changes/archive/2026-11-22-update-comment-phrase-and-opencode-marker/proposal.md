## Why

La regla de comentarios (`response-comments`) tiene tres pegas en el uso diario:

- **La frase fija es larga.** "Puedes seguir añadiendo comentarios, pedirme que los procese (p) o que reformule (r) el mensaje en base a ellos" se lee tras cada comentario. Se puede decir lo mismo en menos palabras.
- **La marca de comentario `'así'` puede activarse por error.** Donde no hay mecanismo de cita, como la TUI de OpenCode, la marca entre comillas es la forma de comentar. Pero un mensaje normal puede empezar por una cadena entre comillas simples, como `'foo' no aparece en el log`, y se tomaría por un comentario. Es muy poco probable que un mensaje normal empiece por una cadena entre comillas simples dobladas (`''así''`), y se teclea igual de rápido.
- **La cita se mantiene donde la hay**: la app de Claude permite citar un fragmento, y la cita de Markdown (`>`) sigue siendo una marca de comentario en los dos agentes. La web de OpenCode también permite citar, pero la cita llega al modelo con otro formato, y hoy no activa la regla.
- **En OpenCode, la regla va metida en el plugin del arranque de sesión** (`session-bootstrap`). Ese plugin es el adaptador del núcleo, y tiene que funcionar siempre (ADR-0002). La regla de comentarios es una ayuda opcional. Si va en su propio plugin, se puede quitar, cambiar o fallar sin tocar el arranque, como pasa con `openspec-autopilot` (ADR-0008).

## What Changes

- **Frase fija nueva**: "Añade más comentarios o pídeme que los procese (p) o reformule (r) en base a ellos". El agente sigue contestándola en el idioma en que está escrito el comentario.
- **Marca de comentario con comillas simples dobladas.** **BREAKING**: en los dos agentes, un comentario es un mensaje que empieza por una cadena no vacía entre comillas simples dobladas (`''así''`). Un mensaje que empieza por `'así'` deja de ser un comentario. La cita de Markdown (`>`) al principio del mensaje sigue siendo una marca de comentario, también en los dos agentes. Las marcas HTML iniciales (`<!-- … -->`) siguen sin contar.
- **Una cita de la web de OpenCode es un comentario.** Llega como texto dentro del mensaje: `The user quoted the following from <origen>:`, líneas `> …` y, si el usuario escribió algo, `The user made the following comment regarding this quote: …`.
- **Plugin propio de OpenCode para la regla de comentarios**: `.opencode/plugins/response-comments/`. Entrega la regla al empezar la sesión y el recordatorio con los mensajes que la activan, con el hook `context` y los textos que prepara el núcleo (`comments-rule` y `comments-reminder` de `session-bootstrap.sh`). `session-bootstrap` deja de entregar nada de la regla de comentarios.
- **En Claude Code la entrega no cambia**: la regla y el recordatorio siguen llegando por los hooks del arranque de sesión. Claude Code no tiene plugins locales del proyecto que se carguen solos al clonar. Solo cambian la frase y la marca.
- **La desactivación en local no cambia**: `PROJECT_COMMENTS=off` desactiva la regla en los dos agentes. En OpenCode, además, quitar el plugin la desactiva sin afectar al arranque.

Fuera de alcance: qué se hace al procesar o al reformular, las palabras de cierre y la acumulación, que no cambian.

## Capabilities

### New Capabilities

### Modified Capabilities
- `response-comments`: los cambios son tres:
  - la marca de comentario entre comillas es una cadena entre comillas simples dobladas (`''así''`) en lugar de entre comillas simples;
  - la frase fija es otra;
  - en OpenCode, la regla y su recordatorio llegan por un plugin propio, no por el adaptador del arranque de sesión. Que el arranque deje de entregarla se especifica aquí: la spec `session-bootstrap` no nombra la regla de comentarios, así que no tiene delta.

## Impact

- `.agents/comments/rule.md` y `.agents/comments/reminder.md`: la frase y la marca nuevas.
- `.agents/hooks/session-bootstrap.sh`: la detección del núcleo (`activates_comments`) pasa a `''…''`. Los modos `comments-rule` y `comments-reminder` se quedan en el núcleo, que sigue siendo la única fuente para los dos agentes.
- `.opencode/plugins/response-comments/server.js` (nuevo) y `.opencode/plugins/session-bootstrap/server.js`, que pierde la parte de comentarios.
- Suite: el host simulado de OpenCode tiene que cargar los dos plugins, como OpenCode carga todos los de `.opencode/plugins/`. También cambian los steps de `comments.steps.js`, con la frase nueva, los ejemplos de la spec y el test del núcleo `comments-reminder.test.js`.
- Un ADR nuevo: en OpenCode, cada capacidad opcional va en su propio plugin, separada del adaptador del arranque.
- README y artículo del wiki `regla-de-comentarios`, que citan la frase y la marca. El artículo se resincroniza al archivar.
