## Why

Con la fusión `--no-ff`, `git log --first-parent` de la rama de origen muestra un change por entrada, pero solo sirve de índice de changes si el título de la fusión nombra el change. Las fusiones de PR llevan el título por defecto de GitHub, que nombra la rama de la sesión: `dad41e9` (*Merge pull request #3 from hiebra/claude/eloquent-hawking-jvhlb0*) y `24b15ce` (*Merge pull request #11 from hiebra/claude/youthful-fermi-85z2ok*, que trajo `reorder-wiki-resync`). Y la orden local que da `check merge` pone en el título la rama, que solo coincide con el change si la rama se creó con `start`. Lo recoge la lección 3 de `.wiki/raw/notes/2026-11-22-ll-fusion-no-ff-y-trazabilidad.md` y está en seguimiento en el inventario (`nombrar-el-change-en-el-titulo-de-la-fusion`).

## What Changes

- **La puerta `check merge` hacia una rama permanente nombra el change de la rama** en el título de la fusión, `Merge <change> into <destino>`:
  - fuera de un contenedor efímero, en la orden `git commit-tree … -m "…"` que da;
  - en un contenedor efímero, recomendando ese título para el commit de fusión del PR, y que el título del PR empiece por el nombre del change.
- Si la rama lleva varios changes, el título los nombra todos; si no lleva ninguno (por ejemplo, una rama que solo toca el wiki), nombra la rama, como hasta ahora.
- La skill `openspec-git-discipline` dice en «La fusión con una rama permanente» que el título de la fusión nombra el change, y que en un PR se edita al fusionarlo en GitHub.

Fuera de alcance: comprobar después de fusionar que el título nombra el change (la puerta no ve la fusión del PR) y cambiar la configuración del repositorio en GitHub.

## Capabilities

### New Capabilities

### Modified Capabilities
- `openspec-change-lifecycle`: la puerta `check merge` hacia una rama permanente da un título de fusión que nombra el change de la rama.

## Impact

- `.agents/openspec/branch-change.mjs` (`checkMerge`).
- `.agents/skills/openspec-git-discipline/SKILL.md`, sección de la fusión con una rama permanente.
- Suite: `acceptance-tests/step-definitions/change-lifecycle.steps.js` y, si hace falta, `acceptance-tests/core-tests/branch-change.test.js`.
- Al archivar, el registro del inventario `nombrar-el-change-en-el-titulo-de-la-fusion` queda completado.
