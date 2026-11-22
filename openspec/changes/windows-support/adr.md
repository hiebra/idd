# ADR Review Manifest

- Status: completed
- Review date: 2026-11-22

## Review Summary

ADR review completed for this change. The change keeps the agent-neutral bash bootstrap core of ADR-0002 and adds one durable decision: how Windows is supported. No in-force ADR is superseded.

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
- ADR-0016 (en `origin/claude/epic-hawking-sawijv`, no en la rama de origen): considerado solo para numerar

## New Durable ADRs Created

- [ADR-0017](../../../adr/0017-windows-support-opencode-git-bash.md): En Windows se soporta solo OpenCode 2, con Git Bash como shell del arranque y un diagnóstico en PowerShell
