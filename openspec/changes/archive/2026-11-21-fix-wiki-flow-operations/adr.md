# ADR Review Manifest

- Status: completed
- Review date: 2026-11-21

## Review Summary

ADR review completed for this change. El diseño precisa con qué operación del motor se consulta y se modifica el wiki y cuándo se registran las lecciones aprendidas. Es una decisión duradera que ADR-0004 no fija y que afecta a cambios futuros (la guía, el recordatorio y el plugin de autopilot). Se recoge en un ADR nuevo que complementa a ADR-0004 sin sustituirlo.

## In-Force ADRs Reviewed

- ADR-0002: arranque de sesión con un núcleo neutral y un adaptador por agente (sustituye a ADR-0001).
- ADR-0003: una sola copia de las skills.
- ADR-0004: el conocimiento del proyecto vive en un wiki que el agente consulta primero. Sigue en vigor y ADR-0009 lo precisa.
- ADR-0005: el motor del wiki y su guía llegan por el arranque de sesión. Se mantiene la guía con una sola fuente.
- ADR-0006: política de asimetrías entre agentes. No aplica: la consulta existe en los dos agentes y solo cambia cómo se invoca.
- ADR-0007: un change, una rama temporal y una sola fusión.
- ADR-0008: plugin de autopilot para OpenCode 2. Es coherente con él: sus lecciones candidatas en la metadata son la forma automatizada del mismo flujo.

ADR-0001 está sustituido por ADR-0002 y solo se ha leído como contexto histórico.

## New Durable ADRs Created

- [ADR-0009: Se consulta el wiki con su operación de lectura y lo comprobado se registra en un punto de cierre](../../../../adr/0009-wiki-read-and-write-operations.md)
