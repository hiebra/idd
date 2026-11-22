---
title: "Lessons Learned: archivado de windows-support"
type: notes
source: session
ingested: 2026-11-22
tags: [lessons-learned, openspec, archive, adr, spec-lint, git, cloud-session, windows-support]
lesson_kind: lessons-learned
lesson_count: 3
category: notes
confidence: high
summary: "Tres lecciones del archivado de windows-support: mover el change a archive/ rompe los enlaces relativos de sus artefactos, lint:specs solo existe en acceptance-tests/ y su fallo en la raíz pasa desapercibido, y en la nube cada paso de la resincronización del wiki acaba en su propio commit, que también pasa por check commit."
---

# Lessons Learned: archivado de windows-support

> Sesión del 2026-11-22 (archivado de `windows-support` en la forma recomendada, en una sesión en la nube). Todo es [comprobado] ejecutando.

## Lesson 1: archivar un change añade un nivel de directorio y rompe los enlaces relativos de sus artefactos

**Category**: gotcha
**Context**: mover `openspec/changes/windows-support/` a `openspec/changes/archive/2026-11-22-windows-support/`.
**Symptom**: el enlace a ADR-0017 del `adr.md`, `../../../adr/…`, deja de resolver una vez archivado. En `openspec/changes/archive/2026-11-22-replace-gherkin-lint-with-gplint/adr.md`, el enlace `../../../adr/0012-spec-lint-with-gplint.md` seguía roto.
**Root cause**: el `mv` del archive no reescribe los enlaces, y los archivados anteriores están mezclados: casi todos usan `../../../../adr/`, pero uno conservaba `../../../adr/`.
**Fix**: tras el `mv`, sustituir `](../../../adr/` por `](../../../../adr/` y comprobar con `test -e` que cada enlace resuelve.
**Rule**: después de mover un change a `archive/`, reescribe los enlaces relativos de sus artefactos que salgan del change, con un `../` más, y comprueba que resuelven antes del commit del archivado.

## Lesson 2: lint:specs solo existe en acceptance-tests/, y en la raíz falla sin decir nada

**Category**: gotcha
**Context**: pasar el lint de las specs tras sincronizar los deltas.
**Symptom**: `npm run -s lint:specs 2>&1 | tail -5`, ejecutado en la raíz, no imprimió nada y pareció que pasaba.
**Root cause**: el script solo está en `acceptance-tests/package.json`. En la raíz, npm sale con 1, `-s` oculta el mensaje de script inexistente y el código de salida que llega es el de `tail`.
**Fix**: `cd acceptance-tests && npm run -s lint:specs` y leer `$?` sin tubería: sale con 0 y extrae los 9 `spec.md`.
**Rule**: el lint de las specs se ejecuta desde `acceptance-tests/`. Para dar por buena una comprobación, lee su código de salida directamente, nunca a través de una tubería ni con `-s`.

## Lesson 3: en la nube, cada paso de la resincronización del wiki acaba en su propio commit, autorizado por check commit

**Category**: pattern
**Context**: resincronizar el wiki paso a paso tras el commit del archivado, con una confirmación del usuario entre pasos.
**Symptom**: al terminar el turno del paso 1, el hook de parada de la sesión en la nube exigió hacer commit y push de los cambios pendientes de `.wiki/`.
**Root cause**: en un contenedor efímero no puede quedar nada sin subir al acabar un turno, y cada paso que espera la confirmación del usuario termina un turno.
**Fix**: un commit de `.wiki/` por paso (fuentes, compilación, librarian…), todos después del commit del archivado y ninguno mezclado con `openspec/`. Cada uno, después de `node .agents/openspec/branch-change.mjs check commit` (en esta sesión se ejecutó tarde, tras cuatro commits; ya autorizaba).
**Rule**: en una sesión en la nube, la resincronización del wiki tras un archivado son varios commits de `.wiki/`, uno por paso confirmado, y antes de cada commit se ejecuta `check commit`.
