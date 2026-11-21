## Context

La guía (`.agents/wiki/guide.md`) y el recordatorio (`.agents/wiki/reminder.md`) los entrega el arranque de sesión. El núcleo (`.agents/hooks/session-bootstrap.sh`, `wiki_text`) los prepara para cada agente. Hoy funcionan así:

- **La guía es la misma para los dos agentes.** Nombra las operaciones en la forma de Claude Code (`/wiki:ll --local`, `/wiki:ingest <url> --local`, `/wiki:ingest-collection …`). OpenCode la recibe precedida de `.agents/wiki/opencode-note.md`, que traduce los `/wiki:*` a peticiones a `wiki-manager` y menciona de pasada `wiki-query` para consultar. La guía no nombra ninguna operación para consultar.
- **El recordatorio tiene dos marcadores**, `{{ll}}` e `{{ingest}}`, que el núcleo sustituye según el agente. Si queda algún marcador sin sustituir, o el texto pasa de 600 caracteres, no se entrega.
- **Lo que cada agente ve del motor**: en Claude Code, la skill `wiki-manager` y los comandos `/wiki:*` (`.claude/commands/wiki`, donde está `query.md`, de solo lectura y con `allowed-tools: Read, Glob, Grep`). En OpenCode, la skill `wiki-query` (`.opencode/skills/wiki-query`), más `wiki-manager`, que OpenCode encuentra en `.claude/skills/`.
- **La suite comprueba la guía por secciones**, con identificadores `<!-- wiki-guide:<id> -->` que no dependen de la redacción, y el recordatorio por la forma en que nombra las operaciones (`REMINDER_OPERATIONS` en `acceptance-tests/step-definitions/wiki.steps.js`).
- **Las indicaciones de archivado** (`openspec/config.yaml`) ya extraen las lecciones en dry-run y escriben solo lo que confirma el usuario. `add-openspec-autopilot` (D10) recoge lecciones candidatas por sesión y las entrega a esa resincronización. Sin el plugin, las lecciones salen de la sesión en curso.

ADRs en vigor que acotan el diseño: ADR-0004 (wiki primero; lo descubierto se registra a propuesta del agente), ADR-0005 (la guía y el motor llegan por el arranque de sesión) y ADR-0006 (asimetrías entre agentes). No hay ADRs sustituidos.

## Goals / Non-Goals

**Goals:**
- Que la guía entregada a cada agente nombre su operación de lectura (`/wiki:query --local` en Claude Code, la skill `wiki-query` en OpenCode) y no proponga `wiki-manager` para consultar.
- Que la guía reserve `wiki-manager` y sus comandos para modificar el wiki, siempre con la confirmación del usuario.
- Que lo comprobado al trabajar se apunte como candidato y se proponga registrar una sola vez, en un punto de cierre.
- Que el recordatorio nombre la consulta y la ingesta en la forma de cada agente y deje de nombrar las lecciones aprendidas, sin pasar de 600 caracteres.

**Non-Goals:**
- Cambiar el motor del wiki o sus skills.
- Exponer en Claude Code la skill `wiki-query` del paquete de OpenCode.
- Detectar el final de una sesión, o guardar las candidatas en un archivo o en la metadata de la sesión (eso solo lo hace el plugin de `add-openspec-autopilot`).
- Comprobar que el modelo sigue la guía: la suite comprueba lo que recibe (ADR-0004).

## Decisions

### D1. La guía también lleva marcadores, y el núcleo los sustituye igual que en el recordatorio

La guía gana el marcador `{{query}}` y el recordatorio sustituye `{{ll}}` por `{{query}}`. Una sola tabla en `wiki_text` da la forma de cada operación por agente, y se aplica a la guía y al recordatorio:

| Marcador | Claude Code | OpenCode |
|---|---|---|
| `{{query}}` | `` `/wiki:query --local` `` | la skill `` `wiki-query` `` |
| `{{ingest}}` | `` `/wiki:ingest <url> --local` `` | ingiere la fuente |

La regla de los marcadores desconocidos pasa a valer también para la guía: si queda alguno sin sustituir, no se entrega. Así no llega nunca una guía con `{{…}}`, y la suite lo detecta como "el agente no recibe la guía".

El resto de operaciones de la guía (`/wiki:ll`, `/wiki:ingest-collection`) siguen escritas como comandos de Claude Code, y `opencode-note.md` las sigue traduciendo. La nota deja de hablar de la consulta, que ya dice la propia guía.

- *Alternativa: dejar la guía literal y añadir la operación de lectura de OpenCode solo en la nota.* OpenCode recibiría `/wiki:query --local`, que no existe allí, y una corrección en la nota. Es justo la confusión que el change quiere quitar, en la operación que más se usa.
- *Alternativa: marcadores para todas las operaciones de la guía.* Cubre más de lo que pide la spec, alarga la tabla y obliga a redactar en OpenCode operaciones que la nota ya resuelve. Queda para cuando haga falta.
- *Alternativa: dos guías, una por agente.* Rompe la fuente única de ADR-0005 y del diseño anterior (D2 de `add-llm-wiki-support`).

### D2. Secciones nuevas y cambiadas en la guía

Con identificadores nuevos, para que la suite compruebe cada parte sin depender de la redacción:

