## Context

`autopilot-rama-por-sesion` (ADR-0022) dejó el checkout al entrar en una sesión en `enterSession` (`lib/screen.mjs`), una función pura que recibe `{ target, fromDir, head, clean, working, permanent, origin }` y devuelve la acción: sin cambio si ya está en la rama, `back` con cambios sin commit o con otra sesión trabajando, `checkout` hacia la rama de origen (`via: 'origin'`) o hacia una rama temporal (`via: 'switch'`), y un aviso si la rama es otra rama permanente. `server.js` (`enter`) calcula esos datos, ejecuta el cambio con `switchTo` (`lib/project.mjs`), que llama a `originBranch` o `switchBranch` de `.agents/openspec/branch-change.mjs`, y registra el checkout como hecho por el plugin (`pluginCheckout`).

`switchBranch` rechaza las ramas permanentes y el árbol sucio; `originBranch` rechaza el árbol sucio. Las dos son las reglas del modelo (ADR-0013, ADR-0020) y no cambian. `branchChange` ya expone `permanent` y `protected` (ADR-0020: `x-main-protected: true` declara el veto; cualquier otro valor, o sin clave, no hay veto), y `readProtected` es la única lectura de la clave.

La proposal explica por qué, con el veto, el árbol sucio no debe impedir entrar en la sesión de una rama de `x-main`.

## Goals / Non-Goals

**Goals:**

- Con `x-main-protected: true`, entrar en la sesión de una rama de `x-main` deja el directorio en esa rama aunque tenga cambios sin commit.
- Que lo que no es esa excepción se comporte igual que hoy, y que un checkout que git rechaza deje el repositorio como estaba.

**Non-Goals:**

- Cambiar las reglas del modelo: `switchBranch`, `originBranch` y `start` siguen sin actuar con el árbol sucio ni hacia ramas permanentes (salvo `origin`).
- Hacer checkout con otra sesión trabajando en el directorio, forzar el cambio o usar un stash.
- Cambiar a una rama permanente sin el veto, o a una rama temporal con cambios sin commit.

## Decisions

### D1. La excepción vive en un cambio de rama nuevo de `branch-change.mjs`

Se añade `permanentBranch(dir, name, env)` junto a `originBranch`. Comprueba, dentro, que `readProtected(dir)` es `true` y que `name` está en `readPermanent(dir).permanent`; si no, sale con `ok: false` y un mensaje que nombra la clave. No actúa en un contenedor efímero (`isEphemeral`, como `originBranch`: ADR-0016). No comprueba el árbol: es la excepción. Cambia con `git switch -q <rama>`, creando la rama local desde `origin/<rama>` si solo existe en el remoto, sin `--force`, `--merge` ni `--discard-changes`. Si git lo rechaza, devuelve el `stderr` de git.

Así la regla de la excepción tiene un solo lugar, el módulo neutral que ya lee `x-main` y `x-main-protected` y que prueba `node --test`, y el plugin no puede abrirla por error con un argumento mal pasado.

- *Alternativa*: un parámetro `{ dirty: true }` en `switchBranch` o `originBranch`. Se descarta: abre en las reglas del modelo una puerta que no tiene que existir, y `switchBranch` rechaza las ramas permanentes por diseño.
- *Alternativa*: que `enterSession` ejecute git. Se descarta: es una función pura con pruebas de núcleo, y el resto de cambios de rama están en el módulo neutral.

### D2. `enterSession` decide con el veto y las ramas permanentes

`enterSession` recibe además `protected`. Cuando `protected` es `true` y `permanent.includes(target.branch)`, la acción es `checkout` con `via: 'permanent'`, **antes** de la comprobación del árbol sucio y de la que rechaza las demás ramas permanentes, pero **después** de la de la sesión trabajando: con otra sesión de ese directorio trabajando sigue sin haber checkout. En cualquier otro caso, el orden de hoy no cambia (la rama de origen con el árbol limpio sigue siendo `via: 'origin'`; con el veto, una rama de origen limpia también pasa por `via: 'permanent'`, que es lo mismo con otra comprobación).

`server.js` pasa `protected` desde `branchChange(directory)`, que ya se lee en `enter` para `permanent` y `origin`. `switchTo` gana la vía `permanent`.

### D3. El aviso lleva los cambios

Tras un checkout `permanent` con el árbol sucio, el aviso es el de `checkedOut(branch, dir)` más «; tus cambios sin commit han pasado a esa rama». `enterSession` no sabe si el árbol estaba sucio tras el checkout, pero sí `clean` de antes, así que devuelve `carried: !clean` y el aviso lo usa. Si git rechaza el checkout, vale el camino de hoy: `back` con `reason: 'checkout'` y el error de git.

### D4. `pluginCheckout` no cambia

El checkout `permanent` se registra con `pluginCheckout(head, branch)` como el resto, para que el cambio de rama no se interprete como un checkout hecho por el modelo (`branchMoved`).

## Risks / Trade-offs

- [Con el veto, los cambios sin commit de una rama temporal pasan a `main`, donde no se pueden commitear] → Es lo pedido, y el aviso lo dice. El usuario los puede llevar de vuelta entrando en la sesión de la rama temporal, y `git checkout` normal no los pierde ni los fuerza.
- [Un cambio local que choca con un archivo distinto en la rama de destino] → git rechaza el cambio sin tocar nada, la TUI vuelve atrás y avisa con el error (D1, D3).
- [Un proyecto declara `x-main-protected: true` sin tener el veto] → Es el aviso de ADR-0020: la clave la declara el proyecto, y quita la excepción con borrarla.

## Migration Plan

Sin migración: sin la clave, `enterSession` se comporta igual. Para volver atrás, se revierte el commit del código.

## Open Questions

- Ninguna. ADR-0022 queda matizado, no sustituido (lo decide el paso `adr`): su regla de no cambiar de rama con cambios sin commit sigue valiendo, salvo en la excepción.
