# ADR Review Manifest

- Status: completed
- Review date: 2026-11-21

## Review Summary

ADR review completed for this change. El diseño entrega una segunda instrucción al agente, la regla de comentarios, por el arranque de sesión y desactivable en local, igual que la guía del wiki. ADR-0005 tomó esa decisión solo para el wiki; generalizarla a cualquier instrucción del proyecto es una decisión duradera que afecta a cambios futuros. Se recoge en un ADR nuevo que extiende ADR-0005 sin sustituirlo.

## In-Force ADRs Reviewed

- ADR-0002: arranque de sesión con un núcleo neutral y un adaptador por agente (sustituye a ADR-0001). La detección de los mensajes que activan la regla va en el núcleo.
- ADR-0003: una sola copia de las skills. No aplica.
- ADR-0004: el conocimiento del proyecto vive en un wiki que el agente consulta primero. No aplica.
- ADR-0005: el motor del wiki y su guía llegan por el arranque de sesión. Sigue en vigor; ADR-0010 extiende su decisión a toda instrucción del proyecto.
- ADR-0006: política de asimetrías entre agentes. No aplica: la regla existe igual en los dos agentes.
- ADR-0007: un change, una rama temporal y una sola fusión. No aplica.
- ADR-0008: plugin de autopilot para OpenCode 2. No aplica.
- ADR-0009: operaciones de lectura y escritura del wiki. No aplica.

ADR-0001 está sustituido por ADR-0002 y solo se ha leído como contexto histórico.

## New Durable ADRs Created

- [ADR-0010: Toda instrucción del proyecto al agente llega por el arranque de sesión y se desactiva en local](../../../../adr/0010-agent-instructions-through-session-bootstrap.md)
