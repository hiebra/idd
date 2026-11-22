---
title: "Collection: archivado de apply-one-task-per-session-in-normal-mode (idd@f9f014c)"
source: "."
type: repos
ingested: 2026-11-22
tags: [collection, collection-manifest, git, apply-one-task-per-session-in-normal-mode]
summary: "Manifest for a collection ingest of the intent-driven template repository: 15 files touched by apply-one-task-per-session-in-normal-mode (the apply-guidance module and its use in the openspec-autopilot server, the versioned apply guidance in openspec/config.yaml, its core tests and acceptance steps, README, ADR-0025, the synced openspec-autopilot spec and the archived change) pinned by path and blob SHA at commit f9f014c3271cbda2588c2ed3563b36b2dd8f5e2e. No file bodies are copied."
collection: "idd"
adapter: git
revision: "f9f014c3271cbda2588c2ed3563b36b2dd8f5e2e"
canonical_url: "https://github.com/hiebra/idd/tree/f9f014c3271cbda2588c2ed3563b36b2dd8f5e2e"
license: "unknown"
manifest_only: true
---

# Collection: archivado de apply-one-task-per-session-in-normal-mode (idd@f9f014c)

Fija, en el commit del archivado, lo que tocó el change `apply-one-task-per-session-in-normal-mode`: el módulo `lib/apply-guidance.mjs`, que añade o quita las indicaciones de «una task por sesión» en `operations.apply.guidance` de `openspec/config.yaml` según el modo del plugin, su llamada con límite de tiempo al cargar `server.js`, el bloque versionado en `config.yaml`, sus core tests y pasos de aceptación, el README, ADR-0025 (que sustituye a ADR-0006) y los dos requisitos añadidos a la spec `openspec-autopilot`. Cita como `idd@f9f014c3271cbda2588c2ed3563b36b2dd8f5e2e:<ruta>`. Las versiones anteriores de las rutas compartidas siguen fijadas en el [manifiesto de autopilot-sesion-operativa](2026-11-22-idd-6d6e79c-autopilot-sesion-operativa.md) y en el [de allow-user-requested-merges](2026-11-22-idd-cac0041-allow-user-requested-merges.md).

| Path | Blob SHA |
|---|---|
| `.opencode/plugins/openspec-autopilot/lib/apply-guidance.mjs` | `7abde684e280793e3803c99aa87723d209e385d7` |
| `.opencode/plugins/openspec-autopilot/server.js` | `d2ea1d71049721821d09e730a30ddb40fc8e8731` |
| `README.md` | `fe61b724a20a9ebd2b3da9e24db4a18e48d294de` |
| `acceptance-tests/core-tests/apply-guidance.test.js` | `e855e80c90d69655b348cdcccad60544dac75866` |
| `acceptance-tests/core-tests/autopilot-plugin.test.js` | `4a67e2cfced9a69296d87dd932e7054d808c5e59` |
| `acceptance-tests/step-definitions/apply-guidance.steps.js` | `2d31ab233f3a4f5cfc1403882deddbf1f3fcee3c` |
| `adr/0025-asymmetry-policy-with-mode-managed-versioned-block.md` | `1fee84e75651ffae88328068dfe03ffee7a9f9a3` |
| `openspec/changes/archive/2026-11-22-apply-one-task-per-session-in-normal-mode/.openspec.yaml` | `ea82943ab5a41ed5d23aacb72c4729778affdd12` |
| `openspec/changes/archive/2026-11-22-apply-one-task-per-session-in-normal-mode/adr.md` | `9cb2c926fc9b1365fed485560c67bcb81dd32c74` |
| `openspec/changes/archive/2026-11-22-apply-one-task-per-session-in-normal-mode/design.md` | `5a5113ad28107f9cf5e1b51e639c18f0c92bb5ee` |
| `openspec/changes/archive/2026-11-22-apply-one-task-per-session-in-normal-mode/proposal.md` | `1fd80e502f0bf7ffb7376cbb76c9843f0f898843` |
| `openspec/changes/archive/2026-11-22-apply-one-task-per-session-in-normal-mode/specs/openspec-autopilot/spec.md` | `f295fb5ac34b37547702b32c1d4d2a54e9fb0d95` |
| `openspec/changes/archive/2026-11-22-apply-one-task-per-session-in-normal-mode/tasks.md` | `1983680b7e73ec0fd2f7fbc08d5b52d4e2948a0f` |
| `openspec/config.yaml` | `1a52d3661dcf7eca7da4e1a954ac8623eca5cf36` |
| `openspec/specs/openspec-autopilot/spec.md` | `4c2fc42c0d42fcb5be07e8292f09679f43df8d14` |

## Procedencia

Comprobado el 2026-11-22:

- **Rutas**: el diff entre el merge-base de la rama con `origin/main` (`af2153e`) y el commit del archivado, sin `.wiki/`.
- **Spec sincronizada**: `openspec/specs/openspec-autopilot/spec.md` recibe al final los 2 requisitos añadidos del delta, idénticos a él; `openspec validate --specs` pasa (8 de 8).
- **Duplicados**: solo `.openspec.yaml` coincide con un blob ya fijado (el de los otros changes archivados: el mismo contenido, `schema: intent-driven`).
