# ADR Review Manifest

- Status: completed
- Review date: 2026-11-22

## Review Summary

ADR review completed for this change.

El design contiene una decisión arquitectónica duradera: los plugins de OpenCode del proyecto devuelven desde `setup` una limpieza que libera lo que registran, con todas las suscripciones de una carga atadas a un `AbortSignal`, y la suite simula ese contrato (design D1, D3 y D4). Afecta a cualquier plugin o suscripción futura. Ningún ADR en vigor la recoge.

No se sustituye ningún ADR. ADR-0008 se matiza: una de las restricciones de su contexto ("cada recarga en caliente deja vivos los escuchadores RPC anteriores") era la consecuencia de que los plugins no liberaban sus suscripciones, pero su decisión sigue en vigor. Se cierra así la pregunta abierta del design: un ADR nuevo que lo cita, sin sustituirlo.

El resto del design no requiere ADR, porque son detalles de implementación:

- mantener D13 de `add-openspec-autopilot` como defensa (D2);
- cómo modela cada simulador la recarga, el cierre y el aviso sintético (D3).

## In-Force ADRs Reviewed

- ADR-0002: arranque de sesión con un núcleo neutral y un adaptador por agente. El adaptador de OpenCode sigue siendo un plugin sin dependencias; solo cambia su parte de TUI.
- ADR-0003: una sola copia de las skills. No se ve afectado.
- ADR-0004: el wiki del proyecto como conocimiento consultado primero. La corrección de la lección 5 y del artículo del autopilot va por la resincronización del archive.
- ADR-0005: el motor del wiki y su guía por el arranque de sesión. No se ve afectado.
- ADR-0006: política de asimetrías entre agentes. No cambia: nada de esto existe en Claude Code.
- ADR-0007: un change, una rama temporal y una sola fusión. Este change lo sigue.
- ADR-0008: el plugin `openspec-autopilot`. Se matiza la restricción de su contexto sobre los escuchadores y la consecuencia sobre lo que hay que volver a comprobar al subir de versión.
- ADR-0009: operaciones de lectura y escritura del wiki. No se ve afectado.

ADR-0001 no está en vigor: lo sustituye ADR-0002.

## New Durable ADRs Created

- [ADR-0010: Los plugins de OpenCode del proyecto liberan al descargarse lo que registran](../../../adr/0010-opencode-plugins-release-what-they-register.md)
