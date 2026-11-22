---
title: "Collection: archivado de autopilot-plan-explore (idd@9eae630)"
source: "."
type: repos
ingested: 2026-11-22
tags: [collection, collection-manifest, git, autopilot-plan-explore]
summary: "Manifest for a collection ingest of the intent-driven template repository: 20 files touched by autopilot-plan-explore (the openspec-autopilot plugin creates every step session with the build agent, switching to plan loads the openspec-explore flow without leaving it in history, and a git-state comparison warns of modifications made with plan; agent-turn.mjs, prompts, RPC, server and TUI, the OpenCode simulator and its tests, ADR-0019, the synced openspec-autopilot spec and the archived change) pinned by path and blob SHA at commit 9eae630f4d8f700219362cc23fd6214be4d76326. No file bodies are copied."
collection: "idd"
adapter: git
revision: "9eae630f4d8f700219362cc23fd6214be4d76326"
canonical_url: "https://github.com/hiebra/idd/tree/9eae630f4d8f700219362cc23fd6214be4d76326"
license: "unknown"
manifest_only: true
---

# Collection: archivado de autopilot-plan-explore (idd@9eae630)

Fija, en el commit del archivado, lo que tocó el change `autopilot-plan-explore`: toda sesión de paso nace con el agente build; cambiar la sesión operativa a plan carga la instrucción de `openspec-explore` sobre el paso en curso (y solo un recordatorio en las peticiones siguientes), volver a build recuerda el paso previo, y nada de ello queda en el historial; al quedar en reposo tras un turno en plan, el plugin compara HEAD, stage y árbol de trabajo y, si cambiaron, avisa (modal "Entendido" en la TUI, que retiene la cadena, o en el mensaje siguiente sin TUI). Incluye `lib/agent-turn.mjs`, los prompts, el RPC, el servidor y la TUI del plugin, el simulador de OpenCode y sus tests, ADR-0019, la spec `openspec-autopilot` sincronizada y el change archivado. Cita como `idd@9eae630f4d8f700219362cc23fd6214be4d76326:<ruta>`. Las versiones anteriores de las rutas compartidas siguen fijadas en el [manifiesto de fix-tui-subscription-cleanup](2026-11-22-idd-99bdccd-fix-tui-subscription-cleanup.md) y en el [de autopilot-sesion-operativa](2026-11-22-idd-6d6e79c-autopilot-sesion-operativa.md).

| Path | Blob SHA |
|---|---|
| `.opencode/plugins/openspec-autopilot/lib/agent-turn.mjs` | `09678a5e90b068c4bf32b167832537b3ec44cdf3` |
| `.opencode/plugins/openspec-autopilot/lib/prompts.mjs` | `5fd7b0625811c64402e75216632ad49e5e5a310a` |
| `.opencode/plugins/openspec-autopilot/lib/rpc.mjs` | `6f1dba91b05170fd58c08c403fbf535a3f0e2012` |
| `.opencode/plugins/openspec-autopilot/server.js` | `1f5b3e019ce657bdbcd927ed2149c19f5d45d8a2` |
| `.opencode/plugins/openspec-autopilot/tui.js` | `c6bb2ec8c29c2ff72bcec1d1cb3dbebeb25032a4` |
| `README.md` | `a187b4418e6cc4f4ed04e3beaf6c5caff9a3fab2` |
| `acceptance-tests/README.md` | `ac41463225eec1a1ecd0ea3e758a0dac0a57f33c` |
| `acceptance-tests/core-tests/autopilot-agent-turn.test.js` | `2fc1b3eba55f2622ab25e6ff291ba2e425df0aa3` |
| `acceptance-tests/core-tests/autopilot-plugin.test.js` | `81fc518ef7389a65ab07ce9c0835280ce03b74cc` |
| `acceptance-tests/core-tests/opencode-sim.test.js` | `1e3b32c21ac81d8dd55df9b643ca1785face1248` |
| `acceptance-tests/step-definitions/autopilot.steps.js` | `6565d39b043a70d23bd6adf0ed2b4612d32b24ed` |
| `acceptance-tests/support/agents/opencode-sim.mjs` | `d8d2021a142744f1fca593bb1c5caca1d1ffc7ee` |
| `adr/0019-autopilot-plan-agent-explores-and-warns.md` | `fc7e13e1ed81a7ccc9dfeba63f57d533161eb720` |
| `openspec/changes/archive/2026-11-22-autopilot-plan-explore/.openspec.yaml` | `ea82943ab5a41ed5d23aacb72c4729778affdd12` |
| `openspec/changes/archive/2026-11-22-autopilot-plan-explore/adr.md` | `6879c88ccfd0872a1743cf72ec0ebd000139160d` |
| `openspec/changes/archive/2026-11-22-autopilot-plan-explore/design.md` | `43d7228adceef97c7891e3528f8c8b7c643c90f0` |
| `openspec/changes/archive/2026-11-22-autopilot-plan-explore/proposal.md` | `6afaeee600d41392bcca3cd0b118cf698d3f16f8` |
| `openspec/changes/archive/2026-11-22-autopilot-plan-explore/specs/openspec-autopilot/spec.md` | `94b567c51f80a54a68423553a99d315f3b76d286` |
| `openspec/changes/archive/2026-11-22-autopilot-plan-explore/tasks.md` | `05d78e6bfdf94dff98d0ddf6fe9471015fc1ab0b` |
| `openspec/specs/openspec-autopilot/spec.md` | `8034bf05e7fa0b8ab55755ec51cc57f275b4867f` |
