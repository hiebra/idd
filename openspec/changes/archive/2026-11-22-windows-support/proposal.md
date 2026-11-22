## Why

El proyecto solo funciona en Linux y macOS. En Windows 11 con OpenCode 2, aunque estén instalados Git for Windows, Node.js y Python, hay cosas que lo rompen: Git for Windows convierte por defecto los finales de línea a CRLF, y el autopilot no puede ejecutar `node_modules/.bin/openspec`. Además, no hay forma de saber de antemano qué le falta a una máquina Windows para que el proyecto funcione, sobre todo si no tiene acceso a internet y no puede descargar lo que falte.

El núcleo del arranque de sesión en Windows no lo resuelve este change. Lo porta a Node el change `windows-global-distro` (ADR-0023), por decisión del usuario (2026-11-22). Este change se limita a lo que no depende de ese núcleo.

## What Changes

- **Un diagnóstico para Windows**, `scripts/windows/Test-OfflineInstall.ps1`, que funciona en Windows PowerShell 5.1 y en PowerShell 7, no instala nada y no usa la red. Comprueba cada binario, dato y ajuste que necesita el proyecto: Node.js y npm, git, Python 3, los finales de línea del clon, el motor del wiki, las dependencias npm de la raíz y de `acceptance-tests/` para la plataforma de la máquina, y el agente. Para cada cosa que falta dice qué incorporar al repositorio, la alternativa de instalarla globalmente, si existe, y cómo conseguirla en una máquina con internet. Termina con 1 si falta algo. Ya hay una primera versión en la rama, sin probar en Windows.
- **En Windows solo se soporta OpenCode 2.** Claude Code en Windows no se soporta, y el diagnóstico solo da por bueno OpenCode 2 como agente.
- **LF en todo el repositorio:** un `.gitattributes` fija LF en todos los archivos de texto, para que `core.autocrlf` no los convierta a CRLF en Windows.
- **El plugin de OpenCode `openspec-autopilot`** encuentra y ejecuta el CLI de OpenSpec del proyecto en Windows, donde `node_modules/.bin/openspec` no es un ejecutable y Node.js no lanza los `.cmd` sin shell.
- **El README** documenta el diagnóstico de Windows y que en Windows solo se soporta OpenCode 2. Los requisitos del arranque en Windows los documenta `windows-global-distro`.

Fuera de alcance:

- incorporar al repositorio los binarios o los datos para instalar sin internet (el vendor `vendor/windows/` que nombra el diagnóstico). Se decidirá en otro change con lo que muestre el diagnóstico en máquinas reales;
- Claude Code en Windows;
- el núcleo del arranque de sesión en Windows (Git Bash, symlinks, rutas): lo resuelve `windows-global-distro` con un núcleo en Node;
- la verificación en Windows 11 real: se hace una vez, con los dos changes fusionados, en `windows-global-distro`, que se fusiona el último;
- WSL: ahí el proyecto ya funciona como en Linux;
- ejecutar la suite de aceptación en Windows: sus escenarios montan un PATH de prueba con symlinks a utilidades POSIX. Los cambios se cubren con escenarios que se ejecutan en Linux.

## Capabilities

### New Capabilities
- `windows-readiness`: el diagnóstico de lo que le falta a una máquina Windows para el proyecto. Qué comprueba, cómo informa de cada componente (estado, qué incorporar al repositorio, alternativa global, cómo conseguirlo) y su código de salida.

### Modified Capabilities
- `session-bootstrap`: el repositorio fija LF en sus archivos de texto, también en un clon con `core.autocrlf=true`.
- `openspec-autopilot`: el plugin ejecuta el CLI de OpenSpec del proyecto también en Windows.

## Impact

- Nuevo: `scripts/windows/Test-OfflineInstall.ps1` (ya en la rama) y `.gitattributes`.
- `.opencode/plugins/openspec-autopilot/lib/project.mjs`.
- `README.md`: el diagnóstico y el soporte de Windows.
- `acceptance-tests/`: escenarios y pasos de las capabilities nuevas y modificadas. Ejecutar el diagnóstico en la suite requiere `pwsh` en la máquina de los tests.
- Clones que ya existen en Windows: tras añadir `.gitattributes` hay que renormalizar el árbol (`git add --renormalize .` o volver a extraer los archivos).
- `adr/`: un ADR sobre el soporte de Windows: solo con OpenCode 2, LF en el repositorio y un diagnóstico en PowerShell.
- `windows-global-distro`: se fusiona después de este change y rehace sobre él sus deltas de `session-bootstrap` y `openspec-autopilot`.
- El wiki del proyecto, en la resincronización tras el archive.
