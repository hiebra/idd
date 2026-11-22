# ADR Review Manifest

- Status: completed
- Review date: 2026-11-22

## Review Summary

ADR review completed for this change. El change fija el título de la fusión con una rama permanente, `Merge <change> into <destino>`, en la orden local de `check merge` y en el PR que recomienda en un contenedor efímero. Es una convención dentro de la puerta que ADR-0020 ya fija, y queda especificada en `openspec-change-lifecycle`. No cambia ninguna decisión en vigor ni introduce un compromiso arquitectónico nuevo: ningún ADR fijaba ese título, y cambiar su formato más adelante solo pediría una delta de la spec.

## In-Force ADRs Reviewed

- ADR-0002: arranque de sesión con un núcleo neutral y un adaptador por agente (sustituye a ADR-0001). No aplica: la rama de la sesión la sigue guardando el arranque.
- ADR-0003: una sola copia de las skills. Se cumple: la skill `openspec-git-discipline` se edita en `.agents/skills/`.
- ADR-0004: el conocimiento del proyecto vive en un wiki, que se resincroniza al archivar cada change. Se mantiene: al archivar, el registro del inventario `nombrar-el-change-en-el-titulo-de-la-fusion` queda completado.
- ADR-0005: el motor del wiki llega por el arranque de sesión. No aplica.
- ADR-0006: política de asimetrías entre agentes. El título lo compone el módulo neutral, igual para los dos agentes. Que la puerta dé una orden local o un PR depende del entorno, no del agente: no es una asimetría.
- ADR-0009: consultar y modificar el wiki son operaciones distintas. No aplica: el wiki solo se ha consultado.
- ADR-0010: las instrucciones del proyecto llegan por el arranque de sesión. No aplica: las reglas de git van en la skill.
- ADR-0011: los plugins de OpenCode liberan lo que registran. No aplica.
- ADR-0012: el lint de las specs con gplint. La delta spec del change lo pasa.
- ADR-0014: el autopilot decide por el producto y por git (sustituye a ADR-0008). No cambia: el autopilot no fusiona.
- ADR-0017: en Windows solo se soporta OpenCode 2, con LF en el repositorio. No aplica.
- ADR-0018: en OpenCode, una instrucción opcional tiene su propio plugin. No aplica.
- ADR-0020: la disciplina de git estándar como regla, con la forma de una rama como única excepción (sustituye a ADR-0013, ADR-0015 y ADR-0016). Conserva de ADR-0016 la puerta `check merge`: la fusión sin cambiar de rama fuera de un contenedor efímero y por PR dentro, que el usuario fusiona con un commit de fusión. El change no cambia nada de eso: añade el título de esa fusión.

ADR-0001, ADR-0007, ADR-0008, ADR-0013, ADR-0015 y ADR-0016 están sustituidos y solo se han leído como contexto histórico.

Tras `git fetch`, hay ADRs en ramas remotas que aún no han llegado a la rama de origen: 0019 y del 0021 al 0025. No están en vigor aquí, y ninguno trata el título de la fusión ni los PR.

## New Durable ADRs Created

- None - no major durable architectural decisions were introduced.
