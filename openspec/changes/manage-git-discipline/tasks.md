`acceptance-tests/` ya existe, así que se omite la puesta en marcha de la suite. Se trabaja con el ciclo de `spec-as-source`: rojo → implementar → verde → commit. Un commit nunca mezcla `openspec/` con la zona de código, salvo este `tasks.md`. En un contenedor efímero, los commits y el push los hace el agente, como manda este mismo change. Hasta que exista `check commit` (tarea 3.1), se comprueba a mano que cada commit es de una sola zona.

Los pasos pendientes salen de `npx cucumber-js --dry-run --format snippets` sobre `.extracted/changes/manage-git-discipline/specs/*/spec.feature`. Los repos de prueba se crean con `support/branches.js`, que se amplía con un remoto (un repo bare) y con clones superficiales. Las referencias D1 a D9 son las del `design.md` del change.

## 1. Preparación

- [x] 1.1 Comprobar que la suite efectiva está en verde antes de tocar nada, salvo los pasos sin definir de este change (`npm test`, `npm run test:core`)
- [x] 1.2 Ampliar `support/branches.js` con lo que necesitan los escenarios, con pruebas en `core-tests/`:
  - un remoto bare por proyecto, con push y fetch;
  - ramas remotas que van por delante de la local o han divergido de ella;
  - una fusión con squash;
  - un clon superficial (`--depth 1` desde `file://`) y uno sin acceso a su remoto;
  - variables de entorno del contenedor efímero para `branch-change.mjs` y para el núcleo del arranque.

  → commit

## 2. La referencia de origen y los changes de la rama (D1, D2): rojo → implementar → verde → commit

- [ ] 2.1 `openspec-change-lifecycle: La rama de origen local está atrasada respecto a la remota`: pasos `una rama de origen remota con el change archivado …`, `la rama de origen local está atrasada y no tiene ese change` y `una rama temporal que sale de la rama de origen remota`. Rojo con el `branch-change.mjs` actual. Implementar D1 (`originRef`, `merge-base --is-ancestor`) → verde → commit
- [ ] 2.2 `La rama de origen local y la remota han divergido`: pasos `la rama de origen local y la remota han divergido`, `una rama temporal que sale de la rama de origen local`, `el merge-base se calcula contra la rama de origen local` (por `originRef`) y `se avisa de que la rama de origen local y la remota han divergido` (por `warnings`) → commit
- [ ] 2.3 `Tras un squash, el change fusionado no cuenta en la rama temporal`: pasos `una rama temporal con el change archivado …`, `la rama temporal se ha fusionado con squash con la rama de origen` y `en la rama temporal se crea después el change …`. Rojo: «varios changes». Implementar D2 (comparar el árbol del directorio en `originRef` y en `HEAD`, sin cambios pendientes) → verde → commit
- [ ] 2.4 Comprobar que los escenarios vigentes de `openspec-change-lifecycle` y del autopilot siguen en verde con D1 y D2, y que la forma del resultado de `branchChange` solo gana `originRef`

## 3. Las puertas (D3, D4, D6): rojo → implementar → verde → commit

- [ ] 3.1 `En un contenedor efímero, el agente hace commit y push en la rama de la sesión`. Pasos:
  - el Scenario Outline `Cuándo deja hacer commit la puerta check commit`;
  - `un clon en la rama temporal … con cambios pendientes en una sola zona`;
  - los `la sesión está en un contenedor efímero …` / `no está en un contenedor efímero`;
  - `se ejecuta la puerta \`check commit\``;
  - `la puerta deja seguir` y `la puerta no deja seguir`.

  Rojo: la puerta no existe. Implementar `check commit` de D4, sin la comprobación de zonas → verde → commit
- [ ] 3.2 `La puerta no deja hacer commit en una rama permanente` y `Fuera de un contenedor efímero, los commits los hace el usuario`: pasos `un contenedor efímero con \`main\` guardada …`, `el clon está en la rama \`main\` con cambios pendientes`, `una sesión que no está en un contenedor efímero`, `se indica que los commits del agente van solo a una rama temporal` y `se indica que los commits los hace el usuario` → commit
- [ ] 3.3 `Commits provisionales de una sola zona`: el Scenario Outline `La puerta check commit comprueba las zonas`, con los pasos `hay cambios pendientes en …`, `un contenedor efímero con \`claude/exportar\` guardada …` y `el clon está en la rama temporal \`claude/exportar\``. Rojo con la mezcla de zonas. Implementar la clasificación de zonas de D4 → verde → commit
- [ ] 3.4 `Las puertas admiten las dos formas del ciclo`. Pasos:
  - `Proponer en la rama de origen`: `la rama de origen no tiene ningún change en curso`, `se ejecuta la puerta \`check propose\`` y `se avisa de que la forma recomendada es proponer en una rama temporal`;
  - `El mensaje de una puerta que no deja seguir dice cómo seguir`: `su mensaje dice cómo dejar un solo change en la rama`.

  Rojo. Implementar en `check propose` la rama permanente con aviso y reescribir los mensajes de rechazo de D3 → verde → commit
