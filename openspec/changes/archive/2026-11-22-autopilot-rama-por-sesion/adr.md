# ADR Review Manifest

- Status: completed
- Review date: 2026-11-22

## Review Summary

ADR review completed for this change.

El design contiene una decisión arquitectónica duradera que cambia una decisión en vigor: **ADR-0022** sustituye a **ADR-0014**. Cada sesión tiene su rama de trabajo, pasar a una sesión es pasar a su rama, el autopilot no actúa en las ramas permanentes, y los worktrees de OpenCode nacen en una rama con la estrategia del plugin (design D1 a D6 y D8). Repite lo que sigue valiendo de ADR-0014.

ADR-0022 restringe ADR-0013 dentro del autopilot, donde el modelo ya no crea ramas ni cambia de rama, pero no lo sustituye: fuera del autopilot y en Claude Code, ADR-0013 sigue en vigor.

El número 0022 es uno más que el más alto de `adr/` en la rama de trabajo, en `origin/main` y en todas las ramas remotas (`origin/claude/nifty-pascal-wkvbq0` tiene ADR-0021).

No requieren ADR, por ser detalles de implementación:

- el subcomando `origin` de `branch-change.mjs` (D7);
- la ubicación de cada llamada de la parte de TUI (D2);
- las ampliaciones del simulador de OpenCode (D9).

## In-Force ADRs Reviewed

- ADR-0006: política de asimetría entre agentes. Claude Code no tiene autopilot, y lo nuevo cumple sus condiciones.
- ADR-0011: los plugins de OpenCode liberan lo que registran. Aplica a la estrategia de worktree y a las llamadas por directorio de la parte de TUI.
- ADR-0013: un change, una rama temporal que puede crear el modelo. Sigue en vigor, restringido en el autopilot por ADR-0022.
- ADR-0014: el autopilot decide por el producto y por git, con una sesión operativa por rama. Sustituido por ADR-0022.
- ADR-0015: dos formas del ciclo y commits en contenedores efímeros. Sin cambios.
- ADR-0018 (en `origin/main`): una instrucción opcional tiene su propio plugin de OpenCode. Sin cambios.
- ADR-0001 a ADR-0005, ADR-0009, ADR-0010 y ADR-0012: no les afecta.

## New Durable ADRs Created

- [ADR-0022](../../../adr/0022-autopilot-session-owns-its-branch-and-worktrees.md): en el autopilot, cada sesión tiene su rama y los changes nuevos empiezan en un worktree o una rama temporal. Sustituye a ADR-0014.
