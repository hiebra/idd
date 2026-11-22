## Why

Cada proyecto creado desde la plantilla lleva su propia copia del schema `intent-driven`, de sus skills, de los plugins de OpenCode, del arranque de sesión y del motor del wiki. Con varios proyectos, esas copias divergen y hay que actualizarlas una a una. En Windows, donde solo se usará OpenCode, el arranque además depende de bash y de symlinks, que la máquina no garantiza. Una instalación global compartida, con una versión por release, hace que todos los proyectos de una máquina usen lo mismo y que actualizar sea un solo paso.

## What Changes

- **Instalador global para Windows como artefacto de la release.** Cada release de este repositorio publica un `.bat` con su versión semántica y un zip con lo que instala. El `.bat`:
  - calcula `<data>` (`%XDG_DATA_HOME%` o, si no está definida, `%LOCALAPPDATA%`) y `<config>` (`%XDG_CONFIG_HOME%` o, si no está definida, `%USERPROFILE%\.config`), las mismas ubicaciones que usan OpenSpec y OpenCode;
  - lee la versión instalada en un archivo de versión que deja él mismo y, si coincide con la suya, no hace nada; si no hay instalación o es de otra versión, instala o actualiza;
  - descarga y descomprime el zip con `curl.exe` y `tar.exe`, sin git ni Node;
  - no valida el schema con `openspec schema validate`: el contenido sale de una release ya probada.
- **Qué instala y dónde:**
  - en `<data>\openspec\schemas\intent-driven\`, el schema `intent-driven` sin modificar, tal como está en `intent-driven-dev/openspec-schemas@4bb6de2`;
  - en `<data>\idd\wiki-engine\`, el motor del wiki en la versión que fija la release;
  - en `<config>\opencode\skills\`, las skills del schema y la skill `wiki-query` del motor. Las skills del schema son las cinco del origen sin cambios (`intent-driven-dev/skills@15aa678`) y nuestras tres modificadas: `openspec-git-discipline`, `acceptance-test-authoring` y `spec-as-source`;
  - en `<config>\opencode\plugins\`, los plugins `openspec-autopilot` y `session-bootstrap`, este con la guía y el recordatorio del wiki y la regla de comentarios.
- **`branch-change.mjs` viaja dentro de la skill `openspec-git-discipline`**, en `scripts/`. El `.bat` escribe en su `SKILL.md` la ruta absoluta del script. El plugin autopilot lo encuentra por una ruta relativa a la suya y la pasa a sus prompts.
- **El núcleo del arranque de sesión se porta de bash a Node**, sin dependencias, para que funcione en Windows sin bash. En la instalación global deja de descargar el motor y de crear symlinks, porque de eso se encarga el `.bat`. Conserva todo lo que depende de cada proyecto:
  - preparar git;
  - instalar las dependencias del proyecto;
  - poner el `openspec` del proyecto en el `PATH`;
  - exportar `CLAUDE_PLUGIN_ROOT` con la ruta del motor;
  - entregar la guía, el recordatorio y la regla de comentarios.
- **El arranque global solo actúa en proyectos intent-driven**, los que declaran `schema: intent-driven` en `openspec/config.yaml`. En cualquier otro proyecto no hace nada.
- **Variante adelgazada de la plantilla** para quien usa la instalación global. Es otro artefacto de la misma release, generado desde este repositorio: un zip con la plantilla ya adelgazada, de la misma versión que el `.bat`. No es otro repositorio ni una rama. Prescinde de:
  - `openspec/schemas/` y `.agents/skills/`;
  - `.agents/openspec/` y `.agents/hooks/`;
  - el motor del wiki, `.agents/wiki/` y los plugins de `.opencode/`;
  - lo de Claude Code (`.claude/`).

  En cada proyecto quedan solo:
  - `openspec/config.yaml`;
  - el ajuste del wiki que define el change del ON/OFF del wiki;
  - `.wiki/`;
  - `package.json` con OpenSpec;
  - `adr/`, las specs y la suite de aceptación del proyecto.
- **La plantilla completa sigue como hoy**, para Claude Code y OpenCode en cualquier plataforma, con todo dentro del proyecto. Pasa a tener tags de versión semántica, de los que salen las releases.

## Capabilities

### New Capabilities

- `windows-global-install`: el instalador de la release para Windows. Comprende las ubicaciones `<data>` y `<config>`, con XDG o sin XDG, qué instala en cada una, la detección de la versión instalada y la actualización, y que una ejecución con la misma versión no cambia nada.
- `slim-template`: la variante adelgazada de la plantilla, generada desde este repositorio como artefacto de cada release. Comprende qué contiene y qué no, que se genera a partir de la plantilla completa de la misma versión, y que un proyecto creado desde ella funciona con la instalación global sin copias locales del schema, las skills, los plugins ni el motor.

### Modified Capabilities

- `session-bootstrap`: el núcleo pasa a Node. Puede instalarse de forma global en OpenCode, y entonces no actúa en proyectos que no sean intent-driven y no instala el motor.
- `llm-wiki`: en la instalación global, la versión del motor la fija la release, no un archivo del proyecto, y el motor se expone sin symlinks.
- `openspec-autopilot`: el plugin puede instalarse de forma global y encuentra `branch-change.mjs` junto a la skill `openspec-git-discipline`.
- `openspec-change-lifecycle`: `branch-change.mjs` deja de estar en una ruta fija del proyecto (`.agents/openspec/`) y va con la skill `openspec-git-discipline`. Los requisitos que lo citan por esa ruta pasan a citarlo por la skill.
- `agent-skills`: en la variante adelgazada, las skills del schema no están en el proyecto: las aporta la instalación global, y el requisito de una única copia en `.agents/skills/` solo rige para la plantilla completa.

## Impact

- **Código nuevo:**
  - el `.bat`, el script que monta el zip de lo que instala y el que genera el zip de la variante adelgazada;
  - el workflow o el procedimiento de release que publica los dos con su tag.
- **Código modificado:**
  - `.agents/hooks/session-bootstrap.sh`, que se sustituye por un núcleo en Node;
  - los adaptadores de Claude Code (`.claude/hooks/`) y de OpenCode (`.opencode/plugins/session-bootstrap/`), que pasan a lanzar el núcleo en Node;
  - `.opencode/plugins/openspec-autopilot/lib/project.mjs` y `lib/prompts.mjs`, por la nueva ruta de `branch-change.mjs`;
  - `.agents/skills/openspec-git-discipline/SKILL.md` y el `README.md`.
- **Suite de aceptación:**
  - escenarios nuevos para el instalador (rutas con XDG y sin XDG, la misma versión y otra versión) y para la variante adelgazada;
  - los tests del arranque, ajustados al núcleo en Node.
- **Relación con otros changes:**
  - depende del change del ON/OFF del wiki, que define el ajuste `enabled` del proyecto y los pasos del wiki entre marcas en `openspec/config.yaml`;
  - la guía y el recordatorio del wiki que instala el `.bat` son los de ese change.
- **Fuera de alcance:**
  - la instalación global en Linux y macOS, y la de Claude Code;
  - aportar al repositorio de origen los cambios de nuestras skills.
- **Riesgos:**
  - un proyecto de la variante adelgazada depende de la versión global instalada en cada máquina;
  - nuestras tres skills modificadas hay que mantenerlas al día con el origen a mano, porque el origen no tiene tags.
