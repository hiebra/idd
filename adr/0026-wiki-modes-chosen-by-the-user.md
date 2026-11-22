# ADR-0026: El wiki tiene dos modos, y cada usuario elige el suyo en local

- Status: accepted
- Date: 2026-11-22
- Supersedes: -

## Context

ADR-0004 decide que, ante una petición que requiere conocimiento, el agente consulta el wiki antes de usar su conocimiento interno y, si no responde, pregunta al usuario. Eso cuesta lecturas del wiki y, a veces, una pregunta en cada petición. Hasta ahora la única forma de evitarlo era `PROJECT_WIKI=off` (ADR-0005), que quita también el motor, la guía y el recordatorio, y con ellos el registro de lo que se descubre.

El change `add-wiki-lite-mode` pide un término medio: el wiki disponible y al día, pero consultado solo cuando el usuario lo pide.

Alternativas consideradas:

- **Solo `full` y `off`, como hasta ahora.** Obliga a elegir entre pagar la consulta en cada petición o perder el wiki.
- **El modo declarado por el proyecto** en un archivo versionado. Cuándo se consulta es una preferencia de quien trabaja, como desactivar el wiki (ADR-0010), y un archivo versionado la impondría a todo el equipo.
- **Una variable propia para el modo.** Admite combinaciones sin sentido con `PROJECT_WIKI=off`.
- **Un archivo de guía por modo.** Duplica casi toda la guía, que ADR-0005 quiere con una sola fuente.

Complementa a ADR-0004 sin sustituirlo: «wiki primero» sigue siendo el modo por defecto, y aquí se decide cuándo y quién puede apartarse de él.

## Decision

- **El wiki tiene dos modos.** En `full`, el flujo de ADR-0004 y ADR-0009 sin cambios. En `lite`, el agente no consulta el wiki por iniciativa propia, solo cuando el usuario lo pide expresamente, y entonces igual que en `full`. Todo lo demás (el motor, registrar lo descubierto con confirmación, la resincronización al archivar) es igual en los dos.
- **El modo lo elige cada usuario en local**, con la misma variable que lo desactiva: `PROJECT_WIKI` vale `full` (o nada), `lite` u `off`. Un valor desconocido produce un aviso al abrir la sesión, y el wiki queda en `full`.
- **La guía y el recordatorio siguen teniendo una sola fuente.** Lo propio de cada modo va marcado dentro del mismo archivo, y el núcleo del arranque entrega solo lo del modo del usuario. Un texto con las marcas mal formadas no se entrega.
- **Un modo nuevo del wiki** se añade con sus bloques en esos dos archivos, su valor de `PROJECT_WIKI` y sus escenarios, no con archivos ni variables nuevos.

## Consequences

- Cada usuario elige cuánto le cuesta el wiki sin dejar de alimentarlo, y sin afectar a su equipo.
- En `lite`, el agente puede responder de memoria lo que el wiki ya sabía. Lo elige el usuario, y la guía y el recordatorio se lo recuerdan al agente.
- El núcleo gana una forma más de preparar los textos (los bloques de modo), con sus propios fallos posibles, que cubren los tests del núcleo.
- La suite tiene que comprobar la guía y el recordatorio de cada modo, y que en `full` no cambian.
- Como en ADR-0004, la plantilla garantiza qué flujo recibe el agente, no que lo siga.
