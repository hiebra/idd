---
title: "Lessons Learned: operaciones del wiki por agente en la guía y el recordatorio"
type: notes
source: session
ingested: 2026-11-21
tags: [lessons-learned, acceptance-tests, cucumber, openspec, session-bootstrap, llm-wiki]
lesson_kind: lessons-learned
lesson_count: 4
category: notes
confidence: high
summary: "Lecciones de aplicar fix-wiki-flow-operations: openspec validate --strict no pasa con las specs del proyecto, cómo comprobar una guía con marcadores e identificadores de sección, el hueco de test:specs entre apply y archive, y las expresiones de paso genéricas que chocan."
---

# Lessons Learned: operaciones del wiki por agente en la guía y el recordatorio

> Sesión del 2026-11-21, al aplicar `fix-wiki-flow-operations` en `idd@f7bafee`. Cuatro lecciones sobre la suite de aceptación y la validación de OpenSpec.

Tipos de evidencia: **[comprobado]** se ejecutó en esta sesión; **[lectura de código]** se leyó, sin verlo en ejecución.

## Lección 1: `openspec validate --strict` no pasa con ninguna spec del proyecto

**Category**: gotcha
**Context**: tarea 4.3 de `fix-wiki-flow-operations`, ejecutar `openspec validate <change> --type change --strict` antes del archive.
**Symptom**: [comprobado] termina con 1 y "has issues". Sin `--strict`, el mismo change es válido.
**Root cause**: [comprobado] en modo estricto, los avisos cuentan como errores, y dos de ellos salen de las convenciones del proyecto: los requisitos dicen "DEBE" en lugar de SHALL/MUST, y los escenarios van en Gherkin dentro de bloques de código en lugar de viñetas `**WHEN**`/`**THEN**`. Pasa lo mismo con la spec principal `wiki-first-knowledge` y con el change `add-openspec-autopilot`.
**Fix**: ninguno todavía. Queda pendiente decidir el criterio de la tarea 4.3.
**Rule**: en este proyecto, `openspec validate --strict` no sirve como criterio de cierre. Hay que validar sin `--strict` y revisar los avisos que no sean de idioma ni del formato Gherkin.

## Lección 2: Comprobar una guía que se entrega sin identificadores y con marcadores sustituidos

**Category**: pattern
**Context**: pasos de `wiki.steps.js` que comprueban qué operación nombra la guía en cada agente.
**Root cause**: [lectura de código] el núcleo (`.agents/hooks/session-bootstrap.sh`, `wiki_text`) quita las líneas `<!-- wiki-guide:<id> -->` y sustituye `{{query}}` e `{{ingest}}` según el agente. [comprobado] al meter `{{query}}` en la guía, `guideAsDelivered()` del World dejó de coincidir con lo entregado hasta que aplicó la misma tabla por agente.
**Fix**: las secciones se buscan en la fuente, desde su identificador hasta el siguiente, y lo entregado se comprueba entero. `GUIDE_OPERATIONS` en `acceptance-tests/support/world.js` replica la tabla del núcleo.
**Rule**: cuando el arranque transforma un texto antes de entregarlo, se comprueba la estructura en la fuente y el contenido en lo entregado. El soporte de la suite tiene que replicar la transformación, y una prueba del núcleo (`core-tests/wiki-markers.test.js`) fija esa tabla para que las dos copias no diverjan sin que nadie lo note.

## Lección 3: Retirar un paso que solo usa un escenario sustituido deja `test:specs` con un paso sin definir hasta el archive

**Category**: discovery
**Context**: tarea 3.3, quitar el paso `el recordatorio nombra las lecciones aprendidas y la ingesta…`.
**Symptom**: [comprobado] la spec principal (`openspec/specs/wiki-first-knowledge/spec.md:150`) todavía lo usa. `npm test` no lo nota, porque la suite efectiva deja fuera ese escenario ("superseded by change") y ejecuta la versión de la delta.
**Root cause**: `npm test` ejecuta las specs efectivas, y `npm run test:specs` ejecuta las principales tal cual, que solo se actualizan al resincronizar en el archive.
**Fix**: se aceptó como estado transitorio entre apply y archive.
**Rule**: en un change que modifica escenarios, el criterio de verde es `npm test`. Durante el change, `test:specs` puede tener pasos sin definir de los escenarios sustituidos, y esos pasos desaparecen al archivar.

## Lección 4: Las expresiones de paso genéricas chocan con frases nuevas de las specs

**Category**: gotcha
**Context**: definir los pasos `When se revisa cuándo indica…`, `When se revisa con qué operación…` y `Then nombra <operación>`.
**Symptom**: [comprobado] el `When` genérico `^se revisa (?:qué|cómo) (?:indica|peticiones exigen) .+$` no cubría "cuándo", y hubo que ampliarlo. [lectura de código] un `Then ^nombra (.+)$` habría sido ambiguo con `nombra como puntos de cierre …`, del escenario vecino.
**Fix**: añadir "cuándo" a la alternativa, definir "con qué operación" como paso propio y restringir `nombra` a las dos operaciones posibles.
**Rule**: antes de definir un paso nuevo en `wiki.steps.js`, hay que contrastar su expresión con las genéricas que ya existen y con los otros pasos que empiezan igual. Conviene restringir las capturas a los valores de los `Examples`.
