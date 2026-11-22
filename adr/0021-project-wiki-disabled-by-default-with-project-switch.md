# ADR-0021: El wiki del proyecto viene deshabilitado y se enciende para todo el proyecto con un ajuste versionado

- Status: accepted, supersedes ADR-0004, ADR-0005, ADR-0010
- Date: 2026-11-22
- Supersedes: ADR-0004, ADR-0005, ADR-0010

## Context

ADR-0004 trae el wiki encendido en todo proyecto creado desde la plantilla. ADR-0005 permite que cada usuario lo apague para sí con `PROJECT_WIKI=off`, sin tocar archivos versionados. ADR-0010 generaliza esa regla a toda instrucción que el proyecto entrega al agente. Al revisarlo han salido tres problemas:

- **El apagado no llega a todo.** `PROJECT_WIKI=off` quita el motor, la guía y el recordatorio. Pero las indicaciones de archivado de `openspec/config.yaml` siguen pidiendo la resincronización con operaciones `/wiki:*` que ya no existen, y el autopilot sigue creando el paso `wiki` y esperando su commit.
- **El wiki es del proyecto, no de cada usuario.** Si un usuario lo apaga para sí, sus archives se saltan la resincronización, y el wiki queda desfasado para todos los que lo usan.
- **No todos los proyectos quieren un wiki.** Traerlo encendido obliga a cada proyecto a cargar con el motor, la guía en cada sesión y un paso más en cada archive, aunque no lo use.

Además, `operations.archive.guidance` solo añade pasos al workflow de archive: no puede saltarse sus preguntas ni cambiar sus flags. Para que el archive no resincronice, los pasos no pueden estar.

Alternativas consideradas:

- **Mantener `PROJECT_WIKI=off` y extenderlo a las indicaciones de archivado y al autopilot.** Arregla el primer problema, pero no el segundo.
- **Un apagado por proyecto conservando también el apagado por usuario.** Mantiene abierto el segundo problema.
- **El ajuste en `openspec/config.yaml`.** OpenSpec valida ese archivo, y mezcla la configuración del wiki con la de OpenSpec.
- **Pasos del archive fijos y redactados en condicional.** La guidance es solo un consejo, y el modelo tendría que comprobar el estado en cada archive.

## Decision

- **El wiki se enciende o se apaga para todo el proyecto** con un único ajuste versionado, `enabled` en `.agents/wiki/engine.json`. Si el campo falta o tiene otro valor que `true`, el wiki está apagado. La plantilla lo trae apagado, también en este repositorio.
- **No hay apagado por usuario.** Se quita `PROJECT_WIKI`, y ninguna preferencia local cambia lo que dice el ajuste.
- **Apagado, no existe nada del wiki**, salvo `.wiki/`, que se conserva:
  - el arranque no instala el motor y retira lo que lo expone;
  - el agente no recibe la guía ni el recordatorio;
  - las indicaciones de archivado no mencionan el wiki;
  - el autopilot termina el ciclo en el archive.
- **El comando `/toggle-wiki` es la única forma prevista de cambiar el ajuste.** Es propio del proyecto, no del motor, y existe en los dos agentes también con el wiki apagado. Cambia el ajuste y pone o quita, entre marcas, los pasos de resincronización en `config.yaml`. Esos pasos tienen su única fuente en `.agents/wiki/archive-guidance.yaml`. Al encender sin `.wiki/`, propone la ingesta inicial y no escribe nada sin confirmación. Deja sus cambios en el stage de git, sin commit. La parte determinista la hace el núcleo del arranque (`session-bootstrap.sh wiki <status|on|off>`).
- **Del proyecto solo se lee el ajuste, `config.yaml` y `.wiki/`.** Lo demás viaja con la distribución, y el núcleo lo busca junto a sí mismo: la guía, el recordatorio, el bloque del archive, el comando y el motor. Así funciona igual con la plantilla completa y con la instalación global de la variante adelgazada.
- **El apagado en local de ADR-0010 sigue valiendo para las instrucciones que no son del proyecto**, como la regla de comentarios (`PROJECT_COMMENTS=off`). Una instrucción que forma parte de una capacidad del proyecto, como la guía y el recordatorio del wiki, se enciende y se apaga con el ajuste del proyecto.
- **Sigue vigente de ADR-0004:**
  - el concepto, independiente del motor;
  - los dos ámbitos: el wiki del proyecto, en `.wiki/` y versionado, y el hub del usuario, opcional;
  - wiki primero, y preguntar ante un hueco;
  - registrar lo descubierto a propuesta del agente;
  - los productos del proyecto como fuentes fijadas a un commit, con la resincronización en cada archive y en un commit posterior;
  - que la plantilla garantiza que el agente recibe el flujo, no cómo razona.

  Todo ello con el wiki encendido.
- **Sigue vigente de ADR-0005:**
  - una sola copia del motor, en la versión de `engine.json`, en `.agents/wiki-engine/` e ignorada por git, expuesta por las rutas de descubrimiento de cada agente;
  - la guía y el recordatorio con una única fuente, preparados por el núcleo y entregados por los adaptadores del arranque;
  - ningún archivo de instrucciones que un agente cargue siempre;
  - `.wiki/` sin ignorar.
- **Sigue vigente de ADR-0010:**
  - toda instrucción llega por el arranque, con una única fuente en `.agents/`;
  - si solo tiene sentido con ciertos mensajes, lo decide el núcleo de forma determinista;
  - el proyecto no tiene archivos de instrucciones que un agente cargue siempre.

El comportamiento está especificado en `openspec/specs/llm-wiki/spec.md`, `openspec/specs/wiki-first-knowledge/spec.md`, `openspec/specs/session-bootstrap/spec.md`, `openspec/specs/openspec-autopilot/spec.md` y `openspec/specs/openspec-change-lifecycle/spec.md`.

## Consequences

- Un proyecto que no quiere wiki no carga con nada de él, y uno que lo quiere lo tiene igual para todos los que usan el repositorio.
- Encender o apagar el wiki es un cambio del proyecto, con su commit y su revisión, y no una preferencia de cada uno.
- Un proyecto creado desde la plantilla anterior, sin `enabled`, queda con el wiki apagado al actualizar. Para seguir usándolo, hay que ejecutar `/toggle-wiki`.
- Este repositorio deja de usar su wiki mientras no se encienda. Un change que se archive con el wiki apagado no lo resincroniza.
- La copia de los pasos del archive que hay en `config.yaml` puede quedar desfasada respecto a su fuente. El arranque avisa, pero no reescribe el archivo.
- En Claude Code, las operaciones del motor que instala `/toggle-wiki` a mitad de sesión pueden valer solo desde la sesión siguiente. Hasta comprobarlo, el comando no depende de ellas y avisa.
- Cómo encuentra el núcleo global el motor que instala el `.bat` de la variante adelgazada queda para el change que la introduce. La descarga del motor queda aislada en una sola función para que pueda cambiar.
