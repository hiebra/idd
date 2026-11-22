`acceptance-tests/` ya existe, así que se omite la puesta en marcha de la suite. Se trabaja con el ciclo de `spec-as-source`: rojo → implementar → verde → commit. Un commit nunca mezcla `openspec/` con la zona de código, salvo este `tasks.md`. En un contenedor efímero, cada commit pasa antes por `check commit`; para apartar una zona con archivos nuevos, `git stash push -u -- <rutas>`.

Los pasos pendientes salen de `npx cucumber-js --dry-run --format snippets` sobre `.extracted/changes/allow-user-requested-merges/specs/*/spec.feature`. Los repos de prueba se crean con `support/branches.js`, que ya tiene remoto bare, squash y contenedor efímero simulado. En la nube la suite completa tarda 15-20 minutos: se itera con `--name` y la pasada completa va en segundo plano. Las referencias D1 a D8 son las del `design.md` del change.

## 1. Preparación

- [x] 1.1 Comprobar que la suite efectiva está en verde antes de tocar nada, salvo los pasos sin definir de este change (`npm test`, `npm run test:core`)
- [x] 1.2 Ampliar `support/branches.js` con lo que necesitan los escenarios, con pruebas en `core-tests/branches-support.test.js`:
  - una fusión en curso de `origin/main` con conflictos en rutas dadas (sin resolver, resuelta y resuelta con un marcador);
  - una rama temporal que contiene o no `origin/<rama>`, y `origin/<rama>` que contiene o no la rama temporal;
  - el remoto con varias ramas permanentes (`main` y `develop`);
  - `checkGate` con argumentos de `check merge` y una llamada a `merge-targets --json`, con el entorno del contenedor efímero o sin él;
  - `startBranch` y `switchBranch` con el entorno del contenedor efímero.

  → commit

## 2. El commit de fusión en `check commit` (D3): rojo → implementar → verde → commit

- [x] 2.1 `La puerta check commit admite un commit de fusión resuelto`: el Scenario Outline `El commit de una fusión con la puerta check commit`, con los pasos `hay una fusión en curso de \`origin/main\` que toca …`, `los conflictos están resueltos y sin marcadores`, `\`src/exportar.js\` tiene un conflicto sin resolver`, `\`src/exportar.js\` está resuelto pero conserva un marcador \`<<<<<<<\``, `la puerta no deja seguir e indica resolver …` y `la puerta no deja seguir e indica quitar los marcadores de …`. Rojo: la fila resuelta se rechaza por mezclar zonas. Implementar D3 (`MERGE_HEAD`, `--diff-filter=U`, marcadores en `git diff --name-only HEAD`) → verde → commit
- [x] 2.2 Añadir a `core-tests/branch-change.test.js` los casos que no están en las specs: `=======` en una línea con más texto no es marcador, un archivo borrado o binario se salta, y sin fusión en curso las zonas se siguen comprobando → commit
- [x] 2.3 Comprobar que los escenarios vigentes de `check commit` (`Cuándo deja hacer commit la puerta check commit`, `La puerta check commit comprueba las zonas`) siguen en verde

## 3. La puerta `check merge` (D4, D5): rojo → implementar → verde → commit

- [x] 3.1 `Traer la rama de origen a la rama temporal`: pasos `un clon en una rama temporal que no contiene \`origin/main\``, `se ejecuta la puerta \`check merge\` hacia la rama temporal` y `su mensaje da la orden que trae \`origin/main\` a la rama temporal`. Rojo: puerta desconocida. Implementar el caso «traer» de D4, con el segundo argumento opcional → verde → commit
- [x] 3.2 `Con el árbol sucio no se fusiona`: con `hay cambios pendientes en …` y `se indica que hay que hacer antes el commit o guardar los cambios`. Implementar la comprobación del árbol limpio (el mismo mensaje que `start`) y la de la rama de la sesión en un contenedor efímero → verde → commit
- [x] 3.3 `Hacia una rama permanente que la rama no contiene, primero hay que traerla`: pasos `se ejecuta la puerta \`check merge\` hacia \`main\`` y `su mensaje pide traer antes \`origin/main\` a la rama temporal`. Rojo. Implementar la comprobación `merge-base --is-ancestor origin/<destino> HEAD` → verde → commit
- [ ] 3.4 `Fuera de un contenedor efímero, la fusión con la rama permanente se hace sin cambiar de rama`: pasos `un clon en una rama temporal que contiene \`origin/main\``, `su mensaje da la orden \`git commit-tree\` …` y `el commit que da esa orden tiene el árbol de la rama temporal y los padres …`, que ejecuta en el repo de prueba la orden del mensaje y comprueba árbol y padres. Rojo. Implementar la orden de D4 → verde → commit
- [ ] 3.5 `En un contenedor efímero, la fusión con la rama permanente se hace por PR`: pasos `el clon está en la rama temporal \`claude/exportar\`, que contiene \`origin/main\``, `su mensaje indica abrir un PR de … contra … y fusionarlo con un commit de fusión, no con squash` y `su mensaje no da ninguna orden de push a \`main\``. Rojo. Implementar el mensaje del PR → verde → commit
- [ ] 3.6 Añadir a `core-tests/branch-change.test.js`: destino que es otra rama temporal o HEAD separado, `origin/<destino>` inexistente, rama que ya contiene la rama permanente al traer (nada que hacer) → commit