- **`consultar-con-lectura`**, en "Consultar antes de responder": consulta con `{{query}}`, que no modifica el wiki, y no con `wiki-manager`. La suite comprueba, en la guía entregada a cada agente, que esta sección nombra la operación de ese agente y no contiene `wiki-manager`. Para eso necesita el texto de la sección, desde su marcador hasta el siguiente.
- **`modificar-con-confirmacion`**, en una sección nueva, "Modificar el wiki": registrar lecciones, ingerir, compilar o corregir artículos se hace con `wiki-manager` o sus comandos `/wiki:*`, y solo cuando el usuario confirma lo que propone el agente. Nunca para consultar.
- **`apuntar-candidatas`** y **`registrar-en-cierre`**, que sustituyen a `registrar-comprobado-ll`: lo comprobado se apunta en la conversación como lección candidata, sin escribir nada. En un punto de cierre (al terminar una tarea, antes de un commit, cuando el usuario da la sesión por terminada o al archivar un change), el agente propone un solo `/wiki:ll --dry-run --local` y escribe solo lo que confirma el usuario. Si no hay candidatas, no propone nada.
- **`registrar-internet-ingesta`** se queda: lo encontrado en internet se propone ingerir en el momento, con `{{ingest}}`.

En el archive, el punto de cierre es el paso de lecciones que ya tienen las indicaciones de archivado. La guía remite a ellas y no añade otra extracción.

- *Alternativa: proponer `ll` en cada hallazgo, como ahora.* Es lo que produjo la nota de nueve lecciones más una añadida a mano: `ll` recorre la sesión entera y está pensada para pasarse una vez.
- *Alternativa: guardar las candidatas en un archivo del repositorio.* Deja rastro sin revisar en el árbol de trabajo y se cruza con la metadata del plugin de autopilot.

### D3. El texto del recordatorio

El recordatorio recuerda consultar con `{{query}}`, preguntar ante un hueco, apuntar como candidato lo que se comprueba y proponer ingerir lo que se encuentra en internet (`{{ingest}}`). No nombra `ll` ni las "lecciones aprendidas". Un borrador con los valores de Claude Code ocupa 477 caracteres, por debajo de 600. La suite comprueba el límite con los valores de cada agente.

En la suite, `REMINDER_OPERATIONS` pasa de `{ll, ingest}` a `{query, ingest}`, y se añade la comprobación de que el recordatorio no contiene `/wiki:ll` ni "lecciones aprendidas".

### D4. La spec y la suite

- `wiki.steps.js`: cambiar los identificadores de `GUIDE_SECTIONS` y `DISCOVERY_OPERATIONS` (fuera `registrar-comprobado-ll`; entran `apuntar-candidatas`, `registrar-en-cierre`, `modificar-con-confirmacion` y `consultar-con-lectura`), añadir el paso de la guía por agente (entregada mediante el adaptador de ese agente, como en los escenarios del arranque) y añadir las comprobaciones del recordatorio.
- La spec delta ya existe (`specs/wiki-first-knowledge/spec.md`). Los escenarios de la spec principal que nombran `/wiki:ll` para lo comprobado (`asigna estas operaciones del motor`) se ajustan al resincronizar la spec en el archive.

## Risks / Trade-offs

- [Las candidatas solo viven en el contexto de la conversación; una compactación o el cierre de la sesión sin un punto de cierre las pierde] → `ll` recorre igualmente la sesión, así que las candidatas orientan la extracción pero no son lo único que la alimenta. En el archive, las indicaciones las recogen de la sesión en curso (o del plugin, con autopilot).
- [El agente puede no proponer nunca el registro porque ningún punto de cierre se le presenta como evento] → Los puntos de cierre son momentos que el agente sí ve (un commit, el final de una tarea, el usuario diciéndolo, un archive). La plantilla garantiza que recibe la indicación, no que la siga (ADR-0004).
- [Un marcador mal escrito en la guía deja la sesión sin guía] → Lo detecta la suite, en los escenarios de entrega de la guía de los dos agentes. Es preferible a entregar una guía con `{{…}}`.
- [La guía crece con la sección nueva] → Hoy ocupa unos 3.600 caracteres en Claude Code y 4.000 en OpenCode. Las secciones nuevas añaden unos pocos cientos, y la suite mantiene el límite de 6.000.
- [La spec principal y la guía quedan desalineadas hasta el archive] → Es lo normal en un change de OpenSpec. La resincronización de specs lo cierra.

## Migration Plan

No hay datos que migrar. El cambio llega con la siguiente sesión: el arranque vuelve a generar la guía y el recordatorio a partir de los archivos nuevos. Para volver atrás, basta con revertir el commit.

## Open Questions

- **ADR-0004.** Dice que lo descubierto "se registra… a propuesta del agente", pero no cuándo ni con qué operación se consulta. Este diseño lo precisa (lectura con la operación de solo lectura; lo comprobado, en un punto de cierre) sin contradecirlo. Propuesta para el paso `adr`: un ADR nuevo que complemente a ADR-0004 sin sustituirlo. Si el paso `adr` concluye que precisar cuándo se registra cambia la decisión, el ADR nuevo lo sustituye.
- **ADR-0006.** No aplica: la consulta existe en los dos agentes y solo cambia cómo se invoca.
