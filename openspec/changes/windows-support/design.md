## Context

El arranque de sesión es un núcleo bash (`.agents/hooks/session-bootstrap.sh`) con un adaptador por agente (ADR-0002): el hook `SessionStart` de Claude Code y el plugin `session-bootstrap` de OpenCode 2. ADR-0002 deja el proyecto «ligado a Node.js con npm y a bash». En Windows solo se soporta OpenCode 2 (decisión del usuario, 2026-11-22), y el único bash nativo que puede lanzar es el de Git for Windows (Git Bash).

Revisando el código para este change (2026-11-22), el proyecto no funciona en Windows con OpenCode aunque estén instalados Git for Windows, Node.js y Python, por cinco causas:

1. **Finales de línea.** No hay `.gitattributes`, y Git for Windows extrae con `core.autocrlf=true`. Bash falla con un `.sh` con CRLF (`$'\r': command not found`). Además, el núcleo filtra la guía y la regla con `sed '/^<!-- ... -->$/d'`, que no casa con un `\r` final, y mide el recordatorio con `wc -m`, que lo cuenta.
2. **Symlinks del motor.** El núcleo crea los enlaces del motor con `ln -s` y los reconoce con `readlink`. En Git Bash, sin `MSYS=winsymlinks:...`, `ln -s` hace una copia, así que en la sesión siguiente `is_engine_link` falla y el núcleo avisa de que «ya existe» algo que no es del motor.
3. **Rutas.** El núcleo devuelve `bin=$PWD/node_modules/.bin` y `wiki-engine=$PWD/...`. En Git Bash `$PWD` es `/c/Users/...`, y el plugin de OpenCode lo antepone tal cual al `PATH` de Windows, separado con `;`.
4. **Qué bash lanza OpenCode.** El plugin hace `spawn("bash", ...)`. En Windows, ese `bash` es el primero del `PATH`, que puede ser `C:\Windows\System32\bash.exe` (WSL).
5. **El CLI en el autopilot.** `lib/project.mjs` ejecuta `node_modules/.bin/openspec` con `spawn` sin shell. En Windows ese archivo es un script sh. Su `openspec.cmd` tampoco sirve: desde Node.js 18.20.2 y 20.12.2, `spawn` rechaza los `.cmd` y `.bat` sin `shell: true`.

También hace falta saber qué le falta a una máquina concreta, sobre todo sin internet. Para eso está el diagnóstico `scripts/windows/Test-OfflineInstall.ps1`, cuya primera versión ya está en la rama y no se ha probado en Windows.

## Goals / Non-Goals

**Goals:**

- Que el proyecto funcione en Windows 11 con OpenCode 2 si la máquina tiene Node.js con npm, Git for Windows y Python 3, sin cambiar su comportamiento en Linux y macOS.
- Que, con el motor del wiki y las dependencias npm ya instalados, nada del arranque necesite red, como ya ocurre en Linux.
- Un diagnóstico que diga qué falta en una máquina Windows, con la alternativa en el repositorio y la global, cubierto por la suite en lo que se puede probar fuera de Windows.

**Non-Goals:**

- Incorporar binarios o datos al repositorio (`vendor/windows/`). El diagnóstico los nombra, pero montar el vendor y hacer que el arranque lo use irá en otro change.
- Claude Code en Windows: ni su adaptador ni la suite se adaptan para él, y el diagnóstico no lo da por bueno.
- WSL, PowerShell o `cmd` como shell del arranque.
- Ejecutar la suite de aceptación en Windows.
- Windows 10, aunque probablemente funcione igual.

## Decisions

### D1. Git Bash es el único shell soportado en Windows

El núcleo sigue siendo bash, y en Windows se ejecuta con Git Bash, que el plugin de OpenCode localiza (D5). En Windows solo se soporta OpenCode 2. Es una restricción de plataforma, no una capacidad de un solo agente (ADR-0006): en Linux y macOS los dos agentes siguen igual.

Alternativas:

- **Portar el núcleo a PowerShell.** Daría dos implementaciones de la lógica de instalación, justo lo que ADR-0002 evita.
- **Escribir el núcleo en Node.** ADR-0002 ya lo descartó: el núcleo no podría avisar de que falta Node o de que la versión es inferior a la requerida.
- **Soportar WSL como shell de Windows.** Dentro de WSL el proyecto ya funciona como en Linux, pero un agente nativo de Windows que lanza bash de WSL ve otro sistema de archivos, otro Node y otra caché de npm.

### D2. LF en todo el repositorio con `.gitattributes`

Se añade `.gitattributes` con `* text=auto eol=lf`: todo archivo de texto se extrae con LF en cualquier sistema, y git sigue detectando los binarios. El script PowerShell no necesita CRLF; lo que necesita para Windows PowerShell 5.1 es el BOM UTF-8, que ya tiene y que `eol` no toca.

Alternativa: fijar LF solo en `*.sh` y en los textos que procesa el núcleo. Cada texto nuevo que entregue el arranque obligaría a acordarse de añadirlo, y el fallo solo se vería en Windows.

