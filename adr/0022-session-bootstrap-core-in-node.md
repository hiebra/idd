# ADR-0022: El núcleo del arranque de sesión es un script de Node, igual en Linux, macOS y Windows

- Status: accepted, supersedes ADR-0002, ADR-0017
- Date: 2026-11-22
- Supersedes: ADR-0002, ADR-0017

## Context

ADR-0002 dividió el arranque de sesión en un núcleo neutral, un script de bash en `.agents/hooks/`, y un adaptador fino por agente. Descartó un núcleo en Node porque no podría avisar si falta Node o si su versión es inferior a la requerida, y aceptó que el proyecto quedara ligado a bash.

El change `windows-global-distro` instala de forma global en Windows, donde solo se usa OpenCode, lo que hoy vive en cada proyecto. Windows no garantiza bash ni symlinks. ADR-0017, de la rama del change `windows-support`, resolvía Windows de otra forma:
- el núcleo en bash, ejecutado con Git Bash;
- symlinks nativos, con el Modo de desarrollador;
- LF fijado con `.gitattributes`;
- un diagnóstico en PowerShell.

Este ADR sustituye a ADR-0017 en lo del núcleo, por decisión del usuario. ADR-0017 aún no ha llegado a la rama de origen. Si `windows-support` se abandona sin fusionarse, se quita de `Supersedes` antes de que este ADR llegue a la rama de origen.

Alternativas consideradas:

- **Mantener bash y exigir Git Bash en Windows (ADR-0017).** Añade Git for Windows como requisito y el riesgo de lanzar el bash de WSL, y sigue necesitando symlinks o copias.
- **Un núcleo en bash y otro en Node o PowerShell para Windows.** Son dos implementaciones de la misma lógica, lo que ADR-0002 evita.
- **Meter la lógica en el plugin de OpenCode.** La duplicaría para Claude Code.

## Decision

- **El núcleo es un único script de Node**, `.agents/hooks/session-bootstrap.mjs`, y sustituye al de bash. Solo usa módulos `node:`, porque es el propio arranque el que instala las dependencias.
- **El contrato del núcleo no cambia.**
  - Tiene los mismos modos: preparar, `guide`, `reminder`, `comments-rule` y `comments-reminder`.
  - Recibe el directorio del proyecto.
  - Escribe `clave=valor` por stdout y los avisos por stderr con el prefijo `session-start:`.
  - Termina siempre con 0.
  - El sello de reinstalación depende del núcleo.
- **El núcleo comprueba la versión de Node** frente a `engines.node`, y avisa sin instalar si no basta.
- **Si falta Node, avisa el adaptador**: es lo único que no puede hacer el núcleo. Si lanzar `node` falla porque no existe, el adaptador muestra el mismo aviso que daría el núcleo.
- **Cada adaptador solo aporta lo que depende de su agente**, como en ADR-0002: cómo se dispara el arranque, cómo se expone el `PATH` y cómo se muestran los avisos.
  - En Claude Code son los hooks de `.claude/`, que lanzan el núcleo con `node`.
  - En OpenCode 2 son plugins sin dependencias. Es `session-bootstrap` y, para cada instrucción opcional, su propio plugin (ADR-0018). Todos lanzan el núcleo con `node`.
- **Los avisos se muestran en la interfaz del agente**, y dejarlos en un log no cuenta.
- **El núcleo no depende de symlinks en Windows.**
- **La suite verifica el núcleo una vez y cada adaptador simulando a su agente**, sin arrancar los agentes reales.
- **En Windows solo se soporta OpenCode 2 o superior**, como decía ADR-0017.

El comportamiento está especificado en `openspec/specs/session-bootstrap/spec.md`.

## Consequences

- El arranque funciona igual en Linux, macOS y Windows con Node.js y npm, sin bash ni Git Bash.
- El proyecto queda ligado a Node.js con npm, que ya exigían OpenCode y OpenSpec, y deja de estar ligado a bash.
- Los adaptadores de Claude Code siguen siendo scripts de shell: Claude Code no se soporta en Windows, y cambiarlos solo cambia la orden que lanzan.
- Hay que portar el núcleo sin cambiar los escenarios de `session-bootstrap`: la suite actual tiene que seguir en verde.
- El plan de `windows-support` (Git Bash, symlinks nativos, Modo de desarrollador) queda sin efecto en lo del núcleo. Su diagnóstico de la máquina y el LF de `.gitattributes` no dependen de este ADR.
- Siguen vigentes las consecuencias de ADR-0002 que no dependían de bash:
  - la primera sesión de cada clon tarda más;
  - en OpenCode, el primer comando espera a la instalación;
  - sin TUI, los avisos de OpenCode solo quedan en el log;
  - un agente con una API de hooks o de plugins incompatible exige un adaptador y un ADR nuevos.
