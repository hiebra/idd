## Context

Hoy el wiki del proyecto viene encendido. Cada usuario lo puede apagar para sí con `PROJECT_WIKI=off`, que lee el núcleo del arranque (`wiki_disabled`, `.agents/hooks/session-bootstrap.sh`). Con la variable puesta, el núcleo no instala el motor, retira los symlinks de `ENGINE_LINKS` y no entrega ni la guía ni el recordatorio. Ese apagado deja fuera tres cosas que también dependen del wiki:

- las indicaciones de archivado de `openspec/config.yaml` (`operations.archive.guidance`), que siguen pidiendo los siete pasos de resincronización con operaciones `/wiki:*` que ya no existen;
- el autopilot de OpenCode, que tras el archive siempre crea el paso `wiki` (`lib/next-step.mjs`) y espera su commit (`waitsForCommit`);
- la skill `openspec-git-discipline` y los prompts del autopilot, que dan por hecho la resincronización y el commit del wiki.

Hechos comprobados que condicionan el diseño:

- En Claude Code 2.1.330, lo que el hook `SessionStart` añade a `.claude/skills/` y `.claude/commands/` o retira de allí vale en la misma sesión. Si se añade a mitad de sesión, después del hook, no está comprobado (`.wiki/wiki/topics/carga-en-la-misma-sesion-por-agente.md`; la retirada se comprobó en la sesión de este change, con `claude -p`).
- En OpenCode 2.3.2, en la TUI, una skill instalada a mitad de sesión aparece en el mensaje siguiente. `opencode run` deja el arranque a medias.
- `operations.<op>.guidance` solo añade pasos al workflow: no puede saltarse sus preguntas ni cambiar sus flags (`.wiki/raw/notes/2026-11-22-ll-guidance-de-archive-no-salta-preguntas.md`). Para que el archive no resincronice, los pasos no tienen que estar.
- Con OpenCode real solo se ha comprobado el contrato de los plugins (el hook `context` y la carga de skills), no el flujo del wiki.

ADRs en vigor que acotan el diseño: ADR-0002 (núcleo neutral y adaptadores), ADR-0004 (wiki-first), ADR-0005 (el motor y la guía llegan por el arranque, con el apagado en local), ADR-0010 (instrucciones por el arranque), ADR-0006 (asimetrías entre agentes), ADR-0017 (en Windows solo OpenCode, con Git Bash para el núcleo) y ADR-0018 (en OpenCode, `session-bootstrap` entrega la guía y el recordatorio del wiki). ADR-0016 rige los commits y las fusiones del ciclo.

En paralelo, el change del schema `intent-driven` prepara una variante adelgazada en la que un `.bat` instala de forma global el schema, las skills, el autopilot y el arranque de sesión. Allí se ha decidido que el `.bat` también instale el motor del wiki y que la guía y el recordatorio viajen con el arranque global.

## Goals / Non-Goals

**Goals:**

- Un único ajuste versionado que encienda o apague el wiki para todo el proyecto, apagado por defecto.
- Que apagarlo lo apague todo: el motor, la guía, el recordatorio, la resincronización del archive y el paso `wiki` del autopilot.
- Un comando `/toggle-wiki` en los dos agentes, que haga el cambio entero, incluida la ingesta inicial con confirmación.
- Que el diseño funcione igual en la variante completa (este repositorio) y en la adelgazada (todo global con el `.bat`).
- Probar el flujo del wiki con OpenCode real, en la TUI.

**Non-Goals:**

- El `.bat` y la variante adelgazada en sí, que son del change del schema `intent-driven`.
- El hub del usuario.
- Borrar `.wiki/` al apagar el wiki.
- Un apagado por usuario: se quita `PROJECT_WIKI` y no se sustituye.

## Decisions

### D1. El ajuste es el campo `enabled` de `.agents/wiki/engine.json`

`engine.json` ya es la declaración del wiki del proyecto. Lleva `repo` y `ref` del motor, y se le añade `"enabled": true|false`. Si falta el campo o no es `true`, el wiki está apagado: un error en el archivo nunca enciende el wiki. El núcleo lo lee sin Node, como ya lee `repo` y `ref`, con una función que acepta solo el literal `true`. El autopilot lo lee con `JSON.parse`.

En la variante adelgazada, el `.bat` aporta el motor, y el `engine.json` del proyecto puede quedarse solo con `enabled`. Si además lleva `repo` y `ref`, se ignoran (D8).

Alternativas descartadas:

- **Que el ajuste sea la presencia de `engine.json`**, que es el apagado del proyecto que existe hoy: apagar perdería la versión fijada del motor.
- **Una clave propia en `openspec/config.yaml`**: OpenSpec valida ese archivo, y una clave desconocida puede dejar de admitirse en otra versión. Además, mezcla la configuración del wiki con la de OpenSpec.
- **Un archivo aparte, como `.agents/wiki/enabled`**: es otro sitio para la misma declaración.

