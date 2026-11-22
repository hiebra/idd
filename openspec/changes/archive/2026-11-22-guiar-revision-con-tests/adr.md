# ADR Review Manifest

- Status: completed
- Review date: 2026-11-22

## Review Summary

ADR review completed for this change.

No major durable architectural decisions were introduced, and no new repository-level ADR files were created. El change amplía el texto de la instrucción de dos tipos de revisión (design D1 a D3); no cambia ni la arquitectura del plugin, ni quién cierra la revisión, ni el agente que la hace.

## In-Force ADRs Reviewed

- ADR-0006: política de asimetrías entre agentes. No cambia: el plugin no existe en Claude Code.
- ADR-0011: los plugins de OpenCode liberan lo que registran. No se ve afectado.
- ADR-0013: el modelo crea las ramas temporales y el plugin pasa lo producido al stage. La revisión sigue sin pedir commits ni tocar el stage.
- ADR-0014: el autopilot verifica el producto y cierra las revisiones con git. Se mantiene; D3 recoge que las ejecuciones no deben dejar archivos no ignorados que alteren ese cierre.
- ADR-0016 y ADR-0018: no se ven afectados.

## New Durable ADRs Created

Ninguno.
