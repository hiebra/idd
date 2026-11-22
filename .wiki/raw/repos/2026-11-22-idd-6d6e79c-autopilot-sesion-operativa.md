---
title: "Collection: archivado de autopilot-sesion-operativa (idd@6d6e79c)"
source: "."
type: repos
ingested: 2026-11-22
tags: [collection, collection-manifest, git, autopilot-sesion-operativa]
summary: "Manifest for a collection ingest of the intent-driven template repository: 38 files touched by autopilot-sesion-operativa (the openspec-autopilot OpenCode plugin rebuilt around the operational session, the evaluable product and the review closed by git; branch-change.mjs list/start/switch; the rewritten openspec-git-discipline skill; ADR-0012 and ADR-0013; the session-bootstrap TUI part; the suite's OpenCode simulator, steps and core tests; both READMEs; the synced openspec-autopilot and openspec-change-lifecycle specs and the archived change) pinned by path and blob SHA at commit 6d6e79c4eb2e01974638a7dc9ece48aada33cb1b. No file bodies are copied."
collection: "idd"
adapter: git
revision: "6d6e79c4eb2e01974638a7dc9ece48aada33cb1b"
canonical_url: "https://github.com/hiebra/idd/tree/6d6e79c4eb2e01974638a7dc9ece48aada33cb1b"
license: "unknown"
manifest_only: true
---

# Collection: archivado de autopilot-sesion-operativa (idd@6d6e79c)

Fija, en el commit del archivado, lo que tocó el change `autopilot-sesion-operativa`: el plugin `openspec-autopilot` (servidor, TUI y su núcleo puro en `lib/`), rehecho en torno a la sesión operativa, el producto evaluable y la revisión cerrada por git, con la lógica en el servidor para cualquier cliente; los subcomandos `list`, `start` y `switch` de `branch-change.mjs`; la skill `openspec-git-discipline` reescrita; ADR-0012 (sustituye a ADR-0007) y ADR-0013 (sustituye a ADR-0008); la parte de TUI de `session-bootstrap` (llamadas RPC con la ubicación); el simulador de OpenCode, los pasos y las pruebas del núcleo; los dos README, y las specs `openspec-autopilot` y `openspec-change-lifecycle` ya sincronizadas. Cita como `idd@6d6e79c4eb2e01974638a7dc9ece48aada33cb1b:<ruta>`.

