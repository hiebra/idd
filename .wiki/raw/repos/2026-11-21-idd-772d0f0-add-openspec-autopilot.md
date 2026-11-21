---
title: "Collection: archivado de add-openspec-autopilot (idd@772d0f0)"
source: "."
type: repos
ingested: 2026-11-21
tags: [collection, collection-manifest, git, add-openspec-autopilot]
summary: "Manifest for a collection ingest of the intent-driven template repository: 36 files touched by add-openspec-autopilot (ADR-0006 to ADR-0008, the branch-change module, the rewritten openspec-git-discipline skill, the openspec-autopilot OpenCode plugin, the OpenCode simulator and steps of the suite, core tests, READMEs, the archive instructions in openspec/config.yaml, the synced openspec-autopilot and openspec-change-lifecycle specs and the archived change) pinned by path and blob SHA at commit 772d0f0d34e3836ae84f35594c2b88b936294d53. No file bodies are copied."
collection: "idd"
adapter: git
revision: "772d0f0d34e3836ae84f35594c2b88b936294d53"
canonical_url: "https://github.com/hiebra/idd/tree/772d0f0d34e3836ae84f35594c2b88b936294d53"
license: "unknown"
manifest_only: true
---

# Collection: archivado de add-openspec-autopilot (idd@772d0f0)

Fija, en el commit del archivado, lo que tocó el change `add-openspec-autopilot`: el módulo neutral `branch-change.mjs` que lee de git el change de la rama y decide las puertas, la skill `openspec-git-discipline` reescrita sobre él, el plugin `openspec-autopilot` de OpenCode (servidor, TUI y `lib/`), el simulador de OpenCode y los pasos de la suite, las pruebas del núcleo, las indicaciones de archivado de `openspec/config.yaml` y las specs `openspec-autopilot` y `openspec-change-lifecycle` ya sincronizadas. Cita como `idd@772d0f0d34e3836ae84f35594c2b88b936294d53:<ruta>`. La propuesta en su versión anterior al archivado sigue fijada en el [manifiesto de la skill heredada](2026-11-21-idd-2e89fa3-git-discipline.md).