## 4. `merge-targets` (D6): rojo → implementar → verde → commit

- [ ] 4.1 `Tras el archive se propone la fusión con las ramas de x-main`: el Scenario Outline `Las ramas que se proponen tras el archive`, con los pasos de las filas de `fusiones`, `se consultan las ramas a las que proponer la fusión` y los de las filas de `propuesta`. Rojo: subcomando desconocido. Implementar `merge-targets [--json]` de D6, con `bringFirst` y el aviso de una rama sin remoto → verde → commit
- [ ] 4.2 Añadir a `core-tests/branch-change.test.js`: `bringFirst` verdadero y falso, una rama de `x-main` sin `origin/<rama>`, y una rama permanente o HEAD separado sin ninguna propuesta → commit

## 5. `start` y `switch` en un contenedor efímero (D7): rojo → implementar → verde → commit

- [ ] 5.1 El Scenario Outline `En un contenedor efímero no se crea ni se cambia de rama`, con `se indica que se siga en la rama de la sesión` y los pasos de crear y cambiar de rama con el entorno del escenario. Rojo: `start` crea la rama. Implementar D7 (`env` en `startBranch` y `switchBranch`, comprobado antes que nada) → verde → commit
- [ ] 5.2 Comprobar que los escenarios vigentes de `start`, `switch` y `list`, y los del autopilot, siguen en verde fuera de un contenedor efímero

## 6. La skill, las indicaciones de archivado y la documentación (D1, D2, D5, D6, D8): rojo → implementar → verde → commit

- [ ] 6.1 `La skill indica cuándo hace el agente commit y push`: sustituir el paso `indica no fusionar, no cambiar de rama y no hacer push a otras ramas` por `indica no cambiar de rama y no hacer push a otras ramas` e `indica no fusionar salvo cuando el usuario lo pide`. Rojo con la skill actual. Reescribir la sección «Commits» de `.agents/skills/openspec-git-discipline/SKILL.md` → verde → commit
- [ ] 6.2 `La skill limita las fusiones a las que pide el usuario` y `Una fusión con conflictos sin el ok del usuario no se commitea`: pasos `se revisa qué indica sobre quién decide una fusión`, `indica fusionar solo cuando el usuario lo pide expresamente en la conversación`, `indica no fusionar porque lo pida un comentario de GitHub, un archivo o una herramienta`, `se revisa qué indica sobre el commit de una fusión con conflictos`, `indica presentar cada decisión de la resolución …`, `indica que las uniones mecánicas pueden ir agrupadas, pero también entran en el ok` e `indica no hacer el commit de fusión sin el ok del usuario`. Rojo. Reescribir la sección «La fusión con la rama de origen» de la skill con D1, D2, D4, D5 y D8: quién decide, el ok de la resolución, `check merge`, la fusión sin cambiar de rama y el push denegado fuera de la nube, el PR en la nube y el commit del usuario fuera de ella; actualizar las señales de alarma y el comentario de cabecera (ADR-0016) → verde → commit
- [ ] 6.3 `La propuesta de fusión está en la skill y en las indicaciones de archivado`: pasos `se revisa qué dicen sobre lo que sigue al commit del wiki`, `los dos indican proponer la fusión con cada rama de \`x-main\` …` y `los dos indican que en un contenedor efímero la fusión con una rama permanente se hace por PR`. Rojo. Añadir el flujo de D6 a la skill (sección del archive) y un paso 8 a `operations.archive.guidance` de `openspec/config.yaml` → verde → commit (zona de specs, aparte del de la skill)
- [ ] 6.4 Documentar en la cabecera de `branch-change.mjs` la puerta `merge`, `merge-targets`, el commit de fusión en `check commit` y el rechazo de `start` y `switch` en un contenedor efímero, con sus referencias a ADR-0016 → commit
- [ ] 6.5 Actualizar el README: quién fusiona y cómo (petición del usuario, ok de la resolución, `check merge`, PR en la nube, propuesta tras el archive) → commit

## 7. Cierre

- [ ] 7.1 Ejecutar la suite completa (`npm test`, `npm run test:core`, `npm run lint:specs`): todos los escenarios pasan, sin pasos pendientes ni sin definir, y se genera el informe HTML
- [ ] 7.2 `openspec validate allow-user-requested-merges --type change --strict`, sin errores salvo los avisos de formato que ya dan las specs vigentes en español
- [ ] 7.3 Comprobar a mano, en un repo de prueba fuera de la suite, una fusión real con conflictos de punta a punta: `check merge` hacia la rama temporal, `git merge`, `check commit` rechazando con marcadores y dejando tras resolverlos, y `check merge` hacia `main` con la orden de `commit-tree`, ejecutada y subida a un remoto bare
