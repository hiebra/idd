# ADR Review Manifest

- Status: completed
- Review date: 2026-11-23

## Review Summary

ADR review completed for this change. El change fija cuántas veces se lanza la suite de aceptación completa (una, en la task de cierre y con la rama de origen traída) y qué se comprueba tras traer una rama permanente (`lint:specs`, `test:core` y los escenarios cambiados, con `--name`). Son acuerdos de trabajo escritos en `openspec/config.yaml`, en la plantilla de tasks de `spec-as-source` y en la skill `openspec-git-discipline`, y quedan especificados en `suite-run-policy` y `openspec-change-lifecycle`. No es un compromiso arquitectónico duradero: no fija una tecnología, un límite ni un contrato, no añade código ni puertas, y cambiarlo más adelante solo pide editar un texto y sus escenarios.

## In-Force ADRs Reviewed

Los ADRs en vigor, tras recorrer los `Supersedes` de `adr/`:

- ADR-0002: arranque de sesión con un núcleo neutral y un adaptador por agente. No aplica.
- ADR-0003: una sola copia de las skills. Se cumple: las skills se editan en `.agents/skills/`.
- ADR-0009: consultar y modificar el wiki son operaciones distintas. No aplica.
- ADR-0011: los plugins de OpenCode liberan lo que registran. No aplica: el change no toca el plugin.
- ADR-0012: el lint de las specs con gplint. Las deltas del change lo pasan.
- ADR-0017: en Windows solo se soporta OpenCode 2. No aplica.
- ADR-0018: en OpenCode, una instrucción opcional tiene su propio plugin. No aplica.
- ADR-0019: el agente plan explora y avisa. No aplica.
- ADR-0020: la disciplina de git estándar como regla, con una única excepción, y las fusiones de ADR-0016 (la puerta `check merge`). Se cumple: las comprobaciones tras traer una rama permanente se añaden antes del ok del usuario y no cambian quién fusiona ni cómo.
- ADR-0021: el wiki del proyecto, deshabilitado por defecto. No aplica: el wiki se resincroniza igual al archivar.
- ADR-0022: cada sesión del autopilot tiene su rama de trabajo. No aplica.
- ADR-0025: política de asimetría con un bloque versionado gestionado por el modo. Se respeta: el change no toca `operations.apply.guidance` y por eso la regla va en `rules.tasks` (decisión D1 del design).

Sustituidos y leídos solo como contexto histórico: ADR-0001, ADR-0004, ADR-0005, ADR-0006, ADR-0007, ADR-0008, ADR-0010, ADR-0013, ADR-0014, ADR-0015 y ADR-0016. ADR-0016 conserva su efecto a través de ADR-0020: el agente solo fusiona cuando el usuario se lo pide, y el change solo le hace proponer traer `main`.

Tras `git fetch`, hay ADRs en ramas remotas que aún no han llegado a la rama de origen (0023 0024 0025 0027 0028 ). No están en vigor aquí y este change no crea ninguno, así que no hay número que reservar.

## New Durable ADRs Created

- None - no major durable architectural decisions were introduced.
