# ADR-0018: En OpenCode, una instrucción opcional del proyecto tiene su propio plugin como adaptador

- Status: accepted
- Date: 2026-11-22
- Supersedes: -

## Context

ADR-0010 fija que toda instrucción que el proyecto entrega al agente llega por el arranque de sesión. El núcleo la prepara desde una única fuente en `.agents/`, decide qué mensajes la activan y la deja desactivar con `PROJECT_<NOMBRE>=off`, y el adaptador de cada agente la entrega. En OpenCode, ese adaptador es hoy el plugin `session-bootstrap`, que entrega la guía del wiki y también la regla de comentarios.

`session-bootstrap` es el adaptador del núcleo y tiene que funcionar siempre (ADR-0002): prepara el `PATH`, el motor del wiki y los avisos. La regla de comentarios es una ayuda opcional. El change `update-comment-phrase-and-opencode-marker` la saca a un plugin propio, `response-comments`, para que se pueda quitar, cambiar o fallar sin tocar el arranque. Es el mismo criterio con el que ADR-0008 (hoy sustituido por ADR-0014, que mantiene el plugin propio) separó el autopilot, pero esta vez para una instrucción.

ADR-0010 sigue en vigor: la fuente única, la decisión en el núcleo y la desactivación local no cambian. Solo se matiza qué adaptador entrega una instrucción en OpenCode. Por eso este ADR no lo sustituye.

Alternativas consideradas:

- **Todo en `session-bootstrap`.** Cada instrucción nueva amplía el adaptador que debe funcionar siempre, y un fallo en una instrucción puede afectar al arranque.
- **Un plugin por instrucción con su propia lógica de activación.** Duplicaría en OpenCode lo que el núcleo decide para los dos agentes, contra ADR-0010.
- **Un módulo común entre plugins.** Los plugins locales se cargan sueltos y sin dependencias, y compartir un módulo entre ellos no está comprobado en OpenCode 2.3.2.

## Decision

- **En OpenCode, una instrucción opcional del proyecto puede tener su propio plugin local** en `.opencode/plugins/<capacidad>/`, que es su adaptador. Lleva el nombre de la capacidad, como `response-comments` para la regla de comentarios.
- **El plugin solo entrega**: pide sus textos al núcleo (`session-bootstrap.sh <modo> opencode <dir>`) y los añade con el hook `context`. La fuente, la decisión de activación y la desactivación siguen en el núcleo.
- **El plugin no comparte código con otros plugins**, no tiene dependencias, nunca lanza una excepción hacia OpenCode y cumple ADR-0011.
- **`session-bootstrap` solo entrega lo que forma parte del arranque**: hoy, la guía y el recordatorio del wiki.
- **En Claude Code no cambia nada**: las instrucciones siguen llegando por los hooks del arranque, porque Claude Code no tiene plugins locales que se carguen solos al clonar. No es una asimetría de las de ADR-0006: la instrucción existe igual en los dos agentes.
- **La suite carga los plugins de sesión del proyecto juntos**, como OpenCode, y comprueba que el arranque funciona sin el plugin de cada instrucción opcional.

## Consequences

- En OpenCode, quitar el directorio del plugin desactiva la instrucción sin tocar el arranque, además de `PROJECT_<NOMBRE>=off`.
- Cada plugin de instrucción repite unas pocas líneas: la llamada al núcleo y la lectura del último mensaje del usuario.
- El orden en que llegan al `system` las instrucciones de plugins distintos depende del orden de carga de OpenCode. Ninguna instrucción puede depender de ese orden.
- El host simulado de OpenCode tiene que cargar varios plugins sobre la misma petición. Lo que se compruebe al subir de versión de OpenCode incluye que varios hooks `context` se apliquen sobre la misma petición.
