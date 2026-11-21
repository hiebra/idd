# ADR Review Manifest

- Status: completed
- Review date: 2026-11-21

## Review Summary

ADR review completed for this change.

El design contiene una decisión que cumple los criterios de decisión arquitectónica duradera: los proyectos se preparan solos en cada sesión de Claude Code mediante un hook `SessionStart` versionado, que instala todas las dependencias del proyecto y de su suite de aceptación y deja el CLI de OpenSpec del proyecto por delante en el `PATH` (design D1-D3, D7). Se registra como ADR de repositorio.

El resto de decisiones del design (D4 sello de hashes, D5 `PATH` mediante `CLAUDE_ENV_FILE`, D6 comprobación de Node a partir de `engines.node`, D8 contenido del README, D9 forma de la suite de aceptación) son detalles de implementación y no requieren ADR.

## In-Force ADRs Reviewed

- None - `<repo>/adr/` no existía antes de este change; no hay ADRs vigentes.

## New Durable ADRs Created

- `adr/0001-session-bootstrap-hook.md` (en la raíz del repositorio) - los proyectos se preparan solos al abrir cada sesión de Claude Code.
