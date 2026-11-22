---
title: "La regla de comentarios"
category: concept
sources:
  - raw/repos/2026-11-21-idd-16e4617-add-quote-comment-rule.md
  - raw/notes/2026-11-22-ll-add-quote-comment-rule.md
  - raw/repos/2026-11-22-idd-c4d6b27-update-comment-closing-and-quotes.md
created: 2026-11-21
updated: 2026-11-22
verified: 2026-11-22
tags: [response-comments, session-bootstrap, claude-code, opencode, adr]
confidence: high
volatility: warm
summary: "Cómo comenta el usuario partes de una respuesta del agente sin que conteste a cada comentario ('…' o una cita '>', y cierre con p o r), cómo llega la regla a cada agente por el arranque de sesión y qué decidió ADR-0010; sintetizado de la spec response-comments, el design del change y el código."
---

# La regla de comentarios

> El usuario comenta partes de una intervención del agente sin que cada comentario dispare una respuesta larga, y después decide cómo tratarlos. La regla vigente sale de los archivos fijados en `idd@c4d6b27` (`idd@c4d6b27862b8a10733ccda91e43bc67380e9b2bd`, change `update-comment-closing-and-quotes`); la entrega y ADR-0010, de `idd@16e4617` (`idd@16e46176b94bebbb4fe6892d8589bcff8e877030`, change `add-quote-comment-rule`).

## Qué dice la regla

`idd@c4d6b27:openspec/specs/response-comments/spec.md` y `idd@c4d6b27:.agents/comments/rule.md`:

- **Un comentario** es un mensaje que, sin los espacios ni los comentarios HTML iniciales, empieza por una marca de comentario: una cadena entre comillas simples (`'así'`) o una cita de Markdown (líneas que empiezan por `>`). El agente no lo responde: contesta solo con la frase fija "Puedes seguir añadiendo comentarios, pedirme que los procese (p) o que reformule (r) el mensaje en base a ellos", en el idioma del comentario, y lo acumula sin investigar ni modificar nada.
- **Procesar** (`p`, `procesa`, `procesar`) hace que responda en un solo mensaje a todos los comentarios acumulados desde su última respuesta completa, incluido el propio mensaje si también es un comentario.
- **Reformular** (`r`, `reformula`, `reformular`) hace que repita su intervención completa con los comentarios incorporados. Asume que el usuario solo leyó lo que citó, así que la versión nueva se entiende por sí sola y no remite a la anterior.
- Las palabras de cierre cuentan como palabras completas, sin distinguir mayúsculas y fuera de la marca de comentario inicial: `pr` o `¿lo reformulamos?` no cuentan.

### Cómo llega una cita de la app de Claude

Comprobado en el transcript de una sesión de Claude Code en la nube: al citar un fragmento con la app de Claude, el `prompt` llega como `<!-- attach -->\n> fragmento citado\n\ntexto del usuario`. Por eso `activates_comments` quita, una y otra vez, los espacios y los comentarios HTML iniciales antes de buscar la marca (`idd@c4d6b27:.agents/hooks/session-bootstrap.sh`; design D1 de `update-comment-closing-and-quotes`).

### Historia

La primera versión (`idd@16e4617`) solo reconocía `'…'` y cerraba con "ya" y "reformula", con otra frase fija. `update-comment-closing-and-quotes` añadió las citas, el idioma del comentario y el cierre con una letra; "ya" dejó de cerrar (`idd@c4d6b27:openspec/changes/archive/2026-11-22-update-comment-closing-and-quotes/proposal.md`).

## Cómo llega al agente

- **Por el arranque de sesión, no por `AGENTS.md`**: la primera versión iba en `AGENTS.md` con un `CLAUDE.md` que lo importaba. Se descartó porque esos archivos no se pueden desactivar en local, la misma razón por la que ADR-0005 los descartó para la guía del wiki (`idd@16e4617:openspec/changes/archive/2026-11-21-add-quote-comment-rule/proposal.md`).
- **Al empezar la sesión**, el adaptador de cada agente entrega la regla (modo `comments-rule` del núcleo). **Con cada mensaje que la activa**, entrega además un recordatorio breve (`.agents/comments/reminder.md`, 600 caracteres como máximo); los demás mensajes no lo llevan (design D2).
- **Qué mensajes la activan lo decide el núcleo**, una sola función en bash (`activates_comments` en `idd@16e4617:.agents/hooks/session-bootstrap.sh`), para no tener una copia por adaptador (ADR-0002). En Claude Code, el `UserPromptSubmit` lee el `prompt` con `json_field` (`idd@16e4617:.claude/hooks/json.sh`), solo con bash porque Node puede faltar. En OpenCode, el hook `context` pregunta por el último mensaje del usuario (ver [[hook-context-opencode|El hook context de OpenCode]] ([El hook context de OpenCode](hook-context-opencode.md))).
- **Se desactiva** con `PROJECT_COMMENTS=off`, independiente de `PROJECT_WIKI` (`idd@16e4617:README.md`).

