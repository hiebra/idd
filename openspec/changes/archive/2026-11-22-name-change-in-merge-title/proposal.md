## Why

Con la fusión `--no-ff`, `git log --first-parent` de una rama permanente muestra un change por entrada, pero solo sirve de índice de changes si el título de cada fusión nombra el change. Lo recoge la lección 3 de `.wiki/raw/notes/2026-11-22-ll-fusion-no-ff-y-trazabilidad.md`, y está en seguimiento en el inventario del wiki (`nombrar-el-change-en-el-titulo-de-la-fusion`). Hoy el título no lo nombra:

- **La orden local nombra la rama.** `check merge` hacia una rama permanente da `git commit-tree … -m "Merge <rama> into <destino>"`. Solo coincide con el change si la rama se llama como él, como las que crea `start`: es el caso de `32639ba` (*Merge autopilot-sesion-operativa into main*).
- **En un contenedor efímero, la puerta recomienda un PR y no dice nada de su título.** GitHub titula la fusión con la rama de la sesión: las 11 fusiones de PR de `main` se titulan *Merge pull request #N from hiebra/claude/…* (por ejemplo, `24b15ce`, que trajo `reorder-wiki-resync`).
- **El título del PR tampoco lo garantiza.** GitHub lo deja en el cuerpo del commit de fusión, y de los 8 PR que trajeron un change, 3 no lo nombraban (#5, #6 y #8). El PR #7 sí se tituló *Merge allow-user-requested-merges into main*, y su fusión (`af2153e`) lleva igualmente el título por defecto.

## What Changes

- **El título de la fusión con una rama permanente nombra el change de la rama:** `Merge <change> into <destino>`. Lo compone la puerta `check merge <rama permanente>`:
  - si la rama lleva varios changes, los nombra todos;
  - si no lleva ninguno (por ejemplo, una rama que solo toca el wiki), nombra la rama, como hasta ahora.
- **Fuera de un contenedor efímero**, la orden `git commit-tree … -m "…"` que da la puerta lleva ese título.
- **En un contenedor efímero**, si la rama lleva algún change, la puerta indica poner ese título al PR y recomendar al usuario ese mismo título para el commit de fusión, porque el que propone GitHub nombra la rama de la sesión. Si no lleva ninguno, no da título: el PR se titula como hasta ahora.
- **La skill `openspec-git-discipline`** lo dice en «La fusión con una rama permanente».

Fuera de alcance:
- **Comprobar el título después de fusionar un PR.** La puerta no ve esa fusión: el título del commit lo decide el usuario en GitHub.
- **Cambiar la configuración del repositorio en GitHub.**
- **Las fusiones que traen una rama permanente a la rama temporal.** No aparecen en `git log --first-parent` de la rama permanente, y conservan el título de git.

## Capabilities

### New Capabilities

### Modified Capabilities
- `openspec-change-lifecycle`: el requirement «La puerta check merge decide las fusiones del ciclo» pasa a exigir que, hacia una rama permanente, el mensaje de la puerta dé un título de fusión que nombra el change de la rama, en la orden local y en la recomendación del PR, y que la skill lo indique.

## Impact

- **`.agents/openspec/branch-change.mjs`:** los dos mensajes de `checkMerge` hacia una rama permanente, y su cabecera.
- **`.agents/skills/openspec-git-discipline/SKILL.md`:** «La fusión con una rama permanente» y las señales de alarma.
- **Suite de aceptación:** los pasos de los escenarios nuevos en `acceptance-tests/step-definitions/change-lifecycle.steps.js`, y lo que no está en la spec en `acceptance-tests/core-tests/branch-change.test.js`.
- **`README.md`:** «Quién fusiona, y cómo».
- **No cambian** las indicaciones de archivado de `openspec/config.yaml`, cuyo paso 8 ya manda ejecutar `check merge`, ni el plugin `openspec-autopilot`, que no fusiona.
- **El wiki:** al archivar, el registro del inventario `nombrar-el-change-en-el-titulo-de-la-fusion` queda completado.
- **Ramas concurrentes sin fusionar** tocan los mismos archivos, aunque no este requirement (ver el design).
