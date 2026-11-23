---
title: "Lessons Learned: planificación de limite-de-verificacion-y-mcp-de-depuracion"
type: notes
source: session
ingested: 2026-11-22
tags: [lessons-learned, openspec, tasks, delta-specs, json-schema, ajv, git, merge, liberty]
lesson_kind: lessons-learned
lesson_count: 5
category: notes
confidence: high
summary: "5 lecciones de la planificación de limite-de-verificacion-y-mcp-de-depuracion: OpenSpec 1.17.0 tolera texto tras la casilla de una task; una delta de capability nueva necesita ## Purpose; ajv estricto exige declarar en el then lo que hace obligatorio; git merge-tree enseña los conflictos sin tocar el árbol; y openliberty.io no responde desde el contenedor."
---

# Lessons Learned: planificación de limite-de-verificacion-y-mcp-de-depuracion

> Extraídas de la sesión del 2026-11-22 en la rama `claude/focused-rubin-2q927o`, al planificar el change. Las cinco son [comprobado] y las confirmó el usuario.

## Lesson 1: El texto añadido tras la casilla de una task no rompe su seguimiento

**Category**: discovery
**Context**: la regla nueva de `rules.tasks` pide escribir al final de cada task su estimación, como `(verificación: ~10 min)`.
**Rule**: OpenSpec 1.17.0 sigue contando las tasks por su casilla con texto de más en la línea: `openspec instructions apply --json`, en una copia del change, dio `progress` correcto y la línea entera, estimación y comentarios `<!-- feature: step -->` incluidos, en `description`. Se puede añadir texto al final de una task sin cambiar nada del seguimiento.

## Lesson 2: Una delta de capability nueva necesita `## Purpose` para su texto de introducción

**Category**: gotcha
**Context**: las deltas de `task-verification-limit` y `debug-mcp-contract` llevaban un párrafo de introducción justo debajo de `# <capability>`.
**Symptom**: `openspec validate` avisó de que el texto anterior a la primera sección `## ` no llega a la spec principal al archivar.
**Fix**: meter el párrafo bajo `## Purpose`, como hicieron las deltas nuevas de `spec-lint` y `windows-readiness`. El aviso desaparece y el lint de las specs sigue pasando.
**Rule**: en la delta de una capability nueva, la introducción va en `## Purpose`, antes de `## ADDED Requirements`.

## Lesson 3: ajv en modo estricto exige declarar en el `then` las propiedades que hace obligatorias

**Category**: gotcha
**Context**: validar con `ajv` 8.20.0 (`ajv/dist/2020`, `strict: true`) un esquema con `if`/`then` que hace obligatoria una propiedad según otra (un paso de `agent` exige `command`).
**Symptom**: al compilar, `strict mode: required property "command" is not defined at "#/allOf/0/then" (strictRequired)`, aunque la propiedad está en las `properties` del objeto.
**Fix**: declarar la propiedad también en el `then`, aunque sea como `true`: `"then": { "required": ["command"], "properties": { "command": true } }`. El esquema valida lo mismo y compila en modo estricto.
**Rule**: con `ajv` estricto, cada `required` de un subesquema necesita la propiedad declarada en ese mismo subesquema.

## Lesson 4: `git merge-tree --write-tree` enseña los conflictos de una fusión sin tocar el árbol

**Category**: pattern
**Context**: decidir si traer `origin/main` a la rama del change, con trabajo ya subido, antes de preguntar al usuario.
**Rule**: `git merge-tree --write-tree --name-only HEAD origin/main` lista los archivos en conflicto sin cambiar el árbol de trabajo ni el índice, y `git show <árbol>:<ruta>` enseña cada conflicto con sus marcadores. Sirve para presentar al usuario qué choca, y cómo se resolvería, antes de fusionar.

## Lesson 5: openliberty.io no responde desde el contenedor; su documentación está en GitHub

**Category**: gotcha
**Context**: investigar el modo debug de Liberty para el contrato del MCP de depuración.
**Symptom**: `curl` a `https://openliberty.io/docs/…` se quedó sin respuesta (código 000) a través del proxy, aunque el túnel se estableció; otras webs sí respondían.
**Fix**: leer el código y la documentación en sus repositorios: el script `server` en `OpenLiberty/open-liberty` (rama `release`), y los plugins en `OpenLiberty/ci.maven` y `OpenLiberty/ci.gradle`, por `raw.githubusercontent.com`.
**Rule**: si openliberty.io no responde desde una sesión en la nube, ve a los repositorios de OpenLiberty en GitHub, fijando el commit con `git ls-remote`.