### D3. El núcleo pide symlinks nativos a Git Bash

El núcleo exporta `MSYS=winsymlinks:nativestrict` antes de `ln -s`. En Git Bash, `ln -s` crea entonces un symlink de Windows, o falla si el usuario no tiene permiso (sin el Modo de desarrollador), y ese fallo ya lo avisa el núcleo («no se ha podido crear ...»). Fuera de MSYS la variable no tiene efecto. Con `nativestrict`, y no con `native`, nunca vuelve a crear copias en silencio.

Alternativa: una rama solo para Windows con `cmd /c mklink`. Daría otro camino de código y otra forma de reconocer los enlaces, cuando `readlink` ya entiende los symlinks nativos.

### D4. El núcleo devuelve rutas relativas al proyecto, y cada adaptador las completa

Hoy el núcleo devuelve `bin=` y `wiki-engine=` como rutas absolutas en formato bash. Pasa a devolverlas relativas al proyecto (`bin=node_modules/.bin`, `wiki-engine=.agents/wiki-engine/claude-plugin`), y cada adaptador las completa con el proyecto tal como lo nombra su entorno:

- **Claude Code** (solo Linux y macOS): el adaptador es bash, escribe en `CLAUDE_ENV_FILE` y completa la ruta con `$project`, con el mismo resultado que hoy.
- **OpenCode:** el plugin es Node y antepone la ruta al `PATH` del proceso. La completa con `path.join(directory, rel)`, que en Windows es `C:\...`.

Esto cambia un contrato interno entre el núcleo y sus adaptadores, no un comportamiento de las specs vigentes. Se actualizan los dos adaptadores y las pruebas del núcleo que lean esas líneas.

Alternativas:

- **Convertir la ruta en el plugin con `cygpath -w`.** El plugin dependería de una herramienta de MSYS y de lanzar otro proceso.
- **Que el núcleo devuelva rutas Windows (`pwd -W`) en Git Bash.** Funcionaría para OpenCode, pero el núcleo tendría que saber qué formato quiere cada adaptador.
- **Que el plugin ignore la ruta del núcleo y construya la suya.** Duplica en el plugin dónde instala el núcleo cada cosa.

La suite lo prueba fuera de Windows haciendo que bash vea el proyecto con otra ruta que el agente: por ejemplo, el agente recibe la ruta de un symlink al proyecto y bash, con `cd -P`, la ruta real. Así se comprueba que las rutas de la sesión salen de la ruta del agente y no de la de bash.

### D5. En Windows, el plugin de OpenCode localiza Git Bash

En `process.platform === "win32"`, el plugin `session-bootstrap` busca el bash en este orden:

1. la instalación de Git que da `git --exec-path` (por ejemplo, `C:\Program Files\Git\mingw64\libexec\git-core`), subiendo hasta la raíz de Git y tomando `bin\bash.exe`;
2. si `git` no está en el `PATH`, la instalación por defecto, `%ProgramFiles%\Git\bin\bash.exe`.

Si no lo encuentra, avisa de que el arranque necesita Git for Windows y no lanza el núcleo. La sesión arranca igual. Fuera de Windows sigue lanzando `bash`.