### D2. Los pasos de resincronización tienen una única fuente y van entre marcas en `config.yaml`

El texto de los pasos de resincronización deja de escribirse a mano en `config.yaml`. Pasa a `.agents/wiki/archive-guidance.yaml`, una lista de entradas YAML con el mismo formato que `operations.archive.guidance`, que viaja con la distribución, como la guía. `/toggle-wiki` copia ese bloque en `operations.archive.guidance`, entre dos comentarios YAML (`# wiki:archive-guidance:begin` y `# wiki:archive-guidance:end`), y al apagar quita lo que hay entre ellos, marcas incluidas. La edición es de texto, línea a línea: no reescribe el YAML, así que conserva comentarios, orden y formato del resto. Si `operations.archive.guidance` no existe, la crea; si al quitar el bloque se queda vacía, la quita.

La primera entrada de hoy ("Dónde se archiva…") es del ciclo, no del wiki, pero dice que "el plan, el código, el archive y el wiki llegan juntos". Se reescribe sin mencionar el wiki, y lo que dice del wiki pasa al bloque. Así, con el wiki apagado, las indicaciones no lo mencionan (spec `wiki-first-knowledge`).

Alternativas descartadas:

- **Pasos fijos con una condición en el texto** ("si el wiki está habilitado…"): la guidance es solo un consejo, y el modelo tendría que comprobar el estado en cada archive. Un paso que no está es más fiable que uno condicional.
- **Que el arranque reescriba `config.yaml` en cada sesión según el ajuste**: cambiaría un archivo versionado sin que nadie lo pida.

### D3. Un modo nuevo del núcleo hace la parte determinista del cambio

El núcleo gana un modo `session-bootstrap.sh wiki <status|on|off> <directorio>`. Imprime líneas `clave=valor`, como el resto de modos, y nunca bloquea:

- `status`: el estado (`enabled=true|false`), si existe `.wiki/` y, para la ingesta inicial, qué entraría como fuente y qué quedaría excluido, calculado con `git ls-files` y la lista de exclusiones de la guía (lo generado, `node_modules/`, informes, `.extracted/`, lockfiles, la copia del motor, archivos vacíos o de configuración trivial).
- `on`: pone `enabled` a `true`, inserta el bloque de D2, instala el motor y lo expone (lo mismo que hace el arranque) y pasa al stage `engine.json` y `config.yaml`.
- `off`: pone `enabled` a `false`, quita el bloque, retira los symlinks del motor y pasa al stage los mismos dos archivos. `.wiki/` no se toca.

Va en el núcleo y no en un script de Node porque es el componente neutral que ya comparten los dos agentes (ADR-0002), y el que se ejecuta con Git Bash en Windows (ADR-0017). La suite puede probarlo directamente, sin modelo.

### D4. `/toggle-wiki` es un comando del proyecto que orquesta el modo del núcleo

El comando no viene con el motor, porque con el wiki apagado el motor no está instalado. Hay uno por agente, con el mismo texto salvo la forma de invocar las operaciones (como los marcadores de `fill_markers`):

- en Claude Code, `.claude/commands/toggle-wiki.md`;
- en OpenCode, un comando del proyecto en `.opencode/` (la ruta exacta se comprueba en la tarea 1).

El comando le pide al modelo:

1. Ejecutar `wiki status`.
2. **Si el wiki está encendido**: ejecutar `wiki off` e informar.
3. **Si está apagado y existe `.wiki/`**: ejecutar `wiki on` e informar.
4. **Si está apagado y no hay `.wiki/`**: presentar al usuario la lista de `status` (qué entra y qué se excluye) y esperar. Si no confirma, no hacer nada más. Si confirma, ejecutar `wiki on`, inicializar el wiki del proyecto en modo local y hacer la ingesta inicial fijada al commit actual, con las operaciones del motor; quitar `.wiki/` del `.gitignore` si el motor lo añade; y pasar `.wiki/` al stage.
5. Informar de cómo queda el wiki y de qué vale desde la sesión siguiente: la guía y, en Claude Code, mientras la tarea 2 no demuestre lo contrario, también los comandos `/wiki:*`.

En el paso 4, el modelo puede no ver todavía las operaciones del motor recién instalado. Por eso el comando le da la ruta de la skill `wiki-manager` en `.agents/wiki-engine/` y su helper, para que siga sus instrucciones leyéndolas de ahí, sin depender de que el agente las haya descubierto.

Si la ingesta falla a medias, el comando ejecuta `wiki off` y borra el `.wiki/` que creó. Así se cumple que, sin una ingesta completa, el wiki queda apagado y nada del proyecto cambia.

