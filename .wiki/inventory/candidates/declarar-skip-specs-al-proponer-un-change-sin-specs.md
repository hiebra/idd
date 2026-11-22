---
title: "¿Declarar skip_specs: true al proponer un change sin cambios de comportamiento?"
kind: question
status: active
priority: p3
created: 2026-11-22
updated: 2026-11-22
last_checked: 2026-11-22
next_action: "Decidir si el flujo de propuesta del proyecto debe pedir skip_specs: true en el .openspec.yaml de un change sin cambios de comportamiento; si se decide que sí, hacerlo como change de OpenSpec."
sources:
  - raw/notes/2026-11-22-ll-guidance-de-archive-no-salta-preguntas.md
  - raw/articles/2026-11-22-openspec-docs-cli-archive.md
tags: [openspec, question, skip-specs, archive]
confidence: medium
summary: "Tema abierto: si un change sin cambios de comportamiento declarara skip_specs: true al proponerse, el archive no tendría delta que sincronizar ni haría la pregunta del sync. Falta decidir si el proyecto lo pide y dónde."
---

# ¿Declarar skip_specs: true al proponer un change sin cambios de comportamiento?

## Why Track This

Sale de la lección 2 de [las lecciones sobre la guidance de archivado](../../raw/notes/2026-11-22-ll-guidance-de-archive-no-salta-preguntas.md). La guidance de archivado no puede quitar la pregunta del sync de specs. Lo que sí la evita es que el change no tenga delta: OpenSpec recomienda declarar `skip_specs: true` en el `.openspec.yaml` de un change que nunca tendrá deltas (refactors, tooling, infraestructura, docs). Así archiva sin flag ([docs/cli.md de OpenSpec 2.1.1](../../raw/articles/2026-11-22-openspec-docs-cli-archive.md)).

El usuario decidió el 2026-11-22 dejarlo como tema abierto, sin abrir aún un change.

## Current State

Abierto. Preguntas por resolver:

- Dónde se pediría: en una regla de `proposal` de `openspec/config.yaml`, en el schema intent-driven o en la skill de disciplina de git.
- Si choca con el schema intent-driven, que exige specs (`rules.specs` y `tasks` usan spec-as-source), y cómo se comporta en él el estado `skipped` del artefacto de specs.
- Comprobar en la 1.17.0 instalada que `skip_specs` funciona igual que en la documentación de la 2.1.1 (el CLI 1.17.0 ya lee el marcador).

## Next Action

Decidir si el flujo de propuesta del proyecto debe pedirlo y, si sí, hacerlo como change de OpenSpec.
