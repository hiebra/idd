## Context

La regla de comentarios vive en `.agents/comments/rule.md` y su recordatorio en `.agents/comments/reminder.md`. El núcleo (`.agents/hooks/session-bootstrap.sh`) los prepara con los modos `comments-rule` y `comments-reminder`, y decide con `activates_comments` qué mensajes llevan el recordatorio. Los entregan los adaptadores del arranque: en Claude Code, los hooks `SessionStart` y `UserPromptSubmit`; en OpenCode, el plugin `session-bootstrap`, con su hook `context`, junto a la guía y el recordatorio del wiki.

El usuario ha precisado en esta sesión:

- la TUI de OpenCode no permite citar, y su web sí;
- en el hook `context`, `input.messages` llega en formato LLM, y una cita de la web de OpenCode aparece solo como texto dentro del mensaje `user`: `\nThe user quoted the following from <origen>:\n> línea…\n` y, si hay comentario, `\nThe user made the following comment regarding this quote: <comentario>`. El usuario dio la expresión regular `/\nThe user quoted the following from (.+?):\n((?:> .*\n?)+)(?:\nThe user made the following comment regarding this quote: ([\s\S]*))?/`. **[heredado]** No se ha comprobado aquí con OpenCode real.
- doblar las comillas solo sirve para que la regla no se active por error.

ADRs en vigor que acotan el diseño:

- ADR-0002: núcleo neutral y un adaptador fino por agente.
- ADR-0006: asimetrías entre agentes.
- ADR-0014, que sustituye a ADR-0008 y mantiene `openspec-autopilot` como plugin propio: ADR-0008 descartó ampliar `session-bootstrap` con una automatización opcional, y ese criterio se reutiliza aquí.
- ADR-0010: toda instrucción llega por el arranque, con una única fuente en `.agents/`, la activación decidida en el núcleo y desactivable con `PROJECT_<NOMBRE>=off`.
- ADR-0011: cada plugin libera al descargarse lo que registra.

Este change matiza ADR-0010 en lo que toca a OpenCode (ver D2 y el ADR del change).

## Goals / Non-Goals

**Goals:**
- Cambiar la marca entre comillas a `''así''` en la regla, en el recordatorio y en la detección, igual en los dos agentes.
- Cambiar la frase fija.
- Sacar a un plugin propio de OpenCode, `response-comments`, la entrega de la regla y de su recordatorio.

**Non-Goals:**
- Que el plugin haga algo más que entregar: no acumula comentarios ni contesta sin el modelo.
- Cambiar la entrega en Claude Code, las palabras de cierre, la acumulación o lo que se hace al procesar o al reformular.
- Distinguir en OpenCode entre la TUI y la web: la cita y `''así''` valen en las dos.

## Decisions

### D1. La marca entre comillas es `''…''`, en el núcleo y para los dos agentes

`activates_comments` sigue quitando primero los espacios y los comentarios HTML iniciales. Después, el mensaje es un comentario si empieza por `''`, al menos un carácter que no sea `'`, y `''`, o si empieza por `>`. La expresión pasa de `^'[^']+'` a `^''[^']+''`.

- Una cadena entre comillas simples sin doblar deja de ser una marca. `'foo' no aparece en el log` ya no activa la regla.
- El interior no puede tener comillas simples, como hasta ahora. Así, `''` seguido de texto sin cierre no es un comentario.
- *Alternativa: marcas distintas por agente* (`''…''` solo en OpenCode). Se descartó a petición del usuario: la regla y la detección siguen siendo una sola, y no hace falta un marcador por agente en `rule.md`.

### D1b. Una cita de la web de OpenCode también es un comentario, y la detecta el núcleo

La detección va en `activates_comments`, como el resto (ADR-0010), y no en el plugin. El mensaje es un comentario si, en cualquier punto, tiene una línea `The user quoted the following from <origen>:` seguida inmediatamente de una línea que empieza por `> `. Es la parte obligatoria de la expresión que dio el usuario. El comentario posterior (`The user made the following comment regarding this quote:`) es opcional y no cambia la decisión.

- Se busca en cualquier línea y no solo al principio, porque el bloque empieza por `\n` y puede ir detrás de lo que el usuario escribió.
- La detección es neutral: en Claude Code un mensaje así es muy improbable, y si llegara también sería una cita.
- Las palabras de cierre del texto fijo de OpenCode ("the", "following"…) no importan: el mensaje ya activa el recordatorio por ser un comentario.
- La regla (`es-comentario-cita`) describe al modelo este bloque, porque el modelo lo ve como texto y no como `>` al principio.
- *Alternativa: detectarla en el plugin con la expresión de JavaScript.* La decisión quedaría fuera del núcleo y repetida por agente.

### D2. Un plugin propio de OpenCode es el adaptador de la regla

El plugin es `.opencode/plugins/response-comments/server.js`, sin parte de TUI, sin dependencias y solo con módulos `node:`. Lleva el nombre de la capacidad.

