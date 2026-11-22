---
title: "La regla de comentarios"
category: concept
sources:
  - raw/repos/2026-11-21-idd-16e4617-add-quote-comment-rule.md
  - raw/notes/2026-11-22-ll-add-quote-comment-rule.md
  - raw/repos/2026-11-22-idd-c4d6b27-update-comment-closing-and-quotes.md
  - raw/notes/2026-11-22-ll-update-comment-closing-and-quotes.md
  - raw/repos/2026-11-22-idd-1657745-update-comment-phrase-and-opencode-marker.md
created: 2026-11-21
updated: 2026-11-22
verified: 2026-11-22
tags: [response-comments, session-bootstrap, claude-code, opencode, adr]
confidence: high
volatility: warm
summary: "Cómo comenta el usuario partes de una respuesta del agente sin que conteste a cada comentario (''…'', una cita '>' o una cita de la web de OpenCode, y cierre con p o r), cómo llega la regla a cada agente (hooks del arranque en Claude Code, plugin response-comments en OpenCode) y qué decidieron ADR-0010 y ADR-0018; sintetizado de la spec response-comments, los designs y el código."
---

# La regla de comentarios

> El usuario comenta partes de una intervención del agente sin que cada comentario dispare una respuesta larga, y después decide cómo tratarlos. La regla vigente sale de los archivos fijados en `idd@1657745` (`idd@165774532006e4fb829ec8bcc4ab6a27987ef185`, change `update-comment-phrase-and-opencode-marker`); las palabras de cierre, de `idd@c4d6b27` (change `update-comment-closing-and-quotes`); ADR-0010, de `idd@16e4617` (change `add-quote-comment-rule`).

## Qué dice la regla

`idd@1657745:openspec/specs/response-comments/spec.md` y `idd@1657745:.agents/comments/rule.md`:

- **Un comentario** es un mensaje que, sin los espacios ni los comentarios HTML iniciales, empieza por una marca de comentario: una cadena no vacía entre comillas simples dobladas (`''así''`) o una cita de Markdown (líneas que empiezan por `>`). `'así'` sin doblar no es una marca. También es un comentario un mensaje que incluye, en cualquier punto, una cita de la web de OpenCode (ver abajo). El agente no lo responde: contesta solo con la frase fija "Añade más comentarios o pídeme que los procese (p) o reformule (r) en base a ellos", en el idioma del comentario, y lo acumula sin investigar ni modificar nada.
- **Procesar** (`p`, `procesa`, `procesar`) hace que responda en un solo mensaje a todos los comentarios acumulados desde su última respuesta completa, incluido el propio mensaje si también es un comentario.
- **Reformular** (`r`, `reformula`, `reformular`) hace que repita su intervención completa con los comentarios incorporados. Asume que el usuario solo leyó lo que citó, así que la versión nueva se entiende por sí sola y no remite a la anterior.
- Las palabras de cierre cuentan como palabras completas, sin distinguir mayúsculas y fuera de la marca de comentario inicial: `pr` o `¿lo reformulamos?` no cuentan.

### Cómo llega una cita de la app de Claude

Comprobado en el transcript de una sesión de Claude Code en la nube: al citar un fragmento con la app de Claude, el `prompt` llega como `<!-- attach -->\n> fragmento citado\n\ntexto del usuario`. Por eso `activates_comments` quita, una y otra vez, los espacios y los comentarios HTML iniciales antes de buscar la marca (`idd@c4d6b27:.agents/hooks/session-bootstrap.sh`; design D1 de `update-comment-closing-and-quotes`; [lecciones de update-comment-closing-and-quotes](../../raw/notes/2026-11-22-ll-update-comment-closing-and-quotes.md), lección 1).

### Por qué `''así''`

Donde no se puede citar, como la TUI de OpenCode, la marca entre comillas es la forma de comentar. Con comillas simples, un mensaje normal como `'foo' no aparece en el log` se tomaba por un comentario; es muy poco probable que un mensaje normal empiece por una cadena entre comillas simples dobladas. Lo explicó el usuario al proponer el change (`idd@1657745:openspec/changes/archive/2026-11-22-update-comment-phrase-and-opencode-marker/proposal.md`).

### Cómo llega una cita de la web de OpenCode

