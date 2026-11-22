# session-bootstrap Specification

## Purpose
Al abrir una sesión de un agente soportado (Claude Code u OpenCode 2 o superior), local o en la nube, el proyecto queda listo para trabajar con OpenSpec sin pasos manuales: el CLI de OpenSpec del proyecto está disponible en su versión fijada y las dependencias del proyecto y de sus tests de aceptación están instaladas, sin que ningún fallo impida que la sesión arranque, y los avisos del arranque se muestran al usuario en la interfaz del agente.

## Requirements

### Requirement: CLI de OpenSpec del proyecto disponible al abrir sesión
Al abrir una sesión de un agente soportado en el proyecto, el arranque de sesión DEBE dejar disponible el `openspec` del proyecto, en la versión fijada por su `package.json`, con prioridad sobre cualquier `openspec` instalado globalmente en la máquina. Los agentes soportados son Claude Code y OpenCode 2 o superior. Si la sesión no permite ajustar el `PATH`, el arranque de sesión DEBE avisar de ello e indicar cómo ejecutar el CLI del proyecto. Avisar significa mostrar el mensaje al usuario en la interfaz del agente (en OpenCode, en su interfaz de terminal); dejarlo solo en un log o en una salida que el agente no muestra no cuenta como aviso.

#### Scenario: Clon recién creado

```gherkin
Given un clon del proyecto sin dependencias instaladas
And una máquina con Node.js 22.12 o superior y npm
When se abre una sesión de Claude Code en el proyecto
Then `openspec --version` en la sesión muestra la versión fijada por el proyecto
```

#### Scenario: Clon recién creado en OpenCode

```gherkin
Given un clon del proyecto sin dependencias instaladas
And una máquina con Node.js 22.12 o superior y npm
When se abre una sesión de OpenCode en el proyecto
Then `openspec --version` en la sesión muestra la versión fijada por el proyecto
```

#### Scenario: La máquina tiene otra versión de OpenSpec instalada globalmente

```gherkin
Given una máquina con otra versión de OpenSpec instalada globalmente
And un clon del proyecto con sus dependencias instaladas
When se abre una sesión de Claude Code en el proyecto
Then `openspec --version` en la sesión muestra la versión fijada por el proyecto
```

#### Scenario: La máquina tiene otra versión de OpenSpec instalada globalmente en OpenCode

```gherkin
Given una máquina con otra versión de OpenSpec instalada globalmente
And un clon del proyecto con sus dependencias instaladas
When se abre una sesión de OpenCode en el proyecto
Then `openspec --version` en la sesión muestra la versión fijada por el proyecto
```

#### Scenario: La sesión no permite ajustar el PATH

```gherkin
Given un clon del proyecto con sus dependencias instaladas
And una versión de Claude Code que no permite ajustar el PATH de la sesión
When se abre una sesión de Claude Code en el proyecto
Then se avisa de que el PATH no se ha podido ajustar
And el aviso indica que el CLI del proyecto se ejecuta con `npx openspec`
```

#### Scenario: La sesión no permite ajustar el PATH en OpenCode

```gherkin
Given un clon del proyecto con sus dependencias instaladas
And una versión de OpenCode que no permite ajustar el PATH de la sesión
When se abre una sesión de OpenCode en el proyecto
Then se avisa de que el PATH no se ha podido ajustar
And el aviso indica que el CLI del proyecto se ejecuta con `npx openspec`
```

### Requirement: Instalación de todas las dependencias del proyecto
El arranque de sesión DEBE instalar todas las dependencias declaradas por el proyecto, no solo OpenSpec, en las sesiones de cualquier agente soportado, tanto locales como en la nube. Si el proyecto tiene un proyecto de tests de aceptación en `acceptance-tests/`, DEBE instalar también sus dependencias.

#### Scenario: Proyecto derivado con dependencias propias

```gherkin
Given un proyecto creado desde la plantilla que declara dependencias propias además de OpenSpec
And ninguna de sus dependencias está instalada
When se abre una sesión en el proyecto
Then todas las dependencias declaradas por el proyecto quedan instaladas
```

#### Scenario: Proyecto con tests de aceptación

```gherkin
Given un proyecto con un proyecto de tests de aceptación en `acceptance-tests/`
And ninguna de sus dependencias está instalada
When se abre una sesión en el proyecto
Then las dependencias del proyecto de tests de aceptación quedan instaladas
```

