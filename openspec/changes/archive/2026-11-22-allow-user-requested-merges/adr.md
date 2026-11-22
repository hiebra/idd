# ADR Review Manifest

- Status: completed
- Review date: 2026-11-22

## Review Summary

ADR review completed for this change. El design cambia una regla de la Decision de ADR-0015: el agente pasa de no fusionar nunca a fusionar cuando el usuario se lo pide, con su ok a la resolución de conflictos, con la puerta `check merge` y por PR hacia una rama permanente en un contenedor efímero. Como los ADRs aceptados no se editan, se recoge en un ADR nuevo que sustituye a ADR-0015, conserva lo que sigue vigente de él y mantiene su relación con ADR-0013.

Numeración, con `rules.adr`: tras `git fetch`, el número más alto de `adr/` en `origin/main`, en todas las ramas `origin/*` y en la rama de trabajo era 0015, así que el ADR nuevo es el 0016.

## In-Force ADRs Reviewed

- ADR-0002: arranque de sesión con un núcleo neutral y un adaptador por agente. No cambia: la rama de la sesión la sigue guardando el arranque.
- ADR-0003: una sola copia de las skills. La skill `openspec-git-discipline` sigue en `.agents/skills/`.
- ADR-0004: el wiki del proyecto, que se consulta primero. Se mantiene el commit del wiki aparte y después del commit del archive, y la propuesta de fusión va después de los dos.
- ADR-0005: el motor del wiki llega por el arranque de sesión. No se toca el motor.
- ADR-0006: política de asimetrías entre agentes. `check merge`, `merge-targets` y el rechazo de `start` y `switch` van en el módulo neutral y dependen del entorno, no del agente: no son una asimetría. El autopilot de OpenCode no fusiona.
- ADR-0009: operaciones de lectura y escritura del wiki. No aplica.
- ADR-0010: las instrucciones del proyecto llegan por el arranque de sesión. No aplica: las reglas de git van en la skill y en `openspec/config.yaml`.
- ADR-0011: los plugins de OpenCode liberan lo que registran. No aplica.
- ADR-0012: el lint de las specs con gplint. La delta spec del change lo pasa.
- ADR-0013: el modelo crea las ramas temporales con `start` y `switch`, y el autopilot pasa lo producido al stage. Sigue en vigor; el código pasa a rechazar `start` y `switch` en un contenedor efímero, como ya pedía ADR-0015.
- ADR-0014: el autopilot decide por el producto y por git. No cambia.
- ADR-0015: dos formas del ciclo y commits del agente en contenedores efímeros. Sustituido por ADR-0016.

ADR-0001 (sustituido por ADR-0002), ADR-0007 (por ADR-0013 y ADR-0015) y ADR-0008 (por ADR-0014) solo se han leído como contexto histórico.

## New Durable ADRs Created

- [ADR-0016: El agente fusiona cuando lo pide el usuario, con su ok a la resolución y por PR hacia una rama permanente en la nube](../../../adr/0016-agent-merges-on-user-request.md), que sustituye a ADR-0015.
