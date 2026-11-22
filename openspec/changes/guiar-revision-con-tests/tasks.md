# Tasks: guiar-revision-con-tests

La suite ya existe (`acceptance-tests/`, `stack: javascript`), así que no hace falta montarla. Cada task de la sección 1 sigue el ciclo: el escenario falla por la razón esperada, se implementa, pasa y se hace commit. Los commits no mezclan `openspec/` con el resto, salvo este `tasks.md`.

## 1. Pasos y reviewPrompt (zona de código): rojo → implementar → verde → commit

- [x] 1.1 <!-- openspec-autopilot: Las revisiones de código se guían con los tests de aceptación --> Definir los pasos: abrir la revisión de la task 3 y la del verify, y las aserciones sobre la instrucción. Ver que fallan con el `reviewPrompt` actual. Implementar D1 y D2 en `.opencode/plugins/openspec-autopilot/lib/prompts.mjs`.
- [x] 1.2 <!-- openspec-autopilot: La revisión de un artefacto del plan no ejecuta tests ni código --> Definir los pasos y ver que pasa con 1.1 y que fallaría si el bloque se añadiera a todas las revisiones.

## 2. Documentación (zona de código)

- [x] 2.1 Actualizar el comentario de cabecera de `prompts.mjs` con el bloque de verificación.

## 3. Cierre

- [x] 3.1 Ejecutar la suite completa con los deltas del change y `npm run test:core`: todos los escenarios pasan, cero pasos pendientes o sin definir, informe HTML generado.
- [x] 3.2 Comprobar con OpenCode real que el agente `plan` de una revisión de task puede ejecutar el runner de aceptación tras el permiso del usuario. Anotar aquí el resultado.
  - Resultado (2026-11-22, OpenCode 2.3.2, UI web manejada con Playwright, en un clon de la rama fuera del repositorio con un change de prueba `saludar` de una task): el autopilot hizo la task con `build` y abrió la revisión con el agente `plan` y la instrucción nueva. El modelo localizó el escenario de la task, lo ejecutó solo a él (`npx cucumber-js --name "Saludar a Ana"`, en verde) y explicó el resultado; `git status` quedó con solo lo del stage (`.extracted/` y `reports/` están ignorados); y dio al usuario, sin lanzarla, la orden `cd acceptance-tests && node --inspect-brk node_modules/.bin/cucumber-js --name "Saludar a Ana"`, con los puntos de ruptura en `saludar` y en el paso When. La orden funciona: con `--inspect` el depurador escucha y el escenario pasa.
  - El agente `plan` ejecutó el runner sin pedir permiso: con la configuración por defecto de OpenCode 2.3.2, la shell no le pide confirmación.
  - Una sesión del autopilot de este repositorio que no era la revisión de una task anotó antes aquí que `plan` no ejecuta la shell; no lo hizo porque no era la sesión operativa, así que esa nota no valía y se ha sustituido.
