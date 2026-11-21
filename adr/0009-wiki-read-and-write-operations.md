# ADR-0009: Se consulta el wiki con su operación de lectura y lo comprobado se registra en un punto de cierre

- Status: accepted
- Date: 2026-11-21
- Supersedes: -

## Context

ADR-0004 decide que el agente consulta el wiki antes de responder y que lo descubierto al trabajar se registra a propuesta del agente: lo comprobado, con las lecciones aprendidas, y lo encontrado en internet, ingiriendo la fuente. ADR-0005 decide cómo llegan el motor, la guía y el recordatorio a cada agente. Ninguno dice con qué operación del motor se consulta ni cuándo se proponen las lecciones aprendidas.

En la práctica, ese hueco lleva a usar la operación equivocada:

- La guía no nombra ninguna operación para consultar. En Claude Code, la skill que el agente encuentra es `wiki-manager`, la que modifica el wiki, y no hay una skill de solo lectura.
- El recordatorio de cada mensaje propone `ll` en cuanto aparece algo. Pero `ll` recorre la sesión entera y está pensada para pasarse una vez: en la sesión que diseñó `add-openspec-autopilot` acabó en una nota con nueve lecciones y una décima añadida a mano.

Alternativas consideradas:

- **Dejarlo al criterio del modelo**, como hasta ahora. Es lo que produjo los problemas anteriores.
- **Proponer `ll` en cada hallazgo, pero en dry-run.** Sigue recorriendo la sesión entera cada vez y repite lecciones.
- **Guardar las candidatas en un archivo del repositorio.** Deja en el árbol de trabajo un rastro sin revisar, y se cruza con la metadata de sesión de ADR-0008.

Complementa a ADR-0004 sin sustituirlo: lo que allí se decide sigue en vigor, y aquí se precisa con qué operación y en qué momento se hace.

## Decision

- **Consultar y modificar son operaciones distintas.** Se consulta con la operación de solo lectura del motor en cada agente: hoy, `/wiki:query --local` en Claude Code y la skill `wiki-query` en OpenCode. El wiki se modifica (registrar lecciones, ingerir, compilar, corregir) solo con `wiki-manager` o sus comandos, y solo cuando el usuario confirma lo que el agente propone. `wiki-manager` no se usa para consultar.
- **La guía y el recordatorio nombran cada operación como se invoca en cada agente.** El núcleo del arranque rellena sus marcadores según el agente. La guía sigue teniendo una sola fuente (ADR-0005).
- **Lo comprobado se apunta como candidato y se registra en un punto de cierre.** Mientras trabaja, el agente apunta las lecciones candidatas sin escribir nada. Propone un solo registro, en dry-run y con confirmación del usuario, en un punto de cierre: al terminar una tarea, antes de un commit, cuando el usuario da la sesión por terminada o al archivar un change. En el archive, ese registro es el paso de lecciones de las indicaciones de archivado. El final de una sesión no es un evento que el agente vea; por eso se habla de puntos de cierre.
- **Lo encontrado en internet se sigue proponiendo ingerir en el momento**, porque se registra fuente a fuente y lo que importa es su procedencia.

## Consequences

- Consultar ya no carga el enrutador entero del motor ni deja a mano operaciones que escriben.
- Las lecciones de una sesión se revisan una vez, juntas, en lugar de una nota por hallazgo.
- Las candidatas solo viven en el contexto de la conversación: una compactación o una sesión que termina sin punto de cierre puede perderlas. `ll` vuelve a recorrer la sesión, así que las candidatas orientan la extracción pero no son lo único que la alimenta.
- El recordatorio deja de nombrar las lecciones aprendidas, y la guía gana marcadores que el núcleo debe rellenar. Si queda alguno sin rellenar, la guía no se entrega.
- Si el motor cambia sus operaciones de lectura o de escritura, cambian los valores de los marcadores, no esta decisión.
- Con el plugin de ADR-0008, las candidatas van a la metadata de la sesión y llegan al archive. Sin él, en los dos agentes, siguen este mismo flujo a mano.