## La decisión general: ADR-0010

`idd@16e4617:adr/0010-agent-instructions-through-session-bootstrap.md` extiende ADR-0005 a cualquier instrucción que la plantilla dé al agente: llega por el arranque, tiene una única fuente en `.agents/`, se desactiva en local por separado con `PROJECT_<NOMBRE>=off` y, si depende del mensaje, la decisión es determinista y está en el núcleo. La plantilla no lleva archivos de instrucciones que se carguen siempre; los proyectos creados desde ella sí pueden añadir los suyos. El coste: una instrucción nueva necesita fuente, modos en el núcleo, entrega en cada adaptador y escenarios.

## Límites

- **La suite comprueba lo que el agente recibe, no que el modelo cumpla la regla** (design, Non-Goals). En el cierre del change se ejecutaron los hooks reales de Claude Code, pero no se comprobó en una sesión nueva que el modelo conteste con la frase fija (`idd@16e4617:openspec/changes/archive/2026-11-21-add-quote-comment-rule/tasks.md`, 6.3).
- **`json_field` y `\uXXXX`**: el `printf` de bash solo convierte un `\uXXXX` fuera de ASCII con una locale UTF-8, así que la conversión fuerza `LC_ALL=C.UTF-8`; en bash 3.2 (macOS), que no entiende `\u`, queda un espacio. Para decidir si un mensaje activa la regla basta, porque solo importan la comilla simple inicial y las palabras de cierre (`idd@16e4617:.claude/hooks/json.sh`; [lecciones de add-quote-comment-rule](../../raw/notes/2026-11-22-ll-add-quote-comment-rule.md), lección 1).
- **Falsos positivos**: una "p" o una "r" sueltas ("p. ej.", "el lenguaje R") llevan el recordatorio, y un mensaje que empieza por `>` sin ser una cita del agente cuenta como comentario; la regla deja al modelo decidir si aplica (design de `update-comment-closing-and-quotes`, Risks).
- **El idioma de la frase fija lo decide el modelo**: el núcleo no detecta idiomas (design D3).

## See Also

- [[arranque-de-sesion|El arranque de sesión]] ([El arranque de sesión](../topics/arranque-de-sesion.md))
- [[hook-context-opencode|El hook context de OpenCode]] ([El hook context de OpenCode](hook-context-opencode.md))
- [[flujo-wiki-first|El flujo wiki-first]] ([El flujo wiki-first](../topics/flujo-wiki-first.md))
- [[suite-de-aceptacion-y-spec-as-source|La suite de aceptación y spec-as-source]] ([La suite de aceptación y spec-as-source](../topics/suite-de-aceptacion-y-spec-as-source.md))

## Sources

- [Collection: archivado de add-quote-comment-rule](../../raw/repos/2026-11-21-idd-16e4617-add-quote-comment-rule.md): `openspec/specs/response-comments/spec.md`, `.agents/comments/rule.md`, `.agents/comments/reminder.md`, `.agents/hooks/session-bootstrap.sh`, `.claude/hooks/json.sh`, `adr/0010-agent-instructions-through-session-bootstrap.md`, `README.md`, y `proposal.md`, `design.md` y `tasks.md` del change archivado.
- [Collection: archivado de update-comment-closing-and-quotes](../../raw/repos/2026-11-22-idd-c4d6b27-update-comment-closing-and-quotes.md): `openspec/specs/response-comments/spec.md`, `.agents/comments/rule.md`, `.agents/hooks/session-bootstrap.sh`, y `proposal.md` y `design.md` del change archivado.
- [Lessons Learned: add-quote-comment-rule](../../raw/notes/2026-11-22-ll-add-quote-comment-rule.md): lección 1.
