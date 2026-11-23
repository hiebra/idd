# Tasks: checkout-al-cambiar-de-sesion

La suite ya existe (`acceptance-tests/`, `stack: javascript`), así que no hace falta montarla. Cada task de las secciones 2 y 3 sigue el ciclo: el escenario falla por la razón esperada, se implementa, pasa y se hace commit. Los commits no mezclan `openspec/` con el resto, salvo este `tasks.md`. Los escenarios de los requisitos que no cambian siguen en verde en todo momento.

## 1. Estado de partida (zona de código)

- [x] 1.1 Traer `origin/main` a la rama de trabajo (`git fetch` y fusión) y comprobar que `git diff --check` no deja marcadores; si hay conflictos, presentar cada decisión de la resolución al usuario antes del commit de fusión.
- [x] 1.2 Ejecutar la suite con los deltas del change (`npm test` en `acceptance-tests/`): los 6 escenarios nuevos de «Pasar a una sesión es pasar a su rama» salen con pasos sin definir y el resto pasa. Anotar aquí el recuento. Recuento: 338 escenarios (332 pasan, 6 sin definir: los de «Pasar a una sesión es pasar a su rama»); 1850 pasos (1816 pasan, 2 omitidos, 32 sin definir).

## 2. Escenarios de la excepción (zona de código), un paso a la vez

Ciclo por task: paso sin definir → implementarlo en `acceptance-tests/step-definitions/autopilot.steps.js` (y `support/`) → el escenario falla porque el plugin no hace la excepción → siguiente.

- [x] 2.1 Pasos de preparación: «un proyecto cuyo `openspec/config.yaml` declara `x-main: [develop, main]` y `x-main-protected: <protegido>`» (y la variante con solo `x-main-protected: true`); «la TUI está en una sesión de la rama temporal `exportar-datos`, con cambios sin commit» (y con un cambio sin commit en un archivo que difiere en `main`); «la sesión libre de la rama `<destino>` está en el mismo directorio». Reutilizar las preparaciones de ramas y sesiones de `support/autopilot.js` y `support/branches.js`.
- [x] 2.2 Pasos de acción y resultado: «la TUI entra en la sesión de la rama `<destino>`»; «el directorio pasa a la rama `<destino>` con sus cambios sin commit»; «el directorio sigue en la rama `exportar-datos` con sus cambios sin commit»; «la TUI vuelve a la sesión de la rama `exportar-datos`»; «se avisa con el error de git».
- [x] 2.3 Comprobar que los escenarios nuevos fallan por la razón esperada (el plugin vuelve atrás con «cambios sin commit» o rechaza la rama permanente) y que los demás pasan.

## 3. Implementación (zona de código), un escenario a la vez

- [x] 3.1 `permanentBranch(dir, name, env)` en `.agents/openspec/branch-change.mjs` (D1), con pruebas de núcleo en `acceptance-tests/core-tests/branch-change.test.js`:
  - rechaza sin el veto, con el veto y una rama que no es de `x-main`, y en un contenedor efímero;
  - cambia con el árbol sucio y los cambios viajan; crea la rama local desde `origin/<rama>` si solo existe en el remoto;
  - devuelve el error de git si rechaza el cambio, sin tocar nada.
- [x] 3.2 `enterSession` en `lib/screen.mjs` (D2, D3), con pruebas de núcleo en `core-tests/autopilot-product.test.js`: `protected` y una rama de `x-main` dan `checkout` con `via: 'permanent'` con el árbol sucio y con otra rama permanente; otra sesión trabajando da `back`; sin el veto no cambia ninguna salida de hoy; `carried` dice si había cambios.
- [ ] 3.3 `switchTo` en `lib/project.mjs` con la vía `permanent`; `enter` en `server.js` pasa `protected` de `branchChange(directory)`, registra `pluginCheckout` y avisa con los cambios que han pasado (D3, D4).
- [ ] 3.4 Documentar en `README.md` el checkout con `x-main-protected`: qué hace, que los cambios sin commit pasan a la rama y que git puede rechazarlo. Documentar la clave en `openspec/config.yaml` solo si ya está comentada allí.

## 4. Cierre

- [ ] 4.1 Ejecutar `openspec validate checkout-al-cambiar-de-sesion --type change --strict` y `npm run lint:specs` en `acceptance-tests/`.
- [ ] 4.2 Ejecutar la suite completa: todos los escenarios pasan, ningún paso pendiente o sin definir, informe HTML generado.
