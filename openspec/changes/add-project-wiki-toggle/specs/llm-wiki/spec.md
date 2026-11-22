# llm-wiki

## ADDED Requirements

### Requirement: Wiki deshabilitado por defecto, con un ajuste del proyecto
El proyecto DEBE declarar en un único ajuste versionado si su wiki está habilitado, y ese ajuste DEBE valer para todos los que usan el repositorio. La plantilla DEBE traer el wiki deshabilitado. Ninguna preferencia local de un usuario DEBE cambiar lo que dice el ajuste. Con el wiki deshabilitado, el arranque de sesión NO DEBE instalar el motor, el agente NO DEBE recibir la guía ni el recordatorio del wiki, las indicaciones de archivado NO DEBEN mencionar el wiki y `.wiki/`, si existe, DEBE conservarse.

#### Scenario Outline: Un proyecto con el wiki deshabilitado

```gherkin
Given un clon del proyecto con el wiki deshabilitado
When se abre una sesión de <agente> en el proyecto
Then no se instala el motor del wiki
And el agente no recibe la guía del wiki
And el agente no recibe el recordatorio del wiki con los mensajes
And las indicaciones de archivado de OpenSpec no mencionan el wiki

Examples:
  | agente      |
  | Claude Code |
  | OpenCode    |
```

#### Scenario: La plantilla trae el wiki deshabilitado

```gherkin
Given la plantilla del proyecto
When se comprueba el ajuste del wiki del proyecto
Then el wiki está deshabilitado
```

#### Scenario Outline: Una preferencia local no apaga el wiki del proyecto

```gherkin
Given un clon del proyecto con el wiki habilitado
And el usuario tiene `PROJECT_WIKI=off` en el entorno de <agente>
When se abre una sesión de <agente> en el proyecto
Then el agente recibe la guía del wiki

Examples:
  | agente      |
  | Claude Code |
  | OpenCode    |
```

### Requirement: Habilitar y deshabilitar el wiki con /toggle-wiki
En cada agente soportado DEBE haber un comando `/toggle-wiki`, propio del proyecto y disponible también con el wiki deshabilitado, que cambia el ajuste del wiki del proyecto al estado contrario. Al habilitarlo, DEBE añadir a las indicaciones de archivado de `openspec/config.yaml` los pasos de resincronización del wiki; al deshabilitarlo, DEBE quitarlos. En los dos casos NO DEBE cambiar nada más de `openspec/config.yaml`, NO DEBE hacer commits y DEBE dejar sus cambios en el stage de git. Al terminar, DEBE informar de cómo queda el wiki y de qué cambios valen solo desde la sesión siguiente. Al deshabilitar, `.wiki/` DEBE conservarse.

#### Scenario Outline: Habilitar el wiki

```gherkin
Given un clon del proyecto con el wiki deshabilitado y con `.wiki/`
When el usuario ejecuta `/toggle-wiki` en <agente>
Then el wiki del proyecto queda habilitado
And las indicaciones de archivado de OpenSpec incluyen la resincronización del wiki
And el resto de `openspec/config.yaml` no ha cambiado
And los cambios quedan en el stage de git, sin commit
And se informa de que el wiki queda habilitado y de qué vale desde la sesión siguiente

Examples:
  | agente      |
  | Claude Code |
  | OpenCode    |
```

#### Scenario Outline: Deshabilitar el wiki

```gherkin
Given un clon del proyecto con el wiki habilitado
When el usuario ejecuta `/toggle-wiki` en <agente>
Then el wiki del proyecto queda deshabilitado
And las indicaciones de archivado de OpenSpec no mencionan el wiki
And el resto de `openspec/config.yaml` no ha cambiado
And `.wiki/` se conserva sin cambios
And los cambios quedan en el stage de git, sin commit
And se informa de que el wiki queda deshabilitado

Examples:
  | agente      |
  | Claude Code |
  | OpenCode    |
```

#### Scenario Outline: El comando está disponible con el wiki deshabilitado

```gherkin
Given un clon del proyecto con el wiki deshabilitado
When se abre una sesión de <agente> en el proyecto
Then el agente dispone del comando `/toggle-wiki`

Examples:
  | agente      |
  | Claude Code |
  | OpenCode    |
```

#### Scenario Outline: La sesión siguiente a habilitar el wiki

```gherkin
Given un clon del proyecto en el que se acaba de habilitar el wiki con `/toggle-wiki`
When se abre una sesión de <agente> en el proyecto
Then el motor del wiki queda disponible para <agente> en la versión fijada por el proyecto
And el agente recibe la guía del wiki

Examples:
  | agente      |
  | Claude Code |
  | OpenCode    |
```

### Requirement: Ingesta inicial al habilitar, con confirmación
Si al habilitar el wiki no existe `.wiki/`, `/toggle-wiki` DEBE proponer al usuario inicializar el wiki del proyecto y hacer la ingesta inicial del repositorio, mostrando qué entra como fuente y qué queda excluido (lo generado y lo que no aporta conocimiento). NO DEBE crear `.wiki/` ni ingerir nada hasta que el usuario lo confirme. Si el usuario no lo confirma, el wiki DEBE quedar deshabilitado y nada del proyecto DEBE cambiar.

