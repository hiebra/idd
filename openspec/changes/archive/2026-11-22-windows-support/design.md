## Context

El arranque de sesión es un núcleo bash (`.agents/hooks/session-bootstrap.sh`) con un adaptador por agente (ADR-0002). En Windows solo se soporta OpenCode 2 (decisión del usuario, 2026-11-22).

Revisando el código para este change (2026-11-22), el proyecto no funciona en Windows con OpenCode aunque estén instalados Git for Windows, Node.js y Python. Hay causas en el núcleo del arranque (bash con CRLF, `ln -s` de Git Bash que copia, rutas `/c/...` frente a `C:\...`, el `bash` de WSL antes en el `PATH`). El change `windows-global-distro` las resuelve portando el núcleo a Node (ADR-0023, por decisión del usuario del 2026-11-22). Este change se reduce a lo que no depende de ese núcleo:

1. **Finales de línea.** No hay `.gitattributes`, y Git for Windows extrae con `core.autocrlf=true`. Bash falla con un `.sh` con CRLF (`$'\r': command not found`). Además, el núcleo filtra la guía y la regla con `sed '/^<!-- ... -->$/d'`, que no casa con un `\r` final. Cualquier otro texto versionado que el proyecto lea o ejecute tiene el mismo riesgo.
2. **El CLI en el autopilot.** `lib/project.mjs` ejecuta `node_modules/.bin/openspec` con `spawn` sin shell. En Windows ese archivo es un script sh. Su `openspec.cmd` tampoco sirve: desde Node.js 18.20.2 y 20.12.2, `spawn` rechaza los `.cmd` y `.bat` sin `shell: true`.

También hace falta saber qué le falta a una máquina concreta, sobre todo sin internet. Para eso está el diagnóstico `scripts/windows/Test-OfflineInstall.ps1`, cuya primera versión ya está en la rama y no se ha probado en Windows.

## Goals / Non-Goals

**Goals:**

- Que el repositorio se extraiga con LF en cualquier sistema.
- Que el autopilot ejecute el CLI del proyecto en cualquier sistema.
- Un diagnóstico que diga qué falta en una máquina Windows, con la alternativa en el repositorio y la global, cubierto por la suite en lo que se puede probar fuera de Windows.
- Todo sin cambiar el comportamiento en Linux y macOS.

**Non-Goals:**

- El núcleo del arranque en Windows: Git Bash, symlinks, rutas y el bash que lanza OpenCode. Lo resuelve `windows-global-distro`.
- Incorporar binarios o datos al repositorio (`vendor/windows/`). El diagnóstico los nombra, pero montar el vendor irá en otro change.
- Claude Code en Windows: el diagnóstico no lo da por bueno.
- Ejecutar la suite de aceptación en Windows.
- La verificación en Windows 11 real: se hace una vez, con este change y `windows-global-distro` fusionados, en el que se fusione el último.

## Decisions

### D1. Este change no toca el núcleo del arranque

En Windows solo se soporta OpenCode 2. Es una restricción de plataforma, no una capacidad de un solo agente (ADR-0006): en Linux y macOS los dos agentes siguen igual. Cómo se ejecuta el arranque en Windows lo decide `windows-global-distro` con un núcleo en Node (ADR-0023).

Una primera versión de este change resolvía el núcleo en Windows con Git Bash: symlinks nativos con `MSYS=winsymlinks:nativestrict`, rutas relativas en la salida del núcleo y la búsqueda de Git Bash en el plugin de OpenCode. Se implementó (tasks 2.2 a 2.7 de la primera versión) y se ha revertido al decidir el núcleo en Node, para que los dos changes no se pisen.

Orden de integración, acordado con la sesión de `windows-global-distro`:

1. Primero se fusiona y archiva este change.
2. Después, `windows-global-distro` hace `git merge` de la rama de origen y rehace sus deltas de `session-bootstrap` y `openspec-autopilot` sobre las specs ya archivadas. Si el requisito de LF ya no le sirve, lo retira con REMOVED y su motivo. También adapta el diagnóstico a su instalación global y hace la verificación en Windows 11 real.

### D2. LF en todo el repositorio con `.gitattributes`

Se añade `.gitattributes` con `* text=auto eol=lf`: todo archivo de texto se extrae con LF en cualquier sistema, y git sigue detectando los binarios. El script PowerShell no necesita CRLF; lo que necesita para Windows PowerShell 5.1 es el BOM UTF-8, que ya tiene y que `eol` no toca.

Alternativa: fijar LF solo en `*.sh` y en los textos que procesa el núcleo. Cada texto nuevo obligaría a acordarse de añadirlo, y el fallo solo se vería en Windows.

La suite lo prueba con un clon real de la copia del proyecto con `core.autocrlf=true`, sobre el que se abre una sesión de OpenCode.

### D3. El autopilot ejecuta el CLI con Node, sin el enlace de binarios

