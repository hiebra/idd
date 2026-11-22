## Context

`openspec-autopilot` guarda en la metadata de cada sesión su `worktree` y su `branch`, y en cada rama hay como mucho una sesión operativa (ADR-0014). La TUI pregunta al servidor qué hacer (`screen`) cada vez que cambia de ruta o recupera el foco (`tui.js`, `report`). Hoy, en `onScreen` (`server.js`), si la ruta es la dueña no archivada de otra rama y la rama actual no tiene sesión operativa, el plugin aplica las reglas de la rama actual (`ensureOperational`). Si la rama actual sí la tiene, la sesión de la ruta es una ventana ajena y sale el modal que lleva a la sesión operativa de la rama actual. En ninguno de los dos casos cambia de rama.

Quien cambia de rama hoy es el modelo, con `branch-change.mjs switch`, que solo cambia entre ramas temporales y nunca con el árbol sucio (ADR-0013). En un contenedor efímero, `start` y `switch` no actúan (ADR-0016). Las ramas permanentes son la lista `x-main` de `openspec/config.yaml`, o `main`, y las lee `readPermanent` en `branch-change.mjs`.

La proposal explica por qué, con un `main` protegido, el árbol sucio no debe impedir volver a una rama de `x-main`.

## Goals / Non-Goals

**Goals:**

- Que entrar en la sesión operativa de otra rama del mismo directorio deje el clon en esa rama, sin pasos a mano, cuando es seguro.
- Con `x-main-protected: true`, que el árbol sucio no impida volver a una rama de `x-main`.
- Que un checkout que no se hace, o que git rechaza, deje el repositorio exactamente como estaba y lo diga.

**Non-Goals:**

- Cambiar `branch-change.mjs switch` o las reglas del modelo: el modelo sigue sin cambiar de rama con el árbol sucio ni a una rama permanente.
- Hacer checkout en Claude Code: allí no hay plugin ni sesiones atadas a una rama (ADR-0006).
- Resolver conflictos de los cambios locales: ni `--force`, ni `--merge`, ni stash.
- Sesiones de otros worktrees: cada worktree tiene su propia parte de servidor y su propio HEAD.

## Decisions

### D1. Solo la sesión operativa de otra rama provoca el checkout

La sesión de la ruta tiene que ser dueña (`role: "owner"`), no archivada, de `meta.worktree === directory`, con `meta.branch` distinta de la rama de HEAD, y no estar trabajando. Las sesiones libres ya terminaron su paso y quedan para archivarse; las ajenas no tienen rama en la metadata.

- *Alternativa*: cualquier sesión con rama en la metadata, archivadas incluidas. Se descarta: entrar a leer el historial de una sesión archivada no debe mover el clon.

### D2. El checkout va antes de cualquier otra regla de `onScreen`

`onScreen` lee primero la sesión de la ruta. Si cumple D1, intenta el checkout y vuelve a leer `branchChange(directory)` antes de calcular la sesión operativa y la directiva. Con el checkout hecho, la sesión de la ruta es la operativa de la rama nueva y la directiva da `validate`, así que se aplican la validación de siempre y su arranque si esperaba el árbol limpio. Si el checkout no se hace, `onScreen` sigue como hoy con la rama actual: modal de ventana ajena o `ensureOperational`.

Se intenta aunque la rama actual no sea `actionable` (por ejemplo, con varios changes), porque esa condición es de la rama de la que se sale, no de la de destino. Con HEAD separado no se intenta (spec). Si la rama de destino ya no existe, git lo rechaza y se avisa como en D5.

### D3. La decisión y el checkout viven en `branch-change.mjs`

Se añaden dos funciones exportadas al módulo neutral:

- `readProtected(dir)` → `{ protected, warning }`, que lee `x-main-protected` con el mismo analizador de líneas que `parsePermanent`. Acepta `true`/`True`/`TRUE` y `false`/`False`/`FALSE` (booleanos del esquema core de YAML 1.2). Cualquier otro valor da `false` con el aviso `openspec/config.yaml: 'x-main-protected' no es un booleano; se trata como false`.
- `checkoutForSession(dir, branch, env)` → `{ ok, message }`. No actúa en un contenedor efímero (`isEphemeral`). Comprueba el árbol con `git status --porcelain`, que cuenta los archivos sin seguimiento, como `treeClean`. Permite el árbol sucio solo si `readProtected` es `true` y `branch` está en `readPermanent(dir).permanent`. Ejecuta `git switch -q <branch>`, sin `--force`, `--merge` ni `--discard-changes`.

