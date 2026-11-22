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
- **Regla de comentarios**: comentas partes de una respuesta del agente sin que conteste a cada comentario, y luego le pides que los responda todos o que reformule la respuesta (ver abajo).
- **Arranque de sesión** que prepara el proyecto en los dos agentes (ver abajo).
- **El ciclo de un change en una rama y una sola fusión con `--no-ff`** como forma recomendada, con la forma canónica de intent-driven también admitida, igual en los dos agentes, y en OpenCode 2 un plugin que lo automatiza con una sesión por paso (ver abajo).

## Requisitos

- Node.js 22.12 o superior (`engines.node` en `package.json`), con npm.
- bash, para el arranque de sesión.
- git y acceso a GitHub en la primera sesión de cada clon (y al subir la versión del motor del wiki), para descargar el motor.
- Python 3, para el helper determinista del motor del wiki (`bin/llm-wiki`: lint, checkpoints, archivos…). Los workflows del wiki no lo necesitan.
- Claude Code, u OpenCode 2 o superior. OpenCode 1 no está soportado: su API de plugins es otra.

## Qué ocurre al abrir una sesión

Cada vez que se abre una sesión de Claude Code o de OpenCode en el proyecto, local o en la nube, el adaptador de ese agente ejecuta el núcleo del arranque de sesión, `.agents/hooks/session-bootstrap.sh`, que no depende de ningún agente:

1. Prepara git: si el clon es superficial, lo completa; en un contenedor efímero (una sesión en la nube), trae las referencias de `origin` con `git fetch`; pone al día cada rama permanente local atrasada respecto a `origin/<rama>`, salvo la rama en la que está el clon, y avisa de las que han divergido; y en un contenedor efímero guarda la rama de la sesión en `git config idd.sessionBranch`. No toca el árbol de trabajo. Fuera de la nube solo usa la red para completar un clon superficial.
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

No hace commits: deja `engine.json`, `config.yaml` (y `.wiki/`, tras la ingesta) en el stage, y haz tú el commit para que valga para todos. Al terminar te dice qué vale ya en la sesión y qué desde la siguiente: en Claude Code, `/wiki:*` y `wiki-manager` se pueden usar en la misma sesión y el recordatorio llega desde el mensaje siguiente, pero la guía y `CLAUDE_PLUGIN_ROOT` llegan en la sesión siguiente; en OpenCode, las skills llegan con el mensaje siguiente y la guía y el recordatorio al volver a abrirlo.

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
- que las operaciones que citan la guía, el recordatorio y las indicaciones de archivado (`/wiki:ll`, `/wiki:ingest`, `/wiki:ingest-collection --manifest-only`, `/wiki:refresh`, `/wiki:compile`, `/wiki:librarian scan`, `/wiki:lint`) siguen existiendo con esas opciones;
- su licencia y su changelog.

Después, pasa la suite de aceptación.

## Comentar las respuestas del agente

Cuando una respuesta del agente tiene varias partes que quieres comentar, contestar a cada una por separado genera otra respuesta larga por comentario. La **regla de comentarios** (`.agents/comments/rule.md`) lo evita:

- **Un comentario** es un mensaje que empieza por una cadena entre comillas simples, por ejemplo `'el segundo punto' no lo entiendo`. El agente no lo responde: contesta solo con una frase fija que te recuerda las opciones, y lo guarda.
- **"ya"** en un mensaje hace que responda en un solo mensaje a todos los comentarios guardados desde su última respuesta completa.
- **"reformula"** hace que rehaga su respuesta entera con tus comentarios incorporados. Da por hecho que solo has leído lo que citaste, así que la nueva versión se entiende por sí sola.

"ya" y "reformula" cuentan como palabras completas, sin distinguir mayúsculas y fuera de la cadena entre comillas del comentario: `mayo` o `¿lo reformulamos?` no cuentan.

La regla la entrega el arranque de sesión al empezar. Además, cuando un mensaje es un comentario o contiene "ya" o "reformula", el arranque añade a ese mensaje un recordatorio breve (`.agents/comments/reminder.md`), para que el agente la aplique aunque la sesión sea larga. Qué mensajes la activan lo decide el núcleo del arranque, igual en los dos agentes. El comportamiento exacto está en la spec `response-comments`.

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

Hay dos formas del ciclo, y las dos se admiten ([ADR-0015](adr/0015-git-discipline-two-forms-and-ephemeral-commits.md), que sustituye a ADR-0007 junto con [ADR-0013](adr/0013-model-creates-change-branches-plugin-stages.md)):

