---
title: "OpenSpec docs/opsx.md: sync de delta specs y cuándo empezar otro change (2.1.1)"
source: "https://raw.githubusercontent.com/Fission-AI/OpenSpec/main/docs/opsx.md"
type: articles
ingested: 2026-11-22
tags: [openspec, opsx, sync, archive, documentacion]
summary: "Extracto de la guía OPSX de OpenSpec en main (2.1.1): /opsx:sync aplica el delta sin archivar y es opcional porque el archive pregunta; cuándo usarlo; y que, en vez de abandonar un change, se da por hecho, se archiva y se abre otro."
canonical_url: "https://github.com/Fission-AI/OpenSpec/blob/0c737dc1b543249b38b0f4716816fcf493d894dd/docs/opsx.md"
upstream_id: "Fission-AI/OpenSpec@0c737dc1b543249b38b0f4716816fcf493d894dd:docs/opsx.md"
upstream_type: git-file
revision: "0c737dc1b543249b38b0f4716816fcf493d894dd"
license: "MIT"
content_format: markdown
fetched: 2026-11-22
extraction_tool: "git ls-remote de refs/heads/main y curl del raw en ese commit; extracto literal"
---

# OpenSpec `docs/opsx.md` (extracto)

Revisión: `Fission-AI/OpenSpec@0c737dc1b543249b38b0f4716816fcf493d894dd` (2.1.1).

## Sync delta specs

> Merges the current change's delta specs into your main `openspec/specs/` without archiving — the change stays active. It applies the whole delta: a requirement under `## REMOVED` is deleted from the main spec and a renamed one is retitled in place, while content the delta doesn't mention is left untouched. Syncing is optional — archive prompts you to sync first if you haven't. Reach for it when you want main specs updated before archiving, when a parallel change needs to build on specs this one just added, or when you want to review the merged main spec before archiving.

> `/opsx:archive   # Move to archive when done (prompts to sync specs if needed)`

## Cuándo empezar un change nuevo (extracto)

> **Original is completable**
> - The original change can be marked "done"
> - New work stands alone, not a refinement
> - Complete "Add dark mode MVP" → Archive → New change "Enhance dark mode"

El documento no describe ningún comando para abandonar o descartar un change; solo nombra «Abandon and start over» como opción en un diagrama del flujo antiguo, sin más.
