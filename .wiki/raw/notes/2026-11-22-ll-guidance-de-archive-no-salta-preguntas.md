---
title: "Lessons Learned: alcance de operations.archive.guidance y archivar sin sincronizar"
type: notes
source: session
ingested: 2026-11-22
tags: [lessons-learned, openspec, archive, operation-guidance, skip-specs]
lesson_kind: lessons-learned
lesson_count: 2
category: notes
confidence: high
summary: "En OpenSpec 1.17.0, operations.<op>.guidance es consultiva y no puede saltarse la pregunta del sync de specs del archive; archivar sin sincronizar es para changes sin cambios de comportamiento (mejor skip_specs: true) o syncs bloqueados."
---

# Lessons Learned: alcance de operations.archive.guidance y archivar sin sincronizar

> Extraído de la sesión del 2026-11-22. 2 lecciones: lo que la guidance de archivado puede cambiar del workflow de archive y para qué existe archivar sin sincronizar.

## Lesson 1: La guidance de archivado no puede saltarse la pregunta del sync

**Category**: gotcha
**Context**: Se quería que el archive sincronizara siempre las delta specs sin preguntar, con una entrada en `operations.archive.guidance` de `openspec/config.yaml`.
**Symptom**: Ninguno en ejecución: se descartó antes de aplicarlo, al leer la skill.
**Root cause**: `openspec instructions archive` entrega la guidance como `operationGuidance`, descrita como «advisory guidance» (`idd@a62cf14:node_modules/@fission-ai/openspec/dist/core/project-config.js`). La skill `openspec-archive-change` (generada por OpenSpec 1.17.0) la trata como un consejo que se añade: prohíbe deducir de ella «skipped prompts, or flags», manda no seguir la guidance que choca con un paso de la skill y explicar por qué, y declara que «prompts, and command contracts are unchanged» (`idd@a62cf14:.claude/skills/openspec-archive-change/SKILL.md`). La pregunta del sync es el paso 4 de la skill.
**Fix**: No se cambió nada. Para forzar el sync, la elección tiene que llegar como elección del usuario en la petición, o hace falta una opción de configuración de OpenSpec. Editar la skill no sirve: `openspec update` la regenera.
**Rule**: `operations.<op>.guidance` solo añade pasos compatibles con el workflow. No sirve para saltarse sus preguntas, cambiar sus flags ni modificar sus comprobaciones; eso se logra con una elección explícita del usuario o con cambios en OpenSpec.

## Lesson 2: Cuándo se archiva sin sincronizar specs

**Category**: discovery
**Context**: Al valorar si el archive debía sincronizar siempre, se buscó para qué existe «Archive without syncing».
**Root cause**: OpenSpec contempla changes sin efecto en las specs y deltas que no se pueden aplicar.
**Fix**: Casos documentados:
- (a) Change sin cambios de comportamiento (refactors, tooling, infraestructura, docs). Si nunca tendrá deltas, se declara `skip_specs: true` en su `.openspec.yaml` y archiva sin flag ni pregunta. Si es puntual, `openspec archive --skip-specs` ([docs/cli.md](../articles/2026-11-22-openspec-docs-cli-archive.md); ayuda del CLI 1.17.0: «useful for infrastructure, tooling, or doc-only changes»).
- (b) Sync bloqueado: MODIFIED o RENAMED sobre una capability sin spec principal, REMOVED solo sin `retire_capabilities: true`, o delta vacío. La skill solo ofrece «Archive without syncing» o «Cancel» (`idd@a62cf14:.claude/skills/openspec-archive-change/SKILL.md`, paso 4).
- No es archivar sin sincronizar: si las specs ya se sincronizaron con `/opsx:sync` (por ejemplo, porque un change en paralelo las necesitaba), la skill ofrece «Archive now» ([docs/opsx.md](../articles/2026-11-22-openspec-docs-opsx-sync.md); [docs/commands.md](../articles/2026-11-22-openspec-docs-commands-sync-archive.md)).
- OpenSpec no documenta cómo abandonar un change: propone darlo por hecho, archivarlo y abrir otro ([docs/opsx.md](../articles/2026-11-22-openspec-docs-opsx-sync.md)). Que un change sustituido por otro o un sync revisado aparte justifiquen archivar sin sincronizar no tiene fuente.

Las páginas de la documentación son de `main` (2.1.1, `Fission-AI/OpenSpec@0c737dc`), por delante de la 1.17.0 instalada.
**Rule**: Con deltas aplicables, sincroniza siempre al archivar. Archivar sin sincronizar es para changes sin cambios de comportamiento (mejor `skip_specs: true` de antemano) o para syncs bloqueados.
