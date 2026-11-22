# ADR Review Manifest

- Status: completed
- Review date: 2026-11-22

## Review Summary

ADR review completed for this change.

El design tiene una decisión duradera que se aparta de un ADR en vigor: un plugin de un solo agente mantiene en un archivo versionado (`openspec/config.yaml`) un bloque literal que depende de una preferencia del usuario (design D5 y Open Questions). Rompe la condición de ADR-0006 de que lo versionado sea igual con la capacidad y sin ella, así que un ADR nuevo lo sustituye con la misma política y una excepción acotada.

El número es 0025: tras `git fetch`, el más alto de `adr/` en `origin/main`, en las ramas remotas y en esta rama es 0024 (`origin/claude/friendly-shannon-kg3rbc`).

No requieren ADR, por ser detalles de implementación:

- el módulo puro y su reconocimiento del bloque por su texto canónico (D1, D2);
- dónde se inserta y qué claves se podan (D3);
- el momento del ajuste (D4);
- la actualización de la firma de una revisión abierta (D6).

## In-Force ADRs Reviewed

- `adr/0006-agent-asymmetry-policy.md`: lo sustituye ADR-0025.
- `adr/0010-agent-instructions-through-session-bootstrap.md`: en vigor. La guidance de `config.yaml` es configuración de los workflows de OpenSpec, como las indicaciones de `archive` que ya tiene, y no una instrucción de sesión, así que no la contradice.
- `adr/0013-model-creates-change-branches-plugin-stages.md`: en vigor. El commit del ajuste lo hace el usuario.
- `adr/0014-autopilot-verifies-product-and-closes-reviews-with-git.md`: en vigor. El ajuste no cierra revisiones (D6).
- `adr/0011-opencode-plugins-release-what-they-register.md`: en vigor. El ajuste no registra nada que haya que liberar.
- `adr/0016-agent-merges-on-user-request.md` y `adr/0018-opencode-optional-instructions-own-plugin.md`: en vigor, sin relación directa.
- En vigor y sin relación: `adr/0002`, `adr/0003`, `adr/0004`, `adr/0005`, `adr/0009` y `adr/0012`.
- Sustituidos, solo como contexto histórico: `adr/0001` (por ADR-0002), `adr/0007` (por ADR-0013 y ADR-0015), `adr/0008` (por ADR-0014) y `adr/0015` (por ADR-0016).

## New Durable ADRs Created

- `adr/0025-asymmetry-policy-with-mode-managed-versioned-block.md`: sustituye a ADR-0006. Mantiene su política y añade la excepción de un bloque versionado, declarado y literal, que sigue al modo del plugin.
