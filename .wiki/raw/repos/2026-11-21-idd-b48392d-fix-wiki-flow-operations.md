---
title: "Collection: archivado de fix-wiki-flow-operations (idd@b48392d)"
source: "."
type: repos
ingested: 2026-11-21
tags: [collection, collection-manifest, git, fix-wiki-flow-operations]
summary: "Manifest for a collection ingest of the intent-driven template repository: 16 files touched by fix-wiki-flow-operations (wiki guide, reminder and OpenCode note, session bootstrap, acceptance steps and core tests, ADR-0009, the synced wiki-first-knowledge spec and the archived change) pinned by path and blob SHA at commit b48392dc0e43f541ed6e1c9b0847241fb45356bd. No file bodies are copied."
collection: "idd"
adapter: git
revision: "b48392dc0e43f541ed6e1c9b0847241fb45356bd"
canonical_url: "https://github.com/hiebra/idd/tree/b48392dc0e43f541ed6e1c9b0847241fb45356bd"
license: "unknown"
manifest_only: true
---

# Collection: archivado de fix-wiki-flow-operations (idd@b48392d)

Fija, en el commit del archivado, lo que tocó el change `fix-wiki-flow-operations`: la guía del wiki y el recordatorio con la operación de lectura de cada agente, la reserva de `wiki-manager` para escribir con confirmación del usuario, las lecciones candidatas registradas en un punto de cierre, ADR-0009 y la spec `wiki-first-knowledge` ya sincronizada. Cita como `idd@b48392dc0e43f541ed6e1c9b0847241fb45356bd:<ruta>`. Las versiones anteriores de estas rutas siguen fijadas en el [manifiesto de add-llm-wiki-support](2026-11-21-idd-1cf0792.md).

| Path | Blob SHA |
|---|---|
| `.agents/hooks/session-bootstrap.sh` | `589c371cadcef65075c802da4086fb08cf6651ab` |
| `.agents/wiki/guide.md` | `7fb9bd28c80d7612a217e78180233bd5e2dea536` |
| `.agents/wiki/opencode-note.md` | `7a1a2f82b8e59b5140bdc88c9e316debc6efeeec` |
| `.agents/wiki/reminder.md` | `2a45be906c02e95fd98e2f760e78fc3ee4960cdd` |
| `acceptance-tests/README.md` | `b2fa5ed971f435024b07676951f4abc2e598afbd` |
| `acceptance-tests/core-tests/wiki-markers.test.js` | `28e35ab4fc21e0d35f0ef650a199564bcaf5d7aa` |
| `acceptance-tests/step-definitions/wiki.steps.js` | `d12eb53a2af810428d70e9ecd0d5821fdd56d83c` |
| `acceptance-tests/support/world.js` | `8225499bf01449f352b655ae79a8812a5a6b7176` |
| `adr/0009-wiki-read-and-write-operations.md` | `6f1db8503a5f1f8f145dafab0cae3640b1017e81` |
| `openspec/changes/archive/2026-11-21-fix-wiki-flow-operations/.openspec.yaml` | `1a9f87e2cc46559e30c348b19780820b33a722c7` |
| `openspec/changes/archive/2026-11-21-fix-wiki-flow-operations/adr.md` | `1d39b66b5286c83fb189153eb5187717d175678f` |
| `openspec/changes/archive/2026-11-21-fix-wiki-flow-operations/design.md` | `7766a890c34183bd8a53cd4c51f9af2914bc70db` |
| `openspec/changes/archive/2026-11-21-fix-wiki-flow-operations/proposal.md` | `4d516e64e8f38912941843f21ce8128d355012bf` |
| `openspec/changes/archive/2026-11-21-fix-wiki-flow-operations/specs/wiki-first-knowledge/spec.md` | `5559e71e5a66965247aa8c9cc61fc42069888307` |
| `openspec/changes/archive/2026-11-21-fix-wiki-flow-operations/tasks.md` | `dd9f662315a2b5fb458cda414acf77c15d284d9b` |
| `openspec/specs/wiki-first-knowledge/spec.md` | `2812ed199323b812d0bc23c1498d19aeeae179a4` |

## Procedencia

Comprobado el 2026-11-21:

- **Rutas**: los archivos de los commits propios del change (de `2e89fa3` a `b48392d`); se dejan fuera ADR-0006 a ADR-0008 y `add-openspec-autopilot`, que comparten la rama pero son de otro change.
- **Spec sincronizada**: `openspec/specs/wiki-first-knowledge/spec.md` incorpora el delta del change (1 requisito añadido y 3 modificados); la suite de specs pasa (63 escenarios).
- **Sin duplicados**: ningún blob coincide con uno ya fijado en otro manifiesto.
