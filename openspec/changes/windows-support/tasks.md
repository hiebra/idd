# Tasks: windows-support

La suite ya existe (`acceptance-tests/`, `stack: javascript`), así que no hace falta montarla. Las tasks por escenario siguen el ciclo de siempre: el escenario falla por la razón esperada, se implementa, pasa y se hace commit. Los commits no mezclan `openspec/` con el resto, salvo este `tasks.md`.

## 1. Preparación

- [x] 1.1 Dejar `pwsh` (PowerShell 7) disponible en la sesión: proponer al usuario añadir su instalación al script de configuración del entorno de la nube (Open Question 1 del design: paquete de Microsoft o tarball de GitHub) y, aprobada, instalarlo en esta sesión. Comprobar `pwsh -v`. Sin `pwsh` no se puede hacer la sección 4.
  - Resultado: entorno personal `idd` (para `hiebra/idd`) con un script de configuración que instala PowerShell 7.4.6 desde el tarball de las releases de GitHub en `/opt/microsoft/powershell/7`, con `pwsh` en `/usr/local/bin`. El script se probó en esta sesión, y `pwsh -v` da 7.4.6.
- [x] 1.2 Ejecutar la suite con el delta del change: los escenarios nuevos de `windows-readiness`, `session-bootstrap` y `openspec-autopilot` salen con pasos sin definir, y el resto pasa. Anotar aquí el resultado.
  - Resultado: 227 escenarios, 203 pasan y 24 sin definir (los nuevos del change); ninguno falla.

## 2. Arranque de sesión en Windows (zona de código): por escenario, rojo → implementar → verde → commit

- [x] 2.1 "Clon con conversión de finales de línea": definir los pasos según D8 (un clon real de la copia con `-c core.autocrlf=true`, sesión de OpenCode). Ver el rojo sin `.gitattributes`. Añadir `.gitattributes` con `* text=auto eol=lf` (D2) y comprobar con `git ls-files --eol` que el índice del repositorio ya está en LF.
  - Resultado: sin `.gitattributes`, el clon con `autocrlf` extrae los cuatro scripts del arranque con CRLF y el paso falla. Con `* text=auto eol=lf`, pasa. `git ls-files --eol` da `i/lf` en todos los archivos de texto del índice; `git add --renormalize .` no cambia ninguno.
- [x] 2.2 "Git Bash copia en lugar de enlazar si no se le pide": en la máquina simulada, un `ln` falso que copia salvo que `MSYS` contenga `winsymlinks:nativestrict` (D8). Ver el rojo y exportar `MSYS=winsymlinks:nativestrict` en el núcleo antes de enlazar el motor (D3).
  - Resultado: sin `MSYS`, el `ln` de Git Bash simulado copia los tres enlaces del motor y el paso falla. Con `MSYS=winsymlinks:nativestrict` en la llamada a `ln -s` del núcleo, los tres son symlinks.
- [x] 2.3 "La sesión siguiente reconoce los enlaces": con la máquina de 2.2, dos sesiones seguidas sin aviso de que ya existe algo que no es del motor.
  - Resultado: sin `MSYS`, la segunda sesión avisa de que los tres enlaces ya existen y no son del motor. Con el cambio de 2.2, no avisa.
- [ ] 2.4 "OpenCode nombra el proyecto con otra ruta que bash": el host de OpenCode recibe la ruta de un symlink al proyecto, y bash la resuelve con `cd -P` (D4). Ver el rojo y cambiar el contrato del núcleo: `bin=` y `wiki-engine=` relativas al proyecto, completadas por el plugin con `path.join(directory, …)` y por el adaptador de Claude Code con `$project`. Actualizar las pruebas de `core-tests/` que lean esas líneas. Los escenarios vigentes de Claude Code siguen pasando.
- [ ] 2.5 "El bash de WSL va antes en el PATH": el host fija `process.platform` a `win32` antes de cargar el plugin, con un `bash` falso que registra que lo han llamado primero en el `PATH` y un `git` falso cuyo `--exec-path` lleva a un `bin/bash.exe` que es el bash real (D5). Ver el rojo e implementar la búsqueda de Git Bash en `.opencode/plugins/session-bootstrap/server.js`.
- [ ] 2.6 "Windows sin Git for Windows": con `win32` y sin `git` ni `%ProgramFiles%\Git\bin\bash.exe`, el plugin avisa de que el arranque necesita Git for Windows, no lanza el núcleo y la sesión arranca.
- [ ] 2.7 En `core-tests/`, pruebas de la búsqueda de Git Bash que no están en las specs: `--exec-path` bajo `mingw64` y bajo `mingw32`, un `git` del `PATH` que no es de Git for Windows y una ruta con espacios.

