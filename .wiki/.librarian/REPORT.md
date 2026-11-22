# Librarian Report

Scan: 2026-11-22 · wiki: `.wiki/` · passes: staleness, quality · threshold: 70

| Metric | Value |
|---|---|
| Articles scanned | 9 |
| Below staleness threshold | 0 |
| Low quality (< 50) | 0 |
| Average staleness | 99.4/100 |
| Average quality | 62.8/100 |

## Articles

| Article | Staleness | Quality | Sources | Flags |
|---|---|---|---|---|
| [wiki/concepts/hook-context-opencode.md](../wiki/concepts/hook-context-opencode.md) | 99 | 60 | 2/2 | - |
| [wiki/concepts/origen-de-openspec-git-discipline.md](../wiki/concepts/origen-de-openspec-git-discipline.md) | 99 | 65 | 7/7 | - |
| [wiki/concepts/proveedor-falso-para-verificar-contexto.md](../wiki/concepts/proveedor-falso-para-verificar-contexto.md) | 99 | 60 | 2/2 | - |
| [wiki/concepts/una-sola-copia-de-las-skills.md](../wiki/concepts/una-sola-copia-de-las-skills.md) | 99 | 60 | 2/2 | - |
| [wiki/topics/arranque-de-sesion.md](../wiki/topics/arranque-de-sesion.md) | 100 | 65 | 4/4 | - |
| [wiki/topics/carga-en-la-misma-sesion-por-agente.md](../wiki/topics/carga-en-la-misma-sesion-por-agente.md) | 100 | 60 | 3/3 | - |
| [wiki/topics/ciclo-de-un-change-y-autopilot.md](../wiki/topics/ciclo-de-un-change-y-autopilot.md) | 100 | 65 | 3/3 | - |
| [wiki/topics/flujo-wiki-first.md](../wiki/topics/flujo-wiki-first.md) | 99 | 65 | 5/5 | - |
| [wiki/topics/suite-de-aceptacion-y-spec-as-source.md](../wiki/topics/suite-de-aceptacion-y-spec-as-source.md) | 100 | 65 | 6/6 | - |

Quality uses Tier 1 only (no article triggered Tier 2): coherence and utility default to 3.

## Content review against fix-tui-subscription-cleanup (idd@99bdccd)

- Contradicted in the wiki layer: none after the step-2 refresh. The four articles that said or implied that the TUI's RPC listeners survive every hot reload (`ciclo-de-un-change-y-autopilot`, `carga-en-la-misma-sesion-por-agente`, `suite-de-aceptacion-y-spec-as-source`) now say they survive only when the plugin does not release them, citing ADR-0010 at `99bdccd`; `arranque-de-sesion` gains the new session-bootstrap requirement.
- Outside the wiki layer (not changed by this scan):
  - `inventory/candidates/volver-a-comprobar-apis-de-sesion-al-subir-opencode.md` still lists "Cada recarga en caliente deja vivo el escuchador RPC anterior de la TUI" as a behaviour to re-check, and its next action asks to re-test "escuchadores RPC que sobreviven a la recarga". Per ADR-0010 the behaviour to watch is now the cleanup contract: the function `setup` returns, run before each reload and at close, and the `signal` of `events.on`; plus the two real-OpenCode checks of task 5.2 (no `ECONNRESET` at a standalone close, only the last load receiving events after two reloads). Suggested: update that record.
  - `raw/notes/2026-11-21-ll-sesiones-opencode-autopilot.md`, lesson 5: its Rule ("cada recarga deja vivo el escuchador anterior") is what happened without releasing the subscriptions. Raw notes are immutable; the correction belongs in a new lessons note.
- Unaffected: `hook-context-opencode` cites `opencode-host.mjs` at `1cf0792` only for the `context` hook, which this change did not touch.
