# ADR Review Manifest

- Status: completed
- Review date: 2026-11-22

## Review Summary

ADR review completed for this change.

El design contiene dos decisiones arquitectónicas duraderas que cambian decisiones en vigor, no solo una premisa de su contexto. Por eso cada una se recoge en un ADR nuevo que sustituye al anterior y repite lo que sigue valiendo:

- **ADR-0012** sustituye a **ADR-0007**. El modelo puede crear la rama temporal del change, siempre desde la rama de origen y con el nombre del change, y cambiar entre ramas temporales con `branch-change.mjs`. En el autopilot, el plugin pasa el producto al stage y el modelo no pide commits. El commit y la fusión siguen siendo del usuario (design D6, D7 y D12).
- **ADR-0013** sustituye a **ADR-0008**. El producto evaluable decide si un paso ha terminado, el cierre de las revisiones lo decide git, hay una sesión operativa por rama, y la lógica vive en el servidor, separada de la interfaz de cada cliente, con la degradación sin TUI (design D1 a D5, D7 a D10 y D13).

ADR-0011 sigue en vigor y aplica a lo nuevo de la parte de TUI: el temporizador de la ruta y la escucha del foco se liberan en la limpieza de `setup`.

No requieren ADR, por ser detalles de implementación:

- el reintento silencioso de `hello` ante `rpc.unavailable` (D14);
- la identificación de las tasks con el CLI (D11);
- el formato de la metadata;
- las ampliaciones del simulador (D15).

## ADRs creados

- `adr/0012-model-creates-change-branches-plugin-stages.md`
- `adr/0013-autopilot-verifies-product-and-closes-reviews-with-git.md`

## In-Force ADRs Reviewed

- ADR-0002: arranque de sesión neutral con un adaptador por agente. No cambia; su adaptador de OpenCode recibe el mismo reintento de la RPC al arrancar (D14).
- ADR-0003: una sola copia de las skills. `openspec-git-discipline` se actualiza en su única copia.
- ADR-0004: el wiki como conocimiento consultado primero. La resincronización tras el archive sigue igual, con su commit aparte.
- ADR-0005: el motor del wiki por el arranque de sesión. No se ve afectado.
- ADR-0006: política de asimetrías. Se mantiene: en Claude Code no hay plugin; el modelo crea ramas con el mismo módulo neutral, y los workflows piden el commit.
- ADR-0007: sustituido por ADR-0012.
- ADR-0008: sustituido por ADR-0013.
- ADR-0009: operaciones de lectura y escritura del wiki. No se ve afectado.
- ADR-0010: instrucciones del agente por el arranque de sesión. No se ve afectado.
- ADR-0011: la limpieza de `setup`. Sigue en vigor y cubre lo nuevo de la parte de TUI.

ADR-0001 no está en vigor: lo sustituye ADR-0002.
