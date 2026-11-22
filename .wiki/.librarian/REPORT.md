# Librarian Report

Scan: 2026-11-22 · wiki `.wiki` · passes: staleness, quality · threshold 70

| Metric | Value |
|---|---|
| Articles | 10 |
| Below staleness threshold | 0 |
| Low quality (< 50) | 0 |
| Average staleness | 100/100 |
| Average quality | 67/100 |

## Articles

| Article | Staleness | Quality | Sources | Words | Flags |
|---|---|---|---|---|---|
| `wiki/concepts/proveedor-falso-para-verificar-contexto.md` | 100 | 55 | 3/3 | 370 | thin-coverage |
| `wiki/concepts/regla-de-comentarios.md` | 100 | 60 | 2/2 | 638 | - |
| `wiki/concepts/una-sola-copia-de-las-skills.md` | 99 | 60 | 2/2 | 400 | - |
| `wiki/concepts/hook-context-opencode.md` | 100 | 65 | 4/4 | 528 | - |
| `wiki/topics/arranque-de-sesion.md` | 100 | 65 | 6/6 | 1125 | - |
| `wiki/topics/carga-en-la-misma-sesion-por-agente.md` | 100 | 65 | 4/4 | 667 | - |
| `wiki/concepts/origen-de-openspec-git-discipline.md` | 100 | 70 | 9/9 | 1072 | - |
| `wiki/topics/flujo-wiki-first.md` | 100 | 75 | 10/10 | 1361 | - |
| `wiki/topics/suite-de-aceptacion-y-spec-as-source.md` | 100 | 75 | 14/14 | 1609 | - |
| `wiki/topics/ciclo-de-un-change-y-autopilot.md` | 100 | 80 | 12/12 | 3366 | - |

## Coherence findings (tras el archivado de autopilot-plan-explore)

1. `wiki/topics/ciclo-de-un-change-y-autopilot.md`, sección «Las restricciones de OpenCode 2.3.2»: el punto «El hook de servidor `prompt`» dice que llega «también cuando el mensaje queda pendiente detrás del turno en curso». Lo contradice la task 1.4 de `autopilot-plan-explore` (`idd@9eae630:openspec/changes/archive/2026-11-22-autopilot-plan-explore/tasks.md`): el mensaje no espera detrás del turno, entra en el mismo bucle, y el hook llega una sola vez, al entrar. Además duplica el punto nuevo sobre el hook `prompt` de la misma sección. Acción propuesta: fusionar los dos puntos.
2. `wiki/topics/ciclo-de-un-change-y-autopilot.md` tiene ya 3366 palabras: el artículo cubre el ciclo y todo el plugin. Acción opcional: separar el plugin en un artículo propio en una compilación futura.
3. `wiki/concepts/proveedor-falso-para-verificar-contexto.md`: `thin-coverage` por la heurística de palabras (370). Fue el banco de todas las comprobaciones de `autopilot-plan-explore` (tasks 1.1 a 1.4 y 7.2: TUI `--standalone` en un pseudoterminal, `opencode serve` propio con `--server`, proveedor que tarda). Acción opcional: ampliarlo con lo aprendido, vía lecciones del paso 4.

Las dos entradas del inventario creadas en la sesión (`puente-del-autopilot-sigue-con-una-tui-cerrada`, `dos-sesiones-que-toman-el-control-a-la-vez`) citan `idd@48ca630:openspec/changes/autopilot-plan-explore/tasks.md`, la ruta anterior al archivado; la cita sigue siendo válida en ese commit.
