# windows-global-install

Cada release de la plantilla publica un `.bat` que instala en Windows, de forma global y compartida por todos los proyectos de la máquina, lo que en la plantilla completa vive dentro de cada proyecto: el schema `intent-driven`, sus skills, los plugins de OpenCode y el motor del wiki. En Windows solo se usa OpenCode. Las ubicaciones son las que usan OpenSpec y OpenCode: `<data>` es `%XDG_DATA_HOME%` o, si no está definida, `%LOCALAPPDATA%`; `<config>` es `%XDG_CONFIG_HOME%` o, si no está definida, `%USERPROFILE%\.config`.

## ADDED Requirements

### Requirement: El instalador es un artefacto de cada release
Cada release de la plantilla DEBE publicar, con el tag de su versión semántica, un `.bat` que instala esa versión. El `.bat` NO DEBE necesitar git ni Node: DEBE descargar y descomprimir lo que instala con `curl.exe` y `tar.exe`.

#### Scenario: La release trae el instalador de su versión

```gherkin
Given una release de la plantilla con el tag `v1.2.0`
When se ejecuta su `.bat` en una máquina Windows sin instalación previa
Then queda instalada la versión `1.2.0`
```

#### Scenario: Sin git ni Node en la máquina

```gherkin
Given una máquina Windows con `curl.exe` y `tar.exe` y sin git ni Node
When se ejecuta el `.bat` de una release
Then la instalación termina con éxito
```

### Requirement: Ubicaciones con XDG o sin XDG
El `.bat` DEBE instalar el schema y el motor del wiki bajo `<data>`, y las skills y los plugins bajo `<config>\opencode`. Si una variable XDG está definida, DEBE usarla; si no, DEBE usar la ubicación por defecto de Windows que usa la herramienta correspondiente.

#### Scenario Outline: Dónde queda cada cosa

```gherkin
Given una máquina Windows con <variables>
When se ejecuta el `.bat` de una release
Then el schema `intent-driven` queda en `<datos>\openspec\schemas\intent-driven`
And el motor del wiki queda en `<datos>\idd\wiki-engine`
And las skills quedan en `<configuración>\opencode\skills`
And los plugins quedan en `<configuración>\opencode\plugins`

Examples:
  | variables                                   | datos              | configuración          |
  | `XDG_DATA_HOME` y `XDG_CONFIG_HOME` definidas | `%XDG_DATA_HOME%`  | `%XDG_CONFIG_HOME%`    |
  | ninguna variable XDG definida                 | `%LOCALAPPDATA%`   | `%USERPROFILE%\.config` |
```

### Requirement: Qué instala
El `.bat` DEBE instalar:
- el schema `intent-driven` sin modificar respecto a su origen (`intent-driven-dev/openspec-schemas`), en la versión que fija la release;
- las skills que declara el `skills.txt` del schema, en la versión que fija la release: las del origen (`intent-driven-dev/skills`) sin modificar salvo las que la plantilla mantiene como propias;
- la skill `openspec-git-discipline` con su `scripts/branch-change.mjs`, y en su `SKILL.md` la ruta absoluta de ese script;
- la skill de consulta del wiki del motor;
- los plugins `openspec-autopilot` y `session-bootstrap`, este con la guía y el recordatorio del wiki y la regla de comentarios;
- el motor del wiki en la versión que fija la release.

#### Scenario: OpenCode encuentra lo instalado en un proyecto intent-driven

```gherkin
Given una máquina Windows en la que se ha ejecutado el `.bat` de una release
And un proyecto creado desde la variante adelgazada de esa release
When se abre una sesión de OpenCode en el proyecto
Then OpenSpec resuelve el schema `intent-driven` instalado
And OpenCode encuentra cada skill del `skills.txt` del schema una sola vez
And OpenCode carga los plugins `openspec-autopilot` y `session-bootstrap`
And dispone de la consulta de solo lectura del wiki
```

#### Scenario: El SKILL.md da la ruta del script instalado

```gherkin
Given una máquina Windows en la que se ha ejecutado el `.bat` de una release
When se lee el `SKILL.md` de la skill `openspec-git-discipline` instalada
Then la ruta de `branch-change.mjs` que da es la del script instalado junto a la skill
And esa ruta es absoluta
```

#### Scenario: El schema instalado es el del origen

```gherkin
Given una máquina Windows en la que se ha ejecutado el `.bat` de una release
When se compara el schema instalado con el del origen en la versión que fija la release
Then son idénticos
```

### Requirement: Instala o actualiza según la versión instalada
El `.bat` DEBE guardar la versión que instala en un archivo de versión dentro de la instalación. Al ejecutarse, si la versión guardada coincide con la suya, NO DEBE cambiar nada; si no hay instalación o la versión es otra, DEBE instalar su versión, sustituyendo por completo lo instalado por la anterior. Si la instalación falla a medias, la versión guardada NO DEBE cambiar, para que la siguiente ejecución vuelva a instalar. El `.bat` NO DEBE validar el schema con `openspec schema validate`.

#### Scenario: Ya está instalada la misma versión

```gherkin
Given una máquina Windows con la versión `1.2.0` instalada
When se ejecuta el `.bat` de la release `v1.2.0`
Then no se descarga nada
And no cambia ningún archivo instalado
And se indica que la versión `1.2.0` ya está instalada
```

#### Scenario: Hay instalada otra versión

```gherkin
Given una máquina Windows con la versión `1.1.0` instalada
When se ejecuta el `.bat` de la release `v1.2.0`
Then queda instalada la versión `1.2.0`
And no queda ningún archivo de la versión `1.1.0` que la `1.2.0` no traiga
```

#### Scenario: La descarga falla

```gherkin
Given una máquina Windows con la versión `1.1.0` instalada
And la descarga de la release `v1.2.0` falla
When se ejecuta el `.bat` de la release `v1.2.0`
Then sigue instalada la versión `1.1.0`
And se indica que la instalación ha fallado
```
