# ADR Review Manifest

- Status: completed
- Review date: 2026-11-22

## Review Summary

ADR review completed for this change.

El design contiene una decisión arquitectónica duradera que no recoge ningún ADR en vigor: la depuración en la verificación se apoya en un servidor MCP externo que solo informa, con un contrato que fija la plantilla, y cuya respuesta es un plan que separa los pasos del modelo de los de la persona (design D5, D6 y D8). Se recoge en **ADR-0027**. No sustituye a ningún ADR: la orden de terminal de `guiar-revision-con-tests` sigue siendo la alternativa cuando no hay servidor, y estaba solo en su design.

Número: tras `git fetch`, el más alto de `adr/` en `origin/main` y en la rama de trabajo es el 0025, y la rama `origin/claude/exciting-shannon-bgr8tv` (`add-wiki-lite-mode`) ya usa el 0026, así que el nuevo es el 0027.

No requieren ADR:

- el límite de verificación por task (D1 a D4): es una regla de `rules.tasks` que cada proyecto cambia, y textos de la instrucción de la revisión;
- los nombres de las tools, la forma de sus esquemas, los códigos de error y los ejemplos (D7, D10 y D12): los fija la spec `debug-mcp-contract` y se cambian versionando el contrato;
- el texto de la instrucción (D13), la validación con `ajv` en la suite (D14) y el README (D15).

## In-Force ADRs Reviewed

- ADR-0002, ADR-0003, ADR-0004, ADR-0005, ADR-0009, ADR-0011, ADR-0012, ADR-0017, ADR-0018 y ADR-0020: sin relación con la revisión ni con la depuración. El wiki se ha consultado y ampliado como piden ADR-0004 y ADR-0009.
- ADR-0010: la plantilla no tiene instrucciones que un agente cargue siempre. Se respeta: el uso del servidor va en la instrucción de la revisión, y el contrato no es una instrucción.
- ADR-0014: el plugin no tiene dependencias, y la revisión la cierra git. Se respeta: solo cambian textos de `prompts.mjs`, y el contrato exige que seguir un plan no deje archivos que git no ignore.
- ADR-0019: las revisiones nacen con el agente `build`. No cambia.
- ADR-0025: cuándo se acepta una capacidad en un solo agente. Lo nuevo de la revisión solo existe en el plugin de OpenCode, como el resto de la revisión guiada; el límite y el contrato son neutrales, y nada versionado depende de que haya un servidor.

## New Durable ADRs Created

- `adr/0027-debugging-through-an-information-only-mcp-contract.md`
