# ADR Review Manifest

- Status: completed
- Review date: 2026-11-22

## Review Summary

ADR review completed for this change.

El design contiene una decisión duradera: cómo se soporta Windows en lo que no depende del núcleo del arranque. Solo con OpenCode 2, LF en todo el repositorio, un diagnóstico en PowerShell y `pwsh` como requisito de la suite (design D1, D2 y D4). Afecta a cualquier change futuro que toque Windows o la suite. No decide nada sobre el núcleo del arranque, que fija ADR-0023 en `windows-global-distro`, así que no se sustituye ningún ADR en vigor.

El resto del design no requiere ADR, porque son detalles de implementación: cómo ejecuta el autopilot el CLI de OpenSpec (D3) y cómo simula la suite Windows en Linux.

## In-Force ADRs Reviewed

- ADR-0002: Arranque de sesión con un núcleo neutral y un adaptador por agente (supersedes ADR-0001)
- ADR-0003: Una sola copia de las skills, vista por cada agente desde sus propias rutas
- ADR-0004: El conocimiento del proyecto vive en un wiki que el agente consulta primero
- ADR-0005: El motor del wiki y su guía llegan a cada agente por el arranque de sesión
- ADR-0006: Cuándo se acepta que una capacidad exista en un solo agente
- ADR-0009: Se consulta el wiki con su operación de lectura y lo comprobado se registra en un punto de cierre
- ADR-0010: Toda instrucción del proyecto al agente llega por el arranque de sesión y se desactiva en local
- ADR-0011: Los plugins de OpenCode del proyecto liberan al descargarse lo que registran
- ADR-0012: El lint de las specs usa gplint, con una configuración fijada común a los dos stacks
- ADR-0013: Un change, una rama temporal que puede crear el modelo, y commits solo del usuario
- ADR-0014: El autopilot decide por el producto y por git, con la lógica en el servidor y una sesión operativa por rama (supersedes ADR-0008)
- ADR-0015: Dos formas del ciclo de un change y commits del agente en contenedores efímeros (supersedes ADR-0007)
- ADR-0016 (en `origin/claude/epic-hawking-sawijv`) y ADR-0018, ADR-0023 y ADR-0024 (en `origin/claude/friendly-shannon-kg3rbc`, de `windows-global-distro`), que no están en la rama de origen: se han tenido en cuenta para numerar y, ADR-0023, para no decidir nada sobre el núcleo del arranque

## New Durable ADRs Created

- [ADR-0017](../../../../adr/0017-windows-support-opencode-lf-diagnostic.md): En Windows se soporta solo OpenCode 2, con LF en el repositorio y un diagnóstico en PowerShell
