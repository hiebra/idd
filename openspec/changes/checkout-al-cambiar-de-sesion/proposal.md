## Why

Un mismo directorio puede tener sesiones del autopilot en varias ramas, porque el modelo salta entre ramas temporales con `branch-change.mjs`. Al entrar en una sesión de otra rama, hoy el plugin no cambia de rama: aplica las reglas de la rama en la que está HEAD, y la sesión en la que el usuario ha entrado no puede seguir con su change hasta que el usuario hace el checkout a mano.

Con un `main` protegido, el trabajo nunca se queda en la rama permanente: lo que haya pendiente en el árbol se lleva a una rama temporal o se descarta. Por eso, volver a una rama de `x-main` con el árbol sucio no pone en riesgo ningún trabajo de esa rama, y exigir el árbol limpio solo añade un paso a mano.

## What Changes

- **Checkout al entrar en una sesión de otra rama.** Cuando la TUI entra en una sesión no archivada del autopilot, o recupera el foco en ella, la sesión es del mismo directorio, su metadata la ata a una rama distinta de la de HEAD y no está trabajando, el plugin hace `git checkout <rama de la sesión>` si el árbol está limpio. Después aplica a la sesión las reglas de esa rama, como en cualquier validación. Esto sustituye a "Si HEAD ya no está en su rama, aplica las reglas de la rama actual" cuando el checkout tiene éxito.
- **Excepción con `x-main-protected: true`.** Si `openspec/config.yaml` declara `x-main-protected: true` y la rama de la sesión es una de `x-main` (o `main` si `x-main` no está), el plugin hace el checkout aunque el árbol no esté limpio. Con cualquier otro valor de `x-main-protected`, o sin la clave, rige la regla del árbol limpio. Un valor que no es booleano se trata como `false` y se avisa.
- **Árbol sucio sin excepción.** Si el árbol no está limpio y la excepción no se aplica, el plugin no hace el checkout, avisa de que lo pendiente impide cambiar a la rama de la sesión y sigue como hoy, con las reglas de la rama actual.
- **Checkout sin forzar.** El plugin nunca fuerza el checkout ni guarda los cambios en un stash: los cambios locales viajan a la rama de destino como en un `git checkout` normal. Si git lo rechaza (por ejemplo, porque un cambio local choca con un archivo que difiere entre ramas), el plugin no toca nada más, avisa al usuario con el error de git y sigue con las reglas de la rama actual.
- Las sesiones de otros directorios (otros worktrees) y las que no tienen rama en la metadata del plugin no provocan ningún checkout.

## Capabilities

### New Capabilities

### Modified Capabilities
- `openspec-autopilot`: cambia "Validación al volver a la sesión operativa", que pasa a hacer el checkout de la rama de la sesión en vez de aplicar sin más las reglas de la rama actual. Se añade el checkout con el árbol sucio hacia una rama de `x-main` cuando `x-main-protected` es `true`, y el aviso cuando el checkout no se hace o git lo rechaza.

## Impact

- `.opencode/plugins/openspec-autopilot/`: `server.js` (`onScreen` y la validación de la sesión), `lib/git.mjs` (el checkout y su error) y `lib/project.mjs` (lectura de `x-main-protected` y de las ramas de `x-main`).
- `.agents/openspec/branch-change.mjs`: puede exponer la lectura de `x-main-protected` junto a la de `x-main`, para que ambas salgan del mismo sitio.
- `openspec/config.yaml`: documenta la clave `x-main-protected` (OpenSpec acepta claves `x-*` sin avisos). Este repositorio no la declara.
- `README.md`: la clave `x-main-protected` y el checkout al cambiar de sesión.
- `acceptance-tests/`: escenarios y pasos del autopilot con sesiones de varias ramas en el mismo directorio, árbol limpio y sucio, `x-main-protected` y un checkout que git rechaza.
- `adr/`: probablemente un ADR nuevo: el plugin pasa a cambiar de rama por su cuenta, algo que hasta ahora solo hacía el modelo con `branch-change.mjs` (ADR-0013).
