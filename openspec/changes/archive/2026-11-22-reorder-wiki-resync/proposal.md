## Why

La resincronización del wiki que hacen las indicaciones de archivado (`operations.archive.guidance` en `openspec/config.yaml`) tiene tres fallos, comprobados con el motor fijado (nvk/llm-wiki 1.0.0) y con el historial de `.wiki/log.md`:

- **El librarian no hace lo que el paso le pide.** El paso 3 le encarga revisar «sin modificar nada» lo que quedó obsoleto o contradicho, pero `librarian scan` solo puntúa antigüedad y forma, y escribe en `.wiki/.librarian/` y `log.md`. En los seis archivados que lo usaron dio 0 obsoletos; lo contradicho por una fuente nueva lo clasifica `/wiki:refresh`.
- **El compile va antes de las lecciones.** El paso 2 compila antes de que existan las lecciones de los pasos 4 y 5, así que en tres archivados se hizo un segundo compile que las indicaciones no nombran. Si nadie lo hace, el `lint --fix` del paso 6 aparca la nota en una página de pendientes y el lint pasa sin que la lección llegue a ningún artículo. Además, el compile escribe antes de la única confirmación del usuario.
- **Nadie actualiza el inventario.** `ingest-collection` y `compile` solo recomiendan cambios en los registros de `.wiki/inventory/`; ningún paso los aplica.

## What Changes

- La resincronización se ordena en tres fases: **evaluar sin escribir**, **presentar al usuario** y **escribir solo lo que confirme**.
  1. Fijar como fuentes, en el commit del archivado, lo que tocó el change (`/wiki:ingest-collection … --manifest-only`), como hasta ahora.
  2. Evaluar sin escribir: `/wiki:refresh` de los artículos que citan rutas que tocó el change, que clasifica lo que cambió o quedó contradicho; las lecciones aprendidas en dry-run (`/wiki:ll --dry-run`); y los registros del inventario que el change completa o deja obsoletos.
  3. Presentarlo todo al usuario.
  4. Escribir solo lo confirmado, en este orden: las actualizaciones del refresh, las lecciones, el compile (que integra las notas de lecciones nuevas) y la actualización del inventario (`/wiki:inventory update`).
  5. El lint del wiki hasta dejarlo sin errores, sin que `--fix` sustituya al compile.
  6. El commit del wiki, aparte y después del commit del archivado.
  7. La propuesta de fusión con las ramas de `x-main`, sin cambios.
- **Se quita** `/wiki:librarian scan` de la resincronización.
- Las operaciones de la resincronización llevan `--local`, todas.

Fuera de alcance: cambiar el motor del wiki; los pasos de la guidance que no son del wiki (dónde se archiva, las rutas que tocó el change, la fusión); el plugin `openspec-autopilot`, que remite a estas indicaciones sin repetir sus pasos.

## Capabilities

### New Capabilities

### Modified Capabilities
- `wiki-first-knowledge`: el requirement «Resincronizar el wiki al archivar un change» cambia su secuencia de pasos: se evalúa sin escribir con el refresh, las lecciones en dry-run y el inventario; el usuario confirma; se escribe en orden (refresh, lecciones, compile, inventario); y el librarian deja de formar parte.

## Impact

- `openspec/config.yaml`, `operations.archive.guidance`: los pasos 1 a 7 de la resincronización. El paso de la fusión debe seguir empezando por `8.`, porque `change-lifecycle.steps.js` lo busca así.
- Suite de aceptación: `RESYNC_STEPS` en `acceptance-tests/step-definitions/wiki.steps.js`, que asocia cada fila de la tabla del escenario a la operación del motor que la hace.
- `README.md`: la lista de operaciones que se revisan al cambiar de versión del motor (`/wiki:librarian scan` sale y `/wiki:inventory update` entra). El motor falso de la suite (`COMMANDS` en `acceptance-tests/support/engine.js`) se alinea con esa lista.
- El artículo `flujo-wiki-first` del wiki, que describe los siete pasos: se refresca al archivar este change.
