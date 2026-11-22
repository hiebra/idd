---
title: "Lessons Learned: check commit mira todo el árbol de trabajo"
type: notes
source: session
ingested: 2026-11-22
tags: [lessons-learned, openspec, git, check-commit, cloud-session, windows-support]
lesson_kind: lessons-learned
lesson_count: 1
category: notes
confidence: high
summary: "Una lección del archivado de windows-support: la puerta check commit de branch-change.mjs juzga todos los cambios pendientes del árbol, no solo el stage, así que para hacer el commit de una zona hay que apartar la otra con git stash push -- <rutas>."
---

# Lessons Learned: check commit mira todo el árbol de trabajo

> Sesión del 2026-11-22 (resincronización del wiki tras archivar `windows-support`, en una sesión en la nube). [comprobado] ejecutando. Complementa la [nota de lecciones del archivado de windows-support](2026-11-22-ll-archive-windows-support.md).

## Lesson 1: check commit juzga los cambios pendientes de todo el árbol, no lo que hay en el stage

**Category**: gotcha
**Context**: hacer dos commits seguidos, uno de `.wiki/` y otro con un arreglo en `openspec/changes/archive/`, con los dos cambios pendientes a la vez.
**Symptom**: `node .agents/openspec/branch-change.mjs check commit` devolvió `{"ok":false,"message":"Los cambios pendientes mezclan la zona de specs (openspec/changes/archive/…/adr.md) y la de código (.wiki/…): un commit es de una sola zona. Aparta una de ellas (por ejemplo, `git stash push -- <rutas>`), …"}`, antes de hacer `git add` de nada.
**Root cause**: la puerta mira todos los cambios pendientes del árbol de trabajo, también los que no están en el stage, y no deja seguir si mezclan la zona de specs (`openspec/`) con la de código (`.wiki/` cuenta como código).
**Fix**: `git stash push -q -- <rutas de una zona>`, `check commit`, commit de la otra zona, `git stash pop -q`, `check commit` y commit de la primera.
**Rule**: antes de `check commit`, deja en el árbol solo los cambios de la zona que vas a guardar; aparta los de la otra con `git stash push -- <rutas>` y recupéralos después.
