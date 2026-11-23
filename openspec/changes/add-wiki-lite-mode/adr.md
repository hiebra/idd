# ADR Review Manifest

- Status: completed
- Review date: 2026-11-22

## Review Summary

ADR review completed for this change. Una decisión duradera es nueva: el wiki habilitado tiene dos modos, y los declara el proyecto en `"mode"` de `engine.json`, con `/toggle-wiki lite|full` como forma de cambiarlo. Complementa a ADR-0021 sin sustituirlo, porque «wiki primero» sigue siendo el modo por defecto.

El número es 0029: se registró como 0028, pero al traer `origin/main` a la rama del change llegó otro ADR-0028 (`0028-autopilot-enters-protected-main-branches-with-dirty-tree.md`), y este se ha renumerado al siguiente libre. Antes, 0026 era el borrador anterior de este change, que no había llegado a ninguna otra rama y también se renumeró.

No requieren ADR, por ser detalles de implementación: la forma de las marcas de bloque (design D2), qué secciones de la guía van en cada bloque (D3), la acción `mode` del núcleo (D5) y cómo lo comprueba la suite (D8).

## In-Force ADRs Reviewed

- ADR-0021: el ajuste del wiki es del proyecto, versionado en `engine.json`; `/toggle-wiki` es la única forma de cambiarlo; sin preferencia local. Sustituye a ADR-0004, ADR-0005 y ADR-0010. Lo complementa ADR-0029.
- ADR-0009: consultar y modificar son operaciones distintas. Se mantiene en los dos modos.
- ADR-0002: núcleo neutral y adaptadores finos. La lógica nueva va en el núcleo y los adaptadores no cambian.
- ADR-0018: en OpenCode, el wiki sigue en `session-bootstrap`. No cambia.
- ADR-0020: ciclo del change y fusión con la rama de origen. Sin relación con el contenido, solo con cómo se fusiona este change.
- En vigor y sin relación: ADR-0003, ADR-0011, ADR-0012, ADR-0017, ADR-0019, ADR-0022 y ADR-0025.
- ADR-0023, ADR-0024 y ADR-0027 solo existen en otras ramas remotas: se han mirado para numerar y no acotan este change.
- Sustituidos, solo como contexto: ADR-0001, ADR-0004, ADR-0005, ADR-0006, ADR-0007, ADR-0008, ADR-0010, ADR-0013, ADR-0014, ADR-0015 y ADR-0016.

## New Durable ADRs Created

- [ADR-0029](../../../adr/0029-wiki-modes-declared-by-the-project.md): el wiki habilitado tiene dos modos, y los declara el proyecto.
