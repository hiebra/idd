---
title: "Collection: openspec-git-discipline en su origen (intent-driven-template@a8b8231)"
source: "https://github.com/intent-driven-dev/intent-driven-template"
type: repos
ingested: 2026-11-21
tags: [collection, collection-manifest, git, openspec-git-discipline]
summary: "Manifest for a collection ingest of intent-driven-dev/intent-driven-template: 2 files (the openspec-git-discipline skill and AGENTS.md) pinned by path and blob SHA at commit a8b8231ff68250a503516b27b2bd70b7a5640c99, where the skill is born. No file bodies are copied."
collection: "intent-driven-template"
adapter: git
revision: "a8b8231ff68250a503516b27b2bd70b7a5640c99"
canonical_url: "https://github.com/intent-driven-dev/intent-driven-template/tree/a8b8231ff68250a503516b27b2bd70b7a5640c99"
license: "MIT (declarado en el frontmatter de la skill)"
manifest_only: true
---

# Collection: openspec-git-discipline en su origen (intent-driven-template@a8b8231)

Fija la skill `openspec-git-discipline` en el commit donde nace y el `AGENTS.md` que la activa en ese mismo commit. Cita como `intent-driven-template@a8b8231ff68250a503516b27b2bd70b7a5640c99:<ruta>`.

| Path | Blob SHA |
|---|---|
| `.agents/skills/openspec-git-discipline/SKILL.md` | `835e065dc3e6a20a36ff5f9f108b297069971127` |
| `AGENTS.md` | `00d05f4aea7e280f3702b2ee21cfffba7cf0bd63` |

## Procedencia

Comprobado el 2026-11-21 sobre un clon completo (35 commits, HEAD `b5bda460a2180a55fc508fdedc4ef058d95355db`):

- **El commit de nacimiento** (`a8b8231`, Hari Krishnan, 2026-05-10) añade 43 archivos de golpe. Su mensaje es solo "Add OpenSpec workflow commands and agent skills", sin cuerpo.
- **`AGENTS.md`** en ese commit tiene una sola instrucción: usar la skill "to enforce proposal commits before apply and merge-before-archive discipline". Enuncia la regla, no su motivo.
- **La skill no ha cambiado** desde ese commit hasta HEAD (`git log --follow` sobre la ruta da solo `a8b8231`).
- **Ninguna justificación en el historial**: en todos los commits del repositorio, la skill solo aparece en `SKILL.md`, `AGENTS.md`, `README.md`, `INSTALL_TEMPLATE.md` y `.opencode/skills/openspec-bulk-apply-change/SKILL.md`, y ningún mensaje de commit la menciona. Todos esos archivos repiten la regla (la propuesta llega a `main` antes de apply; la implementación, antes de archive) sin decir por qué.
