---
title: "OpenSpec docs/cli.md: openspec archive, --skip-specs y skip_specs (2.1.1)"
source: "https://raw.githubusercontent.com/Fission-AI/OpenSpec/main/docs/cli.md"
type: articles
ingested: 2026-11-22
tags: [openspec, archive, skip-specs, cli, documentacion]
summary: "Extracto de la referencia del CLI de OpenSpec en main (2.1.1): openspec archive con --yes, --skip-specs para una sola ejecución y skip_specs: true en .openspec.yaml para changes sin deltas de specs (refactors, tooling, docs). La versión instalada en el proyecto es la 1.17.0."
canonical_url: "https://github.com/Fission-AI/OpenSpec/blob/0c737dc1b543249b38b0f4716816fcf493d894dd/docs/cli.md"
upstream_id: "Fission-AI/OpenSpec@0c737dc1b543249b38b0f4716816fcf493d894dd:docs/cli.md"
upstream_type: git-file
revision: "0c737dc1b543249b38b0f4716816fcf493d894dd"
license: "MIT"
content_format: markdown
fetched: 2026-11-22
extraction_tool: "git ls-remote de refs/heads/main y curl del raw en ese commit; extracto literal de las secciones validate, archive, status e instructions"
---

# OpenSpec `docs/cli.md` (extracto)

Revisión: `Fission-AI/OpenSpec@0c737dc1b543249b38b0f4716816fcf493d894dd`, `package.json` 2.1.1. El proyecto tiene instalada la 1.17.0, cuya ayuda de `openspec archive` describe `--skip-specs` como «Skip spec update operations (useful for infrastructure, tooling, or doc-only changes)».

## validate

> A change with zero spec deltas fails validation unless its `.openspec.yaml` declares `skip_specs: true` (for pure refactors, tooling, or docs work — see [Recipe 5](examples.md#recipe-5-a-refactor-with-no-behavior-change)).

## archive (opciones)

> | `-y, --yes` | Skip confirmation prompts. Required when nothing can answer them — an AI agent, a CI job, or any run with stdin closed |
> | `--skip-specs` | Skip spec updates for one archive run. A change that permanently has no spec deltas should declare `skip_specs: true` in its `.openspec.yaml` instead — it archives with no flag |
> | `--no-validate` | Skip validation (requires confirmation). Also disables capability retirement — with no validator verdict, nothing is retired |

> ```bash
> # Archive without prompts (agents, CI, scripts)
> openspec archive add-dark-mode --yes
>
> # Archive a tooling change that doesn't affect specs
> openspec archive update-ci-config --skip-specs
> ```

## status e instructions

> A change that declares `skip_specs: true` shows its specs stage as `[~] specs (skipped: change declares skip_specs)` and excludes it from the progress count.

> For an artifact skipped via `skip_specs: true`, the output is a warning only (JSON adds `skipped`/`warning` fields) — the artifact must not be created.
