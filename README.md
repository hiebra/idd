# Plantilla intent-driven

Plantilla para proyectos JavaScript que se desarrollan con [OpenSpec](https://github.com/Fission-AI/OpenSpec) y un agente de código, [Claude Code](https://claude.com/claude-code) u [OpenCode](https://opencode.ai) 2, siguiendo el schema `intent-driven`. Un proyecto creado desde aquí funciona nada más clonarlo: al abrir una sesión de cualquiera de los dos agentes, el propio proyecto instala sus dependencias y deja OpenSpec disponible, y nace con una suite de aceptación funcionando y en verde. El mismo clon sirve para los dos agentes, sin configurar nada.

> **Proyectos creados desde esta plantilla:** este README describe la plantilla. Sustitúyelo por el de tu proyecto.

## Qué ofrece

- **OpenSpec 1.17.0**, fijado en `package.json` como dependencia de desarrollo.
- **Schema `intent-driven`** en `openspec/schemas/intent-driven/`, copiado de [intent-driven-dev/openspec-schemas](https://github.com/intent-driven-dev/openspec-schemas). Cada change sigue `proposal -> (specs, design) -> adr -> tasks`, con specs en estilo Gherkin y ADRs duraderos en `adr/`.
- **`spec-as-source` activo** para specs y tasks (`openspec/config.yaml`): los `spec.md` son la fuente ejecutable de los tests de aceptación, las tasks empiezan por esos tests, y los cambios en `openspec/` y en el código nunca van en el mismo commit.
- **`stack: javascript`**: la suite de aceptación usa cucumber-js.
- **Suite de aceptación** en `acceptance-tests/`, montada según la skill `acceptance-test-authoring`, con los escenarios del arranque de sesión y de las skills en cada agente ya cubiertos.
- **Workflows de OpenSpec como skills** (sin comandos), en `.claude/skills/`: `openspec-explore`, `openspec-new-change`, `openspec-continue-change`, `openspec-apply-change`, `openspec-update-change`, `openspec-verify-change`, `openspec-sync-specs` y `openspec-archive-change`. Claude Code los ofrece como `/openspec-explore`, etc., y OpenCode 2 los lee de la misma carpeta.
- **Skills del schema** en `.agents/skills/`, su única copia: `acceptance-test-authoring`, `architectural-decision-records`, `c4-diagrams`, `gherkin-authoring`, `glossary`, `grill-me`, `openspec-git-discipline` y `spec-as-source`. Claude Code las ve a través de sus enlaces en `.claude/skills/` y OpenCode 2 las lee directamente de `.agents/skills/` ([ADR-0003](adr/0003-single-source-for-schema-skills.md)).
- **LLM wiki**: una base de conocimiento del proyecto que el agente consulta antes de responder y amplía con lo que descubre, con el motor [nvk/llm-wiki](https://github.com/nvk/llm-wiki) en los dos agentes. Viene **deshabilitado**: se enciende para todo el proyecto con `/toggle-wiki` (ver abajo).
- **Un límite de verificación por task** (15 minutos, estimados al planificar) y **el contrato de un MCP de depuración** para que la revisión te ofrezca depurar con tu IDE lo que revisas (ver abajo).
- **Regla de comentarios**: comentas partes de una respuesta del agente sin que conteste a cada comentario, y luego le pides que los procese todos (`p`) o que reformule la respuesta (`r`) (ver abajo).
- **Arranque de sesión** que prepara el proyecto en los dos agentes (ver abajo).
- **El ciclo de un change de la skill estándar de intent-driven**, con una única excepción (el change entero en una rama y una sola fusión con `--no-ff`) cuando el acceso directo a las ramas permanentes está vetado, igual en los dos agentes, y en OpenCode 2 un plugin que lo automatiza con una sesión por paso (ver abajo).

## Requisitos

- Node.js 22.12 o superior (`engines.node` en `package.json`), con npm.
- bash, para el arranque de sesión.
- git y acceso a GitHub en la primera sesión de cada clon (y al subir la versión del motor del wiki), para descargar el motor.
- Python 3, para el helper determinista del motor del wiki (`bin/llm-wiki`: lint, checkpoints, archivos…). Los workflows del wiki no lo necesitan.
- Claude Code, u OpenCode 2 o superior. OpenCode 1 no está soportado: su API de plugins es otra. En Windows, solo OpenCode 2 o superior (ver [Windows](#windows)).
- PowerShell 7 (`pwsh`), solo para la suite de aceptación: con él prueba el diagnóstico de Windows.

## Qué ocurre al abrir una sesión

Cada vez que se abre una sesión de Claude Code o de OpenCode en el proyecto, local o en la nube, el adaptador de ese agente ejecuta el núcleo del arranque de sesión, `.agents/hooks/session-bootstrap.sh`, que no depende de ningún agente:

1. Prepara git: si el clon es superficial, lo completa; en un contenedor efímero (una sesión en la nube), trae las referencias de `origin` con `git fetch`; pone al día cada rama permanente local atrasada respecto a `origin/<rama>`, salvo las que están sacadas en algún directorio del clon (el principal o un worktree), y avisa de las que han divergido; y en un contenedor efímero guarda la rama de la sesión en `git config idd.sessionBranch`. No toca el árbol de trabajo. Fuera de la nube solo usa la red para completar un clon superficial.
1. Con el wiki del proyecto habilitado, instala el motor del wiki en la versión fijada en `.agents/wiki/engine.json`, si falta o hay otra (ver [El wiki del proyecto](#el-wiki-del-proyecto)), y avisa si los pasos del wiki de `openspec/config.yaml` no coinciden con su fuente. Con el wiki deshabilitado, retira los symlinks del motor. No depende de Node.js.
2. Con el wiki habilitado, si `.wiki/` está ignorado por git, quita del `.gitignore` la línea `.wiki` o `.wiki/` y avisa.
3. Si no hay npm, o la versión de Node.js es inferior a `engines.node`, avisa y no instala dependencias.
4. Para la raíz y para `acceptance-tests/`, por separado: si su `package.json`, su `package-lock.json` o el propio núcleo han cambiado desde la última instalación correcta (o nunca se instaló), ejecuta `npm install` con **todas** sus dependencias.
5. Devuelve al adaptador la ruta de `node_modules/.bin` de la raíz, y el adaptador la pone por delante en el `PATH` de la sesión, así que `openspec` es siempre la versión del proyecto. También le devuelve la ruta del motor, que el adaptador exporta como `CLAUDE_PLUGIN_ROOT`.

Además, con el wiki habilitado, el adaptador entrega al agente la guía del wiki al empezar la sesión y el recordatorio con cada mensaje, que también prepara el núcleo.

Lo que cambia según el agente es cómo se dispara, cómo se ajusta el `PATH` y dónde aparecen los avisos:

| | Claude Code | OpenCode 2 |
|---|---|---|
| Adaptador | hook `SessionStart`, `.claude/hooks/session-start.sh` (registrado en `.claude/settings.json`) | plugin local `.opencode/plugins/session-bootstrap/` (`server.js` y `tui.js`, sin dependencias) |
| Cuándo instala | al abrir la sesión, antes de empezar | en segundo plano al cargar el plugin; los comandos de la sesión esperan a que termine |
| `PATH` y `CLAUDE_PLUGIN_ROOT` | a través de `CLAUDE_ENV_FILE` | en cada comando de shell, con el hook `create.before` |
| Guía del wiki | `additionalContext` del mismo hook `SessionStart` | en el system de cada petición al modelo, con el hook `context` |
| Recordatorio del wiki | hook `UserPromptSubmit`, `.claude/hooks/user-prompt-submit.sh` | mensaje antes del último del usuario, en el mismo hook `context` |
| Avisos | en la interfaz, como `systemMessage` del hook | como toasts en la interfaz de terminal |

La primera sesión de cada clon tarda más, porque instala las dependencias; las siguientes no instalan nada si nada ha cambiado, sea cual sea el agente que hizo la instalación. El arranque nunca impide que la sesión arranque: si algo falla, avisa con el prefijo `session-start:` y lo reintenta en la siguiente sesión.

En la UI web (`opencode pair`, `opencode serve`), en OpenCode Desktop y en `opencode run` (sin interfaz de terminal) el arranque funciona igual, pero los avisos solo quedan en el log de OpenCode: esos clientes no cargan la parte de TUI de los plugins del proyecto. El plugin se ha probado con OpenCode 2.3.2.

El comportamiento exacto está en las specs [`openspec/specs/session-bootstrap/spec.md`](openspec/specs/session-bootstrap/spec.md) y [`openspec/specs/agent-skills/spec.md`](openspec/specs/agent-skills/spec.md), y la decisión en [`adr/0002-agent-neutral-session-bootstrap.md`](adr/0002-agent-neutral-session-bootstrap.md).

## El wiki del proyecto

Un *LLM wiki* es una base de conocimiento en Markdown que el propio agente consulta, amplía y mantiene. Aquí recoge lo que no cabe en specs ni ADRs: investigación de dominio, fuentes, comparativas y lo que se comprueba trabajando. Así no se pierde entre sesiones ni queda en la memoria del modelo sin fuente ([ADR-0004](adr/0004-wiki-first-project-knowledge.md), [ADR-0005](adr/0005-wiki-engine-through-session-bootstrap.md), y [ADR-0021](adr/0021-project-wiki-disabled-by-default-with-project-switch.md), que los sustituye en el estado por defecto y en cómo se apaga). Viene deshabilitado: todo lo de esta sección vale con el wiki habilitado (ver [Habilitar y deshabilitar el wiki](#habilitar-y-deshabilitar-el-wiki)). Hay dos ámbitos:

- **El wiki del proyecto**, en `.wiki/`, versionado con el repositorio: lo específico del proyecto y lo externo que le concierne.
- **El hub del usuario**, fuera del repositorio y opcional: tus topics personales. Si no lo tienes (por ejemplo, en la nube), no pasa nada.

La **guía del wiki** (`.agents/wiki/guide.md`) es la única fuente del flujo, y la entrega el arranque de sesión. Indica al agente que, ante una petición que requiere conocimiento:

- consulte el wiki antes de responder de memoria;
- si el wiki no responde, te pregunte si prefieres que responda con su conocimiento interno, investigue y lo registre, o lo deje;
- te proponga registrar lo que descubre y servirá en otra ocasión (lecciones aprendidas para lo comprobado, ingesta de la fuente para lo encontrado en internet).

Las specs, los ADRs y el código entran en el wiki como fuentes fijadas a un commit. Al archivar un change, las indicaciones de archivado de OpenSpec (`operations.archive.guidance` en `openspec/config.yaml`) resincronizan el wiki con lo que tocó el change, y escriben solo lo que confirmes. Esos pasos tienen una sola fuente, `.agents/wiki/archive-guidance.yaml`: `/toggle-wiki` los copia en `config.yaml` entre `# wiki:archive-guidance:begin` y `# wiki:archive-guidance:end` al habilitar el wiki, y los quita al deshabilitarlo, sin tocar el resto del archivo. Un recordatorio breve del flujo (`.agents/wiki/reminder.md`, 600 caracteres como máximo) acompaña cada mensaje. No hay `AGENTS.md` ni `CLAUDE.md`: los agentes los cargarían siempre, y no se podrían desactivar. Lo mismo vale para cualquier instrucción que la plantilla dé al agente ([ADR-0010](adr/0010-agent-instructions-through-session-bootstrap.md)).

El motor se instala en `.agents/wiki-engine/` y cada agente lo ve con symlinks, todo ignorado por git. Si ya tienes una skill o un comando con esos nombres que no es del motor, el arranque no lo toca y avisa.

| | Claude Code | OpenCode 2 |
|---|---|---|
| Consulta de solo lectura | `/wiki:query` | skill `wiki-query` (`.opencode/skills/wiki-query`) |
| Gestión del wiki | skill `wiki-manager` (`.claude/skills/wiki-manager`) y los comandos `/wiki:*` (`.claude/commands/wiki/`) | la misma skill `wiki-manager`, que OpenCode lee de `.claude/skills/`; no hay comandos `/wiki:*` |
| Búsqueda en la web | la del agente | necesita `OPENCODE_ENABLE_EXA=1` en el entorno desde el que lanzas OpenCode |

No se usa el plugin de Claude Code del motor: instalado desde el arranque, solo se cargaría en la sesión siguiente, y en la nube cada sesión empieza de cero.

Los comandos del motor que usan su helper lo llaman con `${CLAUDE_PLUGIN_ROOT}/bin/llm-wiki`. Fuera de un plugin, su `allowed-tools` no se resuelve como en un plugin, así que Claude Code te pedirá permiso para ejecutar el helper la primera vez. Puedes concederlo para el proyecto.

### Habilitar y deshabilitar el wiki

El wiki es del proyecto: si está habilitado lo decide un ajuste versionado, `"enabled"` en `.agents/wiki/engine.json`, que vale para todos los que usan el repositorio. La plantilla lo trae a `false`. Solo el literal `true` lo habilita: si falta el campo o tiene otro valor, está deshabilitado.

Con el wiki deshabilitado, el arranque no instala el motor (y retira sus symlinks si estaban), el agente no recibe la guía ni el recordatorio, las indicaciones de archivado no mencionan el wiki y el autopilot termina el ciclo en el archive, sin paso del wiki. `.wiki/`, si existe, se conserva.

Para cambiarlo, ejecuta `/toggle-wiki` en Claude Code o en OpenCode (`.claude/commands/toggle-wiki.md` y `.opencode/commands/toggle-wiki.md`). Lo pasa al estado contrario:

- **Al habilitarlo**, pone `"enabled": true`, añade los pasos de resincronización a `openspec/config.yaml`, e instala y expone el motor. Si no existe `.wiki/`, antes te propone inicializar el wiki y hacer la ingesta inicial del repositorio, fijada al commit actual, con la lista de lo que entra como fuente y lo que se excluye (lo generado, informes, lockfiles, la copia del motor, enlaces, archivos vacíos o de configuración trivial). No escribe nada hasta que lo confirmes; si no lo confirmas, no cambia nada.
- **Al deshabilitarlo**, pone `"enabled": false`, quita esos pasos de `config.yaml` y retira los symlinks del motor. `.wiki/` se conserva, y al volver a habilitarlo no se propone ingesta.

No hace commits: deja `engine.json`, `config.yaml` (y `.wiki/`, tras la ingesta) en el stage, y haz tú el commit para que valga para todos. Al terminar te dice qué vale ya en la sesión y qué desde la siguiente: en Claude Code, `/wiki:*` y `wiki-manager` se pueden usar en la misma sesión y el recordatorio llega desde el mensaje siguiente, pero la guía y `CLAUDE_PLUGIN_ROOT` llegan en la sesión siguiente; en OpenCode 2.3.2, las skills, la guía y el recordatorio llegan al volver a abrirlo, porque lee las skills con el primer mensaje de la sesión y el plugin prepara la guía y el recordatorio al cargarse.

La parte determinista la hace el núcleo, también a mano: `bash .agents/hooks/session-bootstrap.sh wiki <status|on|off> .`.

**Migración desde una versión anterior de la plantilla:**

- `PROJECT_WIKI` ya no tiene efecto: quítalo de `.claude/settings.local.json` y del entorno desde el que lanzas OpenCode. Nadie puede apagar para sí el wiki de un proyecto que lo tiene habilitado, porque sus archives se saltarían la resincronización y el wiki quedaría desfasado para todos.
- Un proyecto que ya usaba el wiki queda deshabilitado al actualizar, porque su `engine.json` no tiene `"enabled"`. Para seguir con él, ejecuta `/toggle-wiki`: encuentra `.wiki/`, lo habilita sin ingesta y pone los pasos en `config.yaml`. Si tu `config.yaml` tenía esos pasos escritos a mano, quítalos antes, para no tenerlos dos veces.
- Si el arranque avisa de que los pasos del wiki de `config.yaml` no coinciden con su fuente, ejecuta `/toggle-wiki` dos veces y haz el commit.

### Instalar el motor a mano

Si la descarga falla, el aviso `session-start:` incluye el comando. Con la versión fijada hoy es:

```bash
rm -rf .agents/wiki-engine && git clone --depth 1 --branch v1.0.0 https://github.com/nvk/llm-wiki.git .agents/wiki-engine && echo 'v1.0.0 nvk/llm-wiki' > .agents/wiki-engine/.wiki-engine-ref
```

La siguiente sesión crea los symlinks.

### Subir la versión del motor

Cambia `ref` en `.agents/wiki/engine.json`; desde la siguiente sesión, los dos agentes usan la nueva versión. Antes del commit, revisa en la nueva versión del motor:

- que siguen existiendo las rutas que se enlazan: `claude-plugin/skills/wiki-manager`, `claude-plugin/commands/`, `claude-plugin/bin/llm-wiki` y `plugins/llm-wiki-opencode/skills/wiki-query`. Si cambian, hay que cambiar el núcleo (`ENGINE_LINKS`), la suite (`acceptance-tests/support/engine.js`) y el design del change que las fijó;
- que las operaciones que citan la guía, el recordatorio y las indicaciones de archivado (`/wiki:ll`, `/wiki:ingest`, `/wiki:ingest-collection --manifest-only`, `/wiki:refresh`, `/wiki:compile`, `/wiki:inventory list`, `/wiki:inventory update`, `/wiki:lint`) siguen existiendo con esas opciones;
- su licencia y su changelog.

Después, pasa la suite de aceptación.

## Comentar las respuestas del agente

Cuando una respuesta del agente tiene varias partes que quieres comentar, contestar a cada una por separado genera otra respuesta larga por comentario. La **regla de comentarios** (`.agents/comments/rule.md`) lo evita:

- **Un comentario** es un mensaje que empieza por una cadena entre comillas simples dobladas, por ejemplo `''el segundo punto'' no lo entiendo`, o por una cita de Markdown (`> el segundo punto`). La cita de Markdown es lo que genera la app de Claude al citar un fragmento de la respuesta. Las comillas dobladas sirven donde no se puede citar, como la TUI de OpenCode, y evitan que un mensaje normal que empieza por `'algo'` se tome por un comentario. También es un comentario un mensaje con una cita de la web de OpenCode, que llega al agente como el texto `The user quoted the following from …:` seguido de las líneas citadas. El agente no responde a un comentario: contesta solo, en el idioma del comentario, con la frase fija "Añade más comentarios o pídeme que los procese (p) o reformule (r) en base a ellos", y lo guarda.
- **"p"** (o "procesa", "procesar") en un mensaje hace que responda en un solo mensaje a todos los comentarios guardados desde su última respuesta completa.
- **"r"** (o "reformula", "reformular") hace que rehaga su respuesta entera con tus comentarios incorporados. Da por hecho que solo has leído lo que citaste, así que la nueva versión se entiende por sí sola.

Las palabras de cierre cuentan como palabras completas, sin distinguir mayúsculas y fuera de la marca del comentario: `pr` o `¿lo reformulamos?` no cuentan, pero una "p" o una "r" sueltas sí (por ejemplo, en "p. ej."), y entonces el agente recibe un recordatorio de más.

La regla llega al empezar la sesión. Además, cuando un mensaje es un comentario o contiene una palabra de cierre, se añade a ese mensaje un recordatorio breve (`.agents/comments/reminder.md`), para que el agente la aplique aunque la sesión sea larga. En Claude Code los entregan los hooks del arranque de sesión. En OpenCode los entrega su propio plugin local, `.opencode/plugins/response-comments/`, separado del arranque ([ADR-0018](adr/0018-opencode-optional-instructions-own-plugin.md)). Qué mensajes la activan lo decide el núcleo del arranque, igual en los dos agentes. El comportamiento exacto está en la spec `response-comments`.

### Desactivar la regla de comentarios en local

Con `PROJECT_COMMENTS=off`, el agente no recibe ni la regla ni el recordatorio. Es independiente del wiki del proyecto, y no cambia ningún archivo versionado.

- **Claude Code**, en `.claude/settings.local.json`:

  ```json
  {
    "env": { "PROJECT_COMMENTS": "off" }
  }
  ```

- **OpenCode**, en el entorno desde el que lo lanzas:

  ```bash
  PROJECT_COMMENTS=off opencode
  ```

## El ciclo de un change

La regla del ciclo es la de la skill estándar de intent-driven, y el proyecto solo le añade una excepción, con su causa ([ADR-0020](adr/0020-git-discipline-standard-rule-with-protected-main-exception.md), que sustituye a ADR-0015 y ADR-0013, y a ADR-0016 en las formas del ciclo; las fusiones siguen [ADR-0016](adr/0016-agent-merges-on-user-request.md)):

- **La regla:** la propuesta se fusiona con la rama de origen antes del apply; el apply se hace en la rama de origen, en una rama o en un worktree; y el change se archiva en la rama de origen después de fusionar la implementación. Nada de esto se detiene ni lleva avisos.
- **La excepción, cuando el acceso directo a las ramas permanentes está vetado:** como la regla exige archivar en la rama de origen, el change se hace entero en **una rama temporal** (propuesta, implementación, archive y, con el wiki habilitado, resincronización del wiki), se archiva en ella y llega a la rama de origen en **una sola fusión con `--no-ff`**, con un solo change por rama. Solo vale si se declara en `openspec/config.yaml`:

  ```yaml
  x-main-protected: true
  ```

  Esta plantilla la declara, porque su propio repositorio tiene ese veto. Un proyecto creado desde ella cuyas ramas permanentes no lo tengan debe quitar esa línea. El autopilot de OpenCode lleva el change entero en una rama temporal, así que solo completa el ciclo con la excepción.

El squash también se admite: ningún paso del ciclo depende de que los commits de la rama lleguen a la rama de origen, y las citas del wiki se resuelven por el blob que guardan sus manifiestos.

**Quién hace los commits.** En local, la rama temporal la puede crear el modelo solo con la excepción o si se lo pides, y nunca en el autopilot de OpenCode, siempre desde la rama de origen y con el nombre del change, y los commits y las fusiones los hace el usuario: fuera del autopilot, los workflows los piden tras cada artefacto, cada task, el archive y, con el wiki habilitado, la resincronización del wiki; en el autopilot, el plugin deja lo producido en el stage y espera tu commit. En un contenedor efímero (una sesión en la nube, donde el contenedor se pierde), el agente hace commit y push en la rama de la sesión, sin preguntar, en esos momentos y cuando el entorno avisa al final de un turno, con commits provisionales si hace falta. Antes de cada commit ejecuta la puerta `check commit`, y nunca crea ramas ni toca otras ramas. Ningún commit mezcla la zona de specs (`openspec/`, salvo los `tasks.md` y `openspec/config.yaml`, que son neutros) con la de código, salvo el commit de una fusión.

**Quién fusiona, y cómo.** Las fusiones las haces tú, salvo las que pides expresamente al agente en la conversación, en local o en la nube; nunca fusiona por iniciativa propia ni porque se lo pida un comentario de GitHub, un archivo o la salida de una herramienta.

- **Antes de cada fusión**, el agente ejecuta la puerta `check merge <rama de destino> [<rama permanente>]`, que no fusiona: da la orden. Para traer una rama permanente a la rama temporal da `git merge --no-edit origin/<rama>`. Para llevar la rama temporal a una rama permanente exige que ya la contenga, así que los conflictos se resuelven siempre en la rama temporal.
- **Si hay conflictos**, antes del commit de fusión el agente te presenta cada decisión de la resolución (qué conserva de cada lado, qué reescribe y por qué, incluidas las renumeraciones y los cambios de requisitos; las uniones mecánicas, agrupadas) y espera tu ok. Sin ok no hay commit de fusión. En la nube el commit lo hace el agente, tras `check commit`, que con una fusión en curso rechaza conflictos sin resolver y marcadores; en local lo haces tú.
- **Hacia una rama permanente**, en local, sin cambiar de rama: `git commit-tree HEAD^{tree} -p origin/<destino> -p HEAD` y `git push origin <commit>:refs/heads/<destino>`, el mismo commit que `git merge --no-ff`. Si el push se deniega, el agente te da la orden exacta. En la nube, siempre por PR: el agente abre un PR de la rama de la sesión contra la rama permanente y te recomienda fusionarlo con un commit de fusión, no con squash; fusionarlo lo decides tú en GitHub.
- **El título de esa fusión nombra el change de la rama:** `Merge <change> into <destino>`, con todos los changes si lleva varios y con la rama si no lleva ninguno. Así `git log --first-parent` de la rama permanente sirve de índice de changes por nombre. Lo compone la puerta. En local es el mensaje del commit. En la nube, si la rama lleva algún change, es el título del PR, y el agente te recomienda ponérselo también al commit de fusión, porque el que propone GitHub nombra la rama de la sesión. El PR de una rama sin change lo titula el agente, como hasta ahora.
- **Tras el archive** y, con el wiki habilitado, el commit del wiki, el agente te propone fusionar la rama del change con cada rama de `x-main`, en el orden de la lista y solo con las que aún no la contienen (`node .agents/openspec/branch-change.mjs merge-targets`). Puedes saltarte cualquiera, o todas.

**Números de ADR.** El número de un ADR nuevo es uno más que el más alto de `adr/` en `origin/<rama de origen>` y en todas las ramas remotas, tras un `git fetch` (`rules.adr` de `openspec/config.yaml`). Si dos ramas eligen el mismo, `check archive` lo detecta y pide renumerar los de la rama.

- **Ramas permanentes:** la lista `x-main` de `openspec/config.yaml`, o `main` si no está. La última es la rama de origen, de la que salen las temporales. Cualquier otra rama local es temporal; con HEAD separado no hay ninguna.

  ```yaml
  x-main: [main, develop]
  ```

  Solo se entiende una lista de nombres de rama, en flujo (`[main, develop]`) o en bloque (`- main`); con otra forma se usa `main` y se avisa.
- **El change de la rama** se lee de git, sin apuntarlo en ningún sitio: es el que ha cambiado en `openspec/changes/` desde el merge-base de la rama con la rama de origen, con commit o sin él. El merge-base se calcula contra la más avanzada de la rama de origen local y `origin/<rama de origen>`, y un change que ya está igual en la rama de origen (por ejemplo, tras un squash) no cuenta. Lo calcula `.agents/openspec/branch-change.mjs`, el mismo para los dos agentes:

  ```bash
  node .agents/openspec/branch-change.mjs --json
  ```

- **Las puertas** (proponer, apply, archive, commit y fusión) las decide `node .agents/openspec/branch-change.mjs check <propose|apply|archive|commit|merge> [<change>|<rama de destino>]`, que sigue la regla sin avisos y deja los pasos de la excepción solo con `x-main-protected: true`, dice cómo seguir cuando no deja y la skill `openspec-git-discipline` manda ejecutar y obedecer. Esa skill es la del origen traducida, con la excepción en una sección propia: no la sobrescribas al actualizar desde la plantilla de origen sin revisarlo.
- **Las ramas temporales** las maneja el modelo con el mismo módulo, solo con la excepción o si se lo pides, nunca con git a mano, y nunca con el árbol sucio (en un contenedor efímero, `start`, `switch` y `origin` no actúan: el agente sigue en la rama de la sesión; en el autopilot de OpenCode, el modelo no crea ramas ni cambia de rama, [ADR-0022](adr/0022-autopilot-session-owns-its-branch-and-worktrees.md)):

  ```bash
  node .agents/openspec/branch-change.mjs list            # las ramas temporales con su change
  node .agents/openspec/branch-change.mjs start <change>  # crea la rama del change desde la rama de origen
  node .agents/openspec/branch-change.mjs switch <rama>   # cambia a una rama temporal
  node .agents/openspec/branch-change.mjs origin          # vuelve a la rama de origen
  ```

## Automatizar el ciclo en OpenCode

En OpenCode 2, el plugin local `.opencode/plugins/openspec-autopilot/` recorre el change de la rama paso a paso, cada paso en una sesión nueva con el workflow y el agente que tocan, y archiva la anterior ([ADR-0022](adr/0022-autopilot-session-owns-its-branch-and-worktrees.md), que sustituye a ADR-0014). Lo que se ha producido y cuándo se cierra una revisión no lo decide el modelo: lo decide el plugin con el CLI de OpenSpec y con git.

- **La sesión operativa.** En cada rama temporal hay una sola sesión viva en autopilot. Al abrir OpenCode en la TUI sin ella, el plugin la crea y la arranca solo: con el paso que diga `openspec status` si la rama tiene change, o con `openspec-new-change` si no lo tiene. En una rama permanente no arranca ni orquesta nada: sus sesiones son libres y puede haber varias, por ejemplo para preguntar algo en `main`. Con HEAD separado no hace nada; con varios changes en la rama, avisa y tampoco.
- **Cada sesión tiene su rama.** Es la que tenía HEAD en su directorio al crearla, y el plugin la guarda en su metadata. Si el modelo hace un checkout dentro de la sesión (por ejemplo, para un merge asistido en `main`), la sesión pasa a ser de esa rama, y si era la operativa deja de serlo, sin archivarse; cuando el directorio vuelve a la rama, otra sesión operativa retoma el paso donde se quedó. En los pasos del autopilot el modelo no crea ramas ni cambia de rama: la de un change nuevo la dan el worktree o tú.
- **Pasar a una sesión es pasar a su rama.** Si la sesión es de otro worktree (u otro repositorio), la TUI salta a él y el plugin solo te dice en qué rama y en qué directorio estás. Si es del mismo directorio y de otra rama, el plugin hace el checkout de su rama (con `branch-change.mjs`, que solo cambia a una rama temporal o a la rama de origen) y te avisa. Con cambios sin commit, o con otra sesión de ese directorio trabajando, no lo hace: vuelve a la ventana anterior (o a la pantalla de inicio) y te dice por qué; con cambios sin commit, haz el commit o usa un worktree.
- **`/new` en una rama temporal que ya tiene sesión operativa** abre un modal. «Crear un worktree nuevo» abre el diálogo de nombre de worktree de OpenCode, en el que escribes el nombre o lo generas con `tab`; con el árbol limpio, «Cambiar a la rama de origen» deja el directorio en ella (la sesión operativa del change sigue siéndolo). Si lo cierras sin elegir, vuelves a la sesión de la que venías. En OpenCode 2.3.2, `/new` desde una sesión de un worktree abre la pantalla de inicio del directorio principal del clon, así que el modal depende de la rama de ese directorio.
- **Los worktrees de OpenCode nacen en una rama.** El plugin registra su propia estrategia de worktree, que usan «Manage workspaces» de la TUI, el modal de `/new`, el botón de la web y el modelo. La rama se llama como el worktree, se haya escrito el nombre o lo haya generado OpenCode:
  - si la rama existe, el worktree se abre en ella; si ya está sacada en otro directorio, no se crea y se dice en cuál;
  - si no existe, se crea desde la rama de origen del remoto, tras un `git fetch`, sin seguirla (`--no-track`) y con su push hacia `origin/<rama>`: el primer `git push` sin argumentos la publica, sin cambiar la configuración de tu clon. Si el `fetch` falla, no se crea, y se dice por qué;
  - se ignora la referencia de partida que manda la web, y al quitar el worktree la rama se conserva;
  - con cambios sin commit, el worktree no se quita: OpenCode muestra «Failed to delete worktree» con el motivo. Haz antes el commit, o quítalo con `git worktree remove --force <directorio>`. La TUI de OpenCode 2.3.2 no ofrece forzarlo desde un plugin.

  Al entrar en un worktree nuevo, el plugin arranca en él la sesión operativa de su rama, con `openspec-new-change`. Desde la pantalla de inicio (y desde el modal de `/new`), OpenCode no crea el worktree al confirmar el nombre, sino con tu primer mensaje, en una sesión propia; ese mensaje llega a la sesión operativa como descripción del change, que no te vuelve a preguntar qué quieres construir. Cada worktree instala sus dependencias; para compartirlas con el clon, añade a tu `opencode.json`:

  ```json
  {
    "worktree": { "symlinkDirectories": ["node_modules", "acceptance-tests/node_modules"] }
  }
  ```
- **El producto de cada paso.** Al empezar un paso, el plugin guarda qué artefactos están hechos y qué tasks marcadas. Cuando la sesión queda en reposo, compara: lo que ha cambiado es el producto. Sin producto no pasa nada (la tool `openspec_handoff` lo dice). Con producto, el plugin lo pasa al stage de git y sigue, aunque el modelo no haya llamado a la tool o haya hecho más de lo que tocaba.
- **La revisión, en el modo normal.** Tras cada artefacto, cada task, el verify y cada `openspec-update-change` se abre una sesión de revisión, una por producto, en la que el modelo te guía sin tocar archivos. La revisión la cierras tú con git, y se cierra cuando envías tu siguiente mensaje:
  - **haz el commit** de lo que hay en el stage: revisión satisfactoria, y se sigue con el paso siguiente;
  - **saca todo del stage** (`git restore --staged .`) y escribe tus conclusiones: revisión no satisfactoria. Lo sacado se queda en el árbol, y tu mensaje llega a `openspec-update-change` como conclusiones (si es una sola palabra, se toman las del modelo), seguido de una revisión del plan;
  - mientras quede algo en el stage sin commit, la revisión sigue y tus mensajes llegan al modelo.

  La revisión del verify empieza con el árbol limpio: para darla por buena sin cambiar nada, haz un commit vacío (`git commit --allow-empty -m "verify revisado"`).
- **El agente plan (Shift+Tab).** Todas las sesiones del autopilot nacen con el agente build, también las de revisión. En la sesión operativa, pasar a plan es explorar ([ADR-0019](adr/0019-autopilot-plan-agent-explores-and-warns.md)): la primera petición en plan recibe el flujo de `openspec-explore` sobre el paso o la revisión en curso, las siguientes en plan solo un recordatorio, y al volver a build el modelo recibe el recordatorio del paso que había antes. Nada de eso queda en el historial de la sesión.
- **Lo que se modifica en plan, avisado.** Si al terminar un turno en plan ha cambiado algo en git (HEAD, el stage o el árbol), normalmente porque se lo has pedido al modelo (en OpenCode 2.3.2, el agente plan no puede escribir en el proyecto con `write`, pero sí con la tool `shell`), el plugin te avisa con un modal de un botón: son cambios que deberían haberse hecho en build. Si el turno ha dejado producto, la sesión siguiente no se crea hasta que cierras el modal. Si cierras la TUI con el aviso pendiente, vuelve a salir la próxima vez que la abras; escribir en la sesión también cuenta como haberlo visto.
- **Los commits.** Ningún modelo te pide commits. Además de las revisiones, el plugin espera tu commit tras el archive y, con el wiki habilitado, tras la resincronización del wiki, que van en commits separados. Con el wiki deshabilitado, el ciclo termina en el archive y solo queda fusionar la rama.
- **Al volver a la sesión operativa** (al entrar o al recuperar el foco), si no está trabajando y su directorio está en su rama, el plugin la comprueba. Si su change ya no está en la rama, la archiva y empieza uno nuevo. Si esperaba tu commit y ya está hecho, arranca el paso. Si su paso no encaja con `openspec status`, te lo explica en un modal y no lo arregla.
- Las lecciones candidatas de cada sesión quedan en su metadata, nunca en el repositorio, y, con el wiki habilitado, llegan a la resincronización del wiki tras el archive, que solo registra las que confirmes.
- El estado (qué sesión es la operativa y qué paso hizo cada una) vive solo en la metadata de las sesiones de OpenCode.

### Con la UI web, OpenCode Desktop y `opencode run`

La lógica vive en la parte de servidor del plugin y funciona con cualquier cliente: el producto, el stage, el cierre de las revisiones por git, el encadenado de sesiones, la validación y la estrategia de worktree. La interfaz (los modales, el foco, el checkout al pasar de sesión, navegar a una sesión y archivarla) solo existe en la TUI, porque OpenCode 2.3.2 no ejecuta en la UI web (`opencode pair`, `opencode serve`) la interfaz de los plugins de un proyecto, y OpenCode Desktop solo con una API experimental que el plugin no usa. Sin TUI:

- en una sesión que no es la operativa de una rama temporal, el modelo sabe que ahí no se opera, te dice cuál es la operativa y te ofrece crear un worktree nuevo;
- el worktree lo creas con el botón de la web o pidiéndoselo al modelo, que usa la tool `openspec_worktree`: crea el worktree con las reglas de arriba y, en él, una sesión que pasa a ser la operativa de su rama y arranca `openspec-new-change` sola. Como el plugin no puede llevar la web a otra sesión, el modelo te da su enlace si el plugin conoce la dirección del servidor, o su título y su id. OpenCode no le da esa dirección; dásela con la opción `serverUrl` del plugin en tu configuración global (por ejemplo, `{ "package": "/ruta/a/tu/clon/.opencode/plugins/openspec-autopilot", "options": { "serverUrl": "http://localhost:4096" } }`);
- la sesión del paso siguiente se crea y se pone a trabajar, pero tienes que abrirla tú desde la lista; su título dice el paso;
- las sesiones terminadas no se archivan: quedan marcadas y se archivan la próxima vez que abras la TUI;
- el autopilot no arranca solo: escribe `autopilot` como primer mensaje de una sesión nueva en una rama sin sesión operativa;
- los avisos solo quedan en el log de OpenCode, salvo el de lo modificado en plan: la cadena no espera, y el aviso va al principio del mensaje con el que arranca la sesión siguiente (o, si no hubo producto, el modelo te lo dice en su respuesta siguiente).

`opencode run "…"` en una rama temporal no arranca nada por accidente; con `opencode run autopilot` sí.

En Claude Code no hay plugin: los mismos workflows se lanzan a mano (`/openspec-new-change`, `/openspec-continue-change`, `/openspec-apply-change`, `/openspec-verify-change`, `/openspec-archive-change`), con el mismo ciclo y el mismo resultado versionado ([ADR-0025](adr/0025-asymmetry-policy-with-mode-managed-versioned-block.md), que sustituye a ADR-0006). Ahí los workflows sí te piden el commit.

### Modo auto

El modo auto quita las sesiones de revisión: el producto de cada paso pasa al stage y se sigue. El ciclo solo se para cuando un workflow pregunta algo (la sesión queda en reposo sin producto), en cada cambio entre la zona de specs y la de código, hasta que hagas el commit, y si el verify encuentra problemas críticos, que revisas en la misma sesión y cierras con git como una revisión. Es una preferencia de cada usuario: el proyecto no la fija. Actívalo en tu configuración global de OpenCode, `~/.config/opencode/opencode.json`, con la ruta del plugin en tu clon:

```json
{
  "plugins": [{ "package": "/ruta/a/tu/clon/.opencode/plugins/openspec-autopilot", "options": { "auto": true } }]
}
```

OpenCode recarga el plugin al cambiar la opción, y el modo nuevo vale desde el paso siguiente.

**El modo también decide cuántas tasks hace el apply por sesión** ([ADR-0025](adr/0025-asymmetry-policy-with-mode-managed-versioned-block.md)). En el modo normal, `openspec/config.yaml` lleva en `operations.apply.guidance`, detrás de la indicación de la lista de tareas (ver abajo), cuatro indicaciones más: el apply hace una sola task por sesión, sin delegarla en un subagente, y al terminarla se para. Así lo hace también un apply que lances a mano, en OpenCode o en Claude Code. En el modo auto, esas cuatro no están; la de la lista de tareas está igual en los dos modos. Al cargarse, el plugin ajusta el archivo al modo: añade el bloque si falta o lo quita si sobra, sin tocar nada más. El proyecto lo versiona como lo deja el modo normal, que es el modo por defecto. Así, al activar el modo auto verás `openspec/config.yaml` modificado: haz su commit aparte o descarta el cambio. Mientras siga sin commit, el autopilot espera con el árbol sucio. Claude Code lee el archivo tal como lo dejó la última carga del plugin.

### Ver el progreso del apply en la lista de tareas

La primera indicación de `operations.apply.guidance` pide al apply que, si el agente tiene una lista de tareas para el usuario, la use como reflejo de solo lectura de `tasks.md`: la carga con las tasks del change, en su orden y con las hechas ya completadas (o una entrada por grupo, con su recuento, si son más de una docena), y marca cada una completada solo cuando su checkbox está `- [x]` y el CLI lo confirma. `tasks.md` sigue siendo la única fuente de verdad, y la lista no escribe nada en el repositorio. La indicación es la misma en los dos modos del autopilot, en OpenCode y en Claude Code, y el plugin no la toca.

Si el agente no tiene la herramienta, la indicación no hace nada: el progreso se ve, como siempre, en la salida del apply. Tenerla es una preferencia de cada usuario, así que ningún archivo versionado del proyecto la activa. Actívala en local:

- **Claude Code** la da por defecto solo en algunos modelos y en las sesiones en la nube. En los demás, con `CLAUDE_CODE_ENABLE_TODO_TOOLS=1` en `.claude/settings.local.json`:

  ```json
  {
    "env": { "CLAUDE_CODE_ENABLE_TODO_TOOLS": "1" }
  }
  ```

  o en el entorno desde el que lo lanzas. La lista se ve con Ctrl+T.

- **OpenCode** la da solo con la opción experimental `experimental.todo`, en tu configuración global, `~/.config/opencode/opencode.json`:

  ```json
  {
    "experimental": { "todo": true }
  }
  ```

### Desactivar el plugin en local

Quítalo en tu configuración global de OpenCode, como el arranque de sesión:

```json
{
  "plugins": ["-openspec-autopilot"]
}
```

Así no se carga la parte de servidor, que es la que orquesta; la de TUI se sigue cargando, pero sin servidor no hace nada. Las sesiones que eran operativas siguen siendo sesiones normales.

## El límite de verificación de las tasks

Cada task se dimensiona para quien la verifica: leer su diff, recorrer y ejecutar los escenarios de aceptación que la cubren y, si quiere, depurarla no debe llevar a una persona más de **15 minutos**. Lo pide una regla de `rules.tasks` de `openspec/config.yaml`, que llega al modelo con las instrucciones del artefacto `tasks` (`openspec instructions tasks`), en los dos agentes y también cuando `openspec-update-change` rehace las tasks:

- **La estimación va escrita en cada task**, al final de su línea, como `(verificación: ~10 min)`. No cambia el seguimiento de las tasks: el CLI las sigue contando por su casilla.
- **La referencia para estimar:** 1 minuto por cada 8 líneas de diff que haya que leer (con los tests y sin los archivos generados) y 2 minutos por cada escenario que haya que recorrer. Con ella, 15 minutos son unas 100 líneas y uno o dos escenarios.
- **La task que pase del límite se divide** en tasks que se puedan verificar por separado.

Es una estimación al planificar: nada mide cuánto lleva de verdad, y el plugin no la valida. En OpenCode, la revisión del artefacto `tasks` (y la de los cambios en el plan, si tocan `tasks.md`) comprueba que cada task lleva su estimación y que ninguna pasa del límite, y da el total del change; la revisión de cada task empieza por su estimación y el límite, y si lo que hay que verificar los supera con claridad, te avisa de que puedes rechazarla para que la task se divida.

**Cambiar el límite o la referencia:** edita los números en el texto de la regla, en `openspec/config.yaml`. Valen para las tasks que se planifiquen o se rehagan después; los `tasks.md` ya escritos no cambian. Los tres números son valores de partida: lo que enseñe el uso se registra como lección en el wiki.

## El MCP de depuración

La revisión de una task y la del verify te ofrecen depurar lo revisado. Sin más, te dan una orden de terminal del stack de la plantilla (`node --inspect-brk`, `python -m debugpy --wait-for-client`), que lanzas tú. Para depurar con tu IDE el código de otro stack (por ejemplo, Java sobre WLP o React sobre Vite con VS Code), la plantilla define el contrato de un servidor MCP que dice cómo hacerlo ([ADR-0027](adr/0027-debugging-through-an-information-only-mcp-contract.md)). La plantilla no incluye ningún servidor: lo pone otro, y tiene que cumplir el contrato.

### El contrato

Vive en `.agents/debug/`: `contract.json`, legible por máquina, con la versión (`1.0`), las dos tools con la forma de una definición de tool de MCP (un servidor puede registrarlas copiándolas de ahí) y los errores; y `examples/java-liberty.json` y `examples/react-vite.json`, con una llamada a cada tool y su respuesta. Los ejemplos cumplen los esquemas, pero no se han ejecutado en una máquina con VS Code, Liberty y Vite.

- **`debug_targets`** dice qué se puede depurar en un árbol de trabajo: los IDE con los que el servidor sabe lanzar la depuración, y cada objetivo con su tecnología, el código que cubre, los archivos revisados que le pertenecen y su estado (`stopped`, `running`, `debuggable` o `unknown`). Un árbol de trabajo sin nada que depurar no es un error: devuelve la lista de objetivos vacía.
- **`debug_launch_plan`** da los pasos para lanzar el IDE en modo depuración sobre unos objetivos, con los puntos de ruptura que propone el modelo y los escenarios que ejercitan el código. Cada paso dice quién lo hace: `agent`, el modelo, que ejecuta una orden (`argv`, sin sintaxis de shell) que termina sola y enseguida; o `user`, la persona, que sigue una instrucción, arranca lo que se queda en marcha y depura. Además da los pasos de `cleanup` para dejarlo todo como estaba, y cada punto de ruptura como `planned` o `rejected`, con su motivo.

Lo que el servidor **no** hace: las dos tools son de solo lectura y sin estado. No arrancan ni paran procesos, no abren el IDE, no escriben en el árbol de trabajo y no manejan el depurador (paso a paso, variables): depura la persona. Seguir un plan no deja en el árbol de trabajo archivos que git no ignore, porque la revisión la cierra git. Las dos tools reciben el árbol de trabajo como parámetro (`workspace`; por defecto, el directorio del servidor), así que valen también para una revisión en un worktree. Los errores que el modelo puede corregir (`invalid-workspace`, `unknown-target`, `ide-unavailable`) vuelven con `isError` y un texto que empieza por el código. Un cambio incompatible del contrato sube su versión mayor.

### Conectar un servidor que lo cumpla

En OpenCode, declara el servidor en `mcp.servers`, en la configuración del proyecto o en tu configuración global (`opencode mcp add <nombre> -- <orden>` lo escribe por ti):

```jsonc
{
  "mcp": {
    "servers": {
      "ide": { "type": "local", "command": ["<orden>", "<argumentos>"] }
    }
  }
}
```

- El nombre del servidor es libre: la revisión reconoce el servidor por el nombre de sus tools, `debug_targets` y `debug_launch_plan`. Con el servidor `ide`, OpenCode las llama `ide_debug_targets` e `ide_debug_launch_plan`.
- Code Mode es cosa tuya: por defecto, OpenCode da las tools dentro de Code Mode (`tools.ide.debug_targets(…)`), y con `"codemode": false` las da directamente. La revisión las usa de las dos formas.
- OpenCode arranca un servidor local en la carpeta de cada directorio abierto, que es el `workspace` por defecto del contrato.

Con el servidor conectado, la revisión pregunta a `debug_targets` por los archivos revisados y, si quieres depurar, pide el plan a `debug_launch_plan`, te lo enseña antes de ejecutar nada, ejecuta solo los pasos de `agent` y te da los de `user`. Si un IDE o un objetivo trae problemas, te los dice con su arreglo, sin arreglarlos. Sin servidor, o si no da ningún objetivo para lo revisado, la revisión vuelve a la orden de terminal. El plugin no habla con el servidor: lo usa el modelo de la revisión. En Claude Code no hay sesiones de revisión; con el servidor conectado (sus tools se llaman `mcp__<servidor>__debug_targets`, etc.), puedes pedir lo mismo a mano.

## Ejecutar la suite de aceptación

```bash
cd acceptance-tests && npm test
```

El informe HTML queda en `acceptance-tests/reports/cucumber-report.html`. Los escenarios del arranque de sesión ejecutan `npm install` reales, así que necesitan acceso al registro de npm y tardan más de un minuto. Los del diagnóstico de Windows necesitan `pwsh` (PowerShell 7) en la máquina que ejecuta la suite; sin él fallan diciéndolo. Más detalles en [`acceptance-tests/README.md`](acceptance-tests/README.md).

La suite completa se lanza una sola vez por change, en la última task de su `tasks.md` y con la rama de origen traída a la rama del change (antes, `git fetch`; traerla lo decide el usuario). Las demás tasks ejecutan solo los escenarios que cubren, con `--name`, y comprueban cuántos se ejecutaron. Tras traer una rama permanente a la rama del change se ejecutan `lint:specs`, `test:core` y los escenarios que cambiaron en cualquiera de los dos lados, no la suite completa (skill `openspec-git-discipline`). Lo piden las reglas de las tasks de `openspec/config.yaml` y la plantilla de tasks de `spec-as-source`: la suite completa tardó casi 10 minutos en un contenedor de la nube, y crece con cada change.

## Desactivar el arranque en local

Si prefieres gestionar las dependencias a mano, desactiva el arranque en tu configuración local, sin tocar la del repositorio.

En Claude Code, desactiva los hooks en `.claude/settings.local.json`:

```json
{
  "disableAllHooks": true
}
```

Esto desactiva también la entrega de la guía y del recordatorio del wiki, que van por los mismos hooks. El wiki no se apaga en local: es del proyecto (ver [Habilitar y deshabilitar el wiki](#habilitar-y-deshabilitar-el-wiki)).

En OpenCode, quita el plugin en tu configuración global, `~/.config/opencode/opencode.json`:

```json
{
  "plugins": ["-session-bootstrap"]
}
```

Así no se carga la parte de servidor del plugin, que es la que instala y ajusta el `PATH`. La parte de TUI se sigue cargando, pero sin servidor no muestra nada.

## Windows

En Windows solo se soporta OpenCode 2 o superior; Claude Code en Windows no está soportado ([ADR-0017](adr/0017-windows-support-opencode-lf-diagnostic.md)). El arranque de sesión en Windows llega con el change `windows-global-distro`. Hasta entonces, instala las dependencias a mano (ver [Instalación manual](#instalación-manual)).

### Qué le falta a la máquina

El diagnóstico `scripts/windows/Test-OfflineInstall.ps1` dice qué le falta a una máquina Windows para el proyecto, también sin internet: Node.js con npm, git, Python 3, los finales de línea del clon, el motor del wiki, las dependencias npm de la raíz y de `acceptance-tests/` para la plataforma de la máquina, y OpenCode 2. No instala nada, no cambia ningún archivo y no usa la red. Funciona con Windows PowerShell 5.1, el que trae Windows 11, y con PowerShell 7:

```powershell
powershell -NoProfile -ExecutionPolicy Bypass -File scripts\windows\Test-OfflineInstall.ps1
```

Para cada componente da su estado (`OK`, `OK (vendor)`, `AVISO` o `FALTA`) y, para lo que falta, qué incorporar al repositorio (bajo `vendor\windows\`), la alternativa de instalarlo globalmente, si existe, y cómo conseguirlo en una máquina con internet. Con `-Json` da el mismo informe como JSON. Termina con 1 si falta algo y con 0 si no.

Un `node_modules` instalado en Linux no sirve en Windows: algunos paquetes traen un binario por plataforma (por ejemplo, `@esbuild/win32-x64`), y el diagnóstico los nombra.

### Finales de línea

`.gitattributes` fija LF en todos los archivos de texto, aunque Git for Windows extraiga con `core.autocrlf=true`. Un clon de Windows anterior a `.gitattributes` puede tener archivos con CRLF; el diagnóstico los detecta. Para volver a extraerlos con LF, con el árbol limpio:

```bash
git rm -r --cached -q .
```

```bash
git reset --hard
```

## Instalación manual

Donde el arranque de sesión no se ejecuta (por ejemplo, en Windows, o con OpenCode 1), instala las dependencias de la raíz y de la suite, y usa el CLI del proyecto con npx:

```bash
npm install
```

```bash
cd acceptance-tests && npm install
```

```bash
npx openspec --version
```

## Qué heredan los proyectos creados desde la plantilla

Además de los archivos de arriba, un proyecto creado desde la plantilla hereda su registro de OpenSpec, como cualquier proyecto que ya se haya trabajado con él:

- **Specs** en `openspec/specs/`: describen el comportamiento que el proyecto hereda (por ejemplo, `session-bootstrap`). Un change del proyecto que lo altere las modifica como cualquier otra spec.
- **ADRs** en `adr/`: las decisiones duraderas de la plantilla, vigentes también para el proyecto mientras ningún ADR posterior las sustituya.
- **Changes archivados** en `openspec/changes/archive/`: la historia de la plantilla. La suite no los ejecuta nunca.
- **La regla de comentarios** en `.agents/comments/`, que cada usuario puede desactivar con `PROJECT_COMMENTS=off`.
- **La suite de aceptación**, que ejecuta los escenarios heredados junto a los del proyecto y debe seguir en verde.
- **El wiki**, deshabilitado: la guía, el recordatorio, los pasos de resincronización (`archive-guidance.yaml`) y la versión fijada del motor en `.agents/wiki/`, con `"enabled": false`. Se habilita con `/toggle-wiki`. También hereda `.wiki/`, el wiki de la plantilla: su ingesta inicial (las specs, los ADRs y el código fijados a un commit) y lo comprobado al construirla. Es conocimiento de la plantilla, como los changes archivados. Un proyecto puede conservarlo o vaciarlo; si lo vacía, la guía indica hacer la ingesta inicial de su propio repositorio cuando vuelva a crearlo. El hub de cada usuario no se hereda: es suyo.

## Subir de versión OpenSpec

Hazlo desde una máquina con OpenSpec bien configurado (perfil `custom`, solo skills, con los workflows de la lista de arriba, solo para Claude Code) y revisa el diff de `.claude/` antes del commit. Solo se regeneran las skills de `.claude/`; OpenCode 2 las lee de ahí, así que no hace falta generarlas para OpenCode.