El plugin pasa a resolver el CLI del proyecto desde `node_modules/@fission-ai/openspec/package.json` (su campo `bin.openspec`) y lo ejecuta con el `node` del `PATH`, es decir, `node <script>`. No usa `process.execPath`: en OpenCode es el propio binario de OpenCode, compilado con Bun, no Node (se vio al implementar la task 3.1). El `node` del `PATH` es el que exige el proyecto. Funciona igual en todos los sistemas y no depende de `node_modules/.bin/`. Si el paquete no está instalado, usa el `openspec` del `PATH`, como hasta ahora.

Alternativa: `spawn` con `shell: true` en Windows. Habría que citar los argumentos (hay rutas y textos del usuario) y el comportamiento sería distinto en cada sistema.

La suite lo prueba con un `node_modules/.bin/openspec` que no es ejecutable, como en Windows.

### D4. El diagnóstico separa lo que recoge de lo que evalúa

El script se divide en dos partes:

- **`Get-ReadinessFacts`** recoge los hechos de la máquina:
  - qué ejecutables hay y sus versiones;
  - si un Python es el alias de la Microsoft Store;
  - los archivos de texto versionados del clon con CRLF;
  - el sello del motor y `engine.json`;
  - los lockfiles, con lo instalado y lo que hay en las cachés de npm;
  - la configuración de npm.
- **`Get-ReadinessReport`** convierte esos hechos en el informe (estado, detalle, repo, global, obtener) sin tocar la máquina.

El script recoge, evalúa e imprime. Con `-FactsFile <json>` evalúa unos hechos dados, sin recogerlos. Eso es lo que usa la suite: cada «Given una máquina Windows ...» construye los hechos de esa máquina, y el paso ejecuta el script con `pwsh`. Así se prueban fuera de Windows todas las reglas de `windows-readiness`, y no queda ninguna lógica de decisión sin probar en la recogida.

La recogida solo se puede probar en Windows. Se comprueba a mano en una máquina Windows 11 real, con Windows PowerShell 5.1 y con PowerShell 7, en `windows-global-distro` (D1).

El diagnóstico deja de comprobar lo que dependía del núcleo bash: Git Bash y sus utilidades, `MSYS`, qué bash va primero en el `PATH`, los symlinks, el Modo de desarrollador y el nombre `python3`. Comprueba los finales de línea del clon, y como agente solo da por bueno OpenCode 2 (spec `windows-readiness`).

La suite ejecuta el script con `pwsh` (PowerShell 7), así que `pwsh` pasa a ser requisito de la suite, como ya lo es el acceso al registro de npm (decisión del usuario, 2026-11-22). Si falta, los escenarios de `windows-readiness` fallan con un mensaje que lo dice, en lugar de saltarse. En la nube lo instala el script de configuración del entorno `idd`.

Alternativas:

- **Probar el script en Windows con agentes de CI.** El proyecto no tiene CI, y la suite se ejecuta en la sesión del agente.
- **Un lanzador PowerShell mínimo y un diagnóstico bash**, que la suite probaría sin `pwsh`. Seguiría habiendo PowerShell sin probar, y la lógica quedaría en dos lenguajes.
- **Etiquetar los escenarios y excluirlos cuando no hay `pwsh`.** Habría que cambiar `cucumber.cjs`, que es copia literal de la skill, y la suite quedaría en verde sin haberlos probado.

## Risks / Trade-offs

- **[Riesgo] `* text=auto eol=lf` cambia los archivos de los clones Windows que ya existen.** Git renormaliza al hacer commit y puede mostrar cambios de solo finales de línea. → El README y el diagnóstico dan los comandos para volver a extraer el árbol con LF. En Linux y macOS no cambia nada, porque ya es LF.
- **[Riesgo] Los deltas de `windows-global-distro` pisan los de este change al archivarse.** → Orden de integración de D1: ese change rehace sus deltas sobre las specs ya archivadas.
- **[Compromiso] Hasta que se fusione `windows-global-distro`, el proyecto sigue sin arrancar en Windows.** → Este change no lo promete: el README dice que el arranque en Windows llega con ese change.
- **[Riesgo] La recogida de hechos del diagnóstico no la cubre la suite.** → Está separada de la evaluación y es lineal (leer, no decidir), y se verifica a mano en Windows con las dos versiones de PowerShell.
- **[Compromiso] La suite necesita `pwsh`** en la máquina en la que se ejecuta. → Sin él, los escenarios de `windows-readiness` fallan con un mensaje que lo dice. El README de la suite lo pone entre los requisitos.

## Migration Plan

1. Se fusiona el change. Los clones Linux y macOS no notan nada.
2. En un clon Windows que ya existe, volver a extraer el árbol con LF (`git rm -r --cached -q . && git reset --hard`, con el árbol limpio). El diagnóstico lo detecta y da el comando.

Rollback: revertir los commits del change. `.gitattributes` se puede retirar sin efectos en Linux y macOS.

## Open Questions

1. **ADRs vigentes.** No hay que sustituir ninguno. ADR-0017, de este change, fija que en Windows solo se soporta OpenCode 2, LF en el repositorio y un diagnóstico en PowerShell. No decide nada sobre el núcleo, que fija ADR-0023 en `windows-global-distro`. Por eso ADR-0023 no debe sustituir a ADR-0017; se lo ha pedido a esa sesión.