**[heredado]** Según el usuario, en el hook `context` de OpenCode `input.messages` llega en formato LLM y la cita de la web aparece solo como texto dentro del mensaje `user`: `\nThe user quoted the following from <origen>:\n> línea…\n` y, si hay comentario, `\nThe user made the following comment regarding this quote: <comentario>`. No se ha comprobado con OpenCode real. El núcleo la detecta con `awk`: una línea `The user quoted the following from …:` seguida de una línea que empieza por `> `, en cualquier punto del mensaje (`idd@1657745:.agents/hooks/session-bootstrap.sh`, `activates_comments`; design D1b).

### Historia

La primera versión (`idd@16e4617`) solo reconocía `'…'` y cerraba con "ya" y "reformula", con otra frase fija. `update-comment-closing-and-quotes` añadió las citas, el idioma del comentario y el cierre con una letra; "ya" dejó de cerrar (`idd@c4d6b27:openspec/changes/archive/2026-11-22-update-comment-closing-and-quotes/proposal.md`). `update-comment-phrase-and-opencode-marker` dobló las comillas, añadió la cita de la web de OpenCode, acortó la frase fija y sacó la entrega en OpenCode a su propio plugin (`idd@1657745:openspec/changes/archive/2026-11-22-update-comment-phrase-and-opencode-marker/proposal.md`).

## Cómo llega al agente

- **Por el arranque de sesión, no por `AGENTS.md`**: la primera versión iba en `AGENTS.md` con un `CLAUDE.md` que lo importaba. Se descartó porque esos archivos no se pueden desactivar en local, la misma razón por la que ADR-0005 los descartó para la guía del wiki (`idd@16e4617:openspec/changes/archive/2026-11-21-add-quote-comment-rule/proposal.md`).
- **Quién la entrega**: en Claude Code, los hooks del arranque de sesión; en OpenCode, desde `update-comment-phrase-and-opencode-marker`, su propio plugin local `.opencode/plugins/response-comments/` (`idd@1657745:.opencode/plugins/response-comments/server.js`), y `session-bootstrap` ya no entrega nada de la regla. Quitar el plugin la desactiva en OpenCode sin afectar al arranque (ADR-0018, abajo).
- **Al empezar la sesión**, el adaptador de cada agente entrega la regla (modo `comments-rule` del núcleo). **Con cada mensaje que la activa**, entrega además un recordatorio breve (`.agents/comments/reminder.md`, 600 caracteres como máximo); los demás mensajes no lo llevan (design D2).
- **Qué mensajes la activan lo decide el núcleo**, una sola función en bash (`activates_comments` en `idd@16e4617:.agents/hooks/session-bootstrap.sh`), para no tener una copia por adaptador (ADR-0002). En Claude Code, el `UserPromptSubmit` lee el `prompt` con `json_field` (`idd@16e4617:.claude/hooks/json.sh`), solo con bash porque Node puede faltar. En OpenCode, el hook `context` pregunta por el último mensaje del usuario (ver [[hook-context-opencode|El hook context de OpenCode]] ([El hook context de OpenCode](hook-context-opencode.md))).
- **Se desactiva** con `PROJECT_COMMENTS=off`, independiente de `PROJECT_WIKI` (`idd@16e4617:README.md`).

## La decisión general: ADR-0010

`idd@16e4617:adr/0010-agent-instructions-through-session-bootstrap.md` extiende ADR-0005 a cualquier instrucción que la plantilla dé al agente: llega por el arranque, tiene una única fuente en `.agents/`, se desactiva en local por separado con `PROJECT_<NOMBRE>=off` y, si depende del mensaje, la decisión es determinista y está en el núcleo. La plantilla no lleva archivos de instrucciones que se carguen siempre; los proyectos creados desde ella sí pueden añadir los suyos. El coste: una instrucción nueva necesita fuente, modos en el núcleo, entrega en cada adaptador y escenarios.

## ADR-0018: un plugin propio en OpenCode

