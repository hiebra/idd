`acceptance-tests/` ya existe, así que se omite la puesta en marcha de la suite. Se trabaja con el ciclo de `spec-as-source`: rojo → implementar → verde → commit. Un commit nunca mezcla `openspec/` con la zona de código, salvo este `tasks.md`. En un contenedor efímero, los commits y el push los hace el agente tras `check commit`, que también cuenta los archivos sin seguimiento: para separar zonas, se aparta una con `git stash push -u -- <rutas>`.

Los pasos pendientes salen de `npx cucumber-js --dry-run --format snippets` sobre `.extracted/changes/git-discipline-standard-with-exception/specs/openspec-change-lifecycle/spec.feature`. Las referencias D1 a D5 son las del `design.md` del change, y la tabla de las puertas es la de D2.

## 1. Preparación

- [x] 1.1 Comprobar que la suite efectiva está en verde antes de tocar nada, salvo los pasos sin definir de este change (`npm test`, `npm run test:core` y `npm run lint:specs` en `acceptance-tests/`)
- [x] 1.2 Ampliar `support/branches.js` para escribir `x-main-protected: true`, `x-main-protected: false` o ninguna clave en el `openspec/config.yaml` de la copia, junto a `x-main`, con una prueba en `core-tests/` → commit

## 2. La clave del veto (D1): rojo → implementar → verde → commit

- [x] 2.1 `El veto del acceso directo a las ramas permanentes se declara en la configuración`: el Scenario Outline `Cuándo hay excepción`, con los pasos `un proyecto con \`x-main-protected: true\``, `un proyecto con \`x-main-protected: false\``, `un proyecto sin la clave \`x-main-protected\``, `se consulta si el proyecto tiene la excepción a la regla del ciclo`, `la excepción está disponible` y `la excepción no está disponible`. Rojo: el estado de `--json` no tiene `protected`. Implementar en `branch-change.mjs` la lectura de la clave (`parseProtected`, `readProtected`) y exponerla como `protected` en el estado → verde → commit
- [x] 2.2 `OpenSpec acepta la clave x-main-protected`: paso `ninguno falla ni avisa por la clave \`x-main-protected\``, con el mismo mecanismo que el escenario de `x-main` → verde → commit

## 3. Las puertas (D2): rojo → implementar → verde → commit

- [x] 3.1 `La regla estándar del ciclo`, apply: escenarios `El apply en la rama de origen, sin avisos` y `El apply empieza con la propuesta ya fusionada en la rama de origen`, con los pasos `se lanza la puerta \`check apply\` de \`exportar-datos\`` y `la puerta no avisa de nada` (el `message` no contiene ningún aviso, solo la confirmación). Rojo: la puerta avisa de la forma recomendada. Quitar el aviso del apply en la rama permanente → verde → commit
- [ ] 3.2 `La excepción: el change entero en una rama temporal`, apply: el Scenario Outline `El apply con la propuesta solo en la rama temporal`, con el paso `la puerta no deja seguir e indica que la propuesta llegue antes a la rama de origen`. Rojo: sin la clave, la puerta deja seguir. Implementar el apply de la tabla de D2: sin veto, en una rama temporal o un worktree, solo con `proposal.md` del change en `originRef`; con veto, además el change de la rama → verde → commit
- [ ] 3.3 `La regla estándar del ciclo`, archive: el Scenario Outline `El archive en la rama de origen, con tasks hechas o sin hacer` y `El archive no se hace en una rama permanente sin el change en curso`, con el paso `se indica que el change no está en curso en la rama de origen`. Rojo: la puerta rechaza las tasks sin hacer. Quitar la comprobación de tasks y reescribir el mensaje del change que no está en curso → verde → commit
- [ ] 3.4 `La excepción: el change entero en una rama temporal`, archive: el Scenario Outline `El archive en la rama temporal`, con el paso `la puerta no deja seguir e indica archivar en la rama de origen tras fusionar la implementación`, y `Con la excepción, el archive y el wiki van en la rama temporal`. Rojo: sin la clave, la puerta deja seguir. Implementar el archive de la tabla de D2 → verde → commit
- [ ] 3.5 `Números de ADR sin choques entre ramas`: comprobar que el Scenario Outline `El archive comprueba los números de los ADRs nuevos`, ya con `x-main-protected: true`, sigue en verde, y que la comprobación de ADRs también se hace en el archive en la rama de origen → commit si hay cambios
- [ ] 3.6 `Las puertas admiten la regla sin avisos y la excepción solo con su causa`. Pasos:
  - `Proponer en la rama de origen, sin avisos`, con `la puerta no avisa de nada`;
  - el Scenario Outline `Proponer en una rama temporal`, con `se avisa de que la regla prefiere proponer en la rama de origen`;
  - el Scenario Outline `Una rama temporal con varios changes`, con `la puerta no deja seguir y su mensaje dice cómo dejar un solo change en la rama`.

  Rojo. Implementar `check propose` de la tabla de D2 y que, sin veto, el estado `several` no impida el propose ni el apply → verde → commit