- [ ] 3.5 `Un change, una rama y una sola fusión`, apply de la forma canónica: escenario `El apply empieza con la propuesta ya fusionada en la rama de origen`, con los pasos `una rama de origen con el change en curso … sin tasks hechas`, `se lanza el apply de \`exportar-datos\` en la rama temporal` y `el apply no se detiene`. Rojo. Implementar el apply canónico de D3, en rama temporal sin change propio y en rama permanente → verde → commit
- [ ] 3.6 Archive de la forma canónica:
  - el Scenario Outline `El archive en la rama de origen`, con los pasos `la rama de origen tiene el change en curso … con todas las tasks hechas / con tasks sin hacer`, `se lanza la puerta \`check archive\` de …` y `la puerta no deja seguir e indica que faltan tasks por hacer`;
  - `El archive no se hace en una rama permanente`, con `la rama de origen no tiene el change en curso …`.

  Rojo. Implementar el archive canónico de D3 → verde → commit
- [ ] 3.7 `Números de ADR sin choques entre ramas`: el Scenario Outline `El archive comprueba los números de los ADRs nuevos`, con los pasos `la rama temporal añade el ADR …`, `la rama de origen tiene hasta …` / `la rama de origen tiene \`adr/{int}-…\`` y `la puerta no deja seguir e indica renumerar \`{int}\``. Rojo. Implementar en `check archive` la comprobación de D6, que también rechaza dos números iguales en el árbol de trabajo → verde → commit
- [ ] 3.8 Documentar en la cabecera de `branch-change.mjs` la puerta `commit`, las excepciones de la forma canónica y `originRef` → commit

## 4. El arranque de sesión (D5): rojo → implementar → verde → commit

- [ ] 4.1 Añadir a `core-tests/` una prueba de `prepare_git` del núcleo, con repos de prueba:
  - un clon superficial queda completo;
  - `main` atrasada y no extraída se pone al día con `update-ref`, y la extraída no se toca;
  - una rama divergida avisa;
  - sin remoto, avisa y sale con 0;
  - en un contenedor efímero se guarda `idd.sessionBranch`, y una ya guardada se conserva;
  - fuera de un contenedor efímero no se guarda nada.

  Rojo sin la función
- [ ] 4.2 Implementar `prepare_git` en `session-bootstrap.sh` antes de instalar dependencias, con `timeout` y `git fetch` solo en un contenedor efímero o para completar un clon superficial, y documentarla en la cabecera → verde la prueba de 4.1 → commit
- [ ] 4.3 `session-bootstrap: Clon completo y ramas permanentes al día al abrir sesión`. Pasos:
  - `un clon superficial del proyecto` / `… sin acceso a su remoto`;
  - `el clon deja de ser superficial`, `se avisa de que no se pudo completar el clon` y `la sesión arranca`;
  - el Scenario Outline `Qué hace el arranque con la rama permanente local`;
  - `La rama en la que está el clon no se toca`, con `un clon del proyecto en la rama permanente \`main\``, `\`main\` está atrasada respecto a \`origin/main\``, `\`main\` no cambia` y `el árbol de trabajo no cambia`.

  Se abre la sesión con los dos agentes simulados → verde → commit
- [ ] 4.4 `Rama de la sesión guardada en un contenedor efímero`: el Scenario Outline `Qué rama de la sesión queda guardada`, con los pasos `un clon del proyecto en la rama \`claude/exportar\``, `la sesión está en un contenedor efímero sin rama guardada / con \`claude/inicial\` guardada`, `la rama de la sesión guardada es …` y `no hay rama de la sesión guardada` → verde → commit

## 5. Textos de la skill, de config.yaml y de la guía del wiki (D6, D7, D8, D9): uno por escenario; rojo → escribir → verde → commit

