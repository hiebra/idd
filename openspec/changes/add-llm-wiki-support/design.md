## Context

La plantilla prepara cada sesión de Claude Code y de OpenCode 2 con un núcleo neutral (`.agents/hooks/session-bootstrap.sh`) y un adaptador por agente: el hook `SessionStart` de `.claude/` y el plugin `.opencode/plugins/session-bootstrap/` (ADR-0002). Las skills del schema tienen una sola copia en `.agents/skills/`, que cada agente ve por sus propias rutas (ADR-0003).

Este change añade el concepto de **LLM wiki**: una base de conocimiento en Markdown que el agente consulta antes de responder y amplía con lo que descubre. Hay dos ámbitos:

- **El wiki del proyecto**, en `.wiki/`, versionado con el repositorio.
- **El hub del usuario**, fuera del repositorio y opcional.

Las operaciones sobre el wiki (consultar en solo lectura, ingerir, compilar, refrescar, revisar con el librarian, lint, lecciones aprendidas, checkpoints) las aporta un **motor del wiki** externo, hoy [nvk/llm-wiki](https://github.com/nvk/llm-wiki) v1.0.0 (MIT). El concepto no depende del motor. Lo que añade la plantilla es la **guía del wiki** (el flujo de trabajo), un **recordatorio** de ella en cada mensaje y la instalación del motor en la versión fijada.

Hechos comprobados que condicionan el diseño:

- **Claude Code 2.1.330, en real.** Un plugin instalado con `claude plugin install` desde el hook `SessionStart` **no se carga en esa sesión**, solo en la siguiente. En la nube cada sesión empieza en un contenedor nuevo, así que el plugin no estaría nunca disponible. En cambio, las skills y los comandos que el hook escribe en `.claude/skills/<id>/` y `.claude/commands/wiki/<cmd>.md` **sí aparecen en la misma sesión**, y los comandos de `commands/wiki/` se invocan como `/wiki:<cmd>`, igual que en el plugin.
- **OpenCode 2, en su código fuente (dev, ~2.3).**
  - Un usuario no puede retirar desde su configuración las `instructions` de un `opencode.json` del proyecto, porque se unen las de todas las configuraciones. Tampoco puede evitar que se lea el `AGENTS.md` de la raíz, que OpenCode carga siempre.
  - Un plugin puede añadir contexto antes de cada petición al modelo con el hook `context`. Si ese hook lanza una excepción, la petición falla.
  - Busca skills de proyecto en `.claude/skills`, `.agents/skills` y `.opencode/skills`, y ante el mismo ID gana `.claude/skills`.
- **El motor.** El paquete de OpenCode es la misma skill que la de Claude Code: el mismo `SKILL.md` con nueve cambios de texto, más las mismas `references/` y el mismo helper `bin/llm-wiki` (Python 3). Los 28 comandos de Claude Code solo existen en el paquete de Claude Code; tres de ellos llaman al helper con `${CLAUDE_PLUGIN_ROOT}/bin/llm-wiki`.

## Goals / Non-Goals

**Goals:**
- Motor del wiki disponible **en la misma sesión** en Claude Code (local y en la nube) y en OpenCode 2, en una sola versión fijada.
- Guía y recordatorio entregados por los adaptadores del arranque, desde una única fuente y desactivables en local.
- `.wiki/` versionado, y resincronizado con lo que toca cada change al archivarlo.
- Ninguna copia del motor versionada en el repositorio.

**Non-Goals:**
- Codex, Pi, DeepSeek Harness y otros runtimes del motor.
- Comandos `/wiki:*` en OpenCode.
- La captura de sesiones del motor (`.sessions/`).
- El hub en sesiones en la nube.
- El lint del wiki en CI.
- Modificar el motor.

## Decisions

### D1. El motor se descarga una vez por versión, y cada agente lo ve desde sus propias rutas

El núcleo del arranque clona el tag fijado (`git clone --depth 1 --branch <ref>`) en `.agents/wiki-engine/`, ignorado por git, y deja un sello con el ref instalado. Si el sello coincide con el ref fijado, no hace nada. Si no, descarga en un directorio temporal y lo sustituye de forma atómica. Después expone el motor a cada agente con symlinks, igual que hace ADR-0003 con las skills del schema:

| Ruta del agente (ignorada por git) | Apunta a | La usa |
|---|---|---|
| `.claude/skills/wiki-manager` | `claude-plugin/skills/wiki-manager` | Claude Code y OpenCode |
| `.claude/commands/wiki/` | `claude-plugin/commands/` | Claude Code (`/wiki:query`, `/wiki:ll`…) |
| `.opencode/skills/wiki-query` | `plugins/llm-wiki-opencode/skills/wiki-query` | OpenCode |

- **Una sola `wiki-manager` para los dos agentes**, la de Claude Code. OpenCode la descubre en `.claude/skills` y, por la precedencia de esa carpeta, una copia en `.opencode/skills` quedaría tapada. Los nueve cambios de texto del paquete de OpenCode se reducen en la práctica a uno con peso: qué hacer con `/wiki:*` en un agente sin esos comandos, más la variable `OPENCODE_ENABLE_EXA` para buscar en la web. Eso lo cubre la guía cuando se entrega en OpenCode (D3).
- **`wiki-query` solo en OpenCode**, como skill de solo lectura (2,8 KB). Claude Code tiene `/wiki:query`.
- **El helper.** Los adaptadores exportan `CLAUDE_PLUGIN_ROOT` con la ruta del motor descargado (en Claude Code por `CLAUDE_ENV_FILE`, en OpenCode en el entorno de cada comando), para que `${CLAUDE_PLUGIN_ROOT}/bin/llm-wiki` funcione.
- **La versión fijada** se declara en un único archivo, `.agents/wiki/engine.json` (`{"repo": "nvk/llm-wiki", "ref": "v1.0.0"}`). No va en `package.json`, porque cambiar el motor no debe forzar un `npm install`.
- Si la descarga falla, el núcleo devuelve un aviso con el prefijo `session-start:`, que indica cómo instalarlo a mano, y lo reintenta en la siguiente sesión, igual que con npm.

Alternativas descartadas:
- **El plugin de Claude Code** (`claude plugin install`). No se carga en la sesión en que se instala, así que en la nube nunca estaría disponible.
- **La vía `instructions` del motor en OpenCode.** No se puede desactivar en local y ocupa unos 30 KB en cada sesión.
- **Un submódulo git.** Fija el motor en el repositorio, complica los proyectos creados desde la plantilla y mezcla el código del motor con el del proyecto.
- **Copias en lugar de symlinks.** Funcionarían igual, pero duplicarían la descarga.

### D2. La guía y el recordatorio viven en `.agents/wiki/`

- **`.agents/wiki/guide.md`** es la guía, la única fuente del flujo. Cubre: qué peticiones requieren conocimiento; consultar primero (`.wiki/` y después el hub); preguntar ante un hueco con las tres opciones; dónde registrar (proyecto o hub, y checkpoints del hub al proyecto); registrar lo descubierto al trabajar (lecciones aprendidas para lo comprobado, ingesta de la fuente para lo encontrado en internet); los productos del proyecto como fuentes fijadas a un commit; la ingesta inicial al crear `.wiki/`; y no ignorar `.wiki/` en git. Tiene que caber holgadamente en los 10.000 caracteres que admite un hook de Claude Code; el objetivo es menos de 6.000.
- **`.agents/wiki/reminder.md`** es el recordatorio, de 600 caracteres como máximo, con dos marcadores (`{{ll}}` e `{{ingest}}`). Cada adaptador los sustituye por la forma de invocar esas operaciones en su agente: `/wiki:ll --local` y `/wiki:ingest <url> --local` en Claude Code; "pide registrar las lecciones aprendidas" e "ingiere la fuente" en OpenCode.
- **Cada sección de la guía lleva un identificador** (un comentario HTML `<!-- wiki-guide:consultar -->`, etc.). Así, la suite comprueba que la guía cubre cada parte del flujo sin depender de cómo esté redactada.

Alternativa descartada: **`AGENTS.md` + `CLAUDE.md`.** OpenCode los carga siempre, así que el wiki no se podría desactivar en local.

### D3. Entrega por agente

| | Claude Code | OpenCode 2 |
|---|---|---|
| Guía | El hook `SessionStart` existente añade la guía como `additionalContext`, junto al `systemMessage` de los avisos | El hook `context` del plugin añade la guía como parte del system, precedida de una nota para OpenCode (sin `/wiki:*`; `OPENCODE_ENABLE_EXA` para la web) |
| Recordatorio | Hook nuevo `UserPromptSubmit` (`.claude/hooks/user-prompt-submit.sh`), con `additionalContext` | El mismo hook `context`, que inserta el recordatorio antes del último mensaje del usuario, como hace el modo Plan de OpenCode |
| Si falla | El hook sale con 0 y sin salida; el mensaje sigue | Todo el cuerpo va en `try/catch`; si falla, no añade nada |

El hook `context` de OpenCode se ejecuta antes de cada petición al modelo, no solo una vez por mensaje. Como transforma el contexto y no lo guarda, el recordatorio no se acumula: en cada petición hay una sola copia, la del último mensaje. Se descarta el hook `prompt`, que modificaría el texto guardado del mensaje del usuario, y `instructions.entry.put`, que es una API experimental marcada para retirarse.

Las dos piezas se generan en el núcleo, no en los adaptadores: el núcleo lee `guide.md` y `reminder.md` y devuelve el texto ya sustituido para el agente que lo pide. Así su lógica (desactivación, marcadores, límite de longitud) tiene una sola implementación, como el resto del arranque (ADR-0002).

### D4. Desactivación en local: `PROJECT_WIKI=off`

Si la variable de entorno `PROJECT_WIKI` vale `off`, el núcleo no descarga el motor, retira los symlinks de D1 (que son locales e ignorados por git) y devuelve la guía y el recordatorio vacíos.

- **En Claude Code**, en `.claude/settings.local.json`: `{"env": {"PROJECT_WIKI": "off"}}`.
- **En OpenCode**, en el entorno desde el que se lanza.

Ningún archivo versionado cambia. `disableAllHooks` y `"plugins": ["-session-bootstrap"]` siguen apagando todo el arranque, wiki incluido.

### D5. `.wiki/` nunca ignorado

Al inicializar un wiki en modo local, el motor añade `.wiki/` al `.gitignore`. El núcleo, en cada sesión, comprueba con `git check-ignore` si algún archivo de `.wiki/` está ignorado. Si alguna línea de `.gitignore` es exactamente `.wiki` o `.wiki/`, la elimina y avisa. Si lo ignora otra regla, solo avisa. La guía lo dice también, para que el agente no lo deshaga.

### D6. Resincronización al archivar: `operations.archive.guidance`

En `openspec/config.yaml`, bajo `operations.archive.guidance`, van los siete pasos de la spec, con las operaciones del motor:

1. `/wiki:ingest-collection . --adapter git --manifest-only --revision <commit del archivado> --include <rutas que tocó el change> --local`
2. `/wiki:refresh` de los artículos cuyas fuentes cambiaron, y `/wiki:compile`.
3. `/wiki:librarian scan --local`.
4. `/wiki:ll --local --dry-run`.
5. El usuario confirma qué se escribe.
6. `/wiki:lint --local`, y `--fix` hasta que no dé errores.
7. Commit del wiki, aparte.

**Las rutas que tocó el change** son las del diff entre la base de la rama del change y `main` tras fusionarla, más sus specs y ADRs. La skill de archivar ya consulta `openspec instructions archive --json`, así que no hay que modificarla. El commit va después del de archivado porque el manifiesto fija ese commit, y porque con `spec-as-source` `.wiki/` está fuera de `openspec/` y no puede ir en el mismo commit.

### D7. Cómo verifica la suite

La suite no puede comprobar cómo razona el modelo. Comprueba lo que la plantilla garantiza, ampliando los adaptadores simulados que ya existen (`support/agents/`):

- **Instalación del motor.** Un repositorio git local hace de repositorio del motor, con un tag; `engine.json` apunta a él en la copia temporal. Se comprueba el sello, los symlinks, la sustitución al cambiar de versión, el reintento tras un fallo (repositorio inaccesible) y que `git status` quede limpio.
- **Descubrimiento.** Se usan las reglas de `support/skills.js`, ampliadas con comandos de Claude Code (`.claude/commands/<ns>/<cmd>.md` → `/<ns>:<cmd>`).
- **Guía y recordatorio.**
  - En Claude Code, salida de los hooks `SessionStart` y `UserPromptSubmit`.
  - En OpenCode, `opencode-host.mjs` invoca el hook `context` con un contexto falso.
  - Se comprueban los identificadores de sección, los marcadores sustituidos, la longitud y el caso de fallo.
- **Indicaciones de archivado.** Se ejecuta `openspec instructions archive --change <change de prueba> --json` y se revisa `operationGuidance`.
- **`.wiki/` ignorado.** Se simula la inicialización del motor añadiendo `.wiki/` al `.gitignore`.

### D8. Gestión de conflictos de nombres

`.claude/skills/` mezcla archivos versionados (los workflows de OpenSpec y los symlinks del schema) con el symlink local del motor. El `.gitignore` ignora rutas concretas (`.claude/skills/wiki-manager`, `.claude/commands/wiki/`, `.opencode/skills/wiki-query`, `.agents/wiki-engine/`), no carpetas enteras. Si un proyecto ya tuviera una skill o un comando con esos nombres, el núcleo no la sobrescribe y avisa.

## Risks / Trade-offs

- **[`CLAUDE_PLUGIN_ROOT` fuera de un plugin]** Los `allowed-tools` de los tres comandos que usan el helper no se resolverán como en un plugin, así que Claude Code pedirá permiso para ejecutarlo. → Aceptable: son tres comandos, y el permiso se concede una vez. Se documenta.
- **[OpenCode usa la skill de Claude Code]** El modelo puede intentar ejecutar `/wiki:*`. → La nota para OpenCode de la guía lo cubre. Si en uso real no basta, se puede añadir en `.opencode/skills/` el paquete de OpenCode, con otro ID para que no lo tape `.claude/skills`.
- **[Dependencia de APIs de OpenCode]** El hook `context` y el orden de precedencia de skills pueden cambiar entre versiones. → La suite simula ese contrato; como en el change anterior, se comprueba con un OpenCode 2 real.
- **[Coste de contexto]** Guía (unos 6.000 caracteres por sesión) y recordatorio (600 por mensaje; en OpenCode, por petición sin acumularse). → Límites fijados en la spec y comprobados por la suite.
- **[Red y GitHub en la primera sesión]** Sin acceso, no hay motor, pero la sesión sigue y se avisa. → Mismo modelo que npm.
- **[El motor cambia su estructura en otra versión]** Las rutas de D1 son del motor v1.0.0. → Subir de versión exige revisar D1 y pasar la suite; se documenta en el README.
- **[Resincronización larga en changes grandes]** → Solo afecta a lo que tocó el change, y el usuario confirma antes de escribir.

## Migration Plan

Los proyectos ya creados desde la plantilla lo adoptan copiando `.agents/wiki/`, los cambios del núcleo y los adaptadores, la entrada de `.gitignore` y la de `openspec/config.yaml`. La primera sesión descarga el motor; la primera vez que se use el wiki, el motor crea `.wiki/` y la guía indica hacer la ingesta inicial.

Para revertirlo, `PROJECT_WIKI=off` lo apaga para un usuario. Para el proyecto, se borra `engine.json` y el núcleo deja de instalar el motor y de entregar la guía y el recordatorio. `.wiki/` se conserva.

## Open Questions

- **ADR-0003.** Lo cumple: hay una sola copia del motor, vista por cada agente desde sus rutas. Pero introduce en `.claude/skills/` entradas locales que no son ni del schema ni de OpenSpec. El paso de ADR registrará un ADR nuevo, sobre el wiki y la integración del motor, que lo complemente. No hace falta sustituirlo.
- **Nombre de la variable de desactivación.** `PROJECT_WIKI` es genérico; habrá que confirmarlo al escribir el README.
- **Comprobación en un OpenCode real** del hook `context` y de que se elige `wiki-manager` desde `.claude/skills`: tarea del change, como en `add-opencode-parity`.
