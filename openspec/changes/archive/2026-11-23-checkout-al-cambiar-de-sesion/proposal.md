## Why

Desde `autopilot-rama-por-sesion` (ADR-0022), entrar en una sesión del mismo directorio y de otra rama hace el checkout de la rama de la sesión, pero no con cambios sin commit: la TUI vuelve a la ventana anterior y avisa. Esa regla protege el trabajo pendiente de una rama temporal, y es correcta para ellas.

Con `x-main-protected: true` (ADR-0020), el acceso directo a las ramas permanentes está vetado: en ellas no se commitea, y el trabajo se hace en ramas temporales y llega por PR. Volver a una rama de `x-main` con cambios sin commit no pone en riesgo nada de esa rama, y el usuario tiene que hacer el commit, guardar los cambios o salir a mano solo para consultar `main` desde su sesión libre.

## What Changes

- **Excepción con `x-main-protected: true`.** Si la rama de la sesión en la que entra la TUI es una de las ramas de `x-main` (o `main` si la lista no está), el plugin hace el checkout aunque el directorio tenga cambios sin commit. Los cambios pasan a esa rama como en un `git checkout` normal: sin forzar y sin stash. El aviso lo dice.
- **Con la excepción, también las ramas permanentes que no son la de origen.** Hoy, aun con el árbol limpio, el plugin rechaza cambiar a una rama de `x-main` que no sea la de origen; con `x-main-protected: true` cambia a cualquiera de ellas.
- **Lo que no cambia:** sin la clave, o con cualquier otro valor, rige la regla de hoy. Con otra sesión trabajando en el directorio, no hay checkout. Si git rechaza el cambio (un cambio local choca con un archivo que difiere entre ramas), no se toca nada, la TUI vuelve a la ventana anterior y se avisa con el error de git. Las ramas temporales con cambios sin commit siguen sin cambiarse.

## Capabilities

### New Capabilities

### Modified Capabilities
- `openspec-autopilot`: cambia "Pasar a una sesión es pasar a su rama", que admite el checkout con cambios sin commit hacia una rama de `x-main` cuando `x-main-protected` es `true`.

## Impact

- `.agents/openspec/branch-change.mjs`: un cambio de rama hacia una rama de `x-main`, con la excepción comprobada dentro, junto a `originBranch`.
- `.opencode/plugins/openspec-autopilot/`: `lib/screen.mjs` (`enterSession` decide con el veto y las ramas permanentes), `lib/project.mjs` (`switchTo`) y `server.js` (pasa el veto a la decisión y lo dice en el aviso).
- `README.md`: el checkout con la excepción.
- `acceptance-tests/`: escenarios y pasos del autopilot con `x-main-protected`, ramas de `x-main` y un checkout que git rechaza; pruebas de núcleo de `enterSession` y del nuevo cambio de rama.
- `adr/`: un ADR nuevo, que matiza ADR-0022 (el plugin cambia de rama con cambios sin commit solo en la excepción).