Así, `x-main` y `x-main-protected` se leen en un solo sitio, y la regla queda probada con `node --test` como el resto del módulo. El plugin la llama a través de `lib/project.mjs`, como hace con `branchChange`.

- *Alternativa*: reutilizar `switchBranch`. Se descarta porque rechaza las ramas permanentes y el árbol sucio, que son justo los casos nuevos, y porque es la regla del modelo, que no cambia.
- *Alternativa*: ponerlo en `lib/git.mjs` del plugin. Se descarta: duplicaría la lectura del config y la detección del contenedor efímero.

`git switch` y `git checkout <rama>` hacen lo mismo con una rama. Se usa `switch` como en `startBranch` y `switchBranch`, porque no confunde una rama con una ruta.

### D4. Ningún checkout mientras trabaja una sesión de la rama actual

Antes del checkout, el plugin mira las sesiones del autopilot de la rama actual en este directorio (`branchSessions`). Si alguna está trabajando (`isWorking`), no hace el checkout y avisa. Cambiar de rama bajo un modelo que está escribiendo mezclaría sus cambios con otra rama.

### D5. Los avisos son toasts, uno por entrada

Si el checkout no se hace (árbol sucio, sesión trabajando o git lo rechaza), el plugin avisa con `ui.toast` de tipo `warning`, con el motivo y, si lo hay, las primeras líneas del error de git (`stderr`, recortado a 200 caracteres, como en `lib/git.mjs`). El aviso de `x-main-protected` no booleano sale en el mismo toast. La TUI solo pregunta al cambiar de ruta o recuperar el foco, así que hay un aviso por entrada, sin bucle. No se usa el modal de un botón: el usuario no tiene que decidir nada, y la sesión sigue disponible para leerla.

### D6. Sin TUI no hay checkout

El checkout solo ocurre en `onScreen`, que solo llama la TUI. En la UI web y con `opencode run` no hay pantalla que observar, y el comportamiento no cambia (requisito "Funcionamiento sin TUI").

## Risks / Trade-offs

- [El usuario entra en una sesión de otra rama solo para mirarla, y el clon cambia de rama] → Solo ocurre con la sesión operativa (D1), que es la que se usa para operar. Las sesiones archivadas no mueven nada, y el modelo ve en su contexto la rama de la sesión.
- [Con `x-main-protected: true`, los cambios sin commit de una rama temporal pasan a `main`] → Es lo que se pide: en un `main` protegido nada se publica sin PR, y desde allí el siguiente change se lleva esos cambios a su rama temporal con el árbol sucio. El toast no avisa del traslado; queda documentado en el README.
- [Carrera: el usuario hace commit o cambia de rama a mano entre la comprobación y el checkout] → `git switch` es atómico respecto al árbol: si algo choca, falla sin tocar nada y se avisa (D5).
- [Varios clientes TUI en el mismo directorio] → Cada uno pregunta por su ruta. El último checkout gana, y el otro cliente valida su sesión en la siguiente pregunta con la rama que haya.

## Migration Plan

Sin migración: sin `x-main-protected`, el único cambio es el checkout con el árbol limpio. Para volver atrás, se revierte el commit del código; la clave del config deja de tener efecto y OpenSpec la sigue aceptando (`x-*`).

## Open Questions

- **ADR-0013** dice que "no se crea ni se cambia con el árbol sucio" y descartó que el plugin cree la rama, para que el ciclo sea el mismo en los dos agentes (ADR-0006). Aquí el plugin cambia de rama, con el árbol sucio si `x-main-protected` lo permite, y solo en OpenCode. La regla de ADR-0013 sigue valiendo para el modelo. Propongo un ADR nuevo que la matice para el plugin y registre la asimetría, sin sustituir ADR-0013, que sigue en vigor entero para el modelo. Lo decide el paso `adr`.
