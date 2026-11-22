# ADR Review Manifest

- Status: completed
- Review date: 2026-11-22

## Review Summary

ADR review completed for this change.

El design contiene una decisión arquitectónica duradera que no recoge ningún ADR en vigor: en el autopilot, todas las sesiones nacen en build, el agente plan de la sesión operativa significa explorar, y lo que se modifica con él se avisa antes de seguir (design D1, D2, D4 y D5). Se recoge en **ADR-0019**. No sustituye a ningún ADR: ADR-0014 deja el agente de cada paso a elección del plugin, y las decisiones que cambia (la revisión con el agente plan y no tratar de forma especial el agente plan ni `openspec-explore`) estaban solo en el design y la proposal de `add-openspec-autopilot`.

Número: el más alto de `adr/` en la rama de trabajo, en `origin/main` y en todas las ramas remotas tras `git fetch` era el 0018 (en ramas concurrentes), así que el nuevo es el 0019.

No requieren ADR, por ser detalles de implementación:

- los textos de exploración, de los recordatorios y del aviso (D3);
- el formato de la metadata (`agentTurn`, `planTurn`, `planNotice`) y la fase `plan-notice`;
- la operación `notice` del RPC y sus reintentos (D5);
- las ampliaciones del simulador (D6).

## In-Force ADRs Reviewed

- ADR-0001, ADR-0002, ADR-0003, ADR-0004, ADR-0005, ADR-0009, ADR-0010 y ADR-0012: sin relación con el autopilot.
- ADR-0006: la asimetría entre agentes; lo nuevo solo existe en OpenCode y en Claude Code no queda nada.
- ADR-0011: la parte de TUI libera lo que registra; aplica a la operación `notice`.
- ADR-0013: el plugin pasa al stage y el usuario hace el commit; el aviso no cambia quién hace los commits.
- ADR-0014: producto, cierre de las revisiones por git, lógica en el servidor y degradación sin TUI; el aviso sigue esas reglas.
- ADR-0015: el ciclo git del change; no cambia.

## New Durable ADRs Created

- `adr/0019-autopilot-plan-agent-explores-and-warns.md`
