# Tasks: limite-de-verificacion-y-mcp-de-depuracion

La suite ya existe (`acceptance-tests/`, `stack: javascript`), así que la sección de montaje no hace falta. Ninguna task ejecuta tests: cada una implementa sus pasos y lo que cubren, y se hace commit. La suite se ejecuta una sola vez, al final, en la task 5.1, antes del archive. Los commits no mezclan `openspec/` con el resto, salvo este `tasks.md`.

Este `tasks.md` ya sigue la regla que añade el change (design D1 a D3): cada task lleva su estimación de verificación, calculada con la referencia de la regla, y ninguna pasa de 15 minutos. El total estimado es de unos 100 minutos en 13 tasks.

El contrato y sus ejemplos son copias literales de los anexos del design. No se leen al verificarlos: se comprueban con esta orden, desde la raíz del proyecto.

```bash
node -e '
const fs = require("fs");
const design = fs.readFileSync("openspec/changes/limite-de-verificacion-y-mcp-de-depuracion/design.md", "utf8");
const anexos = [...design.matchAll(/```json\n([\s\S]*?)\n```/g)].map((m) => JSON.parse(m[1]));
const archivos = [".agents/debug/contract.json", ".agents/debug/examples/java-liberty.json", ".agents/debug/examples/react-vite.json"];
archivos.forEach((archivo, i) => {
  if (!fs.existsSync(archivo)) return console.log(archivo, "no existe");
  const igual = JSON.stringify(JSON.parse(fs.readFileSync(archivo, "utf8"))) === JSON.stringify(anexos[i]);
  console.log(archivo, igual ? "igual al anexo" : "DISTINTO del anexo");
});'
```

## 1. El límite de verificación (`task-verification-limit`)

- [x] 1.1 <!-- task-verification-limit: Las reglas del artefacto tasks llevan el límite de verificación --> <!-- task-verification-limit: Las reglas del artefacto tasks piden la estimación de cada task --> (zona de código) Definir en `acceptance-tests/step-definitions/task-verification-limit.steps.js` el paso que consulta las instrucciones del artefacto `tasks` con el CLI real, como el del artefacto `adr` de `change-lifecycle.steps.js`, y los cinco pasos sobre sus reglas. (verificación: ~9 min)
- [x] 1.2 (zona de specs, en un commit aparte) Añadir a `rules.tasks` de `openspec/config.yaml` la regla literal del design D1. (verificación: ~4 min)

## 2. El contrato del MCP de depuración (`debug-mcp-contract`), zona de código

- [x] 2.1 <!-- debug-mcp-contract: El contrato declara sus dos tools --> <!-- debug-mcp-contract: Cada tool se declara de solo lectura --> Añadir `ajv` a las dependencias de desarrollo de `acceptance-tests/` y crear `acceptance-tests/support/debug-contract.js` (design D14): lee `.agents/debug/contract.json` de la copia del proyecto y compila los esquemas de cada tool con JSON Schema 2020-12 en modo estricto. Definir los pasos de los dos escenarios en `step-definitions/debug-contract.steps.js`. Crear `.agents/debug/contract.json` como copia literal del anexo A, comprobada con la orden de arriba. (verificación: ~13 min)
- [x] 2.2 <!-- debug-mcp-contract: El árbol de trabajo se pasa como parámetro --> <!-- debug-mcp-contract: La descripción de debug_launch_plan dice lo que el modelo puede ejecutar --> <!-- debug-mcp-contract: El contrato enumera los errores de ejecución --> Definir los pasos de los tres escenarios, que comprueban sobre el contrato de 2.1 el parámetro `workspace`, la frase de la descripción y los códigos de error. (verificación: ~11 min)
- [x] 2.3 <!-- debug-mcp-contract: Un árbol de trabajo sin nada que depurar es una respuesta válida --> <!-- debug-mcp-contract: Lo que no admite una respuesta de debug_targets --> Añadir a `support/debug-contract.js` una respuesta válida de `debug_targets` y los tres defectos del escenario, cada uno como un cambio sobre esa respuesta. Definir el paso que valida una respuesta y los dos que dicen si cumple el contrato. (verificación: ~9 min)
- [x] 2.4 <!-- debug-mcp-contract: Lo que no admite una respuesta de debug_launch_plan --> <!-- debug-mcp-contract: Lo que no admite un paso --> Añadir a `support/debug-contract.js` un plan válido y los siete defectos de los dos escenarios. Sirven los pasos de 2.3; un defecto que no esté en el soporte hace fallar el paso diciéndolo, y no pasa por omisión. (verificación: ~10 min)
- [x] 2.5 <!-- debug-mcp-contract: Los ejemplos cumplen el contrato --> Definir los pasos del escenario. Crear `.agents/debug/examples/java-liberty.json` y `.agents/debug/examples/react-vite.json` como copia literal del anexo B, comprobada con la orden de arriba. (verificación: ~7 min)

## 3. La revisión (`openspec-autopilot`), zona de código

- [x] 3.1 <!-- openspec-autopilot: Las revisiones de código usan el MCP de depuración si la sesión lo tiene --> Definir los cuatro pasos. Sustituir en `ACCEPTANCE` (`lib/prompts.mjs`) la frase de la depuración por la del design D13. (verificación: ~9 min)
- [x] 3.2 <!-- openspec-autopilot: La revisión de una task empieza por su estimación y por el límite --> Definir los dos pasos. Añadir a `reviewPrompt` el texto de la revisión de una task del design D4. (verificación: ~5 min)
- [x] 3.3 <!-- openspec-autopilot: Las revisiones del plan de tasks comprueban las estimaciones --> <!-- openspec-autopilot: Las demás revisiones no hablan del límite de verificación --> Ampliar el paso «el plugin abre la revisión…» con el artefacto `tasks`, con una rama nueva en `reachReview`, y con «del verify». Definir los pasos. Añadir a `reviewPrompt` el texto del artefacto `tasks` y de los cambios en el plan del design D4, solo en esas revisiones. (verificación: ~10 min)

## 4. Documentación (zona de código)

- [x] 4.1 `README.md`: el límite de verificación y cómo se cambia; el contrato del MCP de depuración, con lo que hace cada tool y lo que el servidor no hace; y cómo se conecta un servidor que lo cumpla (design D15), con enlace a ADR-0027. `acceptance-tests/README.md`: los pasos nuevos y `ajv`. Cabecera de `prompts.mjs`: los textos nuevos de la revisión. (verificación: ~9 min)

## 5. Cierre

- [x] 5.1 Ejecutar en `acceptance-tests/` la suite completa (`npm test`), `npm run test:core` y `npm run lint:specs`: todos los escenarios en verde, sin pasos pendientes ni sin definir, y con el informe HTML generado. Anotar aquí el resultado. (verificación: ~5 min)
  - Resultado (2026-11-23, en la nube, tras fusionar `origin/main` en `06f4b2f`, que trae `run-full-suite-once-per-change`): 352 de 367 escenarios pasan, sin pasos pendientes ni sin definir, y se genera el informe HTML. Los 15 que fallan son todos de `windows-readiness`, por falta de `pwsh` en el contenedor (entorno Default; el modo automático denegó instalarlo). Decidido con el usuario: es un fallo conocido del entorno, como en `reorder-wiki-resync`, y este change no toca nada de Windows. `test:core` 234/234 y `lint:specs` salen con 0.
- [ ] 5.2 Ejecutar `openspec validate limite-de-verificacion-y-mcp-de-depuracion --type change --strict` y anotar aquí el resultado: ningún error, y avisos solo de los tipos ya conocidos. (verificación: ~2 min)