- Al cargar, pide al núcleo `comments-rule opencode <dir>`.
- Registra `ctx.session.hook("context", …)`.
- En cada petición, añade la regla a `system` y, si el último mensaje del usuario la activa, inserta el recordatorio de `comments-reminder` justo antes de ese mensaje.
- Solo pregunta al núcleo cuando cambia el texto del último mensaje del usuario.

Es lo que hoy hace `session-bootstrap`, que lo pierde.

- El núcleo sigue siendo la única fuente y el que decide la activación, como pide ADR-0010. Lo único que cambia es qué adaptador entrega la regla en OpenCode.
- `lastUserText` y la llamada al núcleo se copian en el plugin. No se comparte un módulo con `session-bootstrap`, para que cada plugin se cargue solo y sin dependencias (como `openspec-autopilot`).
- *Alternativa: mantenerla en `session-bootstrap`.* Mezcla el adaptador que debe funcionar siempre con una instrucción opcional, que es lo que se descartó para el autopilot en ADR-0008, hoy sustituido por ADR-0014.
- *Alternativa: un plugin que acumule y conteste sin modelo.* El usuario lo descartó: el plugin solo separa la entrega.

### D3. Desactivación

`PROJECT_COMMENTS=off` sigue funcionando como hasta ahora: el núcleo devuelve vacío, y el plugin no añade nada. Quitar el directorio del plugin también desactiva la regla en OpenCode, sin afectar al arranque. El escenario nuevo lo comprueba.

### D4. Limpieza al descargarse

El plugin no se suscribe a eventos ni lanza procesos que sobrevivan a la petición. Aun así, devuelve desde `setup` una función de limpieza, que no hace nada, para cumplir ADR-0011. El hook `context` no tiene forma de darse de baja: según el contrato comprobado, OpenCode lo descarta al recargar el plugin.

### D5. La suite carga los plugins de la sesión

El host simulado (`opencode-host.mjs`) carga hoy un solo plugin (`options.plugin`). Pasa a cargar una lista, `options.plugins`, en orden. Cada uno tiene su RPC y sus hooks, y los hooks `context` de todos se ejecutan sobre la misma petición, como en OpenCode.

- El adaptador de la suite (`opencode.js`) abre la sesión con los plugins de sesión del proyecto que existan: `session-bootstrap` y `response-comments`. El autopilot tiene su propio simulador y queda fuera.
- El escenario "sin el plugin de comentarios" quita `.opencode/plugins/response-comments/` del clon de prueba.
- `options.plugin` se mantiene como atajo de una lista de uno, para los tests del núcleo que ya lo usan.

### D6. Textos

- `rule.md`: la sección `es-comentario` define la marca `''así''` y dice que `'así'` no lo es. La sección `es-comentario-cita` nombra también la web de OpenCode. La sección `frase-fija` lleva la frase nueva.
- `reminder.md`: la marca y la frase nuevas, por debajo de `REMINDER_MAX` (600 caracteres).
- `FIXED_REPLY` de `comments.steps.js` pasa a la frase nueva.
- El test del núcleo (`comments-reminder.test.js`) cubre `''…''` con y sin marcas HTML, `'…'` sin doblar, que no activa, y `''` sin cierre.
- El test del núcleo cubre también la cita de la web de OpenCode, con y sin comentario y con texto antes, y una línea `The user quoted the following from …:` sin líneas `> ` debajo, que no activa.
- El step `el usuario cita "<fragmento>" desde la web de OpenCode con el comentario "<comentario>"` construye el texto del mensaje con el formato de D1b y lo envía como cualquier otro.

## Risks / Trade-offs

- [**BREAKING**: `'así'` deja de ser un comentario] → La regla y el recordatorio enseñan la marca nueva. Un comentario con la marca antigua llega como un mensaje normal, y el agente lo responde.
- [Dos plugins con hook `context` sobre la misma petición: el orden de lo añadido a `system` depende del orden de carga de OpenCode] → La regla de comentarios no depende de ir antes o después de la guía del wiki.
- [Copia de `lastUserText` y de la llamada al núcleo en dos plugins] → Son unas pocas líneas estables, y compartirlas obligaría a cargar un módulo común entre plugins locales, sin comprobar en OpenCode 2.3.2.
- [El formato de la cita de la web de OpenCode no está comprobado aquí y puede cambiar entre versiones] → Va al registro de vigilancia al subir de versión de OpenCode. Si cambia, la cita llega como un mensaje normal y el agente la responde.
- [La suite simula la carga de varios plugins, no la de OpenCode real] → Queda en el registro de vigilancia `volver-a-comprobar-hook-context-al-subir-opencode`.

## Migration Plan

No hay datos que migrar. Al abrir una sesión nueva tras actualizar el clon, OpenCode carga el plugin nuevo y el arranque ya no entrega la regla. Si OpenCode tiene cargada una versión anterior de `session-bootstrap` en caliente, la regla puede llegar dos veces hasta reiniciarlo. Para volver atrás, basta con revertir los commits.

## Open Questions

Ninguna. El ADR del change recoge que, en OpenCode, una instrucción opcional puede tener su propio plugin como adaptador. Matiza ADR-0010 sin sustituirlo.