| Path | Blob SHA |
|---|---|
| `.agents/openspec/branch-change.mjs` | `b34352a45546bb97b0ff8dfb5c8f0a578acc2d12` |
| `.agents/skills/openspec-git-discipline/SKILL.md` | `599b25909f52f255eee77efd5e2558551634d12a` |
| `.opencode/plugins/openspec-autopilot/lib/git.mjs` | `99e347162119a07bdcb783715cbd098e14dd869b` |
| `.opencode/plugins/openspec-autopilot/lib/next-step.mjs` | `4da967eedb8fd092109c51a8ac07ecb718887691` |
| `.opencode/plugins/openspec-autopilot/lib/product.mjs` | `50ff619fb3f76041f146b1be2f7884226ec743c8` |
| `.opencode/plugins/openspec-autopilot/lib/project.mjs` | `75663eedeac05c2273c021691273fe462a2bb55d` |
| `.opencode/plugins/openspec-autopilot/lib/prompts.mjs` | `6239b008c9cb7342d11fbbe318abf39d5b575a9d` |
| `.opencode/plugins/openspec-autopilot/lib/rpc.mjs` | `b38252d478672472c8a23b3bbdc4865f0914c156` |
| `.opencode/plugins/openspec-autopilot/lib/run.mjs` | `1cebe424f75b979743b0f09bce6022a7e78cd649` |
| `.opencode/plugins/openspec-autopilot/lib/screen.mjs` | `89cb5a1c3976e6983525c362d58356c226b18a34` |
| `.opencode/plugins/openspec-autopilot/lib/state.mjs` | `dd6f22d7bd8a94294ebef84b8aed9016da3b7cc5` |
| `.opencode/plugins/openspec-autopilot/server.js` | `7caaa7c4c39a8c8804926493389a40eb49842689` |
| `.opencode/plugins/openspec-autopilot/tui.js` | `744567366ff6a58fb0d5d3c2be886f582822b255` |
| `.opencode/plugins/session-bootstrap/tui.js` | `2566952bd6c5ab07c1522506be52bcb87535ea1b` |
| `README.md` | `6d844bf7166e1d79c5a3e09960271c9025f8d5f3` |
| `acceptance-tests/README.md` | `5a1dc97148c59dfc423ab23c6c38bf6317c6cc38` |
| `acceptance-tests/core-tests/autopilot-next-step.test.js` | `18c6e4e066a7cfd7d8a81ded62f4663c76b241b2` |
| `acceptance-tests/core-tests/autopilot-plugin.test.js` | `6a1d9fe295cf878b3843985ae16834b0d7610eba` |
| `acceptance-tests/core-tests/autopilot-product.test.js` | `998456fe3414cf9b0df562b6d7139ce26dacfb75` |
| `acceptance-tests/core-tests/branch-change.test.js` | `04256262b24e8464f9eeea2d8b01bab6e10930a1` |
| `acceptance-tests/step-definitions/autopilot.steps.js` | `41c7ad1e8c1809b8bdaaf330b2f028fc2ceb850f` |
| `acceptance-tests/step-definitions/change-lifecycle.steps.js` | `7d5927f9c4a8fbbc9bc7017c48d025917a536f7f` |
| `acceptance-tests/support/agents/opencode-sim-process.mjs` | `03f3b726a1de88aed1d30c32a46ab4cf51d6d706` |
| `acceptance-tests/support/agents/opencode-sim.js` | `329c9aae80dc2a5148e88d01501531a8f11c3cd5` |
| `acceptance-tests/support/agents/opencode-sim.mjs` | `3716ffa8b979278a925ee5a1211e316f794059ff` |
| `acceptance-tests/support/autopilot.js` | `b9cfd64d996e19dc610931b408b97c633d37b34e` |
| `acceptance-tests/support/world.js` | `cb882f04bf241b397fe9e6c00052d6970eaddcb3` |
| `adr/0012-model-creates-change-branches-plugin-stages.md` | `8f78431de8f3d64035d3760548752c3e8bb7fac2` |
| `adr/0013-autopilot-verifies-product-and-closes-reviews-with-git.md` | `d65d8c54c2d9ef9dc60942275c35ce4edd9447c1` |
| `openspec/changes/archive/2026-11-22-autopilot-sesion-operativa/.openspec.yaml` | `ea82943ab5a41ed5d23aacb72c4729778affdd12` |
| `openspec/changes/archive/2026-11-22-autopilot-sesion-operativa/adr.md` | `c5a62b7b396677ccc13c0c07b0a2f31d5b24bd22` |
| `openspec/changes/archive/2026-11-22-autopilot-sesion-operativa/design.md` | `77c303167dd16e3601e4aa6ed411635821e7094e` |
| `openspec/changes/archive/2026-11-22-autopilot-sesion-operativa/proposal.md` | `34f12fd9e7899c26634b423935c16e3d133de493` |
| `openspec/changes/archive/2026-11-22-autopilot-sesion-operativa/specs/openspec-autopilot/spec.md` | `dd563d834a672117af54c7023330b0a278099786` |
| `openspec/changes/archive/2026-11-22-autopilot-sesion-operativa/specs/openspec-change-lifecycle/spec.md` | `d403425ff76029b820fafa77f8b07600e6799371` |
| `openspec/changes/archive/2026-11-22-autopilot-sesion-operativa/tasks.md` | `d9043a1ca81801b52d2d72e271eeb0202e3432ad` |
| `openspec/specs/openspec-autopilot/spec.md` | `55b4bb49314298f849c7d5f77f47c80bd196cd33` |
| `openspec/specs/openspec-change-lifecycle/spec.md` | `55e1d70dd7e6afd405fe520e0b13ed80424ec005` |
