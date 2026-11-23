# Tasks: apply-progress-mirror

La suite ya existe (`acceptance-tests/`, `stack: javascript`), así que no hace falta montarla. Cada task de pasos sigue el mismo ciclo: el escenario falla por la razón esperada, se implementa, pasa y se hace commit. `openspec/config.yaml` y este `tasks.md` son neutros entre zonas; los commits no mezclan el resto de `openspec/` con el código. Para ver el rojo de un escenario que ya pasaría, se prueba sobre una copia desechable del proyecto con el defecto que el escenario detecta.

## 1. Helpers de la suite (zona de código), D5

- [x] 1.1 Generalizar los helpers para que admitan otras indicaciones de apply junto al bloque de «una task por sesión»:
  - `withoutBlock` de `step-definitions/apply-guidance.steps.js` quita solo las líneas del bloque y poda `guidance:` y `apply:` si quedan sin elementos;
  - el `Given` de «Sin indicaciones de apply previas no quedan claves vacías» parte del proyecto sin la indicación de la lista de tareas;
  - `core-tests/apply-guidance.test.js` («the project config.yaml keeps every other byte in both modes») compara con el resultado de `adjust`, sin contar las claves que crea.

  Rojo: en una copia con la indicación de la spec al principio de `operations.apply.guidance`, fallan esas tres comprobaciones. Verde: pasan los 9 escenarios del bloque y `apply-guidance.test.js`, con la indicación y sin ella.

## 2. Pasos de aceptación (zona de código): `apply-progress`

- [x] 2.1 «El CLI da la indicación de la lista de tareas». Primero, los pasos `When se piden las instrucciones de apply de …` y `Then la primera indicación de apply es la de la lista de tareas`, que leen el texto literal de la spec. Rojo, porque el proyecto aún no tiene la indicación. Después, añadir la indicación al principio de `operations.apply.guidance` de `openspec/config.yaml` (D1, D2). Verde, y siguen en verde los 9 escenarios del bloque.
- [ ] 2.2 «La indicación sigue la primera en los dos modos» (Scenario Outline, sus dos filas): los pasos `Given … tiene la indicación de la lista de tareas` y `And las indicaciones de una task por sesión <van después de ella|no están>`. Rojo en una copia con la indicación detrás del bloque; verde con el proyecto.
- [ ] 2.3 «Ida y vuelta entre los modos», con los pasos existentes del cambio de modo. Rojo en una copia con la indicación detrás del bloque, porque el archivo no vuelve a quedar igual; verde con el proyecto.
- [ ] 2.4 «Ningún archivo versionado activa la lista de tareas»: los pasos `Given el proyecto`, `When se leen sus archivos de configuración de los agentes` y `Then ninguno activa la herramienta de lista de tareas`. Comprueban `.claude/settings.json` (`env.CLAUDE_CODE_ENABLE_TODO_TOOLS`) y cualquier configuración de OpenCode del proyecto (`opencode.json`, `opencode.jsonc`, `.opencode/opencode.json` con `experimental.todo`). Rojo en una copia con la variable en `.claude/settings.json`; verde con el proyecto.

## 3. Documentación (zona de código), D4

- [ ] 3.1 README, en la sección del modo auto: la lista de apply tiene la indicación de la lista de tareas además de las cuatro de una task por sesión, y es igual en los dos modos. Añadir cómo activar la lista en local en cada agente: `CLAUDE_CODE_ENABLE_TODO_TOOLS=1` en `.claude/settings.local.json` o en el entorno, y `experimental.todo: true` en la configuración global de OpenCode. Explicar que sin la herramienta la indicación no hace nada.

## 4. Cierre

- [ ] 4.1 Ejecutar la suite completa (`npm test`, `npm run test:core` y `npm run lint:specs` en `acceptance-tests/`): todos los escenarios en verde, sin pasos pendientes ni sin definir, y con el informe HTML generado. Los de `windows-readiness` necesitan `pwsh`; si la máquina no lo tiene, anotarlo.
- [ ] 4.2 Ejecutar `openspec validate apply-progress-mirror --type change --strict`: ningún `[ERROR]`.
