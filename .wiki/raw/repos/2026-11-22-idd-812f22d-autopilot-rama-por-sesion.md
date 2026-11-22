---
title: "Collection: archivado de autopilot-rama-por-sesion (idd@812f22d)"
source: "."
type: repos
ingested: 2026-11-22
tags: [collection, collection-manifest, git, autopilot-rama-por-sesion]
summary: "Manifest for a collection ingest of the intent-driven template repository: 38 files touched by autopilot-rama-por-sesion (the OpenCode autopilot plugin with a working branch per session, the switch to a session's branch, the worktree strategy and the per-directory TUI calls, the origin subcommand of branch-change.mjs, the session bootstrap, the openspec-git-discipline skill, ADR-0022, the OpenCode simulator, acceptance steps and core tests, the updated main specs and the archived change) pinned by path and blob SHA at commit 812f22df36d4465ab78aeb468824a4388be258e8. No file bodies are copied."
collection: "idd"
adapter: git
revision: "812f22df36d4465ab78aeb468824a4388be258e8"
canonical_url: "https://github.com/hiebra/idd/tree/812f22df36d4465ab78aeb468824a4388be258e8"
license: "unknown"
manifest_only: true
---

# Collection: archivado de autopilot-rama-por-sesion (idd@812f22d)

Fija, en el commit del archivado, lo que tocó el change `autopilot-rama-por-sesion`: la rama de trabajo de cada sesión en el plugin `.opencode/plugins/openspec-autopilot/`, el paso a la rama de una sesión al entrar en ella, la sesión nueva en una rama temporal con sesión operativa, los worktrees de OpenCode que nacen en una rama con la estrategia del plugin (`lib/worktree.mjs`), las llamadas de la TUI al plugin del directorio de la ventana, el subcomando `origin` de `.agents/openspec/branch-change.mjs`, el arranque de sesión, la skill `openspec-git-discipline` y ADR-0022, que sustituye a ADR-0014. Cita como `idd@812f22df36d4465ab78aeb468824a4388be258e8:<ruta>`. Las versiones anteriores de las rutas compartidas siguen fijadas en el [manifiesto de autopilot-sesion-operativa](2026-11-22-idd-6d6e79c-autopilot-sesion-operativa.md) y en el [de manage-git-discipline](2026-11-22-idd-5d7f5b0-manage-git-discipline.md).