Alternativa: tomar el primer `bash.exe` del `PATH` que no esté en `System32` ni en `WindowsApps`. Depende de cómo esté ordenado el `PATH` de cada máquina, y Git for Windows por defecto no pone `bin\` en el `PATH`.

La suite lo prueba simulando Windows en el host de OpenCode: fija `process.platform` a `win32` antes de cargar el plugin, pone un `bash` falso que registra que lo han llamado primero en el `PATH` y un `git` falso cuyo `--exec-path` lleva a un `bin/bash.exe` que es el bash real.

### D6. El autopilot ejecuta el CLI con Node, sin el enlace de binarios

`openspecBin` pasa a resolver el CLI del proyecto desde `node_modules/@fission-ai/openspec/package.json` (su campo `bin.openspec`) y lo ejecuta con `process.execPath`, es decir, `node <script>`. Funciona igual en todos los sistemas y no depende de `node_modules/.bin/`. Si el paquete no está instalado, usa el `openspec` del `PATH`, como hasta ahora.

Alternativa: `spawn` con `shell: true` en Windows. Habría que citar los argumentos (hay rutas y textos del usuario) y el comportamiento sería distinto en cada sistema.

### D7. El diagnóstico separa lo que recoge de lo que evalúa

El script se divide en dos partes:

- **`Get-ReadinessFacts`** recoge los hechos de la máquina: qué ejecutables hay y sus versiones, si es un alias de la Microsoft Store, el registro del Modo de desarrollador, si se pueden crear symlinks con `mklink`, los atributos de los symlinks del clon, los finales de línea de los scripts, el sello del motor, `engine.json`, los lockfiles con lo instalado y lo que hay en las cachés de npm, y la configuración de npm.
- **`Get-ReadinessReport`** convierte esos hechos en el informe (estado, detalle, repo, global, obtener) sin tocar la máquina.

El script recoge, evalúa e imprime. Con `-FactsFile <json>` evalúa unos hechos dados, sin recogerlos. Eso es lo que usa la suite: cada «Given una máquina Windows ...» construye los hechos de esa máquina, y el paso ejecuta el script con `pwsh`. Así se prueban fuera de Windows todas las reglas de `windows-readiness`, y no queda ninguna lógica de decisión sin probar en la recogida.

La recogida solo se puede probar en Windows. Se comprueba a mano, en una máquina Windows 11 real, con Windows PowerShell 5.1 y con PowerShell 7 (tasks de verificación), y se documenta en `acceptance-tests/README.md`, como se hizo con los agentes reales.

El diagnóstico deja de comprobar lo que el arranque resuelve con este change: `MSYS` (D3) y qué bash va primero en el `PATH` (D5). Añade la comprobación de finales de línea CRLF en los scripts del arranque del clon, y como agente solo da por bueno OpenCode 2 (spec `windows-readiness`).

Alternativa: probar el script en Windows con agentes de CI. El proyecto no tiene CI, y la suite se ejecuta en la sesión del agente.

### D8. Los escenarios de Windows del arranque se simulan en Linux

Siguiendo ADR-0002, la suite no arranca los agentes reales ni necesita Windows:

- **Finales de línea:** un clon real de la copia del proyecto con `-c core.autocrlf=true`, sobre el que se abre la sesión de OpenCode.
- **Git Bash que copia:** un `ln` falso en la máquina simulada que copia salvo que `MSYS` contenga `winsymlinks:nativestrict`, y en ese caso llama al `ln` real.
- **Rutas:** D4. **Bash de OpenCode:** D5.

El plugin de OpenCode en Windows se comprueba además con OpenCode 2 real en Windows 11 al final del change, como se hizo con su contrato de plugins en Linux.

## Risks / Trade-offs

- **[Riesgo] `* text=auto eol=lf` cambia los archivos de los clones Windows que ya existen.** Git renormaliza al hacer commit y puede mostrar cambios de solo finales de línea. → El README y el diagnóstico dan los comandos para volver a extraer el árbol con LF. En Linux y macOS no cambia nada, porque ya es LF.
- **[Riesgo] `nativestrict` hace fallar `ln -s` donde antes copiaba.** → Es lo buscado: una copia rompía el arranque en silencio en la sesión siguiente. El fallo se avisa, y el diagnóstico dice cómo activar el Modo de desarrollador.
- **[Riesgo] OpenCode 2 en Windows carga los plugins o entrega `directory` de otra forma que en Linux.** → Se comprueba con OpenCode 2 real en Windows 11 (tasks de verificación). Si difiere, se actualiza el design.
- **[Compromiso] Quien use Claude Code en Windows no tiene arranque.** → El README y el diagnóstico lo dicen. Soportarlo irá en otro change.
- **[Riesgo] La recogida de hechos del diagnóstico no la cubre la suite.** → Está separada de la evaluación y es lineal (leer, no decidir), y se verifica a mano en Windows con las dos versiones de PowerShell.
- **[Compromiso] Los escenarios de `windows-readiness` necesitan `pwsh`** en la máquina de la suite. → Ver Open Questions.
- **[Riesgo] Cambiar el formato de `bin=` y `wiki-engine=` rompe a quien lea la salida del núcleo.** → Solo la leen los dos adaptadores del repositorio y sus pruebas, que cambian en el mismo commit.

## Migration Plan

1. Se fusiona el change. Los clones Linux y macOS no notan nada.
2. En un clon Windows que ya existe: `git config core.symlinks true` (con el Modo de desarrollador activo) y volver a extraer el árbol para que salga con LF y con symlinks (`git rm -r --cached -q . && git reset --hard`, con el árbol limpio). El diagnóstico detecta los dos casos y da el comando.
3. En una máquina nueva: ejecutar el diagnóstico, instalar lo que falte (con la alternativa global que indique) y abrir la sesión.

Rollback: revertir los commits del change. `.gitattributes` se puede retirar sin efectos en Linux y macOS.

## Open Questions

1. **`pwsh` en la suite.** Los escenarios de `windows-readiness` lo necesitan, y la sesión en la nube no lo tiene (descargarlo se ha bloqueado en esta sesión). Opciones:
   - **(a)** `pwsh` pasa a ser requisito de la suite, como ya lo es el acceso al registro de npm, y se instala en la nube con el script de configuración del entorno. Sin él, esos escenarios fallan con un mensaje que lo dice;
   - **(b)** se etiquetan `@pwsh` y se excluyen cuando no hay `pwsh`, avisando. Pero cambia `cucumber.cjs`, que es copia literal de la skill, y la suite se queda en verde sin haber probado nada.

   La recomendación es (a).
2. **ADRs vigentes.** Ninguno hay que sustituir. Este change se apoya en ADR-0002 (un núcleo bash y un adaptador por agente) y fija en uno nuevo que en Windows solo se soporta OpenCode 2, con Git Bash (D1).
