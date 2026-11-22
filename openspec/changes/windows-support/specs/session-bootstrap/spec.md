# session-bootstrap

## ADDED Requirements

### Requirement: Finales de línea del repositorio en cualquier clon
El repositorio DEBE fijar finales de línea LF en los scripts del arranque de sesión y de los hooks y en los textos que el arranque entrega o procesa (la guía y el recordatorio del wiki, la regla de comentarios y su recordatorio), para que un clon con `core.autocrlf=true`, el valor por defecto de Git for Windows, los extraiga con LF.

#### Scenario: Clon con conversión de finales de línea

```gherkin
Given un clon del proyecto extraído con `core.autocrlf=true`
When se abre una sesión de Claude Code en el proyecto
Then los scripts del arranque de sesión del clon tienen finales de línea LF
And la guía del wiki se entrega sin los identificadores de sección
```

### Requirement: Enlaces del motor del wiki nativos en Git Bash
En Git Bash, el arranque de sesión DEBE crear los enlaces del motor del wiki como symlinks nativos, no como copias, para reconocerlos como suyos en las sesiones siguientes. Si no puede crearlos, DEBE avisar, como en cualquier otro sistema.

#### Scenario: Git Bash copia en lugar de enlazar si no se le pide

```gherkin
Given una máquina con Git Bash, cuyo `ln -s` copia salvo que se pidan symlinks nativos
And un clon del proyecto sin el motor del wiki instalado
When se abre una sesión de Claude Code en el proyecto
Then los enlaces del motor del wiki son symlinks
```

#### Scenario: La sesión siguiente reconoce los enlaces

```gherkin
Given una máquina con Git Bash, cuyo `ln -s` copia salvo que se pidan symlinks nativos
And una sesión anterior instaló el motor del wiki en el proyecto
When se abre una sesión de Claude Code en el proyecto
Then no se avisa de que ya existe algo que no es del motor del wiki
```

### Requirement: Rutas de la sesión en el formato del agente
Las rutas que el arranque de sesión deja en la sesión (el directorio de binarios del proyecto en el `PATH` y `CLAUDE_PLUGIN_ROOT`) DEBEN estar en el formato con el que el agente nombra el proyecto, aunque bash vea el proyecto con otra ruta, como ocurre en Git Bash (`/c/...` frente a `C:\...`).

#### Scenario: OpenCode nombra el proyecto con otra ruta que bash

```gherkin
Given un clon del proyecto con sus dependencias instaladas
And bash ve el proyecto con una ruta distinta de la que usa OpenCode
When se abre una sesión de OpenCode en el proyecto
Then el directorio de binarios del proyecto llega al PATH de la sesión con la ruta que usa OpenCode
And `CLAUDE_PLUGIN_ROOT` en la sesión está bajo la ruta que usa OpenCode
```

### Requirement: En Windows, OpenCode ejecuta el arranque con Git Bash
En Windows, el plugin de OpenCode DEBE ejecutar el núcleo del arranque de sesión con el bash de Git for Windows, aunque haya otro `bash` antes en el `PATH` (por ejemplo, el de WSL). Si no encuentra Git for Windows, DEBE avisar de que hace falta y NO DEBE impedir que la sesión arranque.

#### Scenario: El bash de WSL va antes en el PATH

```gherkin
Given una máquina Windows con Git for Windows
And el primer bash del PATH es el de WSL
When se abre una sesión de OpenCode en el proyecto
Then el arranque de sesión se ejecuta con el bash de Git for Windows
And `openspec --version` en la sesión muestra la versión fijada por el proyecto
```

#### Scenario: Windows sin Git for Windows

```gherkin
Given una máquina Windows sin Git for Windows
When se abre una sesión de OpenCode en el proyecto
Then se avisa de que el arranque de sesión necesita Git for Windows
And la sesión arranca
```
