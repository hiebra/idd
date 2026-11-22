## Context

Hoy la plantilla lo lleva todo dentro del proyecto:
- el schema, en `openspec/schemas/intent-driven/`;
- las skills del schema, en `.agents/skills/` (ADR-0003);
- `branch-change.mjs`, en `.agents/openspec/` (ADR-0013);
- el arranque de sesión, un núcleo en bash en `.agents/hooks/session-bootstrap.sh` (ADR-0002);
- el motor del wiki, que el núcleo descarga a `.agents/wiki-engine/` y expone con symlinks (ADR-0005);
- la guía, el recordatorio y la regla de comentarios, en `.agents/wiki/` y `.agents/comments/` (ADR-0010);
- los plugins de OpenCode, en `.opencode/plugins/` (ADR-0014).

Este change añade, como artefactos de cada release, una instalación global para Windows (solo OpenCode) y una variante adelgazada de la plantilla que la usa (ver la propuesta y las specs `windows-global-install` y `slim-template`).

Las restricciones salen de lo comprobado en esta exploración:
- **OpenSpec 1.17.0** busca los schemas de usuario en `%XDG_DATA_HOME%\openspec\schemas` o, si no está definida, en `%LOCALAPPDATA%\openspec\schemas`. La copia del proyecto tiene preferencia (`core/global-config.js` y `core/artifact-graph/resolver.js`).
- **OpenCode** lee la configuración global de `%XDG_CONFIG_HOME%\opencode` o, si no está definida, de `~\.config\opencode`, sin ningún caso especial para Windows (`sst/opencode@ee5fe34:packages/util/src/global-roots.ts`). Lee las skills de su carpeta `skills\` y los plugins de `plugins\`.
- **Windows** no garantiza bash ni symlinks. Sí trae `curl.exe`, `tar.exe`, `cmd` y PowerShell.
- **Los repositorios de origen** del schema (`intent-driven-dev/openspec-schemas`) y de las skills (`intent-driven-dev/skills`) no tienen tags. Nuestra copia del schema es idéntica a `4bb6de2`. Las skills son idénticas a `15aa678`, salvo `openspec-git-discipline`, `acceptance-test-authoring` y `spec-as-source`.

## Goals / Non-Goals

**Goals:**
- Un `.bat` por release que instala o actualiza, en Windows, el schema, las skills, los dos plugins y el motor del wiki, en las ubicaciones que usan OpenSpec y OpenCode, con XDG o sin XDG.
- Una variante adelgazada, generada desde el tag de la release, que funciona con esa instalación.
- Un núcleo del arranque en Node, el mismo para la plantilla completa y la instalación global.
- La plantilla completa sigue funcionando como hoy en Claude Code y en OpenCode.

**Non-Goals:**
- La instalación global en Linux y macOS, y la de Claude Code.
- Desinstalar: borrar lo instalado sigue siendo un paso manual.
- Aportar al origen los cambios de nuestras skills.
- El ajuste `enabled` del wiki y los pasos del wiki entre marcas: los define el change del ON/OFF del wiki, y aquí solo se instalan.

## Decisions

### D1. El núcleo del arranque se porta a Node, y lo usan todos

`.agents/hooks/session-bootstrap.sh` se sustituye por `.agents/hooks/session-bootstrap.mjs`:
- solo módulos `node:`, porque es el propio arranque el que instala las dependencias;
- los mismos modos (preparar, `guide`, `reminder`, `comments-rule`, `comments-reminder`);
- el mismo contrato de salida: `clave=valor` por stdout, avisos con el prefijo `session-start:` por stderr y siempre código 0.

Así los adaptadores solo cambian la orden con la que lo lanzan:
- el de OpenCode pasa de lanzar `bash` a lanzar `node`;
- los de Claude Code siguen siendo scripts de shell, porque Claude Code no se instala en Windows, y también lanzan `node`.

Hay un único núcleo, no uno en bash y otro en Node, para no mantener dos implementaciones del mismo comportamiento. Descarto mantener bash y exigir Git Bash en Windows: añade una dependencia que el `.bat` tendría que comprobar, y los symlinks seguirían fallando.

Supersede la parte de ADR-0002 que dice que el núcleo es un script de bash.

### D2. El núcleo distingue dónde está instalado

El núcleo recibe, además del directorio del proyecto, si se ejecuta desde el proyecto o desde la instalación global. Lo sabe el adaptador, por su propia ubicación.

- **Desde el proyecto** (plantilla completa), todo sigue como hoy: descarga el motor según `.agents/wiki/engine.json` y crea los symlinks.
- **Desde la instalación global**, el núcleo:
  - solo actúa si `openspec/config.yaml` declara `schema: intent-driven`. Lo comprueba con una expresión regular sobre la línea `schema:`, sin un parser de YAML, como ya hace `branch-change.mjs` con `x-main`;
  - no descarga el motor ni crea symlinks;
  - toma el motor de `<data>\idd\wiki-engine\`;
  - toma la guía, el recordatorio y la regla de comentarios del directorio del propio plugin.

Preparar git, instalar las dependencias, poner `openspec` en el `PATH` y exportar `CLAUDE_PLUGIN_ROOT` se hace igual en los dos casos.

### D3. Lo global cede ante lo del proyecto

Si el proyecto tiene su propio `.opencode/plugins/session-bootstrap/` u `.opencode/plugins/openspec-autopilot/`, el plugin global con el mismo papel no hace nada. Así, un proyecto de la plantilla completa abierto en una máquina con la instalación global no arranca dos veces ni tiene dos autopilots.

No sabemos si OpenCode descarta un plugin con el mismo `id` cargado desde dos sitios, así que no se confía en ello. Es la misma regla que ya aplica OpenSpec al schema: la copia del proyecto gana. Lo recogen las specs `session-bootstrap` y `openspec-autopilot`.

### D4. `branch-change.mjs` va dentro de la skill, y su ruta aparece una sola vez en `SKILL.md`

El script pasa a `.agents/skills/openspec-git-discipline/scripts/branch-change.mjs` y no queda ninguna copia en `.agents/openspec/`. El `SKILL.md` se reescribe para que la ruta del script aparezca en una sola línea, «El script es: `<ruta>`»; el resto del texto habla de «el script».

- **En la plantilla completa**, esa línea tiene la ruta relativa al proyecto.
- **En la instalación global**, el `.bat` escribe un `SKILL.md` con la ruta absoluta del script instalado. Lo monta concatenando tres piezas que trae el zip: la parte anterior a la línea, la línea con `echo` y la parte posterior. Basta con `cmd`, sin PowerShell ni reemplazos de texto.

El plugin autopilot no lee `SKILL.md`. Busca el script primero en `<proyecto>/.agents/skills/openspec-git-discipline/scripts/` y, si no está, en `../../skills/openspec-git-discipline/scripts/` respecto a su propio directorio, que es donde lo deja la instalación global (`<config>\opencode\plugins\…` junto a `<config>\opencode\skills\…`). El prompt del paso `new` (`lib/prompts.mjs`) recibe la ruta del script que ha encontrado.

Descarto que la skill remita a su propio directorio: no está comprobado que OpenCode dé al modelo la ruta de la skill al cargarla.

Supersede la ruta de ADR-0013.

### D5. La release se monta desde el tag con un script de Node, y la publica un workflow

`scripts/release/build.mjs` monta, desde el árbol del tag, tres artefactos.

**`idd-global-<versión>.zip`**, con el contenido de la instalación global:
- `data\openspec\schemas\intent-driven\`: la copia de `openspec/schemas/intent-driven/`;
- `data\idd\wiki-engine\`: el motor, descargado en la versión de `.agents/wiki/engine.json`;
- `config\opencode\skills\`:
  - las skills de `.agents/skills/`, con el `SKILL.md` de `openspec-git-discipline` en sus tres piezas;
  - las dos skills del motor que usa OpenCode: `wiki-query` para la consulta y `wiki-manager` para la gestión. Las dos hacen falta para cumplir `llm-wiki`;
- `config\opencode\plugins\`: los dos plugins, y en el de `session-bootstrap`, el núcleo, la guía, el recordatorio y la regla de comentarios.

**`idd-<versión>.bat`**, con la versión y la URL del zip escritas dentro.

**`idd-slim-<versión>.zip`**, con la variante adelgazada: el árbol del tag sin `openspec/schemas/`, `.agents/`, `.opencode/` ni `.claude/`, y sin los changes archivados del propio template.

Un workflow de GitHub Actions, que se dispara con cada tag `v*`:
1. monta los artefactos;
2. pasa la suite de Windows en un runner `windows-latest`;
3. publica la release.

El repositorio todavía no tiene `.github/`, así que el workflow es nuevo.

Los commits de origen del schema y de las skills se guardan en `.agents/release/origins.json`. Allí también se listan las skills que la plantilla mantiene como propias. Un test compara las demás con el origen en ese commit. Así, «sin modificar respecto a su origen» se puede comprobar, aunque el origen no tenga tags.

### D6. El `.bat` instala de forma atómica, con un manifiesto de lo que instaló

El `.bat` sigue estos pasos:
1. Calcula `<data>` y `<config>` como OpenSpec y OpenCode.
2. Lee `<data>\idd\version`. Si coincide con su versión, termina sin hacer nada.
3. Descarga y descomprime el zip en un directorio temporal con `curl.exe` y `tar.exe`.
4. Borra lo que lista `<data>\idd\installed.txt`, el manifiesto de la instalación anterior, y solo eso. Así no toca otras skills ni otros plugins del usuario en `<config>\opencode\`.
5. Mueve lo nuevo a su sitio.
6. Escribe el manifiesto nuevo y, al final, `version`.

Si algo falla antes del paso 6, la versión guardada no cambia y la siguiente ejecución lo vuelve a intentar.

No valida el schema con `openspec schema validate`: el contenido sale de una release que ya ha pasado la suite.

### D7. La suite separa lo que solo se puede comprobar en Windows

Los escenarios de `windows-global-install` y `slim-template` que ejecutan el `.bat` llevan la etiqueta `@windows`:
- el perfil por defecto, que corre en Linux, no los incluye;
- el job de Windows del workflow solo ejecuta esos.

El núcleo en Node, la regla de los proyectos intent-driven, la búsqueda de `branch-change.mjs` y el montaje de la release (`build.mjs`) se prueban en Linux con los artefactos montados. Ejecutarlos con `cmd.exe` solo es necesario en Windows. Como en ADR-0002, los agentes no se arrancan: se simula cómo OpenCode carga plugins y skills de `<config>`.

## Risks / Trade-offs

- **[Riesgo] OpenCode cambia sus rutas globales o su búsqueda de plugins.** → `global-roots.ts` y la búsqueda de plugins de OpenCode están recogidas en el wiki con su commit. Cada release se prueba en Windows contra la versión de OpenCode que fija la suite.
- **[Riesgo] Las skills del motor (`wiki-manager`, `wiki-query`) dejan de funcionar copiadas fuera del motor.** → Hoy ya se exponen por symlink fuera de su directorio y encuentran su helper con `CLAUDE_PLUGIN_ROOT`, que el arranque global exporta con la ruta en `<data>`. Un escenario de la suite de Windows ejecuta una consulta del wiki.
- **[Riesgo] Un proyecto adelgazado depende de la versión global de cada máquina**, y dos máquinas pueden tener versiones distintas. → Aceptado: el `.bat` dice qué versión hay. Que el proyecto declare la versión que espera, y el arranque avise si no coincide, queda como pregunta abierta.
- **[Riesgo] El script de `cmd` es frágil** con rutas con espacios o caracteres como `!` y `%`. → Todas las rutas van entre comillas y no se activa la expansión retardada. Los escenarios de Windows usan un perfil con espacios en la ruta.
- **[Trade-off] Hay dos sitios donde puede estar el script** (D4). → La búsqueda está en un único módulo del plugin, y la skill solo da una ruta.
- **[Trade-off] Portar el núcleo cambia también la plantilla completa.** → La suite actual del arranque sigue pasando sin cambiar los escenarios: el contrato del núcleo no cambia.

## Migration Plan

1. Portar el núcleo a Node (D1) con la suite actual en verde.
2. Mover `branch-change.mjs` a la skill (D4) y ajustar el autopilot, el `SKILL.md` y el README.
3. Añadir el modo global del núcleo y de los plugins (D2, D3).
4. Añadir `build.mjs`, `origins.json`, el `.bat` y el workflow (D5, D6, D7).
5. Publicar la primera release con tag semántico (`v0.1.0`).

En la plantilla completa no hay nada que migrar: un clon nuevo sigue funcionando al abrir la sesión.

Un proyecto existente que quiera pasar a la variante adelgazada borra `openspec/schemas/`, `.agents/`, `.opencode/` y `.claude/`, y ejecuta el `.bat`.

Para volver atrás, se ejecuta el `.bat` de una release anterior, que sustituye lo instalado (D6), o se restauran esos directorios desde la plantilla completa.

## Open Questions

- **ADRs en vigor que hay que revisar**, para que el paso adr registre los que los sustituyen:
  - ADR-0002: el núcleo deja de ser un script de bash (D1);
  - ADR-0005: en la instalación global, el motor no lo descarga el arranque, su versión la fija la release y se expone sin symlinks (D2, D5);
  - ADR-0013: la ruta de `branch-change.mjs` (D4);
  - ADR-0014: el autopilot también puede ser un plugin global (D3).

  ADR-0003 y ADR-0010 siguen en vigor: la única fuente sigue en `.agents/` del repositorio, y la release la copia.
- **¿Debe declarar un proyecto adelgazado qué versión global espera**, y avisar el arranque si la instalada es otra?
- **El orden respecto al change del ON/OFF del wiki:** este change instala su guía, su recordatorio y su ajuste. Si se archiva antes, la release instala los de hoy.