### D5. Todo lo que depende del wiki lee el ajuste

- **El núcleo**: `wiki_disabled` pasa a ser "el ajuste no es `true`" y deja de leer `PROJECT_WIKI`. El resto del comportamiento (no instalar, retirar los symlinks, no entregar textos) se mantiene.
- **El autopilot**: en `nextStep`, tras `archive` va `wiki` solo si el ajuste del proyecto está encendido al terminar el archive; si no, `end`. Con el wiki apagado no espera el commit del wiki, y el aviso final dice que queda fusionar la rama, sin mencionar el wiki. Las lecciones candidatas se quedan en la metadata.
- **Los textos fijos** (`openspec-git-discipline` en `.agents/skills/` y su copia en `.claude/skills/`, y `lib/prompts.mjs`) hablan de la resincronización y del commit del wiki "con el wiki del proyecto habilitado". Se redactan en condicional, en vez de hacer que `/toggle-wiki` los reescriba: son código del proyecto, no configuración.

### D6. Se quita `PROJECT_WIKI` sin sustituirlo

El núcleo deja de leer la variable, y la suite incluye un escenario que comprueba que con el wiki encendido `PROJECT_WIKI=off` no tiene efecto. Se descarta mantenerla como un apagado por usuario: un usuario que no cargara el wiki se saltaría la resincronización en sus archives, y el wiki quedaría desfasado para todos.

### D7. Los escenarios fijan el estado del wiki en el proyecto de prueba

En la suite, el estado deja de ser una propiedad de la máquina simulada (`wikiDisabled` y `PROJECT_WIKI` en `support/machine.js`) y pasa a ser del clon: los pasos "con el wiki habilitado" y "con el wiki deshabilitado" escriben `enabled` en el `engine.json` del proyecto de prueba. Los escenarios que ya existen y necesitan el wiki pasan a decir "con el wiki habilitado". El modo `wiki` de D3 se prueba directamente; el comando, en los dos agentes simulados, con el modelo con guion de la suite, que ejecuta los pasos del comando.

### D8. Compatibilidad con la variante adelgazada

Lo que el núcleo lee **del proyecto** es solo esto: `enabled` en `.agents/wiki/engine.json`, `openspec/config.yaml` y `.wiki/`. Lo que viaja **con la distribución** (la guía, el recordatorio, `opencode-note.md`, `archive-guidance.yaml`, el comando y el motor), el núcleo lo busca junto a sí mismo: en `.agents/wiki/` respecto a su propia ubicación, no respecto al proyecto. En este repositorio las dos ubicaciones coinciden. Con la instalación global, los textos son los del `.bat`, y el proyecto solo lleva su `engine.json`.

Lo que este change no resuelve, y le queda al change del schema `intent-driven`, es cómo encuentra el núcleo global un motor ya instalado por el `.bat`, en vez de descargarlo. Este change deja la descarga detrás de una sola función, para que ese otro change pueda cambiar de dónde sale el motor sin tocar el resto.

### D9. Las pruebas con OpenCode real, en un banco fuera del repositorio y en dos niveles

Siguen el banco de la lección 9 (`.wiki/raw/notes/2026-11-21-ll-sesiones-opencode-autopilot.md`), en una carpeta aparte, con `XDG_CONFIG_HOME` aislado y la TUI en `tmux`, porque `opencode run` deja el arranque a medias:

1. **Con el proveedor falso** (`.wiki/wiki/concepts/proveedor-falso-para-verificar-contexto.md`): comprueba de forma determinista qué recibe el modelo (la guía, el recordatorio, las skills y los comandos) con el wiki apagado, tras `/toggle-wiki` y en la sesión siguiente. Las llamadas a herramientas se dictan con `@@TOOL`.
2. **Con un modelo real**: comprueba el comportamiento. Esto es consultar con `wiki-query` (con el helper del motor encontrado por `CLAUDE_PLUGIN_ROOT` desde el Bash de OpenCode), ingerir, lecciones en dry-run, el lint, la ingesta inicial con confirmación y el archive con el autopilot, con el wiki encendido y apagado. El proveedor candidato es DashScope, conectado a este entorno con la credencial que pone el proxy, por su API compatible con OpenAI.

Lo comprobado se registra como lecciones en el wiki y no deja el banco en el repositorio, como en los changes anteriores.

### D10. Este repositorio también queda con el wiki apagado

Este repositorio es a la vez la plantilla y un proyecto que usa su wiki. Se apaga también aquí, de modo que lo que se clona es exactamente lo que trae la plantilla, sin un paso aparte que cambie el valor al producir la release o crear un proyecto. `.wiki/` se conserva, y se vuelve a encender con `/toggle-wiki`, que lo encuentra y no propone ingesta.

