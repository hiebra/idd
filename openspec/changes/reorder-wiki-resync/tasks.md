`acceptance-tests/` ya existe, así que se omite la puesta en marcha de la suite. Se trabaja con el ciclo de `spec-as-source`: rojo → implementar → verde → commit. Un commit nunca mezcla `openspec/` con la zona de código, salvo este `tasks.md`. Las referencias D1 a D3 son las del `design.md` del change.

## 0. Antes del apply

- [x] 0.1 Traer `origin/main` a la rama del change si el usuario lo pide (lleva `guiar-revision-con-tests`, que no toca `config.yaml` ni `wiki-first-knowledge`), y pasar `check apply reorder-wiki-resync`

## 1. Pasos del escenario (D3): uno por paso; en cada uno, rojo por la causa correcta → implementar → verde → commit

- [x] 1.1 `wiki-first-knowledge: Las indicaciones de archivado incluyen la resincronización del wiki`, paso `incluyen resincronizar el wiki del proyecto con estos pasos, en este orden:`. Cambiar `RESYNC_STEPS` en `acceptance-tests/step-definitions/wiki.steps.js` por las filas nuevas de la tabla (D3). Rojo con la guidance actual: falta `/wiki:inventory list`. Reescribir los pasos 1 a 7 de la resincronización en `operations.archive.guidance` de `openspec/config.yaml` según D1, con `--local` en todas las operaciones y el paso de la fusión todavía como `8.` → verde. `config.yaml` está en `openspec/`: su commit va separado del de la suite
- [x] 1.2 Mismo escenario, paso `no incluyen la revisión con el librarian`: ninguna entrada de la guidance contiene `/wiki:librarian`. Comprobar que está en rojo con la guidance anterior (por ejemplo, con `git stash` del `config.yaml`) y en verde con la de 1.1 → commit
- [x] 1.3 Comprobar que siguen en verde los escenarios que leen la misma guidance: `Las indicaciones de archivado cubren el archive en la rama de origen` (rutas y commit del wiki) y el que busca el paso `8.` en `change-lifecycle.steps.js`

## 2. Documentación y motor falso

- [x] 2.1 En `README.md`, en la lista de operaciones que se revisan al cambiar de versión del motor, quitar `/wiki:librarian scan` y añadir `/wiki:inventory list` y `/wiki:inventory update`. En `acceptance-tests/support/engine.js`, cambiar `librarian` por `inventory` en `COMMANDS`, y comprobar que los escenarios de instalación del motor siguen en verde → commit

## 3. Cierre

- [ ] 3.1 Ejecutar la suite efectiva entera (`npm test` en `acceptance-tests/`): todos los escenarios pasan, sin pasos pendientes ni sin definir, y se genera el informe HTML. Ejecutar también `npm run test:core` y `npm run lint:specs`, leyendo el código de salida sin tubería. Ejecutada el 2026-11-22 en la nube: 245 de 260 escenarios pasan; los 15 que fallan son todos de `windows-readiness`, por falta de `pwsh` en el contenedor (no se pudo instalar: el modo automático denegó la descarga). `test:core` 170/170 y `lint:specs` salen con 0. Queda pendiente ejecutar los de `windows-readiness` en una máquina con `pwsh`
- [x] 3.2 Ejecutar `openspec validate reorder-wiki-resync --type change` antes del archive. Como en el resto de specs del proyecto, el criterio es la validación sin `--strict`. Hecho el 2026-11-22: «is valid»
- [ ] 3.3 Al archivar este change, seguir ya la secuencia nueva, y refrescar en ella el artículo `flujo-wiki-first`, que describe los siete pasos anteriores
