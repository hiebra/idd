---
title: "Nombrar el change en el título del commit de fusión"
kind: task
status: active
priority: p3
created: 2026-11-22
updated: 2026-11-22
last_checked: 2026-11-22
next_action: "Proponer un change pequeño para que la skill openspec-git-discipline (sección de la fusión con la rama de origen) recomiende al usuario poner el nombre del change en el título del commit de fusión, también al fusionar una PR en GitHub, y valorar si una puerta debe comprobarlo."
sources:
  - raw/notes/2026-11-22-ll-fusion-no-ff-y-trazabilidad.md
tags: [git, openspec, no-ff, task]
confidence: high
summary: "El título por defecto de una fusión de PR en GitHub no nombra el change, y git log --first-parent deja de servir de índice de changes por nombre."
---

# Nombrar el change en el título del commit de fusión

## Why Track This

La fusión con `--no-ff` hace que `git log --first-parent` muestre un change por entrada, pero solo sirve de índice si el título nombra el change. Las fusiones locales lo hacían (`32639ba`: *"Merge autopilot-sesion-operativa into main"*); la de la PR más reciente lleva el título por defecto de GitHub (`dad41e9`: *"Merge pull request #3 from hiebra/claude/eloquent-hawking-jvhlb0"*), que nombra la rama de la sesión y no el change ([lección 3](../../raw/notes/2026-11-22-ll-fusion-no-ff-y-trazabilidad.md)).

## Current State

Ni la skill `openspec-git-discipline` ni ADR-0015 dicen nada sobre el título de la fusión. Hasta que se decida, el usuario puede editar el título al fusionar la PR.

## Next Action

Proponer el change (p. ej., `name-change-in-merge-title`) que añada la recomendación a la skill y su escenario a la spec `openspec-change-lifecycle`.