- **La forma recomendada:** el change se hace entero en **una rama temporal** (propuesta, implementación, archive y, con el wiki habilitado, resincronización del wiki), se archiva en ella y llega a la rama de origen en **una sola fusión con `--no-ff`**. Con `git log --first-parent`, cada change es una entrada cuyo diff junta el plan, el código, el archive y, si lo hay, el wiki, y la rama permanente no recibe commits directos.
- **La forma canónica de intent-driven:** la propuesta se fusiona con la rama de origen antes del apply, y el change se archiva en la rama de origen después de fusionar la implementación, con todas sus tasks hechas. Conviene para revisar el plan aparte o reservar pronto los números de ADR, a cambio de tres fusiones.

El squash también se admite: ningún paso del ciclo depende de que los commits de la rama lleguen a la rama de origen, y las citas del wiki se resuelven por el blob que guardan sus manifiestos.

**Quién hace los commits.** En local, la rama temporal la puede crear el modelo, siempre desde la rama de origen y con el nombre del change, y los commits y las fusiones los hace el usuario: fuera del autopilot, los workflows los piden tras cada artefacto, cada task, el archive y, con el wiki habilitado, la resincronización del wiki; en el autopilot, el plugin deja lo producido en el stage y espera tu commit. En un contenedor efímero (una sesión en la nube, donde el contenedor se pierde), el agente hace commit y push en la rama de la sesión, sin preguntar, en esos momentos y cuando el entorno avisa al final de un turno, con commits provisionales si hace falta. Antes de cada commit ejecuta la puerta `check commit`, y nunca fusiona, crea ramas ni toca otras ramas. Ningún commit mezcla la zona de specs (`openspec/`, salvo los `tasks.md` y `openspec/config.yaml`, que son neutros) con la de código.

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

- **Las puertas** (proponer, apply, archive y commit) las decide `node .agents/openspec/branch-change.mjs check <propose|apply|archive|commit> [<change>]`, que admite las dos formas del ciclo, dice cómo seguir cuando no deja y la skill `openspec-git-discipline` manda ejecutar y obedecer. Esa skill es una copia del origen reescrita a propósito: no la sobrescribas al actualizar desde la plantilla de origen sin revisarlo.
- **Las ramas temporales** las maneja el modelo con el mismo módulo, nunca con git a mano, y nunca con el árbol sucio (en un contenedor efímero, el agente no las crea ni cambia de rama):

  ```bash
  node .agents/openspec/branch-change.mjs list            # las ramas temporales con su change
  node .agents/openspec/branch-change.mjs start <change>  # crea la rama del change desde la rama de origen
  node .agents/openspec/branch-change.mjs switch <rama>   # cambia a una rama temporal
  ```

## Automatizar el ciclo en OpenCode

En OpenCode 2, el plugin local `.opencode/plugins/openspec-autopilot/` recorre el change de la rama paso a paso, cada paso en una sesión nueva con el workflow y el agente que tocan, y archiva la anterior ([ADR-0014](adr/0014-autopilot-verifies-product-and-closes-reviews-with-git.md), que sustituye a ADR-0008). Lo que se ha producido y cuándo se cierra una revisión no lo decide el modelo: lo decide el plugin con el CLI de OpenSpec y con git.

- **La sesión operativa.** En cada rama hay una sola sesión viva en autopilot. Al abrir OpenCode en la TUI sin ella, el plugin la crea y la arranca solo: con el paso que diga `openspec status` si la rama tiene change, o con `openspec-new-change` si no lo tiene (también en una rama permanente: el modelo te pide la descripción y crea la rama del change). Cualquier otra ventana (la pantalla de inicio, `/new`, otra sesión, o cualquiera de ellas al volver al terminal) muestra un modal de un botón que lleva a la sesión operativa. Con HEAD separado no hace nada; con varios changes en la rama, avisa y tampoco.
- **El producto de cada paso.** Al empezar un paso, el plugin guarda qué artefactos están hechos y qué tasks marcadas. Cuando la sesión queda en reposo, compara: lo que ha cambiado es el producto. Sin producto no pasa nada (la tool `openspec_handoff` lo dice). Con producto, el plugin lo pasa al stage de git y sigue, aunque el modelo no haya llamado a la tool o haya hecho más de lo que tocaba.
- **La revisión, en el modo normal.** Tras cada artefacto, cada task, el verify y cada `openspec-update-change` se abre una sesión de revisión, una por producto, en la que el modelo te guía sin tocar archivos. La revisión la cierras tú con git, y se cierra cuando envías tu siguiente mensaje:
  - **haz el commit** de lo que hay en el stage: revisión satisfactoria, y se sigue con el paso siguiente;
  - **saca todo del stage** (`git restore --staged .`) y escribe tus conclusiones: revisión no satisfactoria. Lo sacado se queda en el árbol, y tu mensaje llega a `openspec-update-change` como conclusiones (si es una sola palabra, se toman las del modelo), seguido de una revisión del plan;
  - mientras quede algo en el stage sin commit, la revisión sigue y tus mensajes llegan al modelo.

  La revisión del verify empieza con el árbol limpio: para darla por buena sin cambiar nada, haz un commit vacío (`git commit --allow-empty -m "verify revisado"`).
