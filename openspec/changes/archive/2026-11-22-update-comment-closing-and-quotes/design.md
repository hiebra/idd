## Context

`response-comments` ya existe (change `add-quote-comment-rule`). La regla vive en `.agents/comments/rule.md` y su recordatorio en `.agents/comments/reminder.md`, y los dos llegan por el arranque de sesión (ADR-0010). La función `activates_comments` del núcleo (`.agents/hooks/session-bootstrap.sh`) decide si un mensaje lleva el recordatorio, y es la misma para los dos agentes (ADR-0002).

Comprobado en esta sesión, en el transcript de Claude Code: cuando el usuario cita un fragmento con la app de Claude, el `prompt` llega así: `<!-- attach -->\n> fragmento citado\n\ntexto del usuario`.

ADRs en vigor que acotan el diseño: ADR-0002 (núcleo neutral), ADR-0006 (asimetrías entre agentes) y ADR-0010 (las instrucciones llegan por el arranque y se desactivan en local). Este change no se aparta de ninguno.

## Goals / Non-Goals

**Goals:**
- Reconocer como comentario un mensaje que empieza por una cita de Markdown, también detrás de las marcas HTML que añade la app de Claude.
- Cambiar la frase fija y las palabras de cierre en la regla, en el recordatorio y en la detección.
- Pedir que la frase fija se conteste en el idioma del comentario.

**Non-Goals:**
- Cambiar los adaptadores, la entrega o la desactivación.
- Reconocer citas que no estén al principio del mensaje.

## Decisions

### D1. La marca de comentario se busca tras las marcas HTML iniciales

`activates_comments` quita primero, una y otra vez, los espacios iniciales y los comentarios HTML (`<!-- … -->`) del principio del mensaje. Después, el mensaje es un comentario si empieza por una cadena no vacía entre comillas simples, como hasta ahora, o por `>`.

- Se quita cualquier comentario HTML inicial, no solo `<!-- attach -->`. Es la única marca observada, pero la app puede añadir otras, y un comentario HTML al principio de un prompt no es texto del usuario.
- La cita cuenta aunque solo tenga una línea y no lleve texto debajo, porque citar ya es comentar.
- *Alternativa: exigir `> ` con espacio.* Markdown admite `>` sin espacio, y no hace falta ser más estricto.

### D2. Palabras de cierre: p, procesa, procesar, r, reformula, reformular

Si el mensaje no es un comentario, se busca una palabra de cierre como palabra completa, sin distinguir mayúsculas, como hasta ahora (`grep -qiwE '(p|procesa|procesar|r|reformula|reformular)'` en una locale UTF-8). "ya" deja de serlo. Dentro de un comentario no hace falta buscarlas, porque el mensaje ya activa el recordatorio. Las sigue interpretando el modelo, según la regla.

### D3. El idioma de la frase fija lo decide el modelo

La regla da la frase fija en español y pide contestarla en el idioma en que está escrito el comentario. Si el comentario está en español, la frase sale literal. El núcleo no detecta idiomas.

### D4. La suite

- Las secciones de la regla mantienen sus identificadores donde el contenido es el mismo. Se renombran las de "ya" (`ya-*` → `procesar-*`) y se añaden `es-comentario-cita` e `idioma`.
- `FIXED_REPLY` de `comments.steps.js` pasa a la frase nueva.
- El test del núcleo cubre citas con y sin marcas HTML, `>` dentro de una línea que no es inicial, las palabras nuevas y que "ya" ya no activa nada.

## Risks / Trade-offs

- [Falsos positivos con "p" y "r" sueltas, como "p. ej." o "el lenguaje R"] → Entonces el agente recibe un recordatorio de más, y es el modelo quien decide si aplica la regla. Lo eligió el usuario frente a contarlas solo al final del mensaje.
- [Un mensaje que empieza por `>` sin ser una cita de un fragmento del agente, por ejemplo una salida de shell pegada] → Cuenta como comentario. Es poco frecuente, y el usuario puede escribir algo antes.
- [**BREAKING**: "ya" deja de cerrar] → Lo dice la frase fija nueva, que se muestra con cada comentario.

## Migration Plan

No hay datos que migrar. Los textos nuevos llegan en la siguiente sesión o, en el caso del recordatorio, con el siguiente mensaje. Para volver atrás, basta con revertir los commits.

## Open Questions

Ninguna.
