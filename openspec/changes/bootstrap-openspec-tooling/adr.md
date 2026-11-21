# ADR Review Manifest

- Status: completed
- Review date: 2026-11-21

## Review Summary

ADR review completed for this change.

El design contiene una decisión que cumple los criterios de decisión arquitectónica duradera: los proyectos se preparan solos en cada sesión de Claude Code mediante un hook `SessionStart` versionado, que instala todas las dependencias del proyecto y deja el CLI de OpenSpec del proyecto por delante en el `PATH` (design D1-D3, D7).

No se ha creado ningún ADR en `<repo>/adr/` para ella. Este repositorio es una plantilla y los proyectos creados desde ella deben nacer con `adr/` vacío, así que las decisiones de la plantilla se documentan en su `README.md` (design D8) y no en `adr/`. La tarea del README de este change recoge esa decisión.

El resto de decisiones del design (D4 sello de hashes, D5 `PATH` mediante `CLAUDE_ENV_FILE`, D6 comprobación de Node a partir de `engines.node`) son detalles de implementación del hook y no requieren ADR.

## In-Force ADRs Reviewed

- None - `<repo>/adr/` no existe; no hay ADRs vigentes.

## New Durable ADRs Created

- None - la decisión duradera descrita arriba queda en el `README.md` de la plantilla y no en `<repo>/adr/`, porque los proyectos derivados deben nacer con `adr/` vacío.
