# Librarian Report

Scan: 2026-11-21 · wiki: `.wiki/` · passes: staleness, quality · threshold: 70

| Metric | Value |
|---|---|
| Articles scanned | 8 |
| Below staleness threshold | 0 |
| Low quality (< 50) | 0 |
| Average staleness | 100/100 |
| Average quality | 61.2/100 |

## Articles

| Article | Staleness | Quality | Sources | Flags |
|---|---|---|---|---|
| [wiki/concepts/hook-context-opencode.md](../wiki/concepts/hook-context-opencode.md) | 100 | 60 | 2/2 | - |
| [wiki/concepts/origen-de-openspec-git-discipline.md](../wiki/concepts/origen-de-openspec-git-discipline.md) | 100 | 65 | 5/5 | - |
| [wiki/concepts/proveedor-falso-para-verificar-contexto.md](../wiki/concepts/proveedor-falso-para-verificar-contexto.md) | 100 | 60 | 2/2 | - |
| [wiki/concepts/una-sola-copia-de-las-skills.md](../wiki/concepts/una-sola-copia-de-las-skills.md) | 100 | 60 | 2/2 | - |
| [wiki/topics/arranque-de-sesion.md](../wiki/topics/arranque-de-sesion.md) | 100 | 60 | 3/3 | - |
| [wiki/topics/carga-en-la-misma-sesion-por-agente.md](../wiki/topics/carga-en-la-misma-sesion-por-agente.md) | 100 | 60 | 2/2 | - |
| [wiki/topics/flujo-wiki-first.md](../wiki/topics/flujo-wiki-first.md) | 100 | 60 | 3/3 | - |
| [wiki/topics/suite-de-aceptacion-y-spec-as-source.md](../wiki/topics/suite-de-aceptacion-y-spec-as-source.md) | 100 | 65 | 4/4 | - |

Quality uses Tier 1 only (no article triggered Tier 2): coherence and utility default to 3.

## Content review against fix-wiki-flow-operations (idd@b48392d)

- Contradicted: none.
- Obsolete: none. The three articles refreshed in step 2 match the guide, reminder, bootstrap core and spec at `b48392d`; `carga-en-la-misma-sesion-por-agente` cites `ENGINE_LINKS`, unchanged.
- Suggestion: `wiki/topics/flujo-wiki-first.md` summary and its `topics/_index.md` row don't mention the read/write split or the closing point for lessons (ADR-0009).