### Requirement: Reinstalación solo cuando algo ha cambiado
El arranque de sesión DEBE omitir la instalación de un proyecto (la raíz o `acceptance-tests/`) cuando sus dependencias ya se instalaron con éxito con el mismo `package.json`, el mismo `package-lock.json` y el mismo script de arranque, y DEBE reinstalarlas cuando cualquiera de los tres haya cambiado. Una instalación hecha al abrir una sesión de un agente soportado vale para las sesiones de cualquier otro agente soportado.

#### Scenario: Dependencias al día

```gherkin
Given las dependencias del proyecto se instalaron con éxito con los archivos actuales
When se abre una sesión en el proyecto
Then no se lanza ninguna instalación
And `openspec --version` en la sesión muestra la versión fijada por el proyecto
```

#### Scenario: Las dependencias cambiaron desde la última instalación

```gherkin
Given las dependencias del proyecto se instalaron con éxito
And después cambió la lista de dependencias del proyecto
When se abre una sesión en el proyecto
Then las dependencias se instalan de nuevo según la lista actual
```

#### Scenario: Las dependencias de los tests de aceptación cambiaron

```gherkin
Given las dependencias del proyecto de tests de aceptación se instalaron con éxito
And después cambió la lista de dependencias de los tests de aceptación
When se abre una sesión en el proyecto
Then las dependencias de los tests de aceptación se instalan de nuevo según la lista actual
And las dependencias de la raíz no se instalan de nuevo
```

#### Scenario: Cambiar de agente no reinstala

```gherkin
Given las dependencias del proyecto se instalaron con éxito al abrir una sesión de Claude Code
When se abre una sesión de OpenCode en el proyecto
Then no se lanza ninguna instalación
```

### Requirement: Aviso sin instalar cuando el entorno no cumple los requisitos
Cuando la máquina no tiene npm, o tiene una versión de Node.js inferior a la que exige el proyecto, el arranque de sesión DEBE avisar del requisito incumplido, mostrando el aviso al usuario en la interfaz del agente soportado que se haya abierto, NO DEBE intentar instalar nada y NO DEBE impedir que la sesión arranque.

#### Scenario: Máquina sin npm

```gherkin
Given una máquina sin npm
When se abre una sesión de Claude Code en el proyecto
Then la sesión arranca con normalidad
And se avisa de que hace falta Node.js con npm
And no se lanza ninguna instalación
```

#### Scenario: Máquina sin npm en OpenCode

```gherkin
Given una máquina sin npm
When se abre una sesión de OpenCode en el proyecto
Then la sesión arranca con normalidad
And se avisa de que hace falta Node.js con npm
And no se lanza ninguna instalación
```

#### Scenario: Versión de Node.js inferior a la requerida

```gherkin
Given una máquina con Node.js 20
And el proyecto exige Node.js 22.12 o superior
When se abre una sesión en el proyecto
Then la sesión arranca con normalidad
And el aviso indica la versión requerida y la versión encontrada
And no se lanza ninguna instalación
```

### Requirement: Un fallo de instalación no bloquea la sesión
Si la instalación de dependencias falla, el arranque de sesión DEBE avisar del fallo, mostrando el aviso al usuario en la interfaz del agente soportado que se haya abierto, NO DEBE impedir que la sesión arranque y DEBE volver a intentar la instalación en la siguiente sesión, sea del agente que sea.

#### Scenario: Sin acceso al registro de paquetes

```gherkin
Given un clon del proyecto sin dependencias instaladas
And la máquina no puede acceder al registro de paquetes
When se abre una sesión de Claude Code en el proyecto
Then la sesión arranca con normalidad
And se avisa de que la instalación de dependencias falló
```

#### Scenario: Sin acceso al registro de paquetes en OpenCode

```gherkin
Given un clon del proyecto sin dependencias instaladas
And la máquina no puede acceder al registro de paquetes
When se abre una sesión de OpenCode en el proyecto
Then la sesión arranca con normalidad
And se avisa de que la instalación de dependencias falló
```

#### Scenario: Reintento tras una instalación fallida

```gherkin
Given la última instalación de dependencias falló
And la máquina vuelve a tener acceso al registro de paquetes
When se abre una sesión en el proyecto
Then las dependencias del proyecto quedan instaladas
```

### Requirement: Motor del wiki instalado al abrir sesión
Al abrir una sesión de un agente soportado en un proyecto con el wiki habilitado, el arranque de sesión DEBE dejar disponible para ese agente el motor del wiki en la versión fijada por el proyecto: lo instala si falta, lo sustituye si hay otra versión y no hace nada si ya está la fijada. Con el wiki deshabilitado, NO DEBE instalarlo y DEBE dejar de exponerlo al agente si lo exponía. Lo que instale o retire dentro del clon NO DEBE quedar versionado.

