# ADR Review Manifest

- Status: completed
- Review date: 2026-11-22

## Review Summary

ADR review completed for this change.

El design contiene una decisión duradera: la herramienta del lint de las specs pasa a ser `gplint`, con una configuración fijada común a los dos stacks de la skill `acceptance-test-authoring`, y la suite comprueba lo que garantiza el lint (design D1, D2 y D4). Afecta a cualquier change futuro que escriba specs y a cualquier proyecto que monte la suite con la skill. Ningún ADR en vigor trata la herramienta del lint, así que no se sustituye ninguno.

El resto del design no requiere ADR, porque son detalles de implementación:

- el rango de versión en `package.json` y la mayor en `npx` (D3);
- cómo ejecuta el World los dos comandos del script sobre otros directorios (D4).

## In-Force ADRs Reviewed

- ADR-0002: arranque de sesión con un núcleo neutral y un adaptador por agente. Instala las dependencias de `acceptance-tests/`; no cambia.
- ADR-0003: una sola copia de las skills. Los cambios van en `.agents/skills/`, que ven los dos agentes.
- ADR-0004: el wiki del proyecto como conocimiento consultado primero. El artículo de la suite se actualiza en la resincronización del archive.
- ADR-0005: el motor del wiki y su guía por el arranque de sesión. No se ve afectado.
- ADR-0006: política de asimetrías entre agentes. No hay asimetría: el lint es el mismo para los dos.
- ADR-0007: un change, una rama temporal y una sola fusión. Este change lo sigue.
- ADR-0008: el plugin `openspec-autopilot`. No se ve afectado.
- ADR-0009: operaciones de lectura y escritura del wiki. No se ve afectado.
- ADR-0010: instrucciones al agente por el arranque de sesión. No se ve afectado.
- ADR-0011: los plugins de OpenCode liberan lo que registran. No se ve afectado.

ADR-0001 no está en vigor: lo sustituye ADR-0002.

## New Durable ADRs Created

- [ADR-0012](../../../../adr/0012-spec-lint-with-gplint.md): el lint de las specs usa `gplint`, con una configuración fijada común a los dos stacks.