| Path | Blob SHA |
|---|---|
| `.agents/openspec/branch-change.mjs` | `698091214e60e68ac965f432c3212a575dbcc467` |
| `.agents/skills/openspec-git-discipline/SKILL.md` | `6cd1ad0c31e6d553cb32422ca5d1de7be086ebff` |
| `.opencode/plugins/openspec-autopilot/lib/next-step.mjs` | `0362f9b5f226b65e288094dfd4f12aac2f6b6e01` |
| `.opencode/plugins/openspec-autopilot/lib/project.mjs` | `9d51cc41dc9d3fa6b016859ebf790d89215c3069` |
| `.opencode/plugins/openspec-autopilot/lib/prompts.mjs` | `19e5b58553c495952df2d843f7ad490bb057b2db` |
| `.opencode/plugins/openspec-autopilot/lib/rpc.mjs` | `565b4075f2e00315250a0ca52b6473dc04a3ba02` |
| `.opencode/plugins/openspec-autopilot/lib/state.mjs` | `dd6f22d7bd8a94294ebef84b8aed9016da3b7cc5` |
| `.opencode/plugins/openspec-autopilot/server.js` | `1421581fbbcc6a150de13cacecbaccc7c8dff67a` |
| `.opencode/plugins/openspec-autopilot/tui.js` | `f10c24b1b424f569ac9b0e13153924143ddb3f16` |
| `README.md` | `422ddac94160c33ec7ed775a50824d6dd0a04d03` |
| `adr/0006-agent-asymmetry-policy.md` | `6ff70ed28829b7253e8bbc8e1d9531ebe7ae4f39` |
| `adr/0007-single-branch-change-lifecycle.md` | `27aa483096015a05a1c0a90bd139d8f2408f73e7` |
| `adr/0008-openspec-autopilot-plugin.md` | `eee748468e4afdbd6eb10203d1c403dd2fc994c0` |
| `acceptance-tests/README.md` | `194e8680d85ac960e342ce9cf201d00237fb0648` |
| `acceptance-tests/core-tests/autopilot-next-step.test.js` | `e97ff58a433415f9c79b0a851e38a8836afdba8b` |
| `acceptance-tests/core-tests/autopilot-plugin.test.js` | `fee11d398eb882c238ecd7e4317c34d115eb78ad` |
| `acceptance-tests/core-tests/branch-change.test.js` | `a0db0dd2a95660e15bc9ed4f6c1d93803e68d820` |
| `acceptance-tests/step-definitions/autopilot.steps.js` | `74be12e49e5e3451a72e58a9e0164580ec904b7f` |
| `acceptance-tests/step-definitions/change-lifecycle.steps.js` | `9d3dc51b55c95abf67ad17ba2ac13e1ab08d9eae` |
| `acceptance-tests/support/agents/opencode-host.mjs` | `524ccdb5864076d5850713247289bcf60571c9b1` |
| `acceptance-tests/support/agents/opencode-sim-process.mjs` | `5810fc560bc2ee3ca671cdfc9a42a588c7fa1c85` |
| `acceptance-tests/support/agents/opencode-sim.js` | `954d84664bf9f3005d34af6007b11ced70ad8a97` |
| `acceptance-tests/support/agents/opencode-sim.mjs` | `2967aa6c5c4c25aeb579564881460d273feda56d` |
| `acceptance-tests/support/autopilot.js` | `c952ec1fca4f84daa1f0d931f0fb91a526aefad7` |
| `acceptance-tests/support/branches.js` | `4aa8b1d5560a43f99057de6a8fa5434f9a5420c0` |
| `acceptance-tests/support/world.js` | `e8e1457110116eb84f0b9222599a803a9ca8f594` |
| `openspec/changes/archive/2026-11-21-add-openspec-autopilot/.openspec.yaml` | `1a9f87e2cc46559e30c348b19780820b33a722c7` |
| `openspec/changes/archive/2026-11-21-add-openspec-autopilot/adr.md` | `3465ee9afe1997d650f7d7eda450f7d66b0a6cf1` |
| `openspec/changes/archive/2026-11-21-add-openspec-autopilot/design.md` | `075e7f8e81fe6ac11047a9259fb06d7496d77df6` |
| `openspec/changes/archive/2026-11-21-add-openspec-autopilot/proposal.md` | `790bc50e5bf2507634ca5ce0dac81733761720cb` |
| `openspec/changes/archive/2026-11-21-add-openspec-autopilot/specs/openspec-autopilot/spec.md` | `428508428d296f26951a4a04917032f57ef78d40` |
| `openspec/changes/archive/2026-11-21-add-openspec-autopilot/specs/openspec-change-lifecycle/spec.md` | `dad50dd815e201686ab3b1a2eb66aec610dc7563` |
| `openspec/changes/archive/2026-11-21-add-openspec-autopilot/tasks.md` | `c2a91a8883e68799c9fdefe926adc00a0127b48e` |
| `openspec/config.yaml` | `213c93f7ac0ad466e77d0de8914b4a7c3b0f1726` |
| `openspec/specs/openspec-autopilot/spec.md` | `a656039d95a113d414fce820f79b13ba0e5df9b5` |
| `openspec/specs/openspec-change-lifecycle/spec.md` | `636bcdfca0d8ca39954240244c1023f5ef604845` |

## Procedencia

Comprobado el 2026-11-21:

- **Rutas**: las del diff entre el merge-base de la rama con `main` (`5e19106`) y el commit del archivado (`772d0f0`), según las indicaciones de archivado, más los ADR del change (ADR-0006 a ADR-0008), que llegaron a `main` antes del merge-base y por eso no salen en el diff; se excluyen `.wiki/` y lo generado.
- **Specs sincronizadas**: `openspec/specs/openspec-autopilot/spec.md` (11 requisitos) y `openspec/specs/openspec-change-lifecycle/spec.md` (4) se crean desde los deltas del change, con el Purpose «TBD»; la suite pasa contra ellas (113 escenarios, 600 pasos) y `npm run test:core` da 32 pruebas en verde.
- **Blobs ya fijados en otro manifiesto**: `proposal.md` coincide con el de [idd@2e89fa3](2026-11-21-idd-2e89fa3-git-discipline.md) (no cambió desde entonces) `.openspec.yaml` con el de `fix-wiki-flow-operations` (mismo contenido mínimo) y ADR-0007 con el de [idd@c59392a](2026-11-21-idd-c59392a-adr-0007.md); se fijan igual porque su ruta es otra.
