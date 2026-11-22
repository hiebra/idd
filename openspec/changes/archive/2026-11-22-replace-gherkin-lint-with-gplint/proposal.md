## Why

El lint de las specs (`npm run lint:specs`) usa `gherkin-lint` 4.2.4, que arrastra `gherkin` → `cucumber-messages` → `protobufjs` y `uuid` en versiones vulnerables: `npm audit` en `acceptance-tests/` informa de 6 vulnerabilidades (5 altas y 1 moderada). `npm audit fix --force` no las arregla, porque baja `gherkin-lint` a la 0.0.15. El paquete no se mantiene y no hay versión que las corrija.

`gplint` es el fork mantenido de `gherkin-lint` (2.6.2, noviembre de 2026). Parsea con `@cucumber/gherkin` 42, tiene las mismas reglas y `npm audit` no le encuentra vulnerabilidades. Además, sus reglas de AST entran en los hijos de `Rule:`, y `gherkin-lint` no. Como la extracción convierte cada `### Requirement:` en un `Rule:`, hoy las reglas que miran escenarios (por ejemplo, `no-scenario-outlines-without-examples` y `no-examples-in-scenarios`) no se aplican a ningún escenario de las specs. Lo comprobó el 2026-11-22 una spec de prueba pasada por el extractor del proyecto: `gplint` informa de los tres defectos, en su línea del `spec.md`, y `gherkin-lint`, solo del espacio final.

## What Changes

- **El lint de las specs usa `gplint`** en lugar de `gherkin-lint`, con la misma selección de reglas. La configuración pasa de `.gherkin-lintrc` a `.gplintrc`, el nombre que descubre `gplint`, y el nivel `"on"`, que `gplint` ya no admite, pasa a `"error"`.
- **La skill `acceptance-test-authoring` cambia de herramienta en los dos stacks**: la configuración compartida (`references/gplintrc.json`), los `SETUP.md` de JavaScript y Python, `run_acceptance.py`, `SKILL.md` y `EXTRACTION.md`. Desaparece la limitación conocida de los hijos de `Rule:`. La plantilla de tasks de `spec-as-source` nombra `gplint`.
- **Una capability nueva, `spec-lint`**, fija lo que el lint garantiza: falla e informa, en la línea del `spec.md`, de los defectos de los escenarios de cada requisito, y las specs del proyecto lo pasan sin errores.
- `gherkin-lint` sale de las dependencias de `acceptance-tests/`, y con él las vulnerabilidades.

Queda fuera de alcance que el extractor deje en blanco un `#### Scenario:` sin nombre, en lugar de dar un error. Hoy no lo detecta ningún linter, porque el escenario ya no llega al `.feature`. Si se quiere tratar, irá en otro change, empezando por `EXTRACTION.md`.

## Capabilities

### New Capabilities
- `spec-lint`: el lint de las specs del proyecto. Detecta los defectos de los escenarios de cada requisito, los informa en la línea del `spec.md` y pasa sin errores sobre las specs vigentes y los deltas de los changes activos.

### Modified Capabilities

## Impact

- `acceptance-tests/`: `package.json` y su `package-lock.json` (`gplint` en lugar de `gherkin-lint`), `.gherkin-lintrc` → `.gplintrc`, `README.md`, y el soporte y los pasos de los escenarios nuevos.
- `.agents/skills/acceptance-test-authoring/` y `.agents/skills/spec-as-source/references/tasks.md`.
- `adr/`: un ADR nuevo sobre la herramienta del lint de las specs.
- El wiki del proyecto, en la resincronización tras el archive: el artículo `suite-de-aceptacion-y-spec-as-source.md` nombra `.gherkin-lintrc`.
- Claude Code y OpenCode: nada. Las dependencias de `acceptance-tests/` las instala igual el arranque de sesión de los dos.
