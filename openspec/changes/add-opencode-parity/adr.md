# ADR Review Manifest

- Status: completed
- Review date: 2026-11-21

## Review Summary

ADR review completed for this change.

El design contiene dos decisiones arquitectónicas duraderas:

- **El arranque de sesión se divide en un núcleo neutral y un adaptador por agente soportado**, con avisos visibles en la interfaz de cada agente y verificación simulando a cada agente (design D1-D4, D6). Contradice la decisión en vigor de ADR-0001, así que se registra un ADR nuevo que la sustituye. ADR-0001 no se modifica.
- **Las skills tienen una sola copia, `.agents/skills/` para las del schema**, que cada agente ve desde sus propias rutas, sin copias por agente (design D5). No estaba recogida en ningún ADR.

El resto del design no requiere ADR, porque son detalles de implementación:

- la ubicación concreta y el contrato de entrada y salida del núcleo;
- el JSON de `systemMessage` construido en bash;
- el transporte de los avisos a la TUI de OpenCode (RPC o archivo);
- el `try/catch` del plugin;
- la forma de los contextos falsos de la suite;
- el contenido del README (D7).

## In-Force ADRs Reviewed

- `adr/0001-session-bootstrap-hook.md` - en vigor hasta este change; queda sustituido por ADR-0002.

## New Durable ADRs Created

- `adr/0002-agent-neutral-session-bootstrap.md` - arranque de sesión con un núcleo neutral y un adaptador por agente; sustituye a ADR-0001.
- `adr/0003-single-source-for-schema-skills.md` - una sola copia de las skills, vista por cada agente desde sus propias rutas.
