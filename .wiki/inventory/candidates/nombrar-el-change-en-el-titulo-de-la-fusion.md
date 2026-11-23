---
title: "Nombrar el change en el título del commit de fusión"
kind: task
status: archived
priority: p3
created: 2026-11-22
updated: 2026-11-22
last_checked: 2026-11-22
next_action: "Ninguna: lo hizo name-change-in-merge-title; cerrada."
sources:
  - raw/repos/2026-11-22-idd-4b8d2b3-name-change-in-merge-title.md
  - raw/notes/2026-11-22-ll-fusion-no-ff-y-trazabilidad.md
tags: [git, openspec, no-ff, task]
confidence: high
summary: "Cerrada: desde name-change-in-merge-title, check merge titula la fusión con una rama permanente Merge <change> into <destino>, y en la nube pide ese título para el PR."
---

# Nombrar el change en el título del commit de fusión

## Why Track This

La fusión con `--no-ff` hace que `git log --first-parent` muestre un change por entrada, pero solo sirve de índice si el título nombra el change. Las fusiones locales lo hacían (`32639ba`: *"Merge autopilot-sesion-operativa into main"*); la de la PR más reciente lleva el título por defecto de GitHub (`dad41e9`: *"Merge pull request #3 from hiebra/claude/eloquent-hawking-jvhlb0"*), que nombra la rama de la sesión y no el change ([lección 3](../../raw/notes/2026-11-22-ll-fusion-no-ff-y-trazabilidad.md)).

## Current State

Cerrada. El change `name-change-in-merge-title` lo resolvió con una puerta, no solo con una recomendación: `check merge` titula la fusión con una rama permanente `Merge <change> into <destino>` (todos los changes en orden alfabético, o la rama si no lleva ninguno). En local es el mensaje del `commit-tree`; en la nube, el título del PR, recomendado también para su commit de fusión. La skill `openspec-git-discipline` lo indica (`idd@4b8d2b3c29273a705c880c0a08ed5fbfb26f71e6:.agents/openspec/branch-change.mjs`, `idd@4b8d2b3c29273a705c880c0a08ed5fbfb26f71e6:.agents/skills/openspec-git-discipline/SKILL.md`; [manifiesto](../../raw/repos/2026-11-22-idd-4b8d2b3-name-change-in-merge-title.md)).

## Next Action

Ninguna.