- **Los commits.** Ningún modelo te pide commits. Además de las revisiones, el plugin espera tu commit tras el archive y, con el wiki habilitado, tras la resincronización del wiki, que van en commits separados. Con el wiki deshabilitado, el ciclo termina en el archive y solo queda fusionar la rama.
- **Al volver a la sesión operativa** (al entrar o al recuperar el foco), el plugin la comprueba. Si HEAD cambió de rama, sigue las reglas de la rama actual. Si su change ya no está en la rama, la archiva y empieza uno nuevo. Si esperaba tu commit y ya está hecho, arranca el paso. Si su paso no encaja con `openspec status`, te lo explica en un modal y no lo arregla.
- Las lecciones candidatas de cada sesión quedan en su metadata, nunca en el repositorio, y, con el wiki habilitado, llegan a la resincronización del wiki tras el archive, que solo registra las que confirmes.
- El estado (qué sesión es la operativa y qué paso hizo cada una) vive solo en la metadata de las sesiones de OpenCode.

### Con la UI web, OpenCode Desktop y `opencode run`

La lógica vive en la parte de servidor del plugin y funciona con cualquier cliente: el producto, el stage, el cierre de las revisiones por git, el encadenado de sesiones y la validación. La interfaz (el modal, el foco, navegar a una sesión y archivarla) solo existe en la TUI, porque OpenCode 2.3.2 no ejecuta en la UI web (`opencode pair`, `opencode serve`) la interfaz de los plugins de un proyecto, y OpenCode Desktop solo con una API experimental que el plugin no usa. Sin TUI:

- en una sesión que no es la operativa, el modelo sabe que ahí no se opera y te dice cuál es la operativa;
- la sesión del paso siguiente se crea y se pone a trabajar, pero tienes que abrirla tú desde la lista; su título dice el paso;
- las sesiones terminadas no se archivan: quedan marcadas y se archivan la próxima vez que abras la TUI;
- el autopilot no arranca solo: escribe `autopilot` como primer mensaje de una sesión nueva en una rama sin sesión operativa;
- los avisos solo quedan en el log de OpenCode.

`opencode run "…"` en una rama temporal no arranca nada por accidente; con `opencode run autopilot` sí.

En Claude Code no hay plugin: los mismos workflows se lanzan a mano (`/openspec-new-change`, `/openspec-continue-change`, `/openspec-apply-change`, `/openspec-verify-change`, `/openspec-archive-change`), con el mismo ciclo y el mismo resultado versionado ([ADR-0006](adr/0006-agent-asymmetry-policy.md)). Ahí los workflows sí te piden el commit.

### Modo auto

El modo auto quita las sesiones de revisión: el producto de cada paso pasa al stage y se sigue. El ciclo solo se para cuando un workflow pregunta algo (la sesión queda en reposo sin producto), en cada cambio entre la zona de specs y la de código, hasta que hagas el commit, y si el verify encuentra problemas críticos, que revisas en la misma sesión y cierras con git como una revisión. Es una preferencia de cada usuario: el proyecto no la fija. Actívalo en tu configuración global de OpenCode, `~/.config/opencode/opencode.json`, con la ruta del plugin en tu clon:

```json
{
  "plugins": [{ "package": "/ruta/a/tu/clon/.opencode/plugins/openspec-autopilot", "options": { "auto": true } }]
}
```

OpenCode recarga el plugin al cambiar la opción, y el modo nuevo vale desde el paso siguiente.

### Desactivar el plugin en local

Quítalo en tu configuración global de OpenCode, como el arranque de sesión:

```json
{
  "plugins": ["-openspec-autopilot"]
}
```

Así no se carga la parte de servidor, que es la que orquesta; la de TUI se sigue cargando, pero sin servidor no hace nada. Las sesiones que eran operativas siguen siendo sesiones normales.

## Ejecutar la suite de aceptación

```bash
cd acceptance-tests && npm test
```

El informe HTML queda en `acceptance-tests/reports/cucumber-report.html`. Los escenarios del arranque de sesión ejecutan `npm install` reales, así que necesitan acceso al registro de npm y tardan más de un minuto. Más detalles en [`acceptance-tests/README.md`](acceptance-tests/README.md).

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

## Instalación manual

Donde el arranque de sesión no se ejecuta (por ejemplo, en Windows sin bash, o con OpenCode 1), instala las dependencias de la raíz y de la suite, y usa el CLI del proyecto con npx:

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