## 3. Autopilot (zona de código)

- [ ] 3.1 "El enlace de binarios del CLI no es ejecutable": en la copia, sustituir `node_modules/.bin/openspec` por un archivo no ejecutable. Ver el rojo y hacer que `openspecBin` ejecute con `process.execPath` el `bin.openspec` de `node_modules/@fission-ai/openspec/package.json`, y que use el `openspec` del `PATH` si no está (D6).
- [ ] 3.2 En `core-tests/`, el caso sin el CLI del proyecto: usa el `openspec` del `PATH`.

## 4. Diagnóstico (zona de código): por escenario, rojo → implementar → verde → commit

- [ ] 4.1 Reestructurar `scripts/windows/Test-OfflineInstall.ps1` según D7: `Get-ReadinessFacts` (recogida), `Get-ReadinessReport` (evaluación, sin tocar la máquina) y `-FactsFile <json>` para evaluar unos hechos dados. Quitar las comprobaciones de `MSYS` y de qué bash va primero en el `PATH`. Comprobar a mano con `pwsh` que el script se carga y que, con unos hechos de ejemplo, da un informe.
- [ ] 4.2 Soporte en `acceptance-tests/support/` para «una máquina Windows …»: hechos de una máquina con todo lo necesario, que cada `But` modifica, un proyecto temporal con sus lockfiles, y la ejecución del script con `pwsh -NoProfile -File … -FactsFile …` (y `-Json` cuando el paso lo pide), leyendo el código de salida y el informe. Si no hay `pwsh`, el paso falla con un mensaje que lo dice.
- [ ] 4.3 "Máquina con todo lo necesario", "No falta nada" y "Falta algo".
- [ ] 4.4 "Falta Node.js", "Node.js de una versión inferior a la requerida" y "Lo que está en el vendor del repositorio cuenta como presente".
- [ ] 4.5 "Dependencias instaladas en otro sistema operativo" (con el `acceptance-tests/package-lock.json` del proyecto: `@esbuild/win32-x64` sí, `@esbuild/linux-x64` no).
- [ ] 4.6 "Dependencias solo en la caché global sin modo offline".
- [ ] 4.7 "Motor sin instalar que solo está en GitHub" y "Motor sin instalar con una fuente local" (un bundle real con el tag fijado).
- [ ] 4.8 "Solo el alias de la Microsoft Store" y "Python instalado sin `python3`".
- [ ] 4.9 "Clon extraído sin symlinks" y "Clon extraído con CRLF antes de fijar los finales de línea" (añade a los hechos los finales de línea de los scripts del arranque).
- [ ] 4.10 "Solo Claude Code" y "OpenCode 1".
- [ ] 4.11 "Informe en JSON".

## 5. Documentación (zona de código)

- [ ] 5.1 `README.md`: una sección «Windows» que dice que solo se soporta OpenCode 2, sus requisitos (Git for Windows, Node.js, Python 3 con `python3`, Modo de desarrollador y `core.symlinks=true` antes de clonar) y cómo ejecutar el diagnóstico, y que sustituye «Instalación manual», que hoy da Windows por no soportado. Incluir los comandos de la migración de un clon existente (design, Migration Plan).
- [ ] 5.2 `acceptance-tests/README.md`: `pwsh` entre los requisitos, y secciones de los escenarios de `windows-readiness` y de los de Windows en `session-bootstrap` y `openspec-autopilot`, con las simulaciones de D7 y D8.

## 6. Verificación en Windows 11 real (la hace el usuario)

- [ ] 6.1 En una máquina Windows 11, ejecutar el diagnóstico con Windows PowerShell 5.1 y con PowerShell 7, sin red: sale sin errores de PowerShell y el informe coincide con lo que tiene la máquina. Anotar aquí el resultado y corregir la recogida si hace falta.
- [ ] 6.2 En la misma máquina, con OpenCode 2 y lo que pida el diagnóstico instalado: abrir una sesión en el proyecto; `openspec --version` da la versión fijada, el wiki está disponible (`wiki-query`) y el autopilot arranca la sesión operativa. Anotar aquí la versión de OpenCode y lo que difiera de la simulación (riesgo del design).

## 7. Cierre

- [ ] 7.1 Ejecutar la suite completa con el delta del change, `npm run test:core` y `npm run lint:specs`: todo pasa, cero pasos pendientes o sin definir, informe HTML generado. Anotar aquí el resultado.
- [ ] 7.2 `openspec validate windows-support --type change --strict` sin errores.
