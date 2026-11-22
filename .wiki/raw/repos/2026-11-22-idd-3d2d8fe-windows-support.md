---
title: "Collection: archivado de windows-support (idd@3d2d8fe)"
source: "."
type: repos
ingested: 2026-11-22
tags: [collection, collection-manifest, git, windows-support]
summary: "Manifest for a collection ingest of the intent-driven template repository: 22 files touched by windows-support (.gitattributes with LF everywhere, the autopilot running the project's OpenSpec CLI without an executable bin link, the PowerShell offline-install diagnostic Test-OfflineInstall.ps1 and its acceptance steps, ADR-0017, the synced openspec-autopilot and session-bootstrap specs, the new windows-readiness spec and the archived change) pinned by path and blob SHA at commit 3d2d8fe59719f2139913de1052fa087b44d2d185. No file bodies are copied."
collection: "idd"
adapter: git
revision: "3d2d8fe59719f2139913de1052fa087b44d2d185"
canonical_url: "https://github.com/hiebra/idd/tree/3d2d8fe59719f2139913de1052fa087b44d2d185"
license: "unknown"
manifest_only: true
---

# Collection: archivado de windows-support (idd@3d2d8fe)

Fija, en el commit del archivado, lo que tocó el change `windows-support`: `.gitattributes` con finales de línea LF en todo el repositorio, la ejecución del CLI de OpenSpec del proyecto por el autopilot aunque `node_modules/.bin/openspec` no sea un ejecutable, el diagnóstico de instalación sin red `scripts/windows/Test-OfflineInstall.ps1` y sus pasos de aceptación, ADR-0017 (en Windows solo OpenCode 2, LF y un diagnóstico en PowerShell), los requirements añadidos a `openspec-autopilot` y `session-bootstrap`, la spec nueva `windows-readiness` y el change archivado. Cita como `idd@3d2d8fe59719f2139913de1052fa087b44d2d185:<ruta>`. Las versiones anteriores de las rutas compartidas siguen fijadas en el [manifiesto de autopilot-sesion-operativa](2026-11-22-idd-6d6e79c-autopilot-sesion-operativa.md), en el [de fix-tui-subscription-cleanup](2026-11-22-idd-99bdccd-fix-tui-subscription-cleanup.md) y en el [de replace-gherkin-lint-with-gplint](2026-11-22-idd-d355c01-replace-gherkin-lint-with-gplint.md).

| Path | Blob SHA |
|---|---|
| `.gitattributes` | `a15bd5c53be84c2f8ed887fa496b1485cf1d9901` |
| `.opencode/plugins/openspec-autopilot/lib/project.mjs` | `591f5f5dbec38ee3167864b1934dae18532639dd` |
| `README.md` | `5eabc9ec717c81a737e626d82d96e07e8e56e9a2` |
| `acceptance-tests/README.md` | `abc593b84ebe0201766a46905e73ec3241192c31` |
| `acceptance-tests/core-tests/autopilot-openspec-cli.test.js` | `a03d3a81f13487f0ed2a2462bfcf0cf1e61dc142` |
| `acceptance-tests/step-definitions/autopilot.steps.js` | `abf34ed8e051852afea6342a02b35ea4ee5e09d8` |
| `acceptance-tests/step-definitions/line-endings.steps.js` | `ebbecf1ce370135ac2851092db57931710b866ca` |
| `acceptance-tests/step-definitions/windows-readiness.steps.js` | `088352214b3cadff799c441655fe023555b21956` |
| `acceptance-tests/support/windows-readiness.js` | `43effcf6757598581473a688fd3b7760b53d961b` |
| `adr/0017-windows-support-opencode-lf-diagnostic.md` | `aed8f13c6833a0e5739209573d0ed8096dba620b` |
| `openspec/changes/archive/2026-11-22-windows-support/.openspec.yaml` | `ea82943ab5a41ed5d23aacb72c4729778affdd12` |
| `openspec/changes/archive/2026-11-22-windows-support/adr.md` | `f6c32d46ce97fc295de5fb9614d81b3f9be1d329` |
| `openspec/changes/archive/2026-11-22-windows-support/design.md` | `ec1f378b5b50fa04e09c71f7f914a5b96cab012c` |
| `openspec/changes/archive/2026-11-22-windows-support/proposal.md` | `0505b4bd36f1cfe95103d8e15c5ee2e40eb40858` |
| `openspec/changes/archive/2026-11-22-windows-support/specs/openspec-autopilot/spec.md` | `d3371dc875acfd811e42767e14b28fe2a91acf3f` |
| `openspec/changes/archive/2026-11-22-windows-support/specs/session-bootstrap/spec.md` | `50a5f3ef07f7d2d095556bac124f53604915c15d` |
| `openspec/changes/archive/2026-11-22-windows-support/specs/windows-readiness/spec.md` | `5fd45c4d575131261a382836e7a610725708b362` |
| `openspec/changes/archive/2026-11-22-windows-support/tasks.md` | `3085160efa1c791ad970943c65fe9580b73f8ac7` |
| `openspec/specs/openspec-autopilot/spec.md` | `9a3f5d8e0cdeac61f14304ecb6aa8f86f8a1957b` |
| `openspec/specs/session-bootstrap/spec.md` | `1db864dcbe15da614aac72f89cd5cfc6d80d4723` |
| `openspec/specs/windows-readiness/spec.md` | `5eacf160c8dec60c7c2cd32e513bd11467c2b131` |
| `scripts/windows/Test-OfflineInstall.ps1` | `e634c42b24c6f53c8fcda4aae2bc72338c47392f` |
