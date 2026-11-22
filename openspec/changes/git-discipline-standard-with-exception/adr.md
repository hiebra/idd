# ADR Review Manifest

- Status: completed
- Review date: 2026-11-22

## Review Summary

ADR review completed for this change. La numeración se hizo tras un `git fetch`: el número más alto en `origin/main` era 0018 y, en todas las ramas remotas, 0019 (`origin/claude/hopeful-sagan-eqxc31`), así que el ADR nuevo es el 0020.

## In-Force ADRs Reviewed

- ADR-0002: arranque de sesión neutral entre agentes.
- ADR-0003: una sola copia de las skills del schema.
- ADR-0004, ADR-0005, ADR-0009, ADR-0010: el wiki del proyecto, su motor y las instrucciones del agente a través del arranque.
- ADR-0006: política de asimetría entre agentes.
- ADR-0011, ADR-0012, ADR-0014: plugins de OpenCode, lint de las specs y el autopilot.
- ADR-0013: el modelo crea las ramas temporales y el autopilot pasa lo producido al stage. Lo sustituye ADR-0020.
- ADR-0015: dos formas del ciclo y commits del agente en contenedores efímeros. Lo sustituye ADR-0020.
- ADR-0018 (en `origin/main`): instrucciones opcionales de OpenCode en su propio plugin. No le afecta.

ADRs de ramas concurrentes que aún no han llegado a la rama de origen:
- ADR-0016 (`origin/claude/epic-hawking-sawijv`): el agente fusiona cuando lo pide el usuario. También sustituye a ADR-0015, así que, si se fusionan los dos, hay que reconciliar qué parte de ADR-0015 sustituye cada uno.
- ADR-0017 y ADR-0019: soporte de Windows y el agente de planificación del autopilot. No les afecta.

## New Durable ADRs Created

- [ADR-0020: La disciplina de git estándar como regla, con la forma de una rama como única excepción cuando el acceso directo a las ramas permanentes está vetado](../../../adr/0020-git-discipline-standard-rule-with-protected-main-exception.md). Sustituye a ADR-0013 y ADR-0015.
