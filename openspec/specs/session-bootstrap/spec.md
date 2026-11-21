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
