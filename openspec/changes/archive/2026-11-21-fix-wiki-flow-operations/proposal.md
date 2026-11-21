## Why

La guía y el recordatorio del wiki dicen qué hacer, pero no con qué operación del motor, y eso lleva al agente a usar la operación equivocada. Para consultar en solo lectura no nombran ninguna, así que la skill que el agente encuentra es `wiki-manager`, la que modifica el wiki: carga el enrutador entero y deja a mano operaciones que escriben (en Claude Code ni siquiera hay una skill de solo lectura). Y el recordatorio de cada mensaje propone las lecciones aprendidas (`ll`) en cuanto aparece algo, cuando `ll` está hecha para pasarse una vez sobre una sesión entera: en la sesión que diseñó `add-openspec-autopilot` acabó en una nota con nueve lecciones y una décima añadida a mano después.

## What Changes

- **Consultar** el wiki se hace con la operación de solo lectura de cada agente: la skill `wiki-query` en OpenCode y el comando `/wiki:query --local` en Claude Code. La guía y el recordatorio la nombran como se invoca en cada agente.
- **Modificar** el wiki (registrar lecciones, ingerir fuentes, compilar…) se hace con `wiki-manager` o sus comandos, y siempre a propuesta del agente confirmada por el usuario. `wiki-manager` no se usa para consultar.
- **Lo comprobado al trabajar** se apunta como lección candidata mientras se trabaja, sin escribir nada ni proponer `ll` cada vez. El agente propone un solo `ll` (en dry-run, para revisarlo con el usuario) en un punto de cierre: al terminar una tarea, antes de un commit, cuando el usuario da la sesión por terminada o al archivar un change. El final de la sesión no es un evento que el agente vea, por eso se habla de puntos de cierre.
- **Lo encontrado en internet** se sigue proponiendo ingerir en el momento, porque es por fuente y lo que importa es su procedencia.
- **El recordatorio de cada mensaje** recuerda consultar con la operación de lectura y apuntar las candidatas, y deja de nombrar `ll`.

Fuera de alcance: cambiar el motor del wiki o sus skills; exponer en Claude Code la skill `wiki-query` del paquete de OpenCode (se usa el comando `/wiki:query`); detectar automáticamente el final de una sesión.

## Capabilities

### New Capabilities

### Modified Capabilities
- `wiki-first-knowledge`: la guía y el recordatorio nombran la operación de lectura de cada agente para consultar, reservan la operación que modifica el wiki para cuando el usuario confirma un registro, y pasan las lecciones aprendidas de cada hallazgo a un solo registro en un punto de cierre.

## Impact

- `.agents/wiki/guide.md` y `.agents/wiki/reminder.md`, y el núcleo del arranque (`.agents/hooks/session-bootstrap.sh`), que rellena los marcadores del recordatorio por agente: hará falta uno para la consulta.
- El límite de 600 caracteres del recordatorio.
- Suite de aceptación: los escenarios de la guía y del recordatorio (`acceptance-tests/step-definitions/wiki.steps.js`).
- ADR-0004 ("lo descubierto al trabajar se registra… a propuesta del agente"): hay que ver si el registro en puntos de cierre lo matiza o lo sustituye.
- `add-openspec-autopilot`, que ya recoge lecciones candidatas por sesión y las registra en el archive: este change da la misma forma al trabajo sin el plugin, en los dos agentes.
