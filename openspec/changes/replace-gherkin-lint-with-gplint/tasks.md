# Tasks: replace-gherkin-lint-with-gplint

La suite ya existe (`acceptance-tests/`, `stack: javascript`), así que no hace falta montarla. Las tasks de la sección 2 siguen el ciclo de siempre: el escenario falla por la razón esperada, se implementa, pasa y se hace commit. Los commits no mezclan `openspec/` con el resto, salvo este `tasks.md`.

## 1. Herramienta (zona de código)

- [x] 1.1 En `acceptance-tests/`, `npm install -D gplint@^2.6.2` y crear `.gplintrc` desde `.gherkin-lintrc` según D2: mismas reglas, `"on"` → `"error"`, cabecera que nombra `gplint`. Mientras tanto, `gherkin-lint` y el script `lint:specs` se quedan como están.
- [x] 1.2 Ejecutar la suite con el delta del change: los escenarios de `spec-lint` salen con pasos sin definir y el resto pasa.
  - Resultado: 141 escenarios, 137 pasan y 4 sin definir (los de `spec-lint`).

## 2. spec-lint (zona de código): por escenario, rojo → implementar → verde → commit

- [x] 2.1 "Un defecto en un escenario de un requisito hace fallar el lint", con sus tres ejemplos. Según D4, el World escribe un `openspec/` temporal con una spec de un requisito y un defecto, guarda la línea del defecto, extrae con `extract-gherkin.cjs` y pasa `gplint` con `-c .gplintrc -f json`. Definir los pasos. Para ver el rojo por la razón esperada, pasar los mismos ejemplos con `gherkin-lint` y su configuración en lugar de `gplint`: fallan el del Scenario Outline sin `Examples` y el de `Examples` en un Scenario, y pasa el del espacio final. Con `gplint`, pasan los tres. Anotar aquí el resultado.
  - Resultado, con `support/spec-lint.js` apuntado a `gherkin-lint` y `.gherkin-lintrc`: el Scenario Outline sin `Examples` y los `Examples` en un Scenario salen con 0 y ningún error, así que fallan en "el lint falla". El espacio final sale con 1, como se esperaba, pero el paso de la línea tampoco lee su error, porque el JSON de `gherkin-lint` tiene otra forma; con su informe normal, `gherkin-lint` sí da la línea 14. Con `gplint`, los tres pasan, con un solo error en la línea del defecto (11, 11 y 14).
- [x] 2.2 "El lint de las specs del proyecto termina sin errores": definir los pasos, con la extracción del `openspec/` del proyecto en un directorio temporal. Para ver el rojo, pasarlo con una configuración con un nivel `"on"` (D2): `gplint` sale con 0 sin revisar nada, así que se comprueba además que la salida en JSON se puede leer. Anotar qué se ve.
  - Resultado: con `"no-trailing-spaces": "on"`, `gplint` imprime `Unknown level on` y sale con 0 sin informe; el paso falla en "the lint gave no report". Con `.gplintrc`, las 8 specs (7 vigentes y el delta de este change) pasan sin errores.

## 3. Sustitución (zona de código)

- [ ] 3.1 Cambiar el script `lint:specs` a `node extract-gherkin.cjs && gplint .extracted`, `npm uninstall gherkin-lint` y borrar `.gherkin-lintrc`. `npm run lint:specs` termina sin errores.
- [ ] 3.2 En `core-tests/`, un test que compruebe que `lint:specs` es exactamente `node extract-gherkin.cjs && gplint .extracted` y que `.gplintrc` solo usa los niveles `"error"` y `"off"` (D4 y el riesgo del nivel desconocido).
- [ ] 3.3 `npm audit` en `acceptance-tests/` no informa de las vulnerabilidades de `gherkin-lint`. Anotar aquí el resultado.

## 4. Skills y documentación (zona de código)

- [ ] 4.1 En `.agents/skills/acceptance-test-authoring/`, según D2 y D3:
  - `references/gherkin-lintrc.json` → `references/gplintrc.json`, igual que `.gplintrc`;
  - `SKILL.md`: la tabla de referencias, "Linting Specs" y el comando previo a la suite, con `npx gplint@2`;
  - `references/javascript/SETUP.md`: la tabla de archivos, las devDependencies, el script y "Linting", sin la limitación de los hijos de `Rule:`;
  - `references/python/SETUP.md` y `references/python/run_acceptance.py`: `.gplintrc` y `npx gplint@2`;
  - `references/EXTRACTION.md`: nombrar `gplint`.
- [ ] 4.2 En `.agents/skills/spec-as-source/references/tasks.md`, la task 1.6 nombra `gplint`.
- [ ] 4.3 En `acceptance-tests/README.md`: `.gplintrc` en la estructura y una sección de los escenarios de `spec-lint` que explique D4.
- [ ] 4.4 Ninguna referencia a `gherkin-lint` fuera de `openspec/changes/`, `adr/` y `.wiki/` (que se actualiza en la resincronización del archive).

## 5. Cierre

- [ ] 5.1 Ejecutar la suite completa con el delta del change, `npm run test:core` y `npm run lint:specs`: todo pasa, cero pasos pendientes o sin definir, informe HTML generado.
