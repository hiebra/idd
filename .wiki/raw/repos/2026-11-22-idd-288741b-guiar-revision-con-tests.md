---
title: "Collection: archivado de guiar-revision-con-tests (idd@288741b)"
source: "."
type: repos
ingested: 2026-11-22
tags: [collection, collection-manifest, git, guiar-revision-con-tests]
summary: "Manifest for a collection ingest of the intent-driven template repository: 9 files touched by guiar-revision-con-tests (the openspec-autopilot review prompt, the autopilot steps, the synced openspec-autopilot spec and the archived change) pinned by path and blob SHA at commit 288741b581d25d63810e8f4c2511b0714b5272f0. No file bodies are copied."
collection: "idd"
adapter: git
revision: "288741b581d25d63810e8f4c2511b0714b5272f0"
canonical_url: "https://github.com/hiebra/idd/tree/288741b581d25d63810e8f4c2511b0714b5272f0"
license: "unknown"
manifest_only: true
---

# Collection: archivado de guiar-revision-con-tests (idd@288741b)

Fija, en el commit del archivado, lo que tocó el change `guiar-revision-con-tests`: la instrucción de la revisión del plugin `openspec-autopilot` (`reviewPrompt`), que en la revisión de una task y en la del verify pide guiar la verificación con los escenarios de aceptación del change, ejecutarlos sin dejar archivos no ignorados y ofrecer al usuario la orden para ejecutar en modo depuración el código generado; los pasos de la suite; la spec `openspec-autopilot` ya sincronizada, y el change archivado. Cita como `idd@288741b581d25d63810e8f4c2511b0714b5272f0:<ruta>`.

| Path | Blob SHA |
|---|---|
| `.opencode/plugins/openspec-autopilot/lib/prompts.mjs` | `08195d197c4af24397c1fae3a169ec7def97f4ad` |
| `acceptance-tests/step-definitions/autopilot.steps.js` | `f895f1b58a60b7c07f9680c1cba424cd4c2440ea` |
| `openspec/changes/archive/2026-11-22-guiar-revision-con-tests/.openspec.yaml` | `ea82943ab5a41ed5d23aacb72c4729778affdd12` |
| `openspec/changes/archive/2026-11-22-guiar-revision-con-tests/adr.md` | `33ae462f23e4421eaa5d1bc0f5d97c3f0868f8dc` |
| `openspec/changes/archive/2026-11-22-guiar-revision-con-tests/design.md` | `470bf6aea95ede0e66608d73e4bc5a5c618290d4` |
| `openspec/changes/archive/2026-11-22-guiar-revision-con-tests/proposal.md` | `10850b8b8403087ae5abf539c535932159ce7712` |
| `openspec/changes/archive/2026-11-22-guiar-revision-con-tests/specs/openspec-autopilot/spec.md` | `fa326f524a64ff509b50cbad889ba42ef586432b` |
| `openspec/changes/archive/2026-11-22-guiar-revision-con-tests/tasks.md` | `523a2bea18e38695f95fad714466c0a9db5f28ed` |
| `openspec/specs/openspec-autopilot/spec.md` | `56b7bb3ac58884b9c12057e0b6e63149b890781c` |

## Procedencia

Comprobado el 2026-11-22:

- **Rutas**: las del diff entre el merge-base de la rama con `main` (`af2153e`) y el commit del archivado (`288741b`), según las indicaciones de archivado. El change no tiene ADRs. Se excluyen `.wiki/` y lo generado.
- **Spec sincronizada**: `openspec/specs/openspec-autopilot/spec.md` recibe un requisito nuevo (solo ADDED), "Revisión guiada con los tests de aceptación". La suite efectiva pasa antes del archivado (231 escenarios, 1221 pasos) y `npm run test:core` da 166 pruebas en verde.
- **Comprobación con OpenCode 2.3.2 real**: anotada en la task 3.2 del `tasks.md` archivado. El agente `plan` de la revisión de una task localizó y ejecutó solo el escenario de la task, dejó el árbol sin archivos nuevos y dio, sin lanzarla, la orden de depuración con `node --inspect-brk`; ejecutó la shell sin pedir permiso.
