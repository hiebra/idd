# Regla de comentarios

El usuario puede comentar partes de tu intervención anterior sin que cada comentario dispare una respuesta. Sigue esta regla en toda la sesión.

## Un comentario no se responde

<!-- comments-rule:es-comentario -->
Un mensaje del usuario es un comentario sobre tu intervención anterior si, sin los espacios ni los comentarios HTML (`<!-- … -->`) iniciales, empieza por una marca de comentario. Una marca es una cadena entre comillas simples dobladas (`''así''`). Una cadena entre comillas simples sin doblar (`'así'`) no es una marca.
<!-- comments-rule:es-comentario-cita -->
También es marca una cita de Markdown: líneas que empiezan por `>`, como las que crea la app de Claude al citar un fragmento (`<!-- attach -->`, la cita y, debajo, el texto del usuario).
<!-- comments-rule:es-comentario-cita-web -->
También es un comentario un mensaje que incluye, en cualquier punto, una cita de la web de OpenCode: la línea `The user quoted the following from <origen>:`, las líneas citadas, que empiezan por `> `, y, si el usuario escribió algo, `The user made the following comment regarding this quote: <comentario>`.
<!-- comments-rule:frase-fija -->
No lo respondas. Contesta solo, literalmente: Añade más comentarios o pídeme que los procese (p) o reformule (r) en base a ellos
<!-- comments-rule:idioma -->
Da esa frase en el idioma en que está escrito el comentario, traducida si no es español.
<!-- comments-rule:acumular -->
Acumula el comentario sin tratarlo: no investigues ni modifiques nada a raíz de él.

## Palabras de cierre

"p", "procesa" y "procesar" son las palabras de cierre para procesar, y "r", "reformula" y "reformular" para reformular. Cuentan como palabras completas, sin distinguir mayúsculas, y fuera de la marca de comentario inicial. Los comentarios acumulados son los que el usuario ha hecho desde tu última respuesta completa.

<!-- comments-rule:procesar-responde-todos -->
- **Procesar** ("p"): responde en un solo mensaje a todos los comentarios acumulados.
<!-- comments-rule:procesar-incluye-comentario -->
  Si el mensaje con la palabra de cierre es también un comentario, acumúlalo antes y trátalo con los demás.
<!-- comments-rule:reformula-completa -->
- **Reformular** ("r"): repite tu intervención completa, reescrita para incorporar los comentarios acumulados.
<!-- comments-rule:reformula-solo-leido -->
  Asume que el usuario solo ha leído las partes que citó y que podría no haber procesado ninguna otra.
<!-- comments-rule:reformula-autonoma -->
  Por eso la intervención reformulada se entiende por sí sola: no remitas a la anterior ni des por leído nada de lo que no comentó.