- [ ] 3.7 Comprobar que los escenarios vigentes del autopilot siguen en verde. Donde den por hecha la forma de una rama, declarar `x-main-protected: true` en su `Given`, sin debilitarlos (D5) → commit
- [ ] 3.8 Documentar en la cabecera de `branch-change.mjs` la clave `x-main-protected`, la tabla de las puertas y el campo `protected` → commit

## 4. La skill, las indicaciones de archivado y la documentación (D3, D4): rojo → implementar → verde → commit

- [ ] 4.1 Reescribir `.agents/skills/openspec-git-discipline/SKILL.md` según D3:
  - la estándar del origen (blob `835e065`) traducida, con su estructura: regla central, puertas, comprobaciones obligatorias y señales de alarma;
  - las comprobaciones hechas con `branch-change.mjs check`;
  - la excepción en una sección propia, con su causa y la clave;
  - los commits, los commits del agente, el squash y los ADR, sin cambios;
  - los identificadores `lifecycle:<id>`.

  Escenarios `La skill recomienda la fusión con --no-ff en la excepción` (pasos `indica que, con la excepción, la rama llega a la rama de origen en una fusión con \`--no-ff\`` e `indica que el squash también se admite`) y `Sin la excepción, la skill no deja al modelo crear ramas por su cuenta` (pasos `indica que solo con la excepción el modelo crea o cambia de rama con \`branch-change.mjs\`` e `indica que sin la excepción solo lo hace si el usuario lo pide`). Rojo antes de reescribirla → verde → commit
- [ ] 4.2 `La forma de una rama se presenta como excepción justificada`: pasos `los dos dicen que la regla es archivar en la rama de origen tras fusionar la implementación`, `los dos presentan la forma de una rama como excepción, con su causa y la clave \`x-main-protected\`` y `ninguno recomienda la excepción sobre la regla`. Reescribir el primer punto de las indicaciones de archivado de `openspec/config.yaml` (zona de specs, commit aparte) → verde → commit
- [ ] 4.3 Revisar los pasos vigentes que leen la skill o `config.yaml` y fijaban la redacción de ADR-0015 («forma recomendada», «forma canónica»). Ajustarlos a la spec, sin debilitarla, y quitar las definiciones de pasos que solo usaban los requisitos eliminados → verde la suite de `openspec-change-lifecycle` → commit
- [ ] 4.4 README: el ciclo como la regla estándar con su excepción, la clave `x-main-protected`, que el autopilot necesita la excepción, y ADR-0020 en lugar de ADR-0015 y ADR-0013 donde describa el ciclo → commit

## 5. La clave en este repositorio y cierre

- [ ] 5.1 Preguntar al usuario si este repositorio declara `x-main-protected: true`, teniendo en cuenta que los proyectos creados desde la plantilla heredan su `openspec/config.yaml` (pregunta abierta 1 del design). Sin la clave, este change no se podrá archivar en la rama de la sesión. Aplicar su respuesta en `openspec/config.yaml` (zona de specs) → commit
- [ ] 5.2 Ejecutar la suite efectiva entera (`npm test` en `acceptance-tests/`): todos los escenarios de este change y de las specs vigentes pasan, sin pasos pendientes ni sin definir de este change, y se genera el informe HTML. Ejecutar también `npm run test:core` y `npm run lint:specs`
- [ ] 5.3 Comprobar en esta sesión, con el `branch-change.mjs` real, la tabla de D2 en la rama de la sesión con veto y sin veto, usando un worktree o una copia para no tocar la configuración del clon
- [ ] 5.4 Ejecutar `openspec validate git-discipline-standard-with-exception --type change --strict` antes del archive. Como en los changes anteriores, el criterio es la validación sin `--strict`; en modo estricto solo deben quedar los avisos de idioma (SHALL/MUST), de formato (Gherkin en bloques de código) y de longitud de los requisitos
- [ ] 5.5 Al archivar, actualizar el `Purpose` de `openspec/specs/openspec-change-lifecycle/spec.md`, que el archive no toca y hoy describe la forma de una rama como el ciclo (zona de specs, en el commit del archive)
