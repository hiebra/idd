# ADR-0029: El wiki habilitado tiene dos modos, y los declara el proyecto

- Status: accepted
- Date: 2026-11-22
- Supersedes: -

## Context

ADR-0021 mantiene de ADR-0004 que, con el wiki encendido, ante una petición que requiere conocimiento el agente consulta el wiki antes de usar su conocimiento interno y, si no responde, pregunta al usuario. Eso cuesta lecturas del wiki y, a veces, una pregunta en cada petición. La única forma de evitarlo es apagar el wiki del proyecto, que quita también el motor, la guía, el recordatorio y la resincronización al archivar.

El change `add-wiki-lite-mode` pide un término medio: el wiki disponible y al día, pero consultado solo cuando el usuario lo pide.

ADR-0021 también decide que el wiki es del proyecto y no de cada usuario: un único ajuste versionado en `.agents/wiki/engine.json`, sin apagado por usuario ni variable local, y `/toggle-wiki` como única forma prevista de cambiarlo. El modo tiene que seguir esa regla.

Alternativas consideradas:

- **Solo encendido y apagado, como hasta ahora.** Obliga a elegir entre pagar la consulta en cada petición o perder el wiki.
- **El modo elegido por cada usuario en local**, con una variable de entorno. Es lo que ADR-0021 quitó para el apagado: el wiki sería distinto según quién abre la sesión, y no hay forma de saber qué modo usa el proyecto.
- **El modo en `openspec/config.yaml`.** OpenSpec valida ese archivo, y mezclaría la configuración del wiki con la de OpenSpec, que es lo que ADR-0021 evitó.
- **Un archivo de guía por modo.** Duplica casi toda la guía, que ADR-0021 mantiene con una única fuente.

Complementa a ADR-0021 sin sustituirlo: «wiki primero» sigue siendo el modo por defecto, y aquí se decide cuándo y quién puede apartarse de él.

## Decision

- **El wiki habilitado tiene dos modos.** En `full`, el flujo de ADR-0021 y ADR-0009 sin cambios. En `lite`, el agente no consulta el wiki por iniciativa propia, solo cuando el usuario lo pide expresamente, y entonces igual que en `full`. Todo lo demás (el motor, registrar lo descubierto con confirmación, la resincronización al archivar) es igual en los dos.
- **El modo lo declara el proyecto**, en `"mode"` de `.agents/wiki/engine.json`, junto a `enabled` y con las mismas reglas: versionado, el mismo para todos, sin preferencia local que lo cambie. Si falta, es `full`, y la plantilla no lo declara. Un valor que no es un modo produce un aviso al abrir la sesión, y el wiki queda en `full`. Con el wiki deshabilitado, el modo no se lee.
- **`/toggle-wiki lite` y `/toggle-wiki full` cambian el modo**, con el mismo comando que habilita el wiki. Siguen las reglas de ADR-0021 para ese comando: no hacen commit, dejan el cambio en el stage y dicen desde cuándo vale. No habilitan ni deshabilitan el wiki, y habilitarlo o deshabilitarlo conserva el modo. La parte determinista la hace el núcleo del arranque.
- **La guía y el recordatorio siguen teniendo una sola fuente.** Lo propio de cada modo va marcado dentro del mismo archivo, y el núcleo del arranque entrega solo lo del modo del proyecto. Un texto con las marcas mal formadas no se entrega.
- **Un modo nuevo del wiki** se añade con sus bloques en esos dos archivos, su valor de `"mode"` y sus escenarios, no con archivos, variables ni comandos nuevos.

El comportamiento está especificado en `openspec/specs/llm-wiki/spec.md` y `openspec/specs/wiki-first-knowledge/spec.md`.

## Consequences

- Un proyecto elige cuánto le cuesta el wiki sin dejar de alimentarlo, y todos los que usan el repositorio lo tienen igual. Quien prefiere otro modo lo cambia con un commit del proyecto, no para sí.
- En `lite`, el agente puede responder de memoria lo que el wiki ya sabía. Lo declara el proyecto, y la guía y el recordatorio se lo recuerdan al agente.
- El núcleo gana una forma más de preparar los textos (los bloques de modo) y una acción más de su modo `wiki`, con sus propios fallos posibles, que cubren los tests del núcleo.
- La suite tiene que comprobar la guía y el recordatorio de cada modo, y que en `full` no cambian.
- Un `"mode"` mal escrito deja el wiki en `full` con un aviso, no sin guía.
- Como en ADR-0021, la plantilla garantiza qué flujo recibe el agente, no que lo siga.
