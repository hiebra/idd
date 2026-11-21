# Tests de aceptación

Suite de aceptación del proyecto, montada según la skill `acceptance-test-authoring` (`stack: javascript`). Ejecuta con [cucumber-js](https://github.com/cucumber/cucumber-js) el Gherkin de cada `spec.md` de `openspec/specs/` y de los changes activos en `openspec/changes/`; los changes archivados nunca se ejecutan.

## Ejecutar

Las dependencias las instala el hook de arranque de sesión. Si no se ha ejecutado, instálalas a mano:

```bash
npm install
```

Suite efectiva (specs vigentes con los deltas de los changes activos aplicados):

```bash
npm test
```

Solo las specs vigentes de `openspec/specs/`, tal cual:

```bash
npm run test:specs
```

Lint del Gherkin de las specs:

```bash
npm run lint:specs
```

Cada ejecución reconstruye `.extracted/` (los `.feature` extraídos de los `spec.md`, que no se editan nunca a mano) y deja el informe HTML en `reports/cucumber-report.html`. Ambos están ignorados por git.

## Estructura

- `cucumber.cjs`, `extract-gherkin.cjs`, `openspec-effective-paths.cjs` y `.gherkin-lintrc` son copias literales de la skill; sus nombres son obligatorios.
- `support/` contiene el World y el soporte de los escenarios.
- `step-definitions/` contiene los pasos, que solo llaman a métodos de intención del World y hacen aserciones.

## Escenarios de `session-bootstrap`

Los escenarios de arranque de sesión, heredados de la plantilla, no levantan ninguna aplicación: prueban el hook `.claude/hooks/session-start.sh`. Por cada escenario, el World:

- crea en un directorio temporal una copia del proyecto sin `node_modules`, `.git` ni `acceptance-tests/`;
- ejecuta el hook como Claude Code, con `CLAUDE_PROJECT_DIR` apuntando a la copia y `CLAUDE_ENV_FILE` a un archivo temporal;
- simula la máquina con el `PATH` del hook: un envoltorio de npm que registra cada llamada, un directorio de herramientas sin npm, un `node` falso de la versión 20 y un `openspec` global falso; un registro inaccesible se simula con `npm_config_registry` apuntando a un puerto cerrado y una caché vacía.

Estos escenarios ejecutan `npm install` reales: necesitan acceso al registro de npm y tardan más de un minuto, aunque la caché de npm de la máquina acelera las instalaciones repetidas.
