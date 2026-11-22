# ADR-0024: Cada release publica una instalación global para Windows y una variante adelgazada de la plantilla que la usa

- Status: accepted
- Date: 2026-11-22
- Supersedes: -

## Context

Cada proyecto creado desde la plantilla lleva su propia copia de varias cosas:
- el schema `intent-driven`;
- las skills del schema (ADR-0003);
- `branch-change.mjs`, con el que se decide cada puerta del ciclo de git (ADR-0020, que sustituye a ADR-0013);
- el arranque y sus instrucciones (ADR-0023, ADR-0010, ADR-0018);
- el motor del wiki, que descarga el arranque (ADR-0005);
- el plugin autopilot (ADR-0014).

Con varios proyectos en una máquina, esas copias divergen y hay que actualizarlas una a una. En Windows solo se usa OpenCode.

Lo comprobado sobre dónde buscan las herramientas:
- **OpenSpec 1.17** busca los schemas de usuario en `%XDG_DATA_HOME%\openspec\schemas` o, si no está definida, en `%LOCALAPPDATA%\openspec\schemas`. La copia del proyecto tiene preferencia.
- **OpenCode** lee las skills y los plugins globales de `%XDG_CONFIG_HOME%\opencode` o, si no está definida, de `%USERPROFILE%\.config\opencode`.
- **Los repositorios de origen** del schema y de las skills no tienen tags.

Alternativas consideradas:

- **Instalar directamente desde los repositorios de origen** con su `AGENT_INSTALL.md`. Clona siempre su HEAD, sin versión que fijar, y lo ejecuta un agente leyendo prosa: no es reproducible. Además, tres de nuestras skills divergen del origen.
- **Un paquete npm o un repositorio aparte para la distribución.** Es otra pieza que versionar y publicar, cuando la plantilla ya es la fuente de todo lo que se instala.
- **La variante adelgazada como otro repositorio o como una rama.** Divergiría de la plantilla completa. Generada desde el tag, las dos variantes son siempre la misma versión.

## Decision

- **Cada release de la plantilla tiene un tag de versión semántica** y publica tres artefactos, que se generan desde el árbol del tag:
  - un `.bat`;
  - el zip de lo que instala;
  - la variante adelgazada.
- **El `.bat` instala o actualiza de forma global**, sin git ni Node, con `curl.exe` y `tar.exe`.
  - Usa las mismas ubicaciones que OpenSpec y OpenCode: `<data>` es `XDG_DATA_HOME` o `%LOCALAPPDATA%`; `<config>` es `XDG_CONFIG_HOME` o `%USERPROFILE%\.config`.
  - Instala bajo `<data>` el schema sin modificar y el motor del wiki en la versión de la release.
  - Instala bajo `<config>\opencode` las skills (las del schema y las del motor que usa OpenCode) y los plugins del proyecto.
  - Guarda la versión y un manifiesto de lo instalado. Con la misma versión no hace nada; con otra, sustituye solo lo que instaló, y escribe la versión al final.
  - No valida el schema.
- **La variante adelgazada solo contiene lo que es de cada proyecto**: no tiene `openspec/schemas/`, `.agents/`, `.opencode/` ni `.claude/`. Tampoco hereda lo que describe o prueba la plantilla completa, que en un proyecto adelgazado no pasaría: sus specs, sus changes, su suite y sus herramientas de release. En su lugar lleva una suite vacía, en verde, para las specs del proyecto. Sí hereda los ADRs.
- **Lo global solo actúa en proyectos intent-driven y cede ante lo del proyecto.** Un plugin global no hace nada si el proyecto no declara `schema: intent-driven`, ni si el proyecto tiene su propio plugin con ese nombre.
- **`branch-change.mjs` va dentro de la skill `openspec-git-discipline`**, en `scripts/`, en las dos variantes. Su `SKILL.md` da la ruta en una sola línea: relativa al proyecto en la plantilla completa, y absoluta en la instalación global, donde la escribe el `.bat`. El plugin autopilot busca el script en la skill del proyecto y, si no está, junto a su instalación global.
- **El diagnóstico de Windows** (`scripts/windows/Test-OfflineInstall.ps1`, ADR-0017) comprueba la instalación global en un proyecto adelgazado.
- **Los orígenes del schema y de las skills se fijan por commit** en `.agents/release/origins.json`, con la lista de las skills que la plantilla mantiene como propias.

ADR-0003, ADR-0005, ADR-0010, ADR-0014, ADR-0017, ADR-0018 y ADR-0020 siguen en vigor para la plantilla completa, y este ADR no los sustituye. Solo añade dónde viven sus piezas en la instalación global. La excepción es la ubicación de `branch-change.mjs`, que cambia en las dos variantes: sigue siendo un único script para los dos agentes y para las puertas de ADR-0020, y solo se mueve. ADR-0021, del change del ON/OFF del wiki, decide el ajuste del wiki que lleva cada proyecto, y la instalación global instala la guía y el recordatorio que fije.

El comportamiento está especificado en `openspec/specs/windows-global-install/spec.md`, `openspec/specs/slim-template/spec.md`, `openspec/specs/session-bootstrap/spec.md`, `openspec/specs/openspec-autopilot/spec.md` y `openspec/specs/openspec-change-lifecycle/spec.md`.

## Consequences

- En una máquina Windows, todos los proyectos adelgazados usan la misma versión del schema, las skills, los plugins y el motor, y actualizar es ejecutar el `.bat` de la release nueva.
- Un proyecto adelgazado depende de la versión instalada en cada máquina, y dos máquinas pueden tener versiones distintas.
- Publicar una release exige un workflow de GitHub Actions con un runner de Windows. Los escenarios que ejecutan el `.bat` solo se ejecutan ahí. Se eligen por nombre, porque un escenario extraído de un `spec.md` no puede llevar etiquetas. El mismo workflow prueba cada push en Linux y en Windows, sin publicar.
- Las tres skills propias hay que actualizarlas a mano con el origen. Las demás las compara un test con el commit de `origins.json`.
- Un cambio de las rutas globales o de la búsqueda de plugins de OpenCode rompe la instalación global hasta una release nueva.
- La instalación global en Linux y macOS, y la de Claude Code, exigen un change y un ADR nuevos.
