---
title: "Collection: archivado de replace-gherkin-lint-with-gplint (idd@d355c01)"
source: "."
type: repos
ingested: 2026-11-22
tags: [collection, collection-manifest, git, replace-gherkin-lint-with-gplint]
summary: "Manifest for a collection ingest of the intent-driven template repository: 21 files touched by replace-gherkin-lint-with-gplint (the acceptance suite's gplint config, package.json, spec-lint support, steps and core test, the acceptance README, the acceptance-test-authoring and spec-as-source skills, ADR-0012, the new spec-lint spec and the archived change) pinned by path and blob SHA at commit d355c01b03821723b4afa8fb0d0829c2bec16b92. No file bodies are copied."
collection: "idd"
adapter: git
revision: "d355c01b03821723b4afa8fb0d0829c2bec16b92"
canonical_url: "https://github.com/hiebra/idd/tree/d355c01b03821723b4afa8fb0d0829c2bec16b92"
license: "unknown"
manifest_only: true
---

# Collection: archivado de replace-gherkin-lint-with-gplint (idd@d355c01)

Fija, en el commit del archivado, lo que tocó el change `replace-gherkin-lint-with-gplint`: el lint de las specs pasa de `gherkin-lint` a `gplint`, con la configuración fijada `.gplintrc` (copia de `references/gplintrc.json` de la skill `acceptance-test-authoring`); el soporte, los pasos y el test del núcleo de la capability nueva `spec-lint`; el README de la suite; las skills `acceptance-test-authoring` y `spec-as-source`; ADR-0012, y la spec `spec-lint` ya sincronizada. Cita como `idd@d355c01b03821723b4afa8fb0d0829c2bec16b92:<ruta>`.

El change también borró `acceptance-tests/.gherkin-lintrc` y `.agents/skills/acceptance-test-authoring/references/gherkin-lintrc.json`, que no están en este árbol; `acceptance-tests/package-lock.json` se excluye por ser un lockfile.

| Path | Blob SHA |
|---|---|
| `.agents/skills/acceptance-test-authoring/SKILL.md` | `95008925a4db1aff9d110e026f6966402534e934` |
| `.agents/skills/acceptance-test-authoring/references/EXTRACTION.md` | `df374df1d363141df118aa9e2613982480ef08d9` |
| `.agents/skills/acceptance-test-authoring/references/gplintrc.json` | `ac91e0c6ab7ddc9e60e4d5c11739ab84c74346ee` |
| `.agents/skills/acceptance-test-authoring/references/javascript/SETUP.md` | `13b55c32911a22e944c9deb3bcf397b18c5f936a` |
| `.agents/skills/acceptance-test-authoring/references/python/SETUP.md` | `407fc2630adb1ca1ce81952f065cbae860f3c842` |
| `.agents/skills/acceptance-test-authoring/references/python/run_acceptance.py` | `a6932084cd2f5c754c18cf954b7dd3ba1293aa51` |
| `.agents/skills/spec-as-source/references/tasks.md` | `2e691503e6f7eb3814d7395b031d880da4175826` |
| `acceptance-tests/.gplintrc` | `ac91e0c6ab7ddc9e60e4d5c11739ab84c74346ee` |
| `acceptance-tests/README.md` | `9ba770236cc0f56f7182e748f75d0ff507a28023` |
| `acceptance-tests/core-tests/spec-lint-script.test.js` | `a848c447d5735e71e7b35403390bd76d651d6aa4` |
| `acceptance-tests/package.json` | `85c45c7d2fb6f9bd40f49b0f7a71ee9564f4fdf5` |
| `acceptance-tests/step-definitions/spec-lint.steps.js` | `d89b5abd1a7309f473b6858db107fc87a3fe28fc` |
| `acceptance-tests/support/spec-lint.js` | `2be2d39f57e3f5cea0331dd8bd2e2bff8836d838` |
| `adr/0012-spec-lint-with-gplint.md` | `793659d1c25e3a121252c2f8dffc8908a10e7558` |
| `openspec/changes/archive/2026-11-22-replace-gherkin-lint-with-gplint/.openspec.yaml` | `ea82943ab5a41ed5d23aacb72c4729778affdd12` |
| `openspec/changes/archive/2026-11-22-replace-gherkin-lint-with-gplint/adr.md` | `5ffc0b4c3892119e367e5d30e9597041457bb10c` |
| `openspec/changes/archive/2026-11-22-replace-gherkin-lint-with-gplint/design.md` | `1d32ddb963307988d0bfe67989afcfc6c0b1d229` |
| `openspec/changes/archive/2026-11-22-replace-gherkin-lint-with-gplint/proposal.md` | `8060ab0035ebd2d08fb809a6bec0bab72fd2fa9a` |
| `openspec/changes/archive/2026-11-22-replace-gherkin-lint-with-gplint/specs/spec-lint/spec.md` | `b8e3e9da3289f398c8e7cf176ce1305f01459164` |
| `openspec/changes/archive/2026-11-22-replace-gherkin-lint-with-gplint/tasks.md` | `e56d9b24db45140bc1f002bba1ca29df7b04566c` |
| `openspec/specs/spec-lint/spec.md` | `a0c322edc24ac907df40175b2eba6d1fc05facdf` |
