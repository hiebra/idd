# ADR-0017: En Windows se soporta solo OpenCode 2, con Git Bash como shell del arranque y un diagnóstico en PowerShell

- Status: accepted
- Date: 2026-11-22
- Supersedes: -

## Context

ADR-0002 dejó el proyecto «ligado a Node.js con npm y a bash», con un núcleo del arranque en bash y un adaptador por agente. Hasta ahora solo funcionaba en Linux y macOS. En Windows 11 falla aunque estén instalados Git for Windows, Node.js y Python: los finales de línea CRLF de `core.autocrlf` rompen los scripts, `ln -s` de Git Bash copia en lugar de enlazar, las rutas que devuelve el núcleo están en formato bash y el plugin de OpenCode puede lanzar el bash de WSL (change `windows-support`).

Además, una máquina Windows puede no tener internet, y hace falta saber qué le falta antes de abrir una sesión. El diagnóstico tiene que funcionar justo en las máquinas a las que les falta Git Bash, y lo único que trae siempre Windows 11 es Windows PowerShell 5.1.

Alternativas consideradas:

- **Soportar los dos agentes en Windows.** Habría que adaptar y verificar también el hook de Claude Code en Windows, sin una necesidad que lo pida. Se decidió soportar solo OpenCode 2.
- **Un núcleo del arranque en PowerShell para Windows.** Daría dos implementaciones de la lógica de instalación, lo que ADR-0002 evita.
- **WSL como entorno de Windows.** Dentro de WSL el proyecto ya funciona como en Linux, pero un agente nativo de Windows que lanza bash de WSL ve otro sistema de archivos, otro Node y otra caché de npm.
- **Un diagnóstico repartido**: un lanzador PowerShell que solo comprueba Git for Windows y un diagnóstico bash que la suite podría probar sin PowerShell. Seguiría habiendo PowerShell sin probar y la lógica quedaría en dos lenguajes.

## Decision

- **En Windows solo se soporta OpenCode 2 o superior.** Claude Code en Windows no se soporta. No es una capacidad de un solo agente (ADR-0006): en Linux y macOS los dos agentes siguen soportados igual.
- **En Windows, el núcleo del arranque se ejecuta con Git Bash**, que el plugin de OpenCode localiza a partir de la instalación de Git, sin fiarse del primer `bash` del `PATH`.
- **El repositorio fija LF en todos sus archivos de texto** con `.gitattributes`, en cualquier sistema.
- **El núcleo funciona igual en Git Bash que en Linux y macOS**: pide symlinks nativos (`MSYS=winsymlinks:nativestrict`) y devuelve sus rutas relativas al proyecto, para que cada adaptador las complete en su formato.
- **El diagnóstico de Windows es un único script PowerShell** compatible con Windows PowerShell 5.1 y PowerShell 7. No instala nada ni usa la red, y separa la recogida de hechos de la máquina de su evaluación.
- **La suite prueba la evaluación del diagnóstico con `pwsh`** sobre máquinas simuladas, así que `pwsh` es requisito de la suite. La recogida de hechos se comprueba a mano en Windows real.

El comportamiento está especificado en `openspec/specs/windows-readiness/spec.md`, `openspec/specs/session-bootstrap/spec.md` y `openspec/specs/openspec-autopilot/spec.md`.

## Consequences

- El proyecto funciona en Windows 11 con OpenCode 2 si la máquina tiene Node.js con npm, Git for Windows y Python 3, y sin red si ya tiene el motor del wiki y las dependencias npm.
- Quien use Claude Code en Windows no tiene arranque de sesión. Soportarlo exige un change y un ADR nuevos.
- Los clones Windows que ya existen tienen que volver a extraer su árbol para tener LF y symlinks. El diagnóstico lo detecta y da los comandos.
- Sin el Modo de desarrollador, `ln -s` falla en Git Bash en lugar de copiar, y el núcleo avisa. El diagnóstico lo detecta.
- La suite necesita `pwsh` además de Node.js, npm, git y bash. En la sesión en la nube se instala con el script de configuración del entorno.
- La suite no se ejecuta en Windows: los escenarios de Windows del arranque se simulan en Linux. Cuando cambie OpenCode o Git for Windows, hay que repetir la verificación a mano en Windows real.
- Mientras no haya otro change, el diagnóstico nombra qué incorporar al repositorio (`vendor/windows/`), pero el arranque no usa ese directorio.
