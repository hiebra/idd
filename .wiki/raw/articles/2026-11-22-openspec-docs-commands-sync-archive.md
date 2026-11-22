---
title: "OpenSpec docs/commands.md: /opsx:sync y /opsx:archive (2.1.1)"
source: "https://raw.githubusercontent.com/Fission-AI/OpenSpec/main/docs/commands.md"
type: articles
ingested: 2026-11-22
tags: [openspec, opsx, sync, archive, documentacion]
summary: "Extracto de la referencia de comandos de OpenSpec en main (2.1.1): /opsx:sync es opcional y deja el change activo, con una tabla de cuándo usarlo; /opsx:archive ofrece sincronizar si no se ha hecho y deja el change como historial."
canonical_url: "https://github.com/Fission-AI/OpenSpec/blob/0c737dc1b543249b38b0f4716816fcf493d894dd/docs/commands.md"
upstream_id: "Fission-AI/OpenSpec@0c737dc1b543249b38b0f4716816fcf493d894dd:docs/commands.md"
upstream_type: git-file
revision: "0c737dc1b543249b38b0f4716816fcf493d894dd"
license: "MIT"
content_format: markdown
fetched: 2026-11-22
extraction_tool: "git ls-remote de refs/heads/main y curl del raw en ese commit; extracto literal"
---

# OpenSpec `docs/commands.md` (extracto)

Revisión: `Fission-AI/OpenSpec@0c737dc1b543249b38b0f4716816fcf493d894dd` (2.1.1).

## /opsx:sync

> **Optional command.** Merge delta specs from a change into main specs. Archive will prompt to sync if needed, so you typically don't need to run this manually.

> | Scenario | Use sync? |
> |----------|-----------|
> | Long-running change, want specs in main before archiving | Yes |
> | Multiple parallel changes need the updated base specs | Yes |
> | Want to preview/review the merge separately | Yes |
> | Quick change, going straight to archive | No (archive handles it) |

> - Change stays active after sync (not archived)

## /opsx:archive

> - Checks artifact completion status
> - Checks task completion (warns if incomplete)
> - Offers to sync delta specs if not already synced
> - Moves change folder to `openspec/changes/archive/YYYY-MM-DD-<name>/`
> - Preserves all artifacts for audit trail

> Delta specs: Not yet synced
> → Sync now? (recommended)

> - Delta specs can be synced during archive or beforehand

La única mención a descartar es la de `/opsx:onboard`: «Creates a real change you can keep or discard».
