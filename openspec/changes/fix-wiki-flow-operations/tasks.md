`acceptance-tests/` ya existe, así que se omite la puesta en marcha de la suite. Se trabaja con el ciclo de `spec-as-source`: rojo → implementar → verde → commit. Un commit nunca mezcla `openspec/` con la zona de código, salvo este `tasks.md`.

Los pasos pendientes salen de `npx cucumber-js --dry-run` sobre `.extracted/changes/fix-wiki-flow-operations/specs/wiki-first-knowledge/spec.feature`. Las referencias D1 a D4 son las del `design.md` del change.

## 1. Núcleo: marcadores por agente en la guía y en el recordatorio (D1)

- [x] 1.1 Comprobar que los escenarios que entregan la guía y el recordatorio en los dos agentes están en verde antes de tocar nada (`El agente recibe la guía del wiki` de la spec principal y los dos Scenario Outline del recordatorio de la delta)
- [x] 1.2 En `wiki_text` de `.agents/hooks/session-bootstrap.sh`, cambiar la sustitución de `{{ll}}` por una tabla única con `{{query}}` e `{{ingest}}`, aplicada a la guía y al recordatorio, y no entregar la guía si le queda algún marcador. Comprobar con `session-bootstrap.sh guide|reminder <agente> .` que, mientras ningún archivo use los marcadores nuevos, la salida es la misma que antes
- [x] 1.3 Añadir a `acceptance-tests/core-tests/` una prueba del núcleo: cada marcador se sustituye por el valor de cada agente, y con un marcador desconocido no se entrega ni la guía ni el recordatorio. Rojo → implementar → verde → commit

## 2. Pasos de la guía (D2): uno por paso pendiente; en cada uno, rojo por la causa correcta → implementar → verde → commit

- [x] 2.1 `wiki-first-knowledge: La guía reserva la operación que modifica el wiki`. Definir los pasos `indica modificarlo con la operación del motor que lo modifica`, `indica hacerlo solo cuando el usuario confirma lo que el agente propone` e `indica no usar esa operación para consultar` como secciones de `GUIDE_SECTIONS` (`modificar-wiki`, `modificar-con-confirmacion`, `modificar-no-consultar`). Están en rojo mientras falten las secciones. Añadir a `.agents/wiki/guide.md` la sección "Modificar el wiki", que nombra `wiki-manager` o sus comandos `/wiki:*` → verde → commit
- [ ] 2.2 `wiki-first-knowledge: La guía nombra la operación de lectura de cada agente`. Definir:
  - `se revisa con qué operación indica la guía consultar el wiki`: toma la guía entregada por el adaptador del agente de la sesión;
  - `nombra <operación>`: la guía entregada contiene `/wiki:query --local` (Claude Code) o la skill `wiki-query` (OpenCode), y la sección `consultar-con-lectura` de la fuente (desde su identificador hasta el siguiente) contiene `{{query}}`;
  - `no nombra \`wiki-manager\` para consultar`: esa sección de la fuente no contiene `wiki-manager`.

  La guía entregada no lleva los identificadores de sección, porque el núcleo los quita: por eso la sección se localiza en la fuente y lo entregado se comprueba entero. Rojo sin la sección. Añadir a la guía la sección `consultar-con-lectura` con `{{query}}` → verde → commit
- [ ] 2.3 `wiki-first-knowledge: Lo comprobado se registra en un punto de cierre`. Definir `se revisa cuándo indica registrar lo comprobado al trabajar` y los tres `Then` como secciones (`apuntar-candidatas`, `registrar-en-cierre`, `puntos-de-cierre`). Rojo sin ellas. En la guía, sustituir la línea `registrar-comprobado-ll` por esas secciones: candidatas sin escribir; un solo `/wiki:ll --dry-run --local` en un punto de cierre y escribir solo lo que confirme el usuario; los cuatro puntos de cierre, con el archive remitiendo a sus indicaciones → verde → commit
- [ ] 2.4 Ajustar `DISCOVERY_OPERATIONS` para que `comprobado al trabajar|lecciones aprendidas` apunte a `registrar-en-cierre`, y comprobar que `La guía asigna una operación a cada tipo de descubrimiento`, de la spec principal, sigue en verde
- [ ] 2.5 Quitar de `.agents/wiki/opencode-note.md` la mención a `wiki-query` para consultar, que ya está en la guía. Comprobar que `El agente recibe la guía del wiki` sigue en verde en los dos agentes y que la guía entregada a cada uno ocupa menos de 6.000 caracteres → commit

## 3. Pasos del recordatorio (D3): uno por paso pendiente; en cada uno, rojo → implementar → verde → commit

- [ ] 3.1 `wiki-first-knowledge: El agente recibe el recordatorio con cada mensaje`, paso `el recordatorio nombra la consulta y la ingesta de fuentes como se invocan en <agente>`. Cambiar `REMINDER_OPERATIONS` a `{ query, ingest }` (`/wiki:query --local` y `/wiki:ingest <url> --local`; la skill `wiki-query` e "ingiere la fuente") y definir el paso. Rojo con el recordatorio actual. Cambiar `{{ll}}` por `{{query}}` en `.agents/wiki/reminder.md` → verde
- [ ] 3.2 Mismo escenario, pasos `el recordatorio recuerda apuntar como candidato lo que se comprueba` (`/candidat/i`) y `el recordatorio no nombra las lecciones aprendidas` (ni `/lecciones aprendidas/i` ni `/\/wiki:ll\b/`). Rojo con el texto de 3.1. Reescribir el recordatorio según D3, por debajo de 600 caracteres en los dos agentes → verde → commit
- [ ] 3.3 Quitar de `wiki.steps.js` el paso `el recordatorio nombra las lecciones aprendidas y la ingesta de fuentes como se invocan en <agente>`, que ya no usa ningún escenario efectivo, y comprobar que `Un fallo del recordatorio no bloquea el mensaje` sigue en verde en los dos agentes → commit

## 4. Cierre

- [ ] 4.1 Ejecutar la suite efectiva entera (`npm test` en `acceptance-tests/`): todos los escenarios de este change y de las specs vigentes pasan, y no queda ningún paso pendiente ni sin definir de este change. Se genera el informe HTML. Los pasos sin definir de `add-openspec-autopilot` quedan fuera de este criterio. Ejecutar también `npm run test:core` y `npm run lint:specs`
- [ ] 4.2 Abrir una sesión nueva de Claude Code en el proyecto y comprobar a mano que la guía recibida nombra `/wiki:query --local` y que el recordatorio no nombra `/wiki:ll`
- [ ] 4.3 Ejecutar `openspec validate fix-wiki-flow-operations --type change --strict` antes del archive
- [ ] 4.4 Decidir con el usuario el orden de archivado respecto a `add-openspec-autopilot`, que también toca las indicaciones de archivado y la forma de las lecciones candidatas, y anotarlo aquí