- [ ] 5.1 Paso `la skill de disciplina de git del proyecto` (lee la skill, como `readSkill`) y `el commit del wiki va después del commit del archive`, con los pasos `indica hacer el commit del archive aparte` e `indica hacer el commit del wiki después del commit del archive`. Comprobar que está en verde con la skill actual → commit
- [ ] 5.2 Reescribir la skill `openspec-git-discipline` según D9:
  - las dos formas y cuándo conviene cada una;
  - las puertas, incluida `check commit`;
  - los commits del usuario y del agente;
  - `--no-ff` recomendado y el squash admitido;
  - las señales de alarma revisadas;
  - `git fetch` antes de archivar.

  Escenarios `La skill indica cuándo hace el agente commit y push`, `La skill recomienda la fusión con --no-ff` y `La skill admite el squash`, con sus pasos `indica …` y `recomienda …`. Rojo antes de reescribirla → verde → commit
- [ ] 5.3 Revisar los pasos vigentes que leen la skill o `config.yaml` y fijaban la redacción de ADR-0007, como `el artefacto queda sin commit` (`nunca hagas commits, ramas ni fusiones`) y la comprobación `tras fusionarla` de la resincronización. Ajustarlos a lo que pide la spec vigente, sin debilitarla → verde la suite de `openspec-change-lifecycle` → commit
- [ ] 5.4 `Cuándo conviene cada forma del ciclo, donde se archiva`: pasos `la skill de disciplina de git y el \`openspec/config.yaml\` del proyecto`, `se revisa qué dicen sobre dónde se archiva`, `los dos explican la forma recomendada y la forma canónica, con cuándo conviene cada una` y `ninguno trata la forma canónica como una infracción`. Escribir el texto en las indicaciones de archivado de `openspec/config.yaml` (zona de specs, commit aparte) → verde → commit
- [ ] 5.5 `Las reglas del artefacto adr miran todas las ramas remotas`: pasos `el \`openspec/config.yaml\` del proyecto`, `se consultan las instrucciones del artefacto \`adr\` de un change` (con `openspec instructions adr`), `indican hacer \`git fetch\` antes de numerar` e `indican tomar el número más alto …`. Añadir `rules.adr` a `openspec/config.yaml` (zona de specs) → verde → commit
- [ ] 5.6 `wiki-first-knowledge: Las indicaciones de archivado cubren el archive en la rama de origen`: pasos `se consultan las indicaciones de archivado para un change archivado en la rama de origen`, `indican calcular las rutas …` e `indican hacer el commit del wiki después del commit del archive`. Escribirlo en las indicaciones de archivado de `openspec/config.yaml` (zona de specs) → verde → commit
- [ ] 5.7 `wiki-first-knowledge: La guía indica resolver la cita por el blob del manifiesto`: pasos `indica tomar el blob de la ruta en el manifiesto citado`, `indica resolverlo con git por su blob` e `indica no tratar la cita como rota`, como sección de la guía con `assertGuideSection`. Escribir la sección en `.agents/wiki/guide.md` y comprobar que la guía y el recordatorio siguen dentro de sus límites → verde → commit

## 6. Documentación y cierre

- [ ] 6.1 README: las dos formas del ciclo, la fusión con `--no-ff` recomendada, los commits del agente en un contenedor efímero y la preparación de git del arranque, y enlazar ADR-0011 en lugar de ADR-0007 donde describa el ciclo → commit
- [ ] 6.2 Ejecutar la suite efectiva entera (`npm test` en `acceptance-tests/`): todos los escenarios de este change y de las specs vigentes pasan, sin pasos pendientes ni sin definir de este change, y se genera el informe HTML. Ejecutar también `npm run test:core` y `npm run lint:specs`
- [ ] 6.3 Comprobar en esta sesión en la nube, con el núcleo real:
  - que el arranque completa el clon, pone al día `main` y guarda la rama de la sesión;
  - que `check commit` deja seguir en `claude/magical-turing-3z291f` y no deja con zonas mezcladas;
  - que `check propose` en `main` avisa sin bloquear.
- [ ] 6.4 Ejecutar `openspec validate manage-git-discipline --type change --strict` antes del archive. Como en los changes anteriores, el criterio es la validación sin `--strict`; en modo estricto solo deben quedar los avisos de idioma (SHALL/MUST) y de formato (Gherkin en bloques de código)
