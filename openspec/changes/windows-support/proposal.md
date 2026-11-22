## Why

El proyecto solo funciona en Linux y macOS. En Windows 11 con OpenCode 2, aunque estén instalados Git for Windows, Node.js y Python, hay varias cosas que lo rompen: Git for Windows convierte por defecto los finales de línea a CRLF, `ln -s` de Git Bash hace copias en lugar de symlinks, el plugin de OpenCode lanza el primer `bash` del PATH y las rutas del arranque llegan a OpenCode con formato POSIX. Además, no hay forma de saber de antemano qué le falta a una máquina Windows para que el proyecto funcione, sobre todo si no tiene acceso a internet y no puede descargar lo que falte.

## What Changes

- **Un diagnóstico para Windows**, `scripts/windows/Test-OfflineInstall.ps1`, que funciona en Windows PowerShell 5.1 y en PowerShell 7, no instala nada y no usa la red. Comprueba cada binario, dato y ajuste que necesita el proyecto: Node.js y npm, git, Git Bash y sus utilidades, symlinks, Python 3 y `python3`, el motor del wiki, las dependencias npm de la raíz y de `acceptance-tests/` para la plataforma de la máquina, y el agente. Para cada cosa que falta dice qué incorporar al repositorio, la alternativa de instalarla globalmente, si existe, y cómo conseguirla en una máquina con internet. Termina con 1 si falta algo. Ya hay una primera versión en la rama, sin probar en Windows.
- **En Windows solo se soporta OpenCode 2.** Claude Code en Windows no se soporta: el arranque, los hooks y la suite no se adaptan ni se prueban para él, y el diagnóstico solo da por bueno OpenCode 2 como agente.
- **El arranque de sesión funciona en Windows con Git Bash**, si están instalados los requisitos:
  - un `.gitattributes` fija LF en los scripts y en los textos que el arranque entrega o procesa, para que `core.autocrlf` no los convierta a CRLF y bash no falle;
  - los enlaces del motor del wiki se crean como symlinks nativos de Windows, y no como copias, para que el arranque los reconozca en la sesión siguiente;
  - las rutas que el núcleo devuelve (`bin=`, `wiki-engine=`) llegan en el formato que entiende cada adaptador.
- **El plugin de OpenCode `session-bootstrap`** ejecuta el núcleo con el bash de Git for Windows y no con el primero del PATH, que en Windows puede ser el de WSL.
- **El plugin de OpenCode `openspec-autopilot`** encuentra y ejecuta el CLI de OpenSpec del proyecto en Windows, donde `node_modules/.bin/openspec` no es un ejecutable y Node.js no lanza los `.cmd` sin shell.
- **El README** documenta los requisitos en Windows (Git for Windows, Modo de desarrollador, `core.symlinks`, un `python3`) y el diagnóstico, y sustituye la sección «Instalación manual», que hoy da Windows por no soportado.

Fuera de alcance:

- incorporar al repositorio los binarios o los datos para instalar sin internet (el vendor `vendor/windows/` que nombra el diagnóstico). Se decidirá en otro change con lo que muestre el diagnóstico en máquinas reales;
- Claude Code en Windows;
- WSL: ahí el proyecto ya funciona como en Linux;
- ejecutar la suite de aceptación en Windows: sus escenarios montan un PATH de prueba con symlinks a utilidades POSIX. Los cambios se cubren con escenarios que se ejecutan en Linux.

## Capabilities

### New Capabilities
- `windows-readiness`: el diagnóstico de lo que le falta a una máquina Windows para el proyecto. Qué comprueba, cómo informa de cada componente (estado, qué incorporar al repositorio, alternativa global, cómo conseguirlo) y su código de salida.

### Modified Capabilities
- `session-bootstrap`: en Windows, con OpenCode, el arranque se ejecuta con el bash de Git for Windows, con finales de línea LF en lo que ejecuta y lee, enlaces del motor que son symlinks nativos y rutas en el formato de Windows.
- `openspec-autopilot`: el plugin ejecuta el CLI de OpenSpec del proyecto también en Windows.

## Impact

- Nuevo: `scripts/windows/Test-OfflineInstall.ps1` (ya en la rama) y `.gitattributes`.
- `.agents/hooks/session-bootstrap.sh`, `.claude/hooks/*.sh`, `.opencode/plugins/session-bootstrap/server.js` y `.opencode/plugins/openspec-autopilot/lib/project.mjs`.
- `README.md`: requisitos en Windows y sustitución de «Instalación manual».
- `acceptance-tests/`: escenarios y pasos de las capabilities nuevas y modificadas. Ejecutar el diagnóstico en la suite requiere `pwsh` en la máquina de los tests; si no está, esos escenarios necesitan otra estrategia (se decide en el design).
- Clones que ya existen en Windows: tras añadir `.gitattributes` hay que renormalizar el árbol (`git add --renormalize .` o volver a extraer los archivos).
- `adr/`: un ADR sobre el soporte de Windows: solo con OpenCode 2 y con Git Bash como único shell.
- El wiki del proyecto, en la resincronización tras el archive.
