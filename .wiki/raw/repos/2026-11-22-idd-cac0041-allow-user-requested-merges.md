---
title: "Collection: archivado de allow-user-requested-merges (idd@cac0041)"
source: "."
type: repos
ingested: 2026-11-22
tags: [collection, collection-manifest, git, allow-user-requested-merges]
summary: "Manifest for a collection ingest of the intent-driven template repository: 16 files touched by allow-user-requested-merges (branch-change.mjs with check merge, merge-targets and the merge commit in check commit, the openspec-git-discipline skill, the README, the acceptance steps, support and core tests, ADR-0016, the archive guidance in openspec/config.yaml, the synced openspec-change-lifecycle spec and the archived change) pinned by path and blob SHA at commit cac00417c033f58d9a3298d4c7ff7e16f563f570. No file bodies are copied."
collection: "idd"
adapter: git
revision: "cac00417c033f58d9a3298d4c7ff7e16f563f570"
canonical_url: "https://github.com/hiebra/idd/tree/cac00417c033f58d9a3298d4c7ff7e16f563f570"
license: "unknown"
manifest_only: true
---

# Collection: archivado de allow-user-requested-merges (idd@cac0041)

Fija, en el commit del archivado, lo que tocó el change `allow-user-requested-merges`: el agente fusiona cuando el usuario se lo pide en la conversación, con su ok a la resolución de conflictos; `check commit` admite un commit de fusión resuelto; la puerta nueva `check merge` decide cada fusión (con `git commit-tree` fuera de la nube y por PR dentro); `merge-targets` da las ramas de `x-main` a las que proponer la fusión tras el archive, y `start` y `switch` no actúan en un contenedor efímero. Incluye ADR-0016, que sustituye a ADR-0015, y la spec `openspec-change-lifecycle` ya sincronizada. Cita como `idd@cac00417c033f58d9a3298d4c7ff7e16f563f570:<ruta>`.

| Path | Blob SHA |
|---|---|
| `.agents/openspec/branch-change.mjs` | `31e5cc73552005f95053ffc92433a028a145bfa0` |
| `.agents/skills/openspec-git-discipline/SKILL.md` | `0ad707c88a426afe7635efc1fba9ea37d98c3a4f` |
| `README.md` | `e57da153c7c6071d482a42ff27edf4a5bc2e9bce` |
| `acceptance-tests/core-tests/branch-change.test.js` | `97d07d4b775ac7c91943371c4760f395561d13f9` |
| `acceptance-tests/core-tests/branches-support.test.js` | `3b318045eef5ef1559cbf1c640e931a94e4aedc5` |
| `acceptance-tests/step-definitions/change-lifecycle.steps.js` | `833b9838f51b690b54426091ddc51517e727ae0c` |
| `acceptance-tests/support/branches.js` | `9d6b9a1aedc80b1241623db2ff1807964fcb0534` |
| `adr/0016-agent-merges-on-user-request.md` | `63ed3600c6542f9a555698abb850c94516c32870` |
| `openspec/changes/archive/2026-11-22-allow-user-requested-merges/.openspec.yaml` | `ea82943ab5a41ed5d23aacb72c4729778affdd12` |
| `openspec/changes/archive/2026-11-22-allow-user-requested-merges/adr.md` | `efcb93811338db2cfdbd3acfeb172ccef9ab2017` |
| `openspec/changes/archive/2026-11-22-allow-user-requested-merges/design.md` | `2effde71b433c051dbe5da3138420ff11a872a41` |
| `openspec/changes/archive/2026-11-22-allow-user-requested-merges/proposal.md` | `96fb5814a5935d39d3227b7b0aa1f888c5f92e47` |
| `openspec/changes/archive/2026-11-22-allow-user-requested-merges/specs/openspec-change-lifecycle/spec.md` | `ff61c8d37cbab17f4dae9db8974bf37069d6bd84` |
| `openspec/changes/archive/2026-11-22-allow-user-requested-merges/tasks.md` | `ea71155d9f7e39c570cb1b7808a1fc5ac7666e5e` |
| `openspec/config.yaml` | `da91bf219baa56b76d8340390551d0a147dae918` |
| `openspec/specs/openspec-change-lifecycle/spec.md` | `54cf674aee7b1d0f0b25799b9d797b007665efa9` |