#### Scenario Outline: Clon recién creado

```gherkin
Given un clon del proyecto con el wiki habilitado y sin el motor del wiki instalado
When se abre una sesión de <agente> en el proyecto
Then el motor del wiki queda disponible para <agente> en la versión fijada por el proyecto
And git no muestra como cambio nada de lo instalado

Examples:
  | agente      |
  | Claude Code |
  | OpenCode    |
```

#### Scenario Outline: El motor ya está en la versión fijada

```gherkin
Given un clon del proyecto con el wiki habilitado
And el motor del wiki está instalado para <agente> en la versión fijada por el proyecto
When se abre una sesión de <agente> en el proyecto
Then no se lanza ninguna instalación del motor del wiki

Examples:
  | agente      |
  | Claude Code |
  | OpenCode    |
```

#### Scenario Outline: El motor está instalado en otra versión

```gherkin
Given un clon del proyecto con el wiki habilitado
And el motor del wiki está instalado para <agente> en una versión distinta de la fijada por el proyecto
When se abre una sesión de <agente> en el proyecto
Then el motor del wiki queda disponible para <agente> en la versión fijada por el proyecto

Examples:
  | agente      |
  | Claude Code |
  | OpenCode    |
```

#### Scenario Outline: El wiki se ha deshabilitado con el motor instalado

```gherkin
Given el motor del wiki está instalado y expuesto a <agente>
And el wiki del proyecto se ha deshabilitado
When se abre una sesión de <agente> en el proyecto
Then el motor del wiki no está disponible para <agente>
And git no muestra como cambio nada de lo retirado

Examples:
  | agente      |
  | Claude Code |
  | OpenCode    |
```

### Requirement: Un fallo al instalar el motor del wiki no bloquea la sesión
Si la instalación del motor del wiki falla, el arranque de sesión DEBE avisar del fallo indicando cómo instalarlo a mano, NO DEBE impedir que la sesión arranque y DEBE volver a intentarlo en la siguiente sesión.

#### Scenario Outline: Sin acceso al repositorio del motor

```gherkin
Given un clon del proyecto con el wiki habilitado y sin el motor del wiki instalado
And la máquina no puede acceder al repositorio del motor del wiki
When se abre una sesión de <agente> en el proyecto
Then la sesión arranca con normalidad
And se avisa de que la instalación del motor del wiki falló
And el aviso indica cómo instalarlo a mano

Examples:
  | agente      |
  | Claude Code |
  | OpenCode    |
```

#### Scenario Outline: Reintento tras una instalación del motor fallida

```gherkin
Given un clon del proyecto con el wiki habilitado
And la última instalación del motor del wiki para <agente> falló
And la máquina vuelve a tener acceso al repositorio del motor del wiki
When se abre una sesión de <agente> en el proyecto
Then el motor del wiki queda disponible para <agente> en la versión fijada por el proyecto

Examples:
  | agente      |
  | Claude Code |
  | OpenCode    |
```

### Requirement: Guía y recordatorio del wiki entregados por el arranque
En cada agente soportado, con el wiki del proyecto habilitado, el adaptador del arranque de sesión DEBE ser quien entregue al agente la guía del wiki, al empezar la sesión, y el recordatorio, con cada mensaje del usuario. Con el wiki deshabilitado NO DEBE entregar ninguno de los dos. El proyecto NO DEBE entregar la guía por archivos de instrucciones que el agente cargue siempre, porque entonces deshabilitar el wiki no la quitaría.

#### Scenario Outline: La guía llega por el adaptador del arranque

```gherkin
Given un clon del proyecto con el wiki habilitado
When se abre una sesión de <agente> en el proyecto
Then el adaptador del arranque de <agente> entrega la guía del wiki
And el proyecto no tiene archivos de instrucciones que <agente> cargue siempre con la guía del wiki

Examples:
  | agente      |
  | Claude Code |
  | OpenCode    |
```

### Requirement: Clon completo y ramas permanentes al día al abrir sesión
Al abrir una sesión, el arranque DEBE completar el clon si es superficial. También DEBE poner al día cada rama permanente local que esté atrasada respecto a `origin/<rama>` y la contenga. No DEBE tocar ninguna rama sacada en un directorio del clon (el principal o un worktree), ni una rama permanente local que haya divergido de la remota; de esta última DEBE avisar. Si no puede completar el clon o poner al día una rama, DEBE avisar, y la sesión DEBE arrancar igualmente.

#### Scenario: Un clon superficial queda completo

```gherkin
Given un clon superficial del proyecto
When se abre una sesión en el proyecto
Then el clon deja de ser superficial
```

