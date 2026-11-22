# ADR Review Manifest

- Status: completed
- Review date: 2026-11-22

## Review Summary

ADR review completed for this change. El change cambia el estado por defecto del wiki del proyecto y sustituye su apagado en local por un ajuste versionado que vale para todo el proyecto. Contradice ADR-0004 (el wiki viene encendido), ADR-0005 (`PROJECT_WIKI=off`) y ADR-0010 (cada instrucción se apaga en local con su propia variable). Se recoge en un ADR nuevo que sustituye a los tres y repite lo que sigue vigente de cada uno.

## In-Force ADRs Reviewed

Revisados en `adr/` de la rama de trabajo y de todas las ramas remotas (`origin/*`):

- ADR-0002: núcleo neutral del arranque y un adaptador por agente (sustituye a ADR-0001). El modo `wiki` de `/toggle-wiki` va en el núcleo.
- ADR-0003: una sola copia de las skills del schema.
- ADR-0004: el conocimiento del proyecto vive en un wiki que el agente consulta primero. Lo sustituye ADR-0021.
- ADR-0005: el motor del wiki y su guía llegan por el arranque, con el apagado en local. Lo sustituye ADR-0021.
- ADR-0006: política de asimetrías entre agentes. `/toggle-wiki` existe igual en los dos agentes.
- ADR-0009: operaciones de lectura y escritura del wiki.
- ADR-0010: toda instrucción llega por el arranque, con su propio apagado en local. Lo sustituye ADR-0021, que mantiene ese apagado para las instrucciones que no son del proyecto.
- ADR-0011: los plugins de OpenCode liberan lo que registran.
- ADR-0012: lint de specs con gplint.
- ADR-0014: el autopilot verifica el producto y cierra las revisiones con git (sustituye a ADR-0008).
- ADR-0016 (rama concurrente): el agente fusiona cuando lo pide el usuario (sustituye a ADR-0015).
- ADR-0017 (rama concurrente): en Windows, OpenCode con Git Bash para el núcleo. El modo `wiki` se ejecuta con el mismo núcleo.
- ADR-0018 (rama concurrente): en OpenCode, una instrucción opcional tiene su propio plugin, y `session-bootstrap` sigue entregando la guía y el recordatorio del wiki.
- ADR-0019 (rama concurrente): en el autopilot, el agente plan explora y avisa.
- ADR-0020 (rama concurrente): la disciplina de git estándar como regla (sustituye a ADR-0013 y ADR-0015). Los commits del wiki siguen yendo aparte y después del archive.

## New Durable ADRs Created

- [ADR-0021: El wiki del proyecto viene deshabilitado y se enciende para todo el proyecto con un ajuste versionado](../../../adr/0021-project-wiki-disabled-by-default-with-project-switch.md). Sustituye a ADR-0004, ADR-0005 y ADR-0010.
