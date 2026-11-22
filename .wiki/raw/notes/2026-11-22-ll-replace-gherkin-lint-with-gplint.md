---
title: "Lessons Learned: el lint de las specs con gplint (replace-gherkin-lint-with-gplint)"
type: notes
source: session
ingested: 2026-11-22
tags: [lessons-learned, gplint, gherkin-lint, spec-as-source, acceptance-tests, git, replace-gherkin-lint-with-gplint]
lesson_kind: lessons-learned
lesson_count: 6
category: notes
confidence: high
summary: "Seis lecciones del change que sustituye gherkin-lint por gplint: gplint sale con 0 ante un nivel desconocido, gherkin-lint no revisaba los escenarios dentro de Rule:, un #### Scenario: sin nombre desaparece en la extracción, dos ejecuciones de la suite se pisan .extracted/, el main local de una sesión en la nube puede ir por detrás y py_compile deja __pycache__ en las skills."
---

# Lessons Learned: el lint de las specs con gplint

> Sesión del 2026-11-22 (change `replace-gherkin-lint-with-gplint`), con `gplint` 2.6.2 y `gherkin-lint` 4.2.4. Todo es [comprobado] ejecutando las herramientas sobre el extractor del proyecto salvo que se indique otra cosa. Fuente de la herramienta: [gplint](../articles/2026-11-22-gplint.md).

## Lección 1: gplint sale con 0 si la configuración tiene un nivel que no conoce

**Category**: gotcha
**Context**: Trasladar la configuración de `gherkin-lint` a `gplint`. `gherkin-lint` usaba el nivel `"on"`.
**Symptom**: Con `{"no-trailing-spaces": "on"}`, `gplint` imprime `Error running gplint Error: Unknown level on for no-trailing-spaces.` con su traza, y sale con 0. Con `-f json` no da informe.
**Root cause**: `gplint` 2.0 eliminó el nivel `"on"` (solo admite `"off"`, `"warn"` y `"error"`), y el error de un nivel desconocido no cambia el código de salida.
**Fix**: La configuración solo usa `"error"` y `"off"`; un test del núcleo lo comprueba, y el paso "el lint termina sin errores" exige además que haya informe.
**Rule**: No te fíes del código de salida de `gplint` para saber si revisó algo: comprueba que dio informe, y que falla ante un defecto conocido. Al migrar desde `gherkin-lint`, cambia todos los `"on"` por `"error"`.

## Lección 2: gherkin-lint no revisaba ningún escenario de las specs extraídas

**Category**: discovery
**Context**: La skill `acceptance-test-authoring` ya avisaba de que las reglas de AST de `gherkin-lint` no entran en los hijos de `Rule:`.
**Root cause**: La extracción de `spec-as-source` convierte cada `### Requirement:` en un `Rule:`, así que todos los escenarios de una spec extraída están dentro de uno. Las reglas que miran escenarios (`no-scenario-outlines-without-examples`, `no-examples-in-scenarios`, `no-unnamed-scenarios`, `no-duplicate-tags`) no revisaban ninguno. Solo funcionaban las reglas de líneas, como `no-trailing-spaces`.
**Fix**: Con una spec de prueba pasada por `extract-gherkin.cjs`, `gplint` informó del Outline sin `Examples`, de los `Examples` en un Scenario y del espacio final, cada uno en su línea del `spec.md`; `gherkin-lint` solo, del espacio.
**Rule**: Una limitación de una herramienta que parece menor puede anularla entera con la forma concreta de tus archivos: pruébala con un defecto en un archivo real del proyecto, no en uno de ejemplo.

## Lección 3: Un `#### Scenario:` sin nombre desaparece en la extracción

**Category**: gotcha
**Context**: Probar si `gplint` detecta un escenario sin nombre.
**Symptom**: Ninguna de las dos herramientas informa de nada.
**Root cause**: El patrón de escenario de `extract-gherkin.cjs` exige un nombre (`(.+?)`), así que un encabezado vacío se trata como prosa y se deja en blanco. Sus pasos quedan directamente bajo el `Rule:` y el parser los toma como descripción. No es un fallo del linter.
**Fix**: Queda fuera de alcance del change; si se trata, empieza por `EXTRACTION.md`, el contrato de la extracción.
**Rule**: Antes de atribuir a un linter que no detecte algo, mira el `.feature` extraído: puede que el defecto no llegue a él.

## Lección 4: Dos ejecuciones de la suite a la vez se pisan .extracted/

**Category**: gotcha
**Context**: Lanzar la suite completa en segundo plano y querer ejecutar mientras tanto un solo escenario.
**Root cause**: `cucumber.cjs` llama a `extractAll()` al cargar la configuración, y `npm run lint:specs` también extrae: los dos borran y reconstruyen `.extracted/`, que es de donde lee la otra ejecución.
**Fix**: Esperar a que termine la primera. Lo que no pasa por cucumber (por ejemplo, llamar a `support/spec-lint.js` con node, que extrae en un directorio temporal) sí se puede ejecutar a la vez. Por lo mismo, los escenarios de `spec-lint` no ejecutan `lint:specs` tal cual.
**Rule**: No ejecutes a la vez dos comandos de `acceptance-tests/` que extraigan a `.extracted/`; para probar algo en paralelo, extrae en otro directorio.

## Lección 5: En una sesión en la nube, el main local puede ir por detrás de origin/main

**Category**: gotcha
**Context**: La puerta `branch-change.mjs check propose` en una rama recién creada desde el último `main`.
**Symptom**: `La rama '…' tiene varios changes (…); tiene que quedar uno solo`, con changes ya archivados y fusionados en `main`.
**Root cause**: El clon tenía un `main` local antiguo, y la puerta calcula los changes de la rama desde el merge-base con el `main` local, no con `origin/main`.
**Fix**: Comprobar que `main` es ancestro de `origin/main` y adelantarlo solo por avance rápido con `git fetch origin main:main`, que git rechaza si no lo es. Un `git branch -f` sobre la rama permanente lo puede bloquear el modo automático.
**Rule**: Si una puerta del ciclo da changes que ya están en `main`, compara el `main` local con `origin/main` antes de tocar nada.

## Lección 6: py_compile deja un __pycache__ dentro de la skill

**Category**: gotcha
**Context**: Comprobar la sintaxis de `references/python/run_acceptance.py` de la skill tras editarlo.
**Symptom**: `python3 -m py_compile` creó `references/python/__pycache__/run_acceptance.cpython-313.pyc`, y `git add .agents/skills` lo metió en un commit.
**Root cause**: `py_compile` escribe el bytecode junto al archivo, y el `.gitignore` del proyecto no ignora `__pycache__/`.
**Fix**: Un commit aparte que lo borra.
**Rule**: Para comprobar la sintaxis de Python dentro del repositorio, usa `python3 -c "import ast,sys; ast.parse(open(sys.argv[1]).read())" <archivo>`, que no escribe nada, y revisa `git status` antes de `git add` de un directorio entero.
