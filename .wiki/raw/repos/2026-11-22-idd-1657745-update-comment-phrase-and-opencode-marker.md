---
title: "Collection: archivado de update-comment-phrase-and-opencode-marker (idd@1657745)"
source: "."
type: repos
ingested: 2026-11-22
tags: [collection, collection-manifest, git, update-comment-phrase-and-opencode-marker]
summary: "Manifest for a collection ingest of the intent-driven template repository: 18 files touched by update-comment-phrase-and-opencode-marker (the comments rule and reminder, the core detection, the new response-comments OpenCode plugin, the session-bootstrap plugin, README, the simulated OpenCode host, acceptance steps and core tests, ADR-0018, the response-comments spec and the archived change) pinned by path and blob SHA at commit 165774532006e4fb829ec8bcc4ab6a27987ef185. No file bodies are copied."
collection: "idd"
adapter: git
revision: "165774532006e4fb829ec8bcc4ab6a27987ef185"
canonical_url: "https://github.com/hiebra/idd/tree/165774532006e4fb829ec8bcc4ab6a27987ef185"
license: "unknown"
manifest_only: true
---

# Collection: archivado de update-comment-phrase-and-opencode-marker (idd@1657745)

Fija, en el commit del archivado, lo que tocó el change `update-comment-phrase-and-opencode-marker`: la marca de comentario `''así''` en lugar de `'así'`, la cita de la web de OpenCode como comentario, la frase fija nueva y el plugin propio de OpenCode `response-comments` (ADR-0018), que sustituye a `session-bootstrap` en la entrega de la regla. Cita como `idd@165774532006e4fb829ec8bcc4ab6a27987ef185:<ruta>`. Las versiones anteriores de las rutas compartidas siguen fijadas en el [manifiesto de update-comment-closing-and-quotes](2026-11-22-idd-c4d6b27-update-comment-closing-and-quotes.md).

| Path | Blob SHA |
|---|---|
| `.agents/comments/reminder.md` | `abf966fdac4324971ca9502d66c044f5f68ecf94` |
| `.agents/comments/rule.md` | `931ae0b65ef94337f7659433db2caa2be4b4ac1c` |
| `.agents/hooks/session-bootstrap.sh` | `9c1d66d3e46d56f4355e796c7f511e8122642aa0` |
| `.opencode/plugins/response-comments/server.js` | `aef56b63bffd4588402ba67094a9e5f9180e3a6a` |
| `.opencode/plugins/session-bootstrap/server.js` | `380af79bff0bf20f8803f633a28bc89be18593b7` |
| `README.md` | `09eae33c09da4dcbdbded4a25ed14a5746a9bda7` |
| `acceptance-tests/core-tests/comments-reminder.test.js` | `8ac94579741d658a6d9276473447616a6f65f4ab` |
| `acceptance-tests/step-definitions/comments.steps.js` | `4565ccaf3abb60f3b9d78bff11275299779a78e6` |
| `acceptance-tests/support/agents/opencode-host.mjs` | `aa4ef029b57fffd8eb269591acad47bbced26e5b` |
| `acceptance-tests/support/agents/opencode.js` | `75e45e0616b603e36b19443ad5dfaad0e95d0a4b` |
| `adr/0018-opencode-optional-instructions-own-plugin.md` | `931fc70643454a3398c493348156d986b953f64a` |
| `openspec/changes/archive/2026-11-22-update-comment-phrase-and-opencode-marker/.openspec.yaml` | `ea82943ab5a41ed5d23aacb72c4729778affdd12` |
| `openspec/changes/archive/2026-11-22-update-comment-phrase-and-opencode-marker/adr.md` | `33df67d4cfad45d4035f38c63165f9e0068ad77b` |
| `openspec/changes/archive/2026-11-22-update-comment-phrase-and-opencode-marker/design.md` | `5947a8f75203b895373756f6e3cf815e0091b0c4` |
| `openspec/changes/archive/2026-11-22-update-comment-phrase-and-opencode-marker/proposal.md` | `26e0b2937c8c0e907c9bf505f1661ab9136d4751` |
| `openspec/changes/archive/2026-11-22-update-comment-phrase-and-opencode-marker/specs/response-comments/spec.md` | `3a3df96aee34ba62f03f1e6c0a4d5605c5c3c00e` |
| `openspec/changes/archive/2026-11-22-update-comment-phrase-and-opencode-marker/tasks.md` | `033e3f20fb8d57077b8c2ba03ccea0ee62d71942` |
| `openspec/specs/response-comments/spec.md` | `e6487783b935c2b91c94eeea82a31a893b781a2e` |
