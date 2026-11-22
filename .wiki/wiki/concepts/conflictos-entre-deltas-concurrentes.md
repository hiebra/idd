---
title: "Conflictos entre deltas de changes concurrentes"
category: concept
sources:
  - raw/notes/2026-11-22-ll-git-discipline-standard-with-exception.md
  - raw/notes/2026-11-22-ll-conflictos-entre-deltas-concurrentes.md
  - raw/notes/2026-11-22-usuario-por-que-la-spec-en-la-rama-de-origen.md
created: 2026-11-22
updated: 2026-11-22
verified: 2026-11-22
tags: [openspec, archive, delta-specs, git, concurrencia, openspec-git-discipline]
confidence: high
volatility: warm
summary: "Dos changes en curso con deltas sobre la misma capability pueden chocar al archivarse. OpenSpec 1.17.0 aborta el archive si el requirement ya no existe o si se perderían escenarios, pero dos MODIFIED que conservan los mismos escenarios se sobrescriben en silencio cuando se archivan en la misma rama. Archivados en ramas separadas, ese caso aparece como conflicto de git al fusionar. Trabajar la spec en la rama permanente no detecta mejor estos conflictos."
---

# Conflictos entre deltas de changes concurrentes

> Cada delta de un change se escribe contra la versión de `openspec/specs/<capability>/spec.md` que había al proponerlo. Si otro change que toca la misma capability se archiva antes, el delta puede quedar escrito contra una versión que ya no existe. Esta página recoge qué detecta OpenSpec 1.17.0 y qué detecta git, según la forma del ciclo. Lo comprobado sale de experimentos con el CLI del proyecto y el schema `spec-driven` ([lecciones](../../raw/notes/2026-11-22-ll-conflictos-entre-deltas-concurrentes.md)).

## Qué detecta cada forma

| Caso | Misma rama: la regla, los dos se archivan en la rama de origen | Ramas separadas: la excepción de ADR-0020, cada uno se archiva en su rama |
|---|---|---|
| A elimina un requirement que B modifica | `archive` de B se aborta: `MODIFIED failed … - not found` | Conflicto de git al fusionar, o el mismo aborto |
| A añade un escenario y el MODIFIED de B no lo incluye | `archive` de B se aborta: `Refresh the change spec before archiving to avoid dropping scenarios` | Conflicto de git al fusionar |
| A y B modifican el mismo requirement con los mismos escenarios | **No se detecta**: B sustituye a A y el cambio de A se pierde | `CONFLICT (content)` en el `spec.md` al fusionar la segunda rama |

- **Por qué aborta el archive** (lección 1): al aplicar un MODIFIED, el CLI busca el requirement por su cabecera y exige conservar los nombres de sus escenarios. No compara el contenido, solo los nombres.
- **Por qué el tercer caso es silencioso en una sola rama** (lección 2): los deltas viven en directorios distintos de `openspec/changes/` y se aplican uno tras otro. Nada compara la base contra la que se escribió cada uno. En ramas separadas, los dos archives editan las mismas líneas desde el mismo merge-base, y git lo detecta.

## Consecuencias para el ciclo

- **La rama permanente no detecta mejor estos conflictos.** El usuario intuía que trabajar en `main` facilitaría detectarlos ([opinión del usuario](../../raw/notes/2026-11-22-usuario-por-que-la-spec-en-la-rama-de-origen.md), punto 7). Lo comprobado lo contradice: en la misma rama se detecta lo mismo que con ramas en los dos primeros casos, y nada en el tercero.
- **Mitigación manual en la misma rama**: antes de archivar, comprobar si se archivó otro change que tocara la misma capability después de proponer el propio (`git log -- openspec/specs/<capability>/`), y refrescar el delta si es así.
- **Los ADR van al revés.** Escribirlos en la rama de origen reserva su número, mientras que los ADR creados en ramas paralelas son los que chocan (lección 3, deducida de las reglas, no ejecutada). Ver [[ciclo-de-un-change-y-autopilot|el ciclo de un change]] ([el ciclo de un change](../topics/ciclo-de-un-change-y-autopilot.md)), «Números de ADR sin choques».
- **`openspec validate` aplica la misma protección**: un MODIFIED que omite escenarios de la spec actual es un error ya al validar. Para quitar o reemplazar escenarios, el requisito va como REMOVED más ADDED ([lecciones de git-discipline-standard-with-exception](../../raw/notes/2026-11-22-ll-git-discipline-standard-with-exception.md), lección 1).

## Lo que no se sabe

- **Con el schema `intent-driven`**: no se ejecutó. El archive es el mismo comando del CLI, pero el schema podría cambiar la validación.
- **Otras versiones de OpenSpec**: la protección de escenarios es de la 1.17.0. Puede no existir en versiones anteriores ni mantenerse en las siguientes.

## See Also

- [[origen-de-openspec-git-discipline|openspec-git-discipline: una regla heredada sin justificación registrada]] ([openspec-git-discipline: una regla heredada sin justificación registrada](origen-de-openspec-git-discipline.md))
- [[ciclo-de-un-change-y-autopilot|El ciclo de un change y su automatización en OpenCode]] ([El ciclo de un change y su automatización en OpenCode](../topics/ciclo-de-un-change-y-autopilot.md))

## Sources

- [Lessons Learned: git-discipline-standard-with-exception](../../raw/notes/2026-11-22-ll-git-discipline-standard-with-exception.md): lección 1.
- [Lessons Learned: conflictos entre deltas de changes concurrentes](../../raw/notes/2026-11-22-ll-conflictos-entre-deltas-concurrentes.md): lecciones 1 a 3.
- [Opinión del usuario: la spec en la rama de origen y las dos formas del ciclo](../../raw/notes/2026-11-22-usuario-por-que-la-spec-en-la-rama-de-origen.md): punto 7 y objeciones.
