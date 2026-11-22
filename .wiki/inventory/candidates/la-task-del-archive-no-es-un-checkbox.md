---
title: "La task del archive no debería ser un checkbox de tasks.md"
kind: task
status: active
priority: p3
created: 2026-11-22
updated: 2026-11-22
last_checked: 2026-11-22
next_action: "Decidir si rules.tasks de openspec/config.yaml prohíbe una task final para el archive y la resincronización del wiki, o pide marcarla en el commit del archivado limitada a lo hecho en él."
sources:
  - raw/repos/2026-11-22-idd-4b8d2b3-name-change-in-merge-title.md
  - raw/notes/2026-11-22-ll-archivado-autopilot-plan-explore.md
tags: [openspec, archive, tasks, task]
confidence: high
summary: "Una task de tasks.md que cubre el archive y la resincronización del wiki no se puede marcar con verdad dentro del change, así que cada archive avisa de tasks incompletas."
---

# La task del archive no debería ser un checkbox de tasks.md

## Why Track This

En `autopilot-plan-explore`, la task 7.5 ("Archivar … y resincronizar el wiki en un commit aparte") dejó el change en 32 de 33 tasks, y `openspec-archive-change` avisó de tasks incompletas y pidió confirmar. La task vive en el `tasks.md` que el archive mueve, y la resincronización del wiki va en un commit posterior, así que no hay momento en que marcarla sea cierto y esté dentro del change ([lecciones del archivado](../../raw/notes/2026-11-22-ll-archivado-autopilot-plan-explore.md), lección 1). Las indicaciones de archivado ya cubren esos pasos.

## Current State

Abierto. La plantilla no tiene ninguna regla sobre la task final; el change archivado conserva la 7.5 sin marcar.

Otro caso en `name-change-in-merge-title`: la task 5.4 («Al archivar, en la resincronización del wiki: …») dejó el change en 16 de 17 tasks, y el archive volvió a avisar de una task incompleta. Se marcó después del archivado, en el `tasks.md` ya archivado ([manifiesto](../../raw/repos/2026-11-22-idd-4b8d2b3-name-change-in-merge-title.md)).

## Next Action

Decidir entre: (a) una regla en `rules.tasks` de `openspec/config.yaml` que no deje poner el archive ni lo posterior como task; (b) marcarla en el commit del archivado, limitada a lo hecho en él. Con (a), hace falta un change de OpenSpec.