#### Scenario: El usuario confirma la ingesta inicial

```gherkin
Given un clon del proyecto con el wiki deshabilitado y sin `.wiki/`
When el usuario ejecuta `/toggle-wiki`
And confirma la ingesta inicial que se le propone
Then el wiki del proyecto queda habilitado
And `.wiki/` tiene como fuentes los productos del proyecto, fijados al commit actual
And las fuentes no incluyen lo generado ni la copia del motor
```

#### Scenario: El usuario no confirma la ingesta inicial

```gherkin
Given un clon del proyecto con el wiki deshabilitado y sin `.wiki/`
When el usuario ejecuta `/toggle-wiki`
And no confirma la ingesta inicial que se le propone
Then el wiki del proyecto sigue deshabilitado
And no existe `.wiki/`
And ningún archivo del proyecto ha cambiado
```

## MODIFIED Requirements

### Requirement: Motor del wiki disponible en cada agente soportado
Con el wiki del proyecto habilitado, en cada agente soportado (Claude Code y OpenCode 2 o superior) DEBEN estar disponibles, sin configurar nada tras clonar salvo lo que haga el arranque de sesión, la consulta de solo lectura del wiki y la gestión del wiki (investigar, ingerir, compilar, revisar), ambas del motor del wiki en la versión fijada por el proyecto. El motor del wiki es la herramienta externa que aporta esas operaciones, hoy nvk/llm-wiki; cambiar de motor no cambia estos requisitos.

#### Scenario Outline: El agente dispone de las operaciones del wiki

```gherkin
Given un clon del proyecto con el wiki habilitado en el que ya se ha abierto una sesión de <agente>
When <agente> carga las instrucciones, skills y plugins del proyecto
Then dispone de la consulta de solo lectura del wiki
And dispone de la gestión del wiki
And las dos corresponden a la versión del motor fijada por el proyecto

Examples:
  | agente      |
  | Claude Code |
  | OpenCode    |
```

#### Scenario Outline: Sin operaciones del wiki con el wiki deshabilitado

```gherkin
Given un clon del proyecto con el wiki deshabilitado en el que ya se ha abierto una sesión de <agente>
When <agente> carga las instrucciones, skills y plugins del proyecto
Then no dispone de la consulta de solo lectura del wiki
And no dispone de la gestión del wiki

Examples:
  | agente      |
  | Claude Code |
  | OpenCode    |
```

### Requirement: Una sola versión fijada del motor
El proyecto DEBE declarar la versión del motor del wiki en un único sitio, y todos los agentes soportados DEBEN usar esa versión. Cambiar la versión declarada DEBE bastar para que, desde la siguiente sesión, cada agente use la nueva.

#### Scenario: Los dos agentes usan la misma versión

```gherkin
Given un clon del proyecto con el wiki habilitado en el que ya se han abierto sesiones de Claude Code y de OpenCode
When se comprueba qué versión del motor usa cada agente
Then los dos usan la versión fijada por el proyecto
```

#### Scenario Outline: Subir la versión del motor

```gherkin
Given un clon del proyecto con el wiki habilitado que usa una versión del motor
And después se cambia la versión fijada del motor
When se abre una sesión de <agente> en el proyecto
Then <agente> usa la nueva versión fijada

Examples:
  | agente      |
  | Claude Code |
  | OpenCode    |
```

### Requirement: Wiki del proyecto versionado
El wiki del proyecto DEBE vivir en `.wiki/`, en la raíz del repositorio, y git NO DEBE ignorar ninguno de sus archivos, tampoco cuando el motor intente ignorarlo al inicializarlo.

#### Scenario: Inicializar el wiki del proyecto

```gherkin
Given un clon del proyecto con el wiki habilitado y sin `.wiki/`
When el motor inicializa el wiki del proyecto
Then el wiki del proyecto queda en `.wiki/`
And git no ignora ningún archivo de `.wiki/`
```

### Requirement: Hub del usuario opcional
El hub del usuario DEBE ser opcional. Su ausencia, por ejemplo en una sesión en la nube, NO DEBE producir avisos ni errores, y el wiki del proyecto, si está habilitado, DEBE seguir disponible.

#### Scenario Outline: Máquina sin hub del usuario

```gherkin
Given una máquina sin hub del usuario
And un clon del proyecto con el wiki habilitado
When se abre una sesión de <agente> en el proyecto
Then la sesión arranca con normalidad
And no se avisa de nada relacionado con el hub
And el wiki del proyecto está disponible

Examples:
  | agente      |
  | Claude Code |
  | OpenCode    |
```

## REMOVED Requirements

### Requirement: Desactivable en local
**Reason**: El wiki es del proyecto: si un usuario lo apagara para sí, su archive se saltaría la resincronización y el wiki quedaría desfasado para todos. Además, ese apagado no llegaba a las indicaciones de archivado ni al autopilot.
**Migration**: Quita `PROJECT_WIKI` de `.claude/settings.local.json` y del entorno desde el que lanzas OpenCode, porque deja de tener efecto. Para apagar el wiki, ejecuta `/toggle-wiki` y haz el commit: el cambio vale para todo el proyecto.
