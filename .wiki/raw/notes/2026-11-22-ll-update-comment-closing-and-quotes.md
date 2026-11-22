---
title: "Lessons Learned: update-comment-closing-and-quotes"
type: notes
source: session
ingested: 2026-11-22
tags: [lessons-learned, claude-code, response-comments, openspec, acceptance-tests]
lesson_kind: lessons-learned
lesson_count: 3
category: notes
confidence: high
summary: "Una cita de la app de Claude llega como <!-- attach --> seguido de líneas '>'; una delta spec sin H1 rompe la carga de cucumber aunque openspec validate la acepte; y un escenario no se renombra dentro de un MODIFIED, sino con REMOVED + ADDED."
---

# Lessons Learned: update-comment-closing-and-quotes

> Extraído de la sesión del 2026-11-22. 3 lecciones de proponer, implementar y archivar `update-comment-closing-and-quotes`.

## Lesson 1: Cómo llega al agente una cita de la app de Claude

**Category**: discovery
**Context**: Reconocer como comentario un fragmento de la respuesta del agente citado con la app de Claude.
**Symptom**: No se sabía qué texto recibe el agente (ni el hook `UserPromptSubmit`) cuando el usuario cita.
**Root cause**: La app añade una marca propia que no se ve en la interfaz.
**Fix**: Pedir al usuario un mensaje de prueba y leerlo en el transcript de la sesión (`~/.claude/projects/<proyecto>/<sesión>.jsonl`, campo `message.content` de las entradas `user`). Llegó como `<!-- attach -->\n> fragmento citado\n\ntexto del usuario`. `activates_comments` quita, una y otra vez, los espacios y los comentarios HTML iniciales antes de buscar `>` (`idd@c4d6b27:.agents/hooks/session-bootstrap.sh`).
**Rule**: Para detectar una marca al principio de un mensaje del usuario, quita antes los comentarios HTML iniciales que añade el cliente; y si no conoces el formato exacto, compruébalo en el transcript en vez de suponerlo.

## Lesson 2: Una delta spec sin título H1 rompe la carga de la suite entera

**Category**: gotcha
**Context**: Ejecutar la suite de aceptación con la delta spec de `response-comments` recién escrita.
**Symptom**: `npm test` falló al cargar: `Configuration file "cucumber.cjs" failed to load/parse … no H1 title — a spec.md must start with "# <capability>"`, mientras `openspec validate` daba el change por válido.
**Root cause**: `extract-gherkin.cjs`, que carga `cucumber.cjs`, exige que toda `spec.md` empiece por `# <capability>`; `openspec validate` no lo comprueba.
**Fix**: Añadir `# response-comments` al principio de la delta spec.
**Rule**: Empieza toda delta spec por `# <capability>` y ejecuta la suite, no solo `openspec validate`, antes de dar las specs por buenas.

## Lesson 3: En un MODIFIED no se puede renombrar un escenario

**Category**: gotcha
**Context**: Renombrar los requisitos `"ya" responde…` y `"reformula" repite…` y sus escenarios.
**Symptom**: Con RENAMED más MODIFIED, `openspec validate` dio `MODIFIED "…" omits scenario(s) the current spec still has: "La regla dice qué hacer con "ya""`.
**Root cause**: Un MODIFIED sustituye el bloque entero y el archive se niega a perder escenarios de la spec principal; un escenario con otro nombre cuenta como uno quitado y otro añadido.
**Fix**: REMOVED de los requisitos viejos, con Reason y Migration, y ADDED de los nuevos.
**Rule**: Si cambia el nombre de un escenario, usa REMOVED + ADDED del requisito, no RENAMED + MODIFIED.
