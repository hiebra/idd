---
title: "Lessons Learned: conflictos entre deltas de changes concurrentes"
type: notes
source: session
ingested: 2026-11-22
tags: [lessons-learned, openspec, archive, delta-specs, git, adr, concurrencia]
lesson_kind: lessons-learned
lesson_count: 3
category: notes
confidence: high
summary: "En OpenSpec 1.17.0, archivar en la misma rama dos changes con deltas sobre la misma capability aborta si el requirement ya no existe o si se perderían escenarios, pero sobrescribe en silencio cuando los dos MODIFIED conservan los mismos escenarios; archivados en ramas separadas, ese caso aparece como conflicto de git al fusionar. Escribir los ADR en la rama de origen reserva su número."
---

# Lessons Learned: conflictos entre deltas de changes concurrentes

> Extraído de la sesión del 2026-11-22. 3 lecciones, comprobadas con el CLI del proyecto (`node_modules/.bin/openspec`, OpenSpec 1.17.0) en repositorios de prueba con el schema `spec-driven` y una capability `demo`. Con el schema `intent-driven` no se ejecutó; el archive es el mismo comando del CLI.

## Lesson 1: el archive aborta cuando un delta ya no casa con la spec

**Category**: discovery
**Context**: comprobar si dos changes en curso sobre la misma capability pueden chocar al archivarse uno tras otro en la misma rama, como en la forma canónica.
**Symptom**: `openspec archive <change> --yes` aborta sin tocar ningún fichero (`Aborted. No files were changed.`) en dos casos:
- el change A eliminó (REMOVED) un requirement que el change B modifica: `demo MODIFIED failed for header "### Requirement: Despedida" - not found`;
- el change A añadió un escenario a un requirement y el MODIFIED de B, escrito antes, no lo incluye: `current spec contains scenario(s) not present in the modified block: "saluda de noche" … Refresh the change spec before archiving to avoid dropping scenarios.`

El mismo aborto se da con un solo change cuyo bloque MODIFIED renombra un escenario existente: el CLI exige conservar los nombres de los escenarios de la spec actual.
**Root cause**: al aplicar un MODIFIED, OpenSpec 1.17.0 busca el requirement por su cabecera y compara los nombres de sus escenarios con los de la spec actual.
**Fix**: refrescar el delta del segundo change contra la spec actual antes de archivarlo.
**Rule**: el archive detecta un delta que se quedó sin requirement o que perdería escenarios, pero solo compara nombres de cabeceras y escenarios, no el contenido.

## Lesson 2: dos MODIFIED con los mismos escenarios se sobrescriben en silencio en la misma rama; en ramas separadas, git lo detecta

**Category**: gotcha
**Context**: el mismo experimento con dos changes que modifican el requirement `Saludo` manteniendo su único escenario `saluda` ("by name" y "in Spanish").
**Symptom**:
- **En la misma rama** (forma canónica, los dos archivados en ella): los dos archives terminan con `Specs updated successfully.`, y la spec queda solo con el texto de B. El cambio de A se pierde sin ningún aviso.
- **En ramas separadas** (forma recomendada: cada change se archiva en su rama, que se fusiona después con `--no-ff`): la segunda fusión da `CONFLICT (content): Merge conflict in openspec/specs/demo/spec.md`.
**Root cause**: en la misma rama, los deltas viven en directorios distintos de `openspec/changes/` y se aplican uno tras otro, sin que nada compare la base contra la que se escribió cada uno. En ramas separadas, cada archive edita las mismas líneas de `spec.md` desde el mismo merge-base, y git lo ve como un conflicto.
**Fix**: ninguno automático en la misma rama. Antes de archivar, comprobar si otro change archivado después de proponer el propio tocó la misma capability (`git log -- openspec/specs/<capability>/`).
**Rule**: archivar en la rama permanente no detecta mejor los conflictos entre deltas. Detecta lo mismo que las ramas en los casos de la lección 1, y peor en este, que es el único silencioso.

## Lesson 3: los ADR escritos en la rama de origen reservan su número

**Category**: pattern
**Context**: valorar si hacer la spec directamente en la rama de origen hace chocar los números de ADR.
**Root cause**: el número de un ADR nuevo es uno más que el más alto de `adr/` en `origin/<rama de origen>`, en todas las ramas remotas y en la rama de trabajo (`openspec/config.yaml`, reglas de `adr`). `check archive` de `.agents/openspec/branch-change.mjs` rechaza un ADR nuevo de una rama temporal cuyo número ya tiene otro de la rama de origen.
**Fix**: no aplica. Es una deducción de esas reglas, no un experimento ejecutado.
**Rule**: los números de ADR chocan cuando se crean en ramas paralelas. Escribirlos en la rama de origen y hacer push los reserva para las demás, que es lo que el ciclo describe como "reservar pronto los números de ADR". Solo pueden chocar dos clones que escriben a la vez en la rama de origen sin hacer push, y git lo detecta en el segundo push.