`idd@1657745:adr/0018-opencode-optional-instructions-own-plugin.md` matiza ADR-0010 sin sustituirlo: en OpenCode, una instrucción opcional puede tener su propio plugin como adaptador, que solo pide sus textos al núcleo y los añade con el hook `context`; la fuente, la activación y la desactivación siguen en el núcleo. `session-bootstrap` solo entrega lo que forma parte del arranque (la guía y el recordatorio del wiki). El plugin no comparte código con otros: copia la llamada al núcleo y `lastUserText`. En Claude Code no cambia nada, así que no es una asimetría de ADR-0006.

## Límites

- **La suite comprueba lo que el agente recibe, no que el modelo cumpla la regla** (design, Non-Goals). En el cierre del change se ejecutaron los hooks reales de Claude Code, pero no se comprobó en una sesión nueva que el modelo conteste con la frase fija (`idd@16e4617:openspec/changes/archive/2026-11-21-add-quote-comment-rule/tasks.md`, 6.3).
- **`json_field` y `\uXXXX`**: el `printf` de bash solo convierte un `\uXXXX` fuera de ASCII con una locale UTF-8, así que la conversión fuerza `LC_ALL=C.UTF-8`; en bash 3.2 (macOS), que no entiende `\u`, queda un espacio. Para decidir si un mensaje activa la regla basta, porque solo importan la comilla simple inicial y las palabras de cierre (`idd@16e4617:.claude/hooks/json.sh`; [lecciones de add-quote-comment-rule](../../raw/notes/2026-11-22-ll-add-quote-comment-rule.md), lección 1).
- **Falsos positivos**: una "p" o una "r" sueltas ("p. ej.", "el lenguaje R") llevan el recordatorio, y un mensaje que empieza por `>` sin ser una cita del agente cuenta como comentario; la regla deja al modelo decidir si aplica (design de `update-comment-closing-and-quotes`, Risks).
- **El idioma de la frase fija lo decide el modelo**: el núcleo no detecta idiomas (design D3).
- **El formato de la cita de la web de OpenCode no está comprobado**: si cambia entre versiones, la cita llega como un mensaje normal y el agente la responde (design de `update-comment-phrase-and-opencode-marker`, Risks).

## See Also

- [[arranque-de-sesion|El arranque de sesión]] ([El arranque de sesión](../topics/arranque-de-sesion.md))
- [[hook-context-opencode|El hook context de OpenCode]] ([El hook context de OpenCode](hook-context-opencode.md))
- [[flujo-wiki-first|El flujo wiki-first]] ([El flujo wiki-first](../topics/flujo-wiki-first.md))
- [[suite-de-aceptacion-y-spec-as-source|La suite de aceptación y spec-as-source]] ([La suite de aceptación y spec-as-source](../topics/suite-de-aceptacion-y-spec-as-source.md))

## Sources

- [Collection: archivado de update-comment-phrase-and-opencode-marker](../../raw/repos/2026-11-22-idd-1657745-update-comment-phrase-and-opencode-marker.md): `openspec/specs/response-comments/spec.md`, `.agents/comments/rule.md`, `.agents/hooks/session-bootstrap.sh`, `.opencode/plugins/response-comments/server.js`, `adr/0018-opencode-optional-instructions-own-plugin.md`, y `proposal.md` y `design.md` del change archivado.

- [Collection: archivado de add-quote-comment-rule](../../raw/repos/2026-11-21-idd-16e4617-add-quote-comment-rule.md): `openspec/specs/response-comments/spec.md`, `.agents/comments/rule.md`, `.agents/comments/reminder.md`, `.agents/hooks/session-bootstrap.sh`, `.claude/hooks/json.sh`, `adr/0010-agent-instructions-through-session-bootstrap.md`, `README.md`, y `proposal.md`, `design.md` y `tasks.md` del change archivado.
- [Collection: archivado de update-comment-closing-and-quotes](../../raw/repos/2026-11-22-idd-c4d6b27-update-comment-closing-and-quotes.md): `openspec/specs/response-comments/spec.md`, `.agents/comments/rule.md`, `.agents/hooks/session-bootstrap.sh`, y `proposal.md` y `design.md` del change archivado.
- [Lessons Learned: update-comment-closing-and-quotes](../../raw/notes/2026-11-22-ll-update-comment-closing-and-quotes.md): lección 1.
- [Lessons Learned: add-quote-comment-rule](../../raw/notes/2026-11-22-ll-add-quote-comment-rule.md): lección 1.
