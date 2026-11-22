# Tasks: guiar-revision-con-tests

La suite ya existe (`acceptance-tests/`, `stack: javascript`), así que no hace falta montarla. Cada task de la sección 1 sigue el ciclo: el escenario falla por la razón esperada, se implementa, pasa y se hace commit. Los commits no mezclan `openspec/` con el resto, salvo este `tasks.md`.

## 1. Pasos y reviewPrompt (zona de código): rojo → implementar → verde → commit

- [ ] 1.1 <!-- openspec-autopilot: Las revisiones de código se guían con los tests de aceptación --> Definir los pasos: abrir la revisión de la task 3 y la del verify, y las aserciones sobre la instrucción. Ver que fallan con el `reviewPrompt` actual. Implementar D1 y D2 en `.opencode/plugins/openspec-autopilot/lib/prompts.mjs`.
- [ ] 1.2 <!-- openspec-autopilot: La revisión de un artefacto del plan no ejecuta tests ni código --> Definir los pasos y ver que pasa con 1.1 y que fallaría si el bloque se añadiera a todas las revisiones.

## 2. Documentación (zona de código)

- [ ] 2.1 Actualizar el comentario de cabecera de `prompts.mjs` con el bloque de verificación.

## 3. Cierre

- [ ] 3.1 Ejecutar la suite completa con los deltas del change y `npm run test:core`: todos los escenarios pasan, cero pasos pendientes o sin definir, informe HTML generado.
- [ ] 3.2 Comprobar con OpenCode real que el agente `plan` de una revisión de task puede ejecutar el runner de aceptación tras el permiso del usuario. Anotar aquí el resultado.
