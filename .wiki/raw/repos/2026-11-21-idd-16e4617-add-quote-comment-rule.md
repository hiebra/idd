---
title: "Collection: archivado de add-quote-comment-rule (idd@16e4617)"
source: "."
type: repos
ingested: 2026-11-21
tags: [collection, collection-manifest, git, add-quote-comment-rule]
summary: "Manifest for a collection ingest of the intent-driven template repository: 21 files touched by add-quote-comment-rule (the comments rule and its reminder, the session bootstrap core and both agent adapters, json_field, acceptance steps and core tests, ADR-0010, the new response-comments spec and the archived change) pinned by path and blob SHA at commit 16e46176b94bebbb4fe6892d8589bcff8e877030. No file bodies are copied."
collection: "idd"
adapter: git
revision: "16e46176b94bebbb4fe6892d8589bcff8e877030"
canonical_url: "https://github.com/hiebra/idd/tree/16e46176b94bebbb4fe6892d8589bcff8e877030"
license: "unknown"
manifest_only: true
---

# Collection: archivado de add-quote-comment-rule (idd@16e4617)

Fija, en el commit del archivado, lo que tocó el change `add-quote-comment-rule`: la regla de comentarios (`'…'`, "ya", "reformula") y su recordatorio en `.agents/comments/`, los modos `comments-rule` y `comments-reminder` del núcleo del arranque, su entrega en Claude Code y OpenCode, `json_field` para leer el `prompt` sin Node, la desactivación con `PROJECT_COMMENTS=off`, ADR-0010 y la spec nueva `response-comments`. Cita como `idd@16e46176b94bebbb4fe6892d8589bcff8e877030:<ruta>`. Las versiones anteriores de las rutas compartidas siguen fijadas en el [manifiesto de fix-wiki-flow-operations](2026-11-21-idd-b48392d-fix-wiki-flow-operations.md) y en el [de add-openspec-autopilot](2026-11-21-idd-772d0f0-add-openspec-autopilot.md).

| Path | Blob SHA |
|---|---|
| `.agents/comments/reminder.md` | `71014051ed64f94e0c0ac6766905159f2bf9d71f` |
| `.agents/comments/rule.md` | `5f7dd7bdf8c42cf4602797adf807e21d31077d0f` |
| `.agents/hooks/session-bootstrap.sh` | `8bef8b2ad1219dbe19975465166c340f27a41acc` |
| `.claude/hooks/json.sh` | `7703e089ab771debce3de9c8f453338ff6876e7d` |
| `.claude/hooks/session-start.sh` | `5425b9767e18834473f1e53d31c0093fc3b9c63b` |
| `.claude/hooks/user-prompt-submit.sh` | `8f0fa9ea8de4ab61864cacc0cf6ae491b1de3dba` |
| `.opencode/plugins/session-bootstrap/server.js` | `c70c090542a98764006b8c5f0cebfb9d445f1581` |
| `README.md` | `c1e4c8bbd570ed7e3a4315884e37b36ae7c5a949` |
| `acceptance-tests/core-tests/comments-reminder.test.js` | `bd0e33cc3e81c3539d29855563935173ce940e54` |
| `acceptance-tests/core-tests/json-field.test.js` | `6bd6e7a614819e83cd8cf83cc107aabfa06ca683` |
| `acceptance-tests/step-definitions/comments.steps.js` | `5d69ea0ca9a55d9f857665573fbf27873d5f2cc3` |
| `acceptance-tests/step-definitions/wiki.steps.js` | `98b6e1cfcf77eeb58e1ae077265d5930da540047` |
| `acceptance-tests/support/machine.js` | `a03bcdbb6f235e19effc744153d894ff89afde4c` |
| `adr/0010-agent-instructions-through-session-bootstrap.md` | `2138c689bc33dfe2c301ee63db9b97a591deb821` |
| `openspec/changes/archive/2026-11-21-add-quote-comment-rule/.openspec.yaml` | `1a9f87e2cc46559e30c348b19780820b33a722c7` |
| `openspec/changes/archive/2026-11-21-add-quote-comment-rule/adr.md` | `0ba108c55b14701019be3cccd86e272ab3f5703b` |
| `openspec/changes/archive/2026-11-21-add-quote-comment-rule/design.md` | `7b15250fc7d3d4ec4128dd84dfe84be5972658ac` |
| `openspec/changes/archive/2026-11-21-add-quote-comment-rule/proposal.md` | `187afb1aa2902eb6cd3d4c556995ad9de30c6f71` |
| `openspec/changes/archive/2026-11-21-add-quote-comment-rule/specs/response-comments/spec.md` | `cfd9fce82d3c9858800afbd6d5b8ba9f90e6baed` |
| `openspec/changes/archive/2026-11-21-add-quote-comment-rule/tasks.md` | `93c57125e5155cf1561158d57a5f1043b70716cb` |
| `openspec/specs/response-comments/spec.md` | `58d13fce3c5be2f1b9b2031575e09f2775a646f5` |

## Procedencia

Comprobado el 2026-11-21:

- **Rutas**: el diff entre el merge-base de la rama con `origin/main` (`6199cdc`) y el commit del archivado. La primera versión de la regla, en `AGENTS.md` y `CLAUDE.md`, se añadió y se revirtió en la misma rama, así que no aparece en el diff.
- **Spec sincronizada**: `openspec/specs/response-comments/spec.md` es nueva y tiene los 6 requisitos añadidos del delta, con un `## Purpose` añadido al delta antes de sincronizar; la suite efectiva pasa (132 escenarios).
- **Duplicados**: solo `.openspec.yaml` coincide con un blob ya fijado (el de los otros changes archivados: el mismo contenido, `schema: intent-driven`).
