## Why

La regla de comentarios (`response-comments`) funciona, pero tiene dos pegas en el uso diario:

- La app de Claude permite citar un fragmento de la respuesta del agente, y esa es la forma natural de comentarlo. Una cita no cuenta como comentario: solo cuentan los mensajes que empiezan por una cadena entre comillas simples.
- La frase fija y las palabras de cierre son largas de leer y de teclear. Lo más cómodo es cerrar con una sola letra.

## What Changes

- **Una cita también es un comentario.** Hasta ahora solo lo era un mensaje que empieza por una cadena entre comillas simples. Ahora también lo es un mensaje que empieza por una cita de Markdown, es decir, una o más líneas que empiezan por `>`. Así llegan las citas de la app de Claude, comprobado en esta sesión: `<!-- attach -->\n> fragmento citado\n\ntexto del usuario`. Las marcas de comentario HTML (`<!-- ... -->`) que haya al principio del mensaje no cuentan para decidirlo.
- **Frase fija nueva**: "Puedes seguir añadiendo comentarios, pedirme que los procese (p) o que reformule (r) el mensaje en base a ellos".
- **Palabras de cierre nuevas.** **BREAKING**: "ya" deja de ser palabra de cierre.
  - Procesar, que responde a todos los comentarios acumulados: "p", "procesa" o "procesar".
  - Reformular: "r", "reformula" o "reformular".
  - Cuentan igual que antes: como palabra completa, sin distinguir mayúsculas y fuera de la marca de comentario inicial, sea la cadena entre comillas o la cita.
- **El recordatorio** con cada mensaje sigue las nuevas marcas y las nuevas palabras de cierre.

Fuera de alcance: las citas que no van al principio del mensaje, que no lo convierten en comentario, y el resto de la regla, que no cambia. El resto de la regla son la acumulación, qué se hace al procesar o al reformular, la entrega por el arranque y la desactivación con `PROJECT_COMMENTS=off`.

## Capabilities

### New Capabilities

### Modified Capabilities
- `response-comments`: los cambios son tres:
  - la marca de comentario incluye la cita de Markdown al principio del mensaje, tras las marcas HTML iniciales;
  - la frase fija es otra;
  - las palabras de cierre son "p", "procesa" y "procesar" para procesar, y "r", "reformula" y "reformular" para reformular, en lugar de "ya" y "reformula".

## Impact

- `.agents/comments/rule.md` y `.agents/comments/reminder.md`: la frase, la marca y las palabras de cierre nuevas.
- `.agents/hooks/session-bootstrap.sh`: la detección del núcleo (`activates_comments`), que comparten los dos agentes. Los adaptadores no cambian.
- Suite: los steps de `comments.steps.js`, con la frase fija, y el test del núcleo `comments-reminder.test.js`, con citas, marcas HTML y las palabras nuevas.
- README y artículo del wiki `regla-de-comentarios`, que citan la frase y las palabras de cierre. El artículo se resincroniza al archivar.
