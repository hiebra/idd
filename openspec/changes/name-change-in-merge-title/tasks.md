`acceptance-tests/` ya existe, así que se omite la puesta en marcha de la suite. Se trabaja con el ciclo de `spec-as-source`: rojo → implementar → verde → commit. Un commit nunca mezcla `openspec/` con la zona de código, salvo este `tasks.md`. En un contenedor efímero, cada commit pasa antes por `check commit`.

Los pasos pendientes salen de `npx cucumber-js --dry-run --name "título"` en `acceptance-tests/`: son seis, todos para `step-definitions/change-lifecycle.steps.js`. Antes de definir cada uno se contrasta su expresión con las que ya existen, se restringen las capturas a los valores de los escenarios y solo capturan los grupos que recibe la función. En la nube la suite completa tarda entre 6 y 20 minutos según el contenedor: se itera con `--name` y la pasada completa va en segundo plano, sin editar nada del proyecto mientras corre. Las referencias D1 a D7 son las del `design.md` del change.

## 0. Antes del apply

- [ ] 0.1 Pasar `node .agents/openspec/branch-change.mjs check apply name-change-in-merge-title`. Hacer `git fetch` y, si `origin/main` ha avanzado, decírselo al usuario: tres ramas concurrentes tocan los mismos archivos (design, Risks), y traerla pronto con `check merge <rama de la sesión>` reduce los conflictos. Solo se trae si el usuario lo pide

## 1. Preparación

- [ ] 1.1 Comprobar que la suite efectiva está en verde antes de tocar nada, salvo los seis pasos sin definir de este change (`npm test` y `npm run test:core` en `acceptance-tests/`). En la nube, los escenarios de `windows-readiness` fallan por falta de `pwsh`: se cuenta el resto
- [ ] 1.2 `openspec-change-lifecycle: El título de la fusión nombra el change de la rama`, paso `la rama temporal lleva <changes>`. Definirlo sobre la rama que monta `temporaryBranchWithRemote`, con las cuatro formas de los `Examples`: añade cada change con `addChange` (y `archiveChange` si está archivado) y hace commit; con «solo código, sin ningún change» no añade nada. Comprobar en el propio paso que el árbol queda limpio y que `branchChange` da esos changes → commit

## 2. El título en la orden local (D1 a D4): rojo → implementar → verde → commit

- [ ] 2.1 Mismo Scenario Outline, paso ``el commit de fusión que da su orden se titula `<título>` ``: toma del mensaje la orden `git commit-tree`, la ejecuta sin el push y compara el título del commit creado (`git log -1 --format=%s`). Rojo por la causa correcta: las tres primeras filas dan `Merge feature/exportar into main`; la cuarta ya pasa, porque sin change el título no cambia. Implementar en `.agents/openspec/branch-change.mjs` una función exportada que componga el título (los nombres kebab-case de `changes`, sin repetir, unidos por una coma y un espacio; sin ninguno, la rama) y usarla en el `-m` de la orden de `checkMerge` → verde → commit
- [ ] 2.2 Añadir a `core-tests/branch-change.test.js` lo que no tiene escenario: un directorio de `openspec/changes/` con un nombre que no es kebab-case (con `$(` o con un acento grave) no llega al título ni a la orden; un change en curso y archivado con el mismo nombre se nombra una vez; y con `x-main: [main, develop]`, el título hacia `main` nombra el change calculado contra `develop` → commit
- [ ] 2.3 Comprobar que los cinco escenarios vigentes del requisito `La puerta check merge decide las fusiones del ciclo` siguen en verde, acotando con `--name`

## 3. El título en el PR (D5): un paso por task; rojo → implementar → verde → commit

- [ ] 3.1 `openspec-change-lifecycle: En un contenedor efímero, el título del PR nombra el change de la rama`, paso ``su mensaje indica que el PR lleve el título `Merge exportar-datos into main`, también si ya estaba abierto``. Rojo: el mensaje no da ningún título. Añadir al mensaje de `checkMerge` en un contenedor efímero el título del PR, y que se le ponga al PR si ya está abierto, sin tocar lo que comprueban los pasos vigentes (``PR de `<rama>` contra `<destino>` ``, «commit de fusión, no con squash» y ninguna orden de push al destino) → verde → commit
- [ ] 3.2 Mismo escenario, paso `su mensaje recomienda ese mismo título para el commit de fusión`. Rojo: el mensaje no lo recomienda. Añadir la recomendación y su motivo: el título que propone GitHub nombra la rama de la sesión → verde → commit

## 4. La skill y la documentación (D6): rojo → implementar → verde → commit

- [ ] 4.1 `openspec-change-lifecycle: La skill indica que el título de la fusión es el que da la puerta`, paso ``indica que el título de la fusión es el que da la puerta `check merge`, que nombra el change de la rama``, sobre la sección `<!-- lifecycle:merge -->`. Rojo con la skill actual. En «La fusión con una rama permanente» de `.agents/skills/openspec-git-discipline/SKILL.md`: el título de la fusión, `Merge <change> into <destino>`, es el que da la puerta y no se cambia, y la orden local lo lleva en el `-m` → verde → commit
- [ ] 4.2 Mismo escenario, paso `indica poner ese título al PR y recomendarlo para su commit de fusión`. Rojo. En el punto del PR de la skill: el PR lleva ese título, también si ya estaba abierto; el resumen del change va en su descripción; y el agente recomienda ese mismo título para el commit de fusión y dice por qué. Añadir la señal de alarma de D6 → verde → commit
- [ ] 4.3 Documentar el título de la fusión en la cabecera de `branch-change.mjs` (puerta `merge`) y en «Quién fusiona, y cómo» del `README.md` → commit

## 5. Cierre

- [ ] 5.1 Ejecutar la suite efectiva entera en `acceptance-tests/` (`npm test`, `npm run test:core` y `npm run lint:specs`), leyendo el código de salida sin tubería: todos los escenarios pasan, sin pasos pendientes ni sin definir, y se genera el informe HTML. En la nube, los escenarios de `windows-readiness` fallan por falta de `pwsh`; este change no toca nada de Windows, y se decide con el usuario si se dan por cubiertos
- [ ] 5.2 Ejecutar `openspec validate name-change-in-merge-title --type change` antes del archive. Como en el resto de specs del proyecto, el criterio es la validación sin `--strict`
- [ ] 5.3 Comprobar la puerta en la rama de la sesión, sin fusionar: con el árbol limpio, `node .agents/openspec/branch-change.mjs check merge main` da el PR con el título `Merge name-change-in-merge-title into main`. Si la rama no contiene `origin/main`, la puerta pide traerla antes: entonces se comprueba cuando el usuario pida traerla, o al proponer la fusión tras el archive
- [ ] 5.4 Al archivar, en la resincronización del wiki: completar el registro del inventario `nombrar-el-change-en-el-titulo-de-la-fusion`, refrescar el artículo `ciclo-de-un-change-y-autopilot` (quién fusiona y qué aporta la fusión con `--no-ff`) y proponer al usuario un registro para sanear el nombre de la rama en las órdenes de las puertas (design, Open Questions)
