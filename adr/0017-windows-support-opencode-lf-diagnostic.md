# ADR-0017: En Windows se soporta solo OpenCode 2, con LF en el repositorio y un diagnóstico en PowerShell

- Status: accepted
- Date: 2026-11-22
- Supersedes: -

## Context

Hasta ahora el proyecto solo funcionaba en Linux y macOS. En Windows 11 hay causas que no dependen de cómo se ejecute el arranque de sesión (change `windows-support`):

- Git for Windows extrae por defecto con `core.autocrlf=true`, y los textos que el proyecto ejecuta o procesa salen con CRLF.
- El autopilot ejecuta `node_modules/.bin/openspec`, que en Windows es un script de shell.

Además, una máquina Windows puede no tener internet, y hace falta saber qué le falta antes de abrir una sesión. El diagnóstico tiene que funcionar en una máquina a la que le falta casi todo, y lo único que trae siempre Windows 11 es Windows PowerShell 5.1.

Cómo se ejecuta el núcleo del arranque en Windows no lo decide este ADR: lo fija ADR-0023, del change `windows-global-distro`, con un núcleo en Node. Una primera versión de este ADR lo resolvía con Git Bash y se reescribió antes de llegar a la rama de origen, por decisión del usuario (2026-11-22).

Alternativas consideradas:

- **Soportar los dos agentes en Windows.** Habría que adaptar y verificar también Claude Code en Windows, sin una necesidad que lo pida. Se decidió soportar solo OpenCode 2.
- **Fijar LF solo en los scripts y en los textos del arranque.** Cada texto nuevo obligaría a acordarse de añadirlo, y el fallo solo se vería en Windows.
- **Un diagnóstico repartido**: un lanzador PowerShell mínimo y un diagnóstico en bash, que la suite podría probar sin PowerShell. Seguiría habiendo PowerShell sin probar, y la lógica quedaría en dos lenguajes.

## Decision

- **En Windows solo se soporta OpenCode 2 o superior.** Claude Code en Windows no se soporta. No es una capacidad de un solo agente (ADR-0006): en Linux y macOS los dos agentes siguen soportados igual.
- **El repositorio fija LF en todos sus archivos de texto** con `.gitattributes` (`* text=auto eol=lf`), en cualquier sistema.
- **El diagnóstico de Windows es un único script PowerShell**, compatible con Windows PowerShell 5.1 y PowerShell 7. No instala nada ni usa la red, y separa la recogida de hechos de la máquina de su evaluación.
- **La suite prueba la evaluación del diagnóstico con `pwsh`** sobre máquinas simuladas, así que `pwsh` es requisito de la suite. La recogida de hechos se comprueba a mano en Windows real.

El comportamiento está especificado en `openspec/specs/windows-readiness/spec.md`, `openspec/specs/session-bootstrap/spec.md` y `openspec/specs/openspec-autopilot/spec.md`.

## Consequences

- El repositorio se extrae con LF en cualquier sistema. Los clones Windows que ya existen tienen que volver a extraer su árbol; el diagnóstico lo detecta y da los comandos.
- Quien use Claude Code en Windows no está soportado. Soportarlo exige un change y un ADR nuevos.
- La suite necesita `pwsh` además de Node.js, npm, git y bash. En la sesión en la nube se instala con el script de configuración del entorno.
- El diagnóstico tiene que seguir lo que exija el arranque en Windows: cuando cambie ese arranque, por ejemplo con ADR-0023, el change que lo cambie adapta también el diagnóstico.
- Mientras no haya otro change, el diagnóstico nombra qué incorporar al repositorio (`vendor/windows/`), pero el arranque no usa ese directorio.
