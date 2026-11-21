# ADR Review Manifest

- Status: completed
- Review date: 2026-11-21

## Review Summary

ADR review completed for this change.

El design contiene tres decisiones arquitectónicas duraderas, ninguna recogida en un ADR en vigor:

- **Cuándo se acepta que una capacidad exista en un solo agente**: una política general, de la que el plugin es el primer caso (design D17, y D1 para separar lo común al ciclo).
- **El ciclo de un change en una rama temporal y una sola fusión**, con el archive en la rama: ramas permanentes en `x-main`, el change de la rama leído de git por un módulo neutral, los commits a cargo del usuario y las puertas heredadas de `openspec-git-discipline` reescritas (design D1, D2).
- **El plugin de OpenCode 2 que encadena una sesión por paso**: el estado solo en la metadata de las sesiones, el cierre de cada paso con una tool y la confirmación del usuario en la TUI, y los modos normal y auto (design D3 a D15).

No se sustituye ningún ADR:

- ADR-0002 trata del arranque de sesión, y el plugin no es un adaptador del arranque.
- ADR-0003 se respeta: `openspec-git-discipline` se cambia en su única copia.
- ADR-0004 se mantiene: la resincronización del wiki sigue en un commit posterior al del archivado, y las lecciones se registran con la confirmación del usuario.

Las puertas que se sustituyen venían de una skill heredada, no de un ADR.

El resto del design no requiere ADR, porque son detalles de implementación:

- el formato de la clave `openspec` de la metadata (D4);
- la tabla de decisiones al abrir una sesión (D5);
- la elección de workflow y agente por paso (D6);
- el protocolo RPC con generaciones e identificadores (D13);
- el lector mínimo de `x-main` (D1);
- la forma de la simulación en la suite (D16).

## In-Force ADRs Reviewed

- `adr/0002-agent-neutral-session-bootstrap.md` - en vigor (sustituye a ADR-0001). El plugin sigue su patrón de plugin local sin dependencias, pero no es un adaptador del arranque.
- `adr/0003-single-source-for-schema-skills.md` - en vigor. La skill `openspec-git-discipline` se reescribe en su única copia, sin copias por agente.
- `adr/0004-wiki-first-project-knowledge.md` - en vigor. La resincronización del wiki al archivar se mantiene, ahora en la rama temporal, y las lecciones candidatas se registran solo con la confirmación del usuario.
- `adr/0005-wiki-engine-through-session-bootstrap.md` - en vigor. No le afecta: el plugin no entrega la guía ni el recordatorio del wiki.
- `adr/0001-session-bootstrap-hook.md` - sustituido por ADR-0002; solo contexto histórico.

## New Durable ADRs Created

- `adr/0006-agent-asymmetry-policy.md` - cuándo se acepta que una capacidad exista en un solo agente.
- `adr/0007-single-branch-change-lifecycle.md` - un change, una rama temporal y una sola fusión, con el archive en la rama.
- `adr/0008-openspec-autopilot-plugin.md` - el ciclo de un change se automatiza en OpenCode 2 con un plugin que encadena una sesión por paso.
