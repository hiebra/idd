# Librarian Report

Scan: 2026-11-22 · wiki `.wiki` · passes: staleness, quality · threshold 70 · tras fusionar `origin/main` en la rama de `autopilot-plan-explore`

| Metric | Value |
|---|---|
| Articles | 13 |
| Below staleness threshold | 0 |
| Low quality (< 50) | 0 |
| Average staleness | 100/100 |
| Average quality | 68/100 |

## Articles

| Article | Staleness | Quality | Sources | Words | Flags |
|---|---|---|---|---|---|
| `wiki/concepts/conflictos-entre-deltas-concurrentes.md` | 100 | 60 | 3/3 | 627 | - |
| `wiki/concepts/una-sola-copia-de-las-skills.md` | 100 | 60 | 3/3 | 469 | - |
| `wiki/concepts/worktrees-de-opencode.md` | 100 | 60 | 2/2 | 595 | - |
| `wiki/concepts/hook-context-opencode.md` | 100 | 65 | 5/5 | 666 | - |
| `wiki/concepts/proveedor-falso-para-verificar-contexto.md` | 100 | 65 | 5/5 | 501 | - |
| `wiki/topics/carga-en-la-misma-sesion-por-agente.md` | 100 | 65 | 4/4 | 667 | - |
| `wiki/topics/soporte-de-windows.md` | 100 | 65 | 2/2 | 1490 | - |
| `wiki/concepts/regla-de-comentarios.md` | 100 | 70 | 6/6 | 1295 | - |
| `wiki/concepts/origen-de-openspec-git-discipline.md` | 100 | 75 | 13/13 | 1550 | - |
| `wiki/topics/arranque-de-sesion.md` | 100 | 75 | 9/9 | 1373 | - |
| `wiki/topics/flujo-wiki-first.md` | 100 | 75 | 16/16 | 1728 | - |
| `wiki/topics/suite-de-aceptacion-y-spec-as-source.md` | 100 | 75 | 23/23 | 2320 | - |
| `wiki/topics/ciclo-de-un-change-y-autopilot.md` | 100 | 80 | 23/23 | 4571 | - |

## Coherence findings

1. Corregido: `wiki/topics/ciclo-de-un-change-y-autopilot.md` decía que el hook `prompt` llega «también cuando el mensaje queda pendiente detrás del turno en curso», contra la task 1.4 de `autopilot-plan-explore`. Se fundió con el punto nuevo.
2. Corregido al fusionar con `main`: el punto de `guiar-revision-con-tests` sobre la revisión guiada decía que «el agente `plan` de la revisión ejecuta el runner». Desde `autopilot-plan-explore` la revisión nace con build; el punto lo dice ahora.
3. Unido al fusionar con `main`: los registros del inventario `dos-sesiones-que-toman-el-control-a-la-vez` (rama) y `corregir-prueba-intermitente-dos-sesiones-autopilot` (`main`) trataban la misma carrera. Queda el de `main`, con el diagnóstico de la rama.
4. Opcional: `wiki/topics/ciclo-de-un-change-y-autopilot.md` tiene 4571 palabras y cubre el ciclo y todo el plugin; se podría separar el plugin en un artículo propio.
