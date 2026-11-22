---
title: "Collection: archivado de manage-git-discipline (idd@5d7f5b0)"
source: "."
type: repos
ingested: 2026-11-22
tags: [collection, collection-manifest, git, manage-git-discipline]
summary: "Manifest for a collection ingest of the intent-driven template repository: 24 files touched by manage-git-discipline (branch-change.mjs with originRef, the check commit gate and both forms of the cycle, prepare_git in the session bootstrap core, the rewritten openspec-git-discipline skill, rules.adr and the archive guidance in config.yaml, the blob citation section of the wiki guide, ADR-0013, acceptance steps and core tests, the updated main specs and the archived change) pinned by path and blob SHA at commit 5d7f5b08d0183691c46ba1eca89ee8cdf6681a97. No file bodies are copied."
collection: "idd"
adapter: git
revision: "5d7f5b08d0183691c46ba1eca89ee8cdf6681a97"
canonical_url: "https://github.com/hiebra/idd/tree/5d7f5b08d0183691c46ba1eca89ee8cdf6681a97"
license: "unknown"
manifest_only: true
---

# Collection: archivado de manage-git-discipline (idd@5d7f5b0)

Fija, en el commit del archivado, lo que tocó el change `manage-git-discipline`: la referencia de origen más avanzada (`originRef`) y el descarte de changes ya fusionados en `.agents/openspec/branch-change.mjs`, la puerta `check commit` de los commits del agente en un contenedor efímero, las puertas que admiten la forma recomendada y la canónica, la comprobación de números de ADR, `prepare_git` en el núcleo del arranque, la skill `openspec-git-discipline` reescrita, `rules.adr` y las indicaciones de archivado de las dos formas en `openspec/config.yaml`, la resolución de citas por blob en la guía del wiki y ADR-0013, que sustituye a ADR-0007. Cita como `idd@5d7f5b08d0183691c46ba1eca89ee8cdf6681a97:<ruta>`. Las versiones anteriores de las rutas compartidas siguen fijadas en el [manifiesto de add-quote-comment-rule](2026-11-21-idd-16e4617-add-quote-comment-rule.md), en el [de ADR-0007](2026-11-21-idd-c59392a-adr-0007.md) y en el [de add-openspec-autopilot](2026-11-21-idd-772d0f0-add-openspec-autopilot.md).

| Path | Blob SHA |
|---|---|
| `.agents/hooks/session-bootstrap.sh` | `ecf20fff4d3ae7f42575329b227c45f25c19f8e8` |
| `.agents/openspec/branch-change.mjs` | `a5ecd69dab1766b18f4a5484cc2bf7dcb7a9d839` |
| `.agents/skills/openspec-git-discipline/SKILL.md` | `f6ecca0bcd385bc3acbcb396aad27644b13a93f3` |
| `.agents/wiki/guide.md` | `7edceed6459860011a493f711ceeeed284e65173` |
| `README.md` | `2a5ce8c1bc18ccd1d715ece294ac9c052183c144` |
| `acceptance-tests/core-tests/branches-support.test.js` | `28f43e5e369be614af082e9391e67286b069d387` |
| `acceptance-tests/core-tests/prepare-git.test.js` | `49ed066c0e5b5da5a7374b4fa4da7af8acdd3a55` |
| `acceptance-tests/step-definitions/change-lifecycle.steps.js` | `89fcf2d265f4de8ca9410ff9daf2e2475c2841b6` |
| `acceptance-tests/step-definitions/session-bootstrap.steps.js` | `e83260b0210b61d0e5d633c43683a6fe72b2ce44` |
| `acceptance-tests/step-definitions/wiki.steps.js` | `eafde90701199fa663ffd8c2835b45713487a9c4` |
| `acceptance-tests/support/branches.js` | `169bcdedd13c2339ae851834ec5b7b6ee9c974ee` |
| `acceptance-tests/support/machine.js` | `95fbd853c4ee1e46ec3bd58d2476cf7cb6f857d5` |
| `adr/0013-git-discipline-two-forms-and-ephemeral-commits.md` | `368d7e0ca350bfb5b5b6b76515d12a39eb90c7eb` |
| `openspec/changes/archive/2026-11-22-manage-git-discipline/adr.md` | `fa32a9a9a84a1bc3236fe8fef8d6cc4127d89813` |
| `openspec/changes/archive/2026-11-22-manage-git-discipline/design.md` | `d145627e843630cb3e89c401f3d4af53854cb5c3` |
| `openspec/changes/archive/2026-11-22-manage-git-discipline/proposal.md` | `772262cc716a9797221e12c80707edd95a116716` |
| `openspec/changes/archive/2026-11-22-manage-git-discipline/specs/openspec-change-lifecycle/spec.md` | `ee16c5fdb648d5f3f698029b984572c53b9469a9` |
| `openspec/changes/archive/2026-11-22-manage-git-discipline/specs/session-bootstrap/spec.md` | `4ee9f16b194d077ae135e44ab8b34c9939da4f42` |
| `openspec/changes/archive/2026-11-22-manage-git-discipline/specs/wiki-first-knowledge/spec.md` | `8ad8c7e56c82d201b77faf7bf05e9135cc353c73` |
| `openspec/changes/archive/2026-11-22-manage-git-discipline/tasks.md` | `93a168e4f3c8a5be0443871c0da6050ff8836f14` |
| `openspec/config.yaml` | `995a7f39dc6884dba388de29c68aea1d7d39d1d4` |
| `openspec/specs/openspec-change-lifecycle/spec.md` | `f8014a0add47b591a3e393a948efdcc2f7ee221d` |
| `openspec/specs/session-bootstrap/spec.md` | `d4b747f37282a05747181cbf0931f4f0464f29b7` |
| `openspec/specs/wiki-first-knowledge/spec.md` | `765562a454bdaf7cc5e8b9a0b93be4f5b9cba59c` |