#### Scenario Outline: Qué hace el arranque con la rama permanente local

```gherkin
Given un clon del proyecto en la rama temporal `claude/exportar`
And la rama permanente local `main` <estado>
When se abre una sesión en el proyecto
Then <resultado>

Examples:
  | estado                                  | resultado                                                     |
  | está atrasada respecto a `origin/main`  | `main` apunta al mismo commit que `origin/main`               |
  | está al día con `origin/main`           | `main` no cambia                                              |
  | ha divergido de `origin/main`           | `main` no cambia y se avisa de que ha divergido               |
```

#### Scenario: La rama en la que está el clon no se toca

```gherkin
Given un clon del proyecto en la rama permanente `main`
And `main` está atrasada respecto a `origin/main`
When se abre una sesión en el proyecto
Then `main` no cambia
And el árbol de trabajo no cambia
```

#### Scenario: Una rama sacada en otro directorio del clon no se toca

```gherkin
Given el directorio principal del clon en la rama permanente `main`
And `main` está atrasada respecto a `origin/main`
And un worktree del clon en la rama temporal `exportar-datos`
When se abre una sesión en el worktree
Then `main` no cambia
And el árbol de trabajo y el índice del directorio principal no cambian
```

#### Scenario: Sin acceso al remoto, la sesión arranca

```gherkin
Given un clon superficial del proyecto sin acceso a su remoto
When se abre una sesión en el proyecto
Then se avisa de que no se pudo completar el clon
And la sesión arranca
```

### Requirement: Rama de la sesión guardada en un contenedor efímero
Al abrir una sesión en un contenedor efímero (`CLAUDE_CODE_CONTAINER_ID` no vacía y `CLAUDE_CODE_REMOTE=true`), el arranque DEBE guardar la rama en la que está el clon en `git config idd.sessionBranch`, si no hay ninguna guardada. NO DEBE escribir nada en el árbol de trabajo. Fuera de un contenedor efímero NO DEBE guardar ninguna rama.

#### Scenario Outline: Qué rama de la sesión queda guardada

```gherkin
Given un clon del proyecto en la rama `claude/exportar`
And <sesión>
When se abre una sesión en el proyecto
Then <resultado>
And el árbol de trabajo no cambia

Examples:
  | sesión                                                         | resultado                                         |
  | la sesión está en un contenedor efímero sin rama guardada      | la rama de la sesión guardada es `claude/exportar` |
  | la sesión está en un contenedor efímero con `claude/inicial` guardada | la rama de la sesión guardada es `claude/inicial`  |
  | la sesión no está en un contenedor efímero                     | no hay rama de la sesión guardada                 |
```

### Requirement: En OpenCode, la parte de TUI libera su suscripción a los avisos
En OpenCode, la parte de TUI del adaptador del arranque de sesión DEBE dar de baja su suscripción a los avisos de la parte de servidor cuando OpenCode la descarga: antes de cada recarga en caliente y al cerrarse la TUI. Tras una recarga, cada aviso nuevo DEBE mostrarse una sola vez. Al cerrar una TUI que lleva su propio servidor (`opencode --standalone`), el adaptador NO DEBE dejar ningún error en el terminal.

#### Scenario: Tras recargar, cada aviso nuevo se muestra una vez

```gherkin
Given una sesión de OpenCode abierta en la TUI en el proyecto
And OpenCode ha recargado el plugin del arranque dos veces
When la parte de servidor del arranque emite un aviso nuevo
Then el aviso se muestra una sola vez en la TUI
```

#### Scenario: Al cerrar la TUI no queda ningún error

```gherkin
Given una sesión de OpenCode abierta en la TUI con su propio servidor, en el proyecto
When el usuario cierra la TUI
Then el terminal no muestra ningún error del arranque de sesión
```

### Requirement: Finales de línea del repositorio en cualquier clon
El repositorio DEBE fijar finales de línea LF en todos sus archivos de texto, entre ellos los scripts del arranque de sesión y los textos que el arranque entrega o procesa (la guía y el recordatorio del wiki, la regla de comentarios y su recordatorio), para que un clon con `core.autocrlf=true`, el valor por defecto de Git for Windows, los extraiga con LF.

#### Scenario: Clon con conversión de finales de línea

```gherkin
Given un clon del proyecto con el wiki habilitado
And un clon del proyecto extraído con `core.autocrlf=true`
When se abre una sesión de OpenCode en el proyecto
Then los scripts del arranque de sesión del clon tienen finales de línea LF
And la guía del wiki se entrega sin los identificadores de sección
```
