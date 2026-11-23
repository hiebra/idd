# ADR Review Manifest

- Status: completed
- Review date: 2026-11-22

## Review Summary

ADR review completed for this change.

El design contiene una decisión duradera: con `x-main-protected: true`, el plugin cambia a la rama de una sesión de `x-main` aunque haya cambios sin commit. Es una excepción a una regla de ADR-0022 (no cambiar de rama con cambios sin commit), no un cambio de su decisión: cada sesión sigue teniendo su rama. Por eso se registra en un ADR nuevo que no sustituye a ADR-0022, igual que ADR-0011 matizó ADR-0008.

## In-Force ADRs Reviewed

Se han revisado todos los ADR de `adr/` y el grafo de sustituciones. En vigor, los que importan aquí:

- ADR-0022: cada sesión tiene su rama y pasar a una sesión es pasar a su rama. Es el que se matiza.
- ADR-0020: `x-main-protected: true` declara el veto del acceso directo a las ramas permanentes, y fija las reglas del modelo. Sigue en vigor y no cambia.
- ADR-0011: la parte de TUI libera lo que registra. No aplica: el cambio no añade suscripciones.
- ADR-0006 (sustituido por ADR-0025) y ADR-0025: asimetría entre agentes. El cambio es solo de OpenCode, como el checkout al entrar en una sesión.

Sustituidos y sin efecto en este design: ADR-0001, ADR-0007, ADR-0008, ADR-0013, ADR-0014, ADR-0015 y ADR-0016.

## New Durable ADRs Created

- `adr/0028-autopilot-enters-protected-main-branches-with-dirty-tree.md`

El número es uno más que el más alto de `adr/` en las ramas remotas (0027, en una rama sin fusionar) y en la rama de trabajo.
