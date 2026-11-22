# ADR Review Manifest

- Status: completed
- Review date: 2026-11-22

## Review Summary

ADR review completed for this change. Una decisión duradera es nueva: el wiki tiene dos modos y cada usuario elige el suyo en local con `PROJECT_WIKI`. Complementa a ADR-0004 sin sustituirlo, porque «wiki primero» sigue siendo el modo por defecto.

El número es 0026: tras `git fetch`, el más alto de `adr/` en `origin/main`, en las ramas remotas y en esta rama es 0025.

No requieren ADR, por ser detalles de implementación: la forma de las marcas de bloque (design D2), qué secciones de la guía van en cada bloque (D3) y cómo lo comprueba la suite (D6).

## In-Force ADRs Reviewed

- ADR-0004: wiki primero. Lo complementa ADR-0026.
- ADR-0005: el motor, la guía y el recordatorio llegan por el arranque, con `PROJECT_WIKI=off`. Se mantiene: la misma variable elige el modo.
- ADR-0009: consultar y modificar son operaciones distintas. Se mantiene en los dos modos.
- ADR-0010: toda instrucción llega por el arranque y se desactiva en local. Se mantiene.
- ADR-0002: núcleo neutral y adaptadores finos. La lógica nueva va en el núcleo y los adaptadores no cambian.
- ADR-0018: en OpenCode, el wiki sigue en `session-bootstrap`. No cambia.
- En vigor y sin relación: ADR-0003, ADR-0011, ADR-0012, ADR-0014, ADR-0016, ADR-0017, ADR-0020 y ADR-0025.
- ADR-0021 a ADR-0024 solo existen en otras ramas remotas: se han mirado para numerar y no acotan este change.
- Sustituidos, solo como contexto: ADR-0001, ADR-0006, ADR-0007, ADR-0008, ADR-0013 y ADR-0015.

## New Durable ADRs Created

- [ADR-0026](../../../adr/0026-wiki-modes-chosen-by-the-user.md): el wiki tiene dos modos, y cada usuario elige el suyo en local.
