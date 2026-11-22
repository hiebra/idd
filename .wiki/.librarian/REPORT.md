# Librarian Report

Scan: 2026-11-22 · wiki: `.wiki/` · passes: staleness, quality · threshold: 70

| Metric | Value |
|---|---|
| Articles scanned | 11 |
| Below staleness threshold | 0 |
| Low quality (< 50) | 0 |
| Average staleness | 99.8/100 |
| Average quality | 64.1/100 |

## Articles

| Article | Staleness | Quality | Sources | Flags |
|---|---|---|---|---|
| [wiki/concepts/hook-context-opencode.md](../wiki/concepts/hook-context-opencode.md) | 99 | 60 | 3/3 | - |
| [wiki/concepts/origen-de-openspec-git-discipline.md](../wiki/concepts/origen-de-openspec-git-discipline.md) | 100 | 65 | 9/9 | - |
| [wiki/concepts/proveedor-falso-para-verificar-contexto.md](../wiki/concepts/proveedor-falso-para-verificar-contexto.md) | 100 | 60 | 3/3 | - |
| [wiki/concepts/regla-de-comentarios.md](../wiki/concepts/regla-de-comentarios.md) | 100 | 60 | 2/2 | - |
| [wiki/concepts/una-sola-copia-de-las-skills.md](../wiki/concepts/una-sola-copia-de-las-skills.md) | 99 | 60 | 2/2 | - |
| [wiki/topics/arranque-de-sesion.md](../wiki/topics/arranque-de-sesion.md) | 100 | 65 | 8/8 | - |
| [wiki/topics/carga-en-la-misma-sesion-por-agente.md](../wiki/topics/carga-en-la-misma-sesion-por-agente.md) | 100 | 65 | 4/4 | - |
| [wiki/topics/ciclo-de-un-change-y-autopilot.md](../wiki/topics/ciclo-de-un-change-y-autopilot.md) | 100 | 75 | 13/13 | - |
| [wiki/topics/flujo-wiki-first.md](../wiki/topics/flujo-wiki-first.md) | 100 | 65 | 6/6 | - |
| [wiki/topics/soporte-de-windows.md](../wiki/topics/soporte-de-windows.md) | 100 | 60 | 2/2 | - |
| [wiki/topics/suite-de-aceptacion-y-spec-as-source.md](../wiki/topics/suite-de-aceptacion-y-spec-as-source.md) | 100 | 70 | 15/15 | - |

Quality uses Tier 1 only (no article triggered Tier 2): coherence and utility default to 3.

## Content review against windows-support (idd@3d2d8fe)

- Contradicted in the wiki layer: none. The three topics whose sources changed were refreshed in step 2, and no other article states that the project only runs on Linux and macOS or that the autopilot runs `node_modules/.bin/openspec`.
- Gaps (suggested, not applied):
  - `wiki/topics/soporte-de-windows.md`: Falta qué deja fuera windows-support: el núcleo del arranque en Windows (Git Bash, symlinks, rutas), que resuelve windows-global-distro; la primera versión con Git Bash que se implementó y se revirtió (commits 052e567 a 9e5b7b8); las comprobaciones que el diagnóstico quitó (Git Bash, MSYS, symlinks, Modo de desarrollador, python3), y que la suite no se ejecuta en Windows. Fuente: idd@3d2d8fe:openspec/changes/archive/2026-11-22-windows-support/proposal.md y design.md, ya fijados en el manifiesto.
  - `wiki/concepts/una-sola-copia-de-las-skills.md`: La consecuencia 'los symlinks no funcionan en Windows sin modo desarrollador' (ADR-0003) es relevante ahora que Windows se soporta con OpenCode 2: el repositorio versiona symlinks en .claude/skills/ y el motor se expone por symlinks. windows-support no lo resuelve y el diagnóstico ya no lo comprueba; queda para windows-global-distro. Sugerido: una línea con eso y un enlace a soporte-de-windows.
- Unaffected: `hook-context-opencode`, `proveedor-falso-para-verificar-contexto`, `regla-de-comentarios`, `carga-en-la-misma-sesion-por-agente`, `flujo-wiki-first` and `origen-de-openspec-git-discipline` cite no path this change touched. The inventory records do not depend on Windows support.
