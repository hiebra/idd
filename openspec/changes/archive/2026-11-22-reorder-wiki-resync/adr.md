# ADR Review Manifest

- Status: completed
- Review date: 2026-11-22

## Review Summary

ADR review completed for this change. El change reordena los pasos de la resincronización del wiki al archivar y quita el librarian. Es una decisión de procedimiento que vive en `operations.archive.guidance` y en la spec `wiki-first-knowledge`; no introduce un compromiso arquitectónico nuevo. Cumple mejor ADR-0004 (resincronizar al archivar, en un commit aparte) y ADR-0009 (modificar el wiki solo con confirmación del usuario), sin cambiarlos.

## In-Force ADRs Reviewed

- ADR-0002: arranque de sesión con núcleo neutral (sustituye a ADR-0001). No aplica.
- ADR-0003: una sola copia de las skills. No aplica.
- ADR-0004: el conocimiento del proyecto vive en un wiki; se resincroniza al archivar cada change, con su propio commit. Se mantiene.
- ADR-0005: el motor del wiki llega por el arranque de sesión, con su versión fijada. Las operaciones nuevas existen en la versión fijada (1.0.0).
- ADR-0006: política de asimetrías entre agentes. No aplica: la guidance es la misma para los dos agentes.
- ADR-0009: consultar y modificar el wiki son operaciones distintas, y se modifica solo con confirmación. El change lleva todas las escrituras, salvo el manifiesto de fuentes, detrás de la confirmación.
- ADR-0010, ADR-0011, ADR-0012, ADR-0017, ADR-0018: no aplican.
- ADR-0014: el autopilot verifica el producto y cierra revisiones con git (sustituye a ADR-0008). Su paso del wiki remite a estas indicaciones y no cambia.
- ADR-0020: la regla de git-discipline y su excepción (sustituye a ADR-0013, ADR-0015 y ADR-0016). Dónde se archiva y la fusión del paso 8 no cambian.

ADR-0001, ADR-0007, ADR-0008, ADR-0013, ADR-0015 y ADR-0016 están sustituidos y solo se han leído como contexto histórico.

## New Durable ADRs Created

- None - no major durable architectural decisions were introduced.
