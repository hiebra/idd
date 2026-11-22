## Context

`operations.archive.guidance` de `openspec/config.yaml` resincroniza el wiki tras el commit del archivado en siete pasos, que fijó `add-llm-wiki-support` (su design D6): fijar fuentes, refrescar y compilar, librarian, lecciones en dry-run, confirmar, lint y commit. Un octavo paso, de `allow-user-requested-merges`, propone las fusiones con `x-main`.

Al leer el motor fijado (nvk/llm-wiki 1.0.0, `.agents/wiki-engine/claude-plugin/`) y el historial de `.wiki/log.md` se ve que:

- `librarian scan` solo ejecuta los pases `staleness` y `quality` (fechas, integridad de `sources:`, tamaño y See Also) y escribe `.librarian/REPORT.md`, `.librarian/scan-results.json`, `.librarian/log.md` y `log.md`. No compara el contenido con las fuentes. La revisión de contenido que dio resultado en `windows-support` la añadió el agente por su cuenta.
- `refresh` es el que compara un artículo con sus fuentes y clasifica cada una (`unchanged`, `updated`, `contradicted`, `unreachable`), y evalúa antes de escribir (`references/refresh.md`).
- `ll` deja las lecciones que no encajan en ningún artículo «para el siguiente `/wiki:compile`», y el único compile de la secuencia va antes de `ll`. En `add-quote-comment-rule`, `manage-git-discipline` y `windows-support` se hizo un segundo compile no previsto.
- `lint --fix` cubre una fuente sin artículo creando `wiki/references/uncompiled-source-coverage.md`, y el lint pasa (comprobado en una copia de `.wiki/`; lección en `.wiki/raw/notes/2026-11-22-ll-lint-fix-y-librarian-1-0-0.md`).
- `ingest-collection` y `compile` solo recomiendan cambios en el inventario; nada los aplica.

En vigor: ADR-0004 (el wiki se resincroniza al archivar, en su propio commit) y ADR-0009 (el wiki solo se modifica con su operación de escritura y con la confirmación del usuario). Este change los cumple mejor y no los cambia.

## Goals / Non-Goals

**Goals:**
- Que nada se escriba en el wiki, salvo el manifiesto de fuentes, antes de que el usuario confirme.
- Que las lecciones confirmadas lleguen a un artículo dentro de la misma resincronización.
- Quitar de la secuencia la operación que no hace lo que se le pide.
- Que el inventario se actualice con lo que el change completa.

**Non-Goals:**
- Cambiar el motor o sus operaciones.
- Cambiar los pasos de la guidance que no son del wiki (dónde se archiva, qué rutas tocó el change, la fusión).
- Cambiar el plugin `openspec-autopilot`: su paso `wiki` remite a estas indicaciones y les pasa las lecciones candidatas, sin repetir los pasos.

## Decisions

### D1. Tres fases: evaluar sin escribir, presentar, escribir lo confirmado

La guidance queda así (los textos exactos se ajustan al implementar):

1. Fijar las fuentes en el commit del archivado: `/wiki:ingest-collection . --adapter git --manifest-only --revision <commit> --include <rutas> --local`. Sin cambios. Escribe antes de la confirmación porque el manifiesto es procedencia inmutable, no conocimiento, y lo necesita el refresh.
2. Evaluar sin escribir los artículos que citan rutas que tocó el change: `/wiki:refresh <artículo> --local` hasta su informe de decisiones, que dice qué fuente cambió o quedó contradicha.
3. Extraer las lecciones aprendidas sin escribir: `/wiki:ll --local --dry-run`, partiendo de las lecciones candidatas que haya recibido la sesión de las sesiones del change y, si no hay, de la sesión en curso (como ahora).
4. Revisar sin escribir los registros del inventario que el change completa o deja obsoletos: `/wiki:inventory list --local`.
5. Presentarlo todo al usuario y escribir solo lo que confirme, en este orden: las decisiones del refresh, las lecciones (`/wiki:ll --local`), el compile de las fuentes nuevas, incluidas las notas de lecciones (`/wiki:compile --local`), y el inventario (`/wiki:inventory update <registro> --local`).
6. `/wiki:lint --local`, y con `--fix`, hasta que no dé errores. Si `--fix` crea `wiki/references/uncompiled-source-coverage.md`, falta compilar algo: se vuelve al compile del paso 5.
7. El commit del wiki, aparte y después del commit del archivado.
8. La propuesta de fusión, sin cambios.

Cada evaluación va en su propia entrada porque el escenario comprueba el orden por entradas. El paso de la fusión sigue siendo el 8, que es como lo busca `change-lifecycle.steps.js` (`/^8\./`).

**Alternativas:**
- *Mantener el compile en el paso 2 y añadir otro tras las lecciones.* Deja dos compiles y uno escribe antes de la confirmación.
- *Juntar las tres evaluaciones en una entrada.* Más corto, pero el escenario no podría comprobar su orden ni su presencia por separado.

### D2. Sin librarian

Se quita `/wiki:librarian scan`. Lo contradicho lo detecta el refresh del paso 2, y la frescura por fechas ya la comprueba el lint del paso 6 (avisa de un artículo sin `verified` o verificado hace demasiado). El escenario lo exige con un paso nuevo: la guidance no nombra `/wiki:librarian`.

**Alternativa:** *conservarlo como puntuación de salud.* No aporta en un wiki pequeño y recién verificado (seis scans sin hallazgos) y escribe tres archivos en cada archivado. Se puede pasar a mano cuando se quiera.

### D3. La suite

En `acceptance-tests/step-definitions/wiki.steps.js`:

- `RESYNC_STEPS` asocia cada fila nueva de la tabla a su operación: `/wiki:refresh` para el refresco sin escribir, `/wiki:ll … --dry-run`, `/wiki:inventory list` y, para la escritura confirmada, una expresión que exige la confirmación seguida de `/wiki:refresh`, `/wiki:ll`, `/wiki:compile` y `/wiki:inventory update`, en ese orden.
- El paso `no incluyen la revisión con el librarian` comprueba que ninguna entrada de la guidance contiene `/wiki:librarian`.

El motor falso (`COMMANDS` en `acceptance-tests/support/engine.js`) cambia `librarian` por `inventory`, y el README nombra las operaciones nuevas en la lista que se revisa al cambiar de versión del motor.

## Risks / Trade-offs

- [El refresh «sin escribir» depende de que el agente pare en el informe de decisiones] → El protocolo del motor ya es «assessment first, write second»; la guidance lo dice explícitamente.
- [Se pierde la puntuación del librarian] → El lint cubre la frescura por `verified`; el librarian sigue disponible a mano.
- [Un change concurrente que toque la misma guidance] → `allow-user-requested-merges` ya añadió el paso 8; el texto nuevo respeta su número. Si otro change la toca, conflicto de git en `config.yaml`, que se resuelve al traer la rama de origen.
- [Esta rama de sesión no tiene el último `main`] → `main` tiene `guiar-revision-con-tests`, que no toca `config.yaml` ni `wiki-first-knowledge`. Se trae antes del apply o del PR, cuando el usuario lo pida.

## Migration Plan

La guidance se lee en cada archive, así que el cambio vale desde el primer archive tras fusionarlo. El archive de este mismo change ya sigue la secuencia nueva. Rollback: revertir el commit de `config.yaml` y el de la suite.

## Open Questions

Ninguna.
