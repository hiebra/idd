# Tests de aceptación

Suite de aceptación del proyecto, montada según la skill `acceptance-test-authoring` (`stack: javascript`). Ejecuta con [cucumber-js](https://github.com/cucumber/cucumber-js) el Gherkin de cada `spec.md` de `openspec/specs/` y de los changes activos en `openspec/changes/`; los changes archivados nunca se ejecutan.

## Ejecutar

Las dependencias las instala el arranque de sesión de Claude Code u OpenCode. Si no se ha ejecutado, instálalas a mano:

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

Los escenarios de arranque de sesión, heredados de la plantilla, no levantan ninguna aplicación ni arrancan los agentes reales: prueban el núcleo `.agents/hooks/session-bootstrap.sh` a través del adaptador de cada agente, simulando cómo lo invoca ese agente. Por cada escenario, el World:

- crea en un directorio temporal una copia del proyecto sin `node_modules`, `.git` ni `acceptance-tests/`;
- abre la sesión con el adaptador de agente que nombra el paso (`se abre una sesión de Claude Code en el proyecto`, `... de OpenCode ...`); `se abre una sesión en el proyecto`, en los escenarios del núcleo, usa Claude Code;
- simula la máquina con el `PATH` y el entorno: un envoltorio de npm que registra cada llamada, un directorio de herramientas sin npm, un `node` falso de la versión 20 y un `openspec` global falso; un registro inaccesible se simula con `npm_config_registry` apuntando a un puerto cerrado y una caché vacía, y entonces el envoltorio añade al log de npm una línea con comillas, barras, un tabulador y un carácter de control, para comprobar cómo escapa cada adaptador el aviso que la cita. Del directorio de `node` y `npm` solo se exponen esos dos binarios (y `npx`), porque puede tener también paquetes globales, como un `openspec` real.

Los adaptadores están en `support/agents/` y dan a los pasos el mismo resultado: cómo terminó el agente, las llamadas a npm, los avisos mostrados al usuario y cómo ejecutar un comando en la sesión.

- **Claude Code** (`claude-code.js`): ejecuta `.claude/hooks/session-start.sh` como lo hace Claude Code, con `CLAUDE_PROJECT_DIR` apuntando a la copia y `CLAUDE_ENV_FILE` a un archivo temporal, que se carga antes de cada comando de la sesión. Los avisos mostrados son el `systemMessage` del JSON que el hook imprime por stdout; el stdout tiene que estar vacío o ser un único objeto JSON. "Una versión de Claude Code que no permite ajustar el PATH" es una sesión sin `CLAUDE_ENV_FILE`.
- **OpenCode 2** (`opencode.js` y `opencode-host.mjs`): un proceso hijo de Node con el entorno de la máquina simulada hace de OpenCode. Carga `server.js` y `tui.js` de `.opencode/plugins/session-bootstrap/` y llama a su `setup` con contextos falsos de servidor y de TUI, unidos por un RPC del plugin en memoria. Un comando de la sesión se ejecuta con el entorno que dejan los hooks `create.before`, y los avisos mostrados son los toasts de la parte de TUI. Como una sesión real sigue abierta, el proceso que hace de OpenCode no da la sesión por terminada hasta que acaban los procesos que el plugin ha lanzado en segundo plano y sus avisos han llegado a la TUI. Solo ve los procesos lanzados con `spawn` de `node:child_process`: si el plugin pasa a usar otra función (`exec`, `execFile`…), hay que seguirla también en `opencode-host.mjs`, o los avisos que lleguen tarde se perderán de forma intermitente. Además se comprueba que `setup` no espera a la instalación y que ninguna excepción sale del plugin. "Una versión de OpenCode que no permite ajustar el PATH" se simula de tres formas, que tienen que dar los mismos avisos: un contexto de servidor sin `shell`, un `shell.hook()` que lanza una excepción y un entorno del comando que no se puede cambiar.

El contrato de OpenCode que simula el adaptador se comprobó con OpenCode 2.3.2 real (ver las tareas 1.2 y 7.2 del change `add-opencode-parity`). Si cambia la API de plugins de OpenCode, hay que actualizar `opencode-host.mjs`.

Estos escenarios ejecutan `npm install` reales: necesitan acceso al registro de npm y tardan más de un minuto, aunque la caché de npm de la máquina acelera las instalaciones repetidas.

## Escenarios de `agent-skills`

Los escenarios de skills tampoco arrancan los agentes: aplican sobre una copia del proyecto las reglas con las que cada agente descubre las skills de proyecto, que están en `support/skills.js` y son la única copia de esas reglas en el proyecto. Si un agente cambia cómo busca skills, se actualiza ese archivo.

- **Claude Code:** `.claude/skills/<id>/SKILL.md`, siguiendo symlinks.
- **OpenCode 2:** `.claude/skills`, `.agents/skills` y `.opencode/skills`, cada una como `<fuente>/<id>/SKILL.md`; si un ID aparece en varias, solo cuenta el de mayor precedencia, en ese orden.

De cada `SKILL.md` se lee el frontmatter (`name` y `metadata.generatedBy`): el nombre tiene que coincidir con el directorio, y los workflows de OpenSpec, con la versión de `@fission-ai/openspec` fijada en el `package.json` del proyecto.