| Path | Blob SHA |
|---|---|
| `.agents/hooks/session-bootstrap.sh` | `3faaa5705a1b1a9fc1dd0e5ce82051629c3993b0` |
| `.agents/openspec/branch-change.mjs` | `ff52ed2d51a031ff67cf86e124396bd798b1a869` |
| `.agents/skills/openspec-git-discipline/SKILL.md` | `274d437b13ca3a61df179a19e586e6cc589a2f97` |
| `.opencode/plugins/openspec-autopilot/lib/git.mjs` | `7fa69a7242021c6be79f1f73396d93aa7b2de5a4` |
| `.opencode/plugins/openspec-autopilot/lib/project.mjs` | `52ec6f5fd4ae97d041a4c1dc4cc6a90e6e6ff40c` |
| `.opencode/plugins/openspec-autopilot/lib/prompts.mjs` | `fc66f4c53cf4b320fd52dd724520468362c20770` |
| `.opencode/plugins/openspec-autopilot/lib/rpc.mjs` | `aa133285aa79b0e1f92725d220b2228a82dc83da` |
| `.opencode/plugins/openspec-autopilot/lib/screen.mjs` | `4f2d9fe34030d34c5dc44839aff726f7811c2146` |
| `.opencode/plugins/openspec-autopilot/lib/state.mjs` | `f986632b52695ceaaf64e93b0d5496e629109464` |
| `.opencode/plugins/openspec-autopilot/lib/worktree.mjs` | `7acd0a7e3589de94a0aedd2bc5b2d45ef6b87e0d` |
| `.opencode/plugins/openspec-autopilot/server.js` | `d42c68521f95d23872dbac30ec71894ce5a2fdf1` |
| `.opencode/plugins/openspec-autopilot/tui.js` | `891020fe1805a2a0e55e7d0c42b1a8de1a64e27a` |
| `README.md` | `748593f7a7998fa76ce6c190349ac3ed3906c742` |
| `acceptance-tests/README.md` | `d84472ee0382f0a597756c67bb146a003fab7bca` |
| `acceptance-tests/core-tests/autopilot-plugin.test.js` | `ef91ea796979f771a43b49800e75f866d33582a0` |
| `acceptance-tests/core-tests/autopilot-product.test.js` | `f42ad691bcd5038a388b36c3cf92f50db150d7a6` |
| `acceptance-tests/core-tests/autopilot-worktree.test.js` | `4bc346d4517753843a98c332c31e5dd81c5fc2dd` |
| `acceptance-tests/core-tests/branch-change.test.js` | `d410e12bf33ce32b6309bd6c27384f658bf3b23f` |
| `acceptance-tests/core-tests/prepare-git.test.js` | `acc7b12d549e677859c6fa471ec2fc8b52278ad9` |
| `acceptance-tests/step-definitions/autopilot.steps.js` | `99e881ef75826a631df71dc4f60fcfa7ab59822f` |
| `acceptance-tests/step-definitions/change-lifecycle.steps.js` | `d4e659d0d3668b50aea4d195c1045950aa496afe` |
| `acceptance-tests/step-definitions/session-bootstrap.steps.js` | `02236b4f9003ac8d8d78fa9e5819e96681141a39` |
| `acceptance-tests/support/agents/opencode-sim-process.mjs` | `bb0ec521507687c0fd3e571853d76babf23f1c12` |
| `acceptance-tests/support/agents/opencode-sim.js` | `08f550e7372cd94123bc1ec06c99e8ced27fa1be` |
| `acceptance-tests/support/agents/opencode-sim.mjs` | `7777672d926a09e1dd0f1940c986db69359b882b` |
| `acceptance-tests/support/autopilot.js` | `7ac7db743083d5f6c2ec38f6cf12c5880a8edfd7` |
| `acceptance-tests/support/branches.js` | `2b2d71c6f750caabb62cb851061eafcdb878271a` |
| `adr/0022-autopilot-session-owns-its-branch-and-worktrees.md` | `0191bb19d30c423562149fd56b8b2a2ce4297298` |
| `openspec/changes/archive/2026-11-22-autopilot-rama-por-sesion/adr.md` | `e444fad7634f64049829a2323b3af759fc0aacc6` |
| `openspec/changes/archive/2026-11-22-autopilot-rama-por-sesion/design.md` | `0e60f352da4cdf3da54e9b4870155177eb540e86` |
| `openspec/changes/archive/2026-11-22-autopilot-rama-por-sesion/proposal.md` | `4f9e33617e3eb7da9ac7d1f6c1d4ed261a00103d` |
| `openspec/changes/archive/2026-11-22-autopilot-rama-por-sesion/specs/openspec-autopilot/spec.md` | `d77fcaba32a456d3fb4f3beed5eccb89072c708c` |
| `openspec/changes/archive/2026-11-22-autopilot-rama-por-sesion/specs/openspec-change-lifecycle/spec.md` | `8544fb9645df9092c1ff57b53104ccf289e9d3d5` |
| `openspec/changes/archive/2026-11-22-autopilot-rama-por-sesion/specs/session-bootstrap/spec.md` | `8f2a1912a02a8ed581b2362777a784042be35b14` |
| `openspec/changes/archive/2026-11-22-autopilot-rama-por-sesion/tasks.md` | `21015f3ed8986ef1b3690a9746d991bc98c25deb` |
| `openspec/specs/openspec-autopilot/spec.md` | `d4d78d2aa7a3133f07826a58f247d52ce751ff01` |
| `openspec/specs/openspec-change-lifecycle/spec.md` | `1cbd1690dcae73b765f4b885b001b00f09315ba0` |
| `openspec/specs/session-bootstrap/spec.md` | `841b279e544ba54d430cdd389ba7cd3339615fcb` |
