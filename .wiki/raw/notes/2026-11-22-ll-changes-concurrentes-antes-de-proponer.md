---
title: "Lessons Learned: changes concurrentes antes de proponer (checkout-al-cambiar-de-sesion)"
type: notes
source: session
ingested: 2026-11-22
tags: [lessons-learned, openspec, git, adr, ramas-concurrentes]
lesson_kind: lessons-learned
lesson_count: 1
category: notes
confidence: high
summary: "Antes de proponer un change hay que mirar los changes y ADRs de las ramas remotas sin fusionar: en checkout-al-cambiar-de-sesion, dos ramas ya cubrían su base y se descubrió al numerar el ADR, con proposal, specs y design escritos; como chocaban con main y entre sí, se esperó a que llegaran a main."
---

# Lessons Learned: changes concurrentes antes de proponer

> Extraída de la sesión del 2026-11-22 en la que se planteó `checkout-al-cambiar-de-sesion` en la rama `claude/epic-hamilton-8mh92a`. 1 lección, confirmada por el usuario.

## Lesson 1: Mirar los changes y los ADRs de las ramas remotas antes de proponer, no solo al numerar

**Category**: pattern
**Context**: Se propuso `checkout-al-cambiar-de-sesion`: con `x-main-protected: true`, pasar en `openspec-autopilot` a una sesión del mismo directorio y de otra rama hace el checkout aunque el árbol esté sucio, si la rama de destino es de `x-main`. En `main` el plugin no hacía ningún checkout al cambiar de sesión ni existía la clave `x-main-protected`, así que la propuesta, las specs y el design añadieron también el comportamiento base (checkout con el árbol limpio) y la lectura de la clave.
**Symptom**: Al numerar el ADR, como manda `rules.adr` de `openspec/config.yaml` (`git fetch` y `git ls-tree --name-only <ref> adr/` en todas las ramas `origin/*`), aparecieron en ramas sin fusionar ADRs sobre lo mismo:
- `origin/claude/exciting-ramanujan-802ws8`: change activo `autopilot-rama-por-sesion` y ADR-0022 ("pasar a una sesión es pasar a su rama": en el mismo directorio el plugin hace el checkout con `branch-change.mjs`, salvo con cambios sin commit o con otra sesión trabajando; el autopilot deja de actuar en las ramas permanentes, donde sus sesiones son libres).
- `origin/claude/optimistic-noether-3vo8gl`: change archivado `git-discipline-standard-with-exception` y ADR-0020, que introduce `x-main-protected: true` como declaración de que el acceso directo a las ramas permanentes está vetado.
**Root cause**: El schema solo hace leer `adr/` de la rama de trabajo en el paso `design`, y las ramas remotas solo se miran al numerar el ADR, después del design. Nada obliga a mirar `openspec/changes/` de las ramas concurrentes antes de la propuesta.
**Fix**: Se paró antes de escribir el ADR y las tasks. Fusionar las dos ramas en la rama de trabajo daba conflictos con `main` (13 archivos en `optimistic-noether`, a la que le faltaban 68 commits de `main`, y 8 en `exciting-ramanujan`, entre ellos `branch-change.mjs`, la skill `openspec-git-discipline`, la spec `openspec-change-lifecycle`, el `README.md` y el wiki) y entre ellas (22 entradas en `git merge-tree`). Se abortó la fusión: resolverla habría rehecho en otra rama la integración de dos trabajos abiertos, y volvería a chocar cuando llegaran a `main`. El usuario decidió esperar a que las dos ramas llegaran a `main` y reducir entonces el change a la excepción.
**Rule**: Antes de proponer un change, haz `git fetch` y mira `openspec/changes/` (activos y archivados) y `adr/` de cada rama `origin/*` sin fusionar (`git ls-tree --name-only origin/<rama> openspec/changes/ openspec/changes/archive/ adr/`). Si otra rama ya cubre parte del cambio, decide con el usuario si esperar a que llegue a la rama de origen o construir encima, comprobando antes con `git merge-tree --write-tree --name-only HEAD origin/<rama>` si esa rama choca con la rama de origen.