Consecuencia para este mismo change: si al archivarlo el wiki está apagado, sus indicaciones de archivado no tendrán la resincronización, y lo que haya cambiado no llegará al wiki. Para registrarlo, hay que encender el wiki con `/toggle-wiki` antes del archive. La tarea final lo recuerda.

Alternativa descartada: mantenerlo encendido aquí y que la release del `.bat`, o la creación de un proyecto, lo deje en `false`. Obliga a un paso más, y la plantilla de este repositorio no sería la misma que se distribuye.

### D11. `openspec/config.yaml` es neutro para las zonas de `spec-as-source`

`/toggle-wiki` cambia `.agents/wiki/engine.json`, de la zona de código, y `openspec/config.yaml`, que hoy es de la zona de specs. `check commit` rechazaría ese commit. `zoneOf` en `branch-change.mjs` pasa a tratar `openspec/config.yaml` como neutro, igual que los `tasks.md`. Las skills `spec-as-source` y `openspec-git-discipline` lo dicen igual.

La regla de las zonas existe para que una spec y el código que la cumple no entren juntos. `config.yaml` no es una spec: es la configuración de OpenSpec.

Alternativas descartadas:

- **Dos commits, uno por zona.** Encender o apagar el wiki dejaría de ser un único commit, y entre los dos el proyecto quedaría a medias.
- **Una excepción en `check commit` solo para el commit de `/toggle-wiki`.** Mete en la puerta una regla a medida de un comando.

## Risks / Trade-offs

- [El modo auto bloquea `npm install @opencode/cli` en la nube, como ya pasó] → La tarea del banco empieza pidiendo al usuario que apruebe la instalación, o añadiendo antes reglas `allow` estrechas para ese paquete. Si no se consigue, las pruebas con OpenCode real se hacen fuera de la nube y el change no se archiva sin ellas.
- [DashScope puede no servir como proveedor de OpenCode, por la API, por el proxy o por el modelo] → Se comprueba al principio (tarea 1). Si no sirve, el nivel 2 de D9 necesita otro proveedor que aporte el usuario.
- [En Claude Code, las operaciones del motor instaladas a mitad de sesión pueden no estar disponibles] → El comando no depende de ellas (D4) y dice qué vale desde la sesión siguiente. La tarea 2 lo comprueba y, si funciona, se simplifica el aviso.
- [El bloque de `config.yaml` puede quedar desfasado respecto a `archive-guidance.yaml` si este cambia] → El arranque avisa si, con el wiki encendido, el bloque no coincide con la fuente. El aviso indica que se ejecute `/toggle-wiki` dos veces. El arranque no reescribe el archivo.
- [Alguien edita a mano el bloque o sus marcas] → `wiki on` y `wiki off` comprueban que hay como mucho un par de marcas bien formado. Si no, no tocan `config.yaml` y avisan.
- [Quitar `PROJECT_WIKI` rompe la configuración local de quien la usa] → No rompe nada: deja de tener efecto. El README lo explica en la migración, y la spec lo marca como **BREAKING**.
- [Una ingesta inicial grande ocupa contexto y tiempo] → El usuario ve antes la lista de lo que entra (D3 `status`), y la ingesta es solo de manifiesto, fijada al commit, sin copiar contenido.

## Migration Plan

1. Al implementar, `engine.json` lleva `"enabled": false` y `config.yaml` queda sin los pasos del wiki (D10).
2. Un proyecto creado desde la plantilla anterior, con el wiki en uso y sin `enabled`, quedaría apagado al actualizar. Para seguir con él, ejecuta `/toggle-wiki`, que lo encuentra con `.wiki/` y lo enciende sin ingesta. El README lo indica.
3. Quien tenga `PROJECT_WIKI=off` puede quitarlo; no tiene efecto.
4. Marcha atrás: `/toggle-wiki` en el sentido contrario, más el commit. Para deshacer el change entero, se revierte su fusión. `.wiki/` no se pierde en ningún caso.

## Open Questions

1. **ADR-0005 y ADR-0004.** ADR-0005 decide el apagado en local con `PROJECT_WIKI=off`, y ADR-0004 da por hecho que el wiki viene encendido. Hay que registrar en el paso `adr` un ADR nuevo que los sustituya en esa parte y conserve el resto (el motor y la guía por el arranque, una sola versión, `.wiki/` versionado, wiki-first).
2. **La ruta de los comandos del proyecto en OpenCode 2.3.2** (`.opencode/command/` o `.opencode/commands/`) y si admiten argumentos. Se comprueba en la tarea 1.
3. **Cómo encuentra el núcleo global el motor que instala el `.bat`** (D8). Lo decide el change del schema `intent-driven`. Este change solo deja la descarga aislada en una función.
