# llm-wiki

## ADDED Requirements

### Requirement: Dos modos del wiki habilitado, declarados en el ajuste del proyecto
Con el wiki del proyecto habilitado, el wiki DEBE tener dos modos, `full` y `lite`. El proyecto DEBE declarar el modo en un único ajuste versionado, `"mode"` en `.agents/wiki/engine.json`, y ese ajuste DEBE valer para todos los que usan el repositorio. Si el ajuste falta, el modo DEBE ser `full`, y la plantilla NO DEBE declararlo. Ninguna preferencia local de un usuario DEBE cambiar el modo. En los dos modos, el arranque de sesión DEBE instalar el motor del wiki, y el agente DEBE disponer de sus operaciones y recibir la guía del wiki de ese modo.

#### Scenario Outline: El wiki está en el modo que declara el proyecto

```gherkin
Given un clon del proyecto con el wiki habilitado <declaración>
When se abre una sesión de <agente> en el proyecto
Then el agente recibe la guía del wiki del modo <modo>
And el motor del wiki queda disponible para <agente> en la versión fijada por el proyecto

Examples:
  | agente      | declaración                         | modo |
  | Claude Code | sin declarar ningún modo            | full |
  | Claude Code | en el modo full                     | full |
  | Claude Code | en el modo lite                     | lite |
  | OpenCode    | sin declarar ningún modo            | full |
  | OpenCode    | en el modo full                     | full |
  | OpenCode    | en el modo lite                     | lite |
```

#### Scenario: La plantilla no declara el modo

```gherkin
Given la plantilla del proyecto
When se comprueba el ajuste del wiki del proyecto
Then no declara ningún modo del wiki
```

#### Scenario Outline: Una preferencia local no cambia el modo del proyecto

```gherkin
Given un clon del proyecto con el wiki habilitado en el modo full
And el usuario tiene `PROJECT_WIKI=lite` en el entorno de <agente>
When se abre una sesión de <agente> en el proyecto
Then el agente recibe la guía del wiki del modo full

Examples:
  | agente      |
  | Claude Code |
  | OpenCode    |
```

#### Scenario Outline: Con el wiki deshabilitado, el modo no importa

```gherkin
Given un clon del proyecto con el wiki deshabilitado y declarado el modo lite
When se abre una sesión de <agente> en el proyecto
Then no se instala el motor del wiki
And el agente no recibe la guía del wiki
And el agente no recibe el recordatorio del wiki con los mensajes

Examples:
  | agente      |
  | Claude Code |
  | OpenCode    |
```

### Requirement: Aviso ante un modo del wiki que no existe
Si el ajuste del proyecto declara un modo del wiki que no existe, con el wiki habilitado, el arranque de sesión DEBE avisar de ello y nombrar los modos que existen, NO DEBE impedir que la sesión arranque y DEBE dejar el wiki en el modo `full`.

#### Scenario Outline: El proyecto declara un modo que no existe

```gherkin
Given un clon del proyecto con el wiki habilitado en un modo que no existe
When se abre una sesión de <agente> en el proyecto
Then la sesión arranca con normalidad
And se avisa de que ese modo del wiki no existe
And el aviso nombra los modos `full` y `lite`
And el agente recibe la guía del wiki del modo full

Examples:
  | agente      |
  | Claude Code |
  | OpenCode    |
```

### Requirement: Cambiar el modo del wiki con /toggle-wiki lite y /toggle-wiki full
En cada agente soportado, `/toggle-wiki lite` y `/toggle-wiki full` DEBEN cambiar el modo declarado en el ajuste del proyecto. NO DEBEN habilitar ni deshabilitar el wiki, NO DEBEN cambiar nada más de `.agents/wiki/engine.json` ni de `openspec/config.yaml`, NO DEBEN hacer commits y DEBEN dejar el cambio en el stage de git. Con el wiki deshabilitado, DEBEN declarar el modo igualmente y el wiki DEBE seguir deshabilitado. Si el wiki ya está en ese modo, NO DEBEN cambiar nada y DEBEN decirlo. Con otro argumento, NO DEBEN cambiar nada y DEBEN nombrar los modos que existen. Al terminar, DEBEN informar de cómo queda el modo y de desde cuándo vale.

#### Scenario Outline: Cambiar el modo del wiki

```gherkin
Given un clon del proyecto con el wiki habilitado <antes>
When el usuario ejecuta `/toggle-wiki <modo>` en <agente>
Then el wiki del proyecto queda en el modo <modo>
And el wiki del proyecto sigue habilitado
And el resto de `.agents/wiki/engine.json` no ha cambiado
And `openspec/config.yaml` no ha cambiado
And el cambio queda en el stage de git, sin commit
And se informa de que el wiki queda en el modo <modo> y de qué vale desde el mensaje siguiente y desde la sesión siguiente

Examples:
  | agente      | antes                    | modo |
  | Claude Code | sin declarar ningún modo | lite |
  | Claude Code | en el modo lite          | full |
  | OpenCode    | sin declarar ningún modo | lite |
  | OpenCode    | en el modo lite          | full |
```

#### Scenario Outline: Cambiar el modo con el wiki deshabilitado

```gherkin
Given un clon del proyecto con el wiki deshabilitado
When el usuario ejecuta `/toggle-wiki lite` en <agente>
Then el modo del wiki queda declarado como lite
And el wiki del proyecto sigue deshabilitado
And no se instala el motor del wiki
And el cambio queda en el stage de git, sin commit
And se informa de que el wiki sigue deshabilitado y de que el modo valdrá cuando se habilite

Examples:
  | agente      |
  | Claude Code |
  | OpenCode    |
```

#### Scenario Outline: El wiki ya está en ese modo

```gherkin
Given un clon del proyecto con el wiki habilitado en el modo lite
When el usuario ejecuta `/toggle-wiki lite` en <agente>
Then ningún archivo del proyecto ha cambiado
And se informa de que el wiki ya estaba en el modo lite

Examples:
  | agente      |
  | Claude Code |
  | OpenCode    |
```

#### Scenario Outline: Un argumento que no es un modo

```gherkin
Given un clon del proyecto con el wiki habilitado en el modo full
When el usuario ejecuta `/toggle-wiki light` en <agente>
Then ningún archivo del proyecto ha cambiado
And se informa de que ese modo no existe
And se nombran los modos `full` y `lite`

Examples:
  | agente      |
  | Claude Code |
  | OpenCode    |
```

#### Scenario Outline: La sesión siguiente a cambiar el modo

```gherkin
Given un clon del proyecto en el que se acaba de cambiar el modo del wiki a lite con `/toggle-wiki lite`
When se abre una sesión de <agente> en el proyecto
Then el agente recibe la guía del wiki del modo lite

Examples:
  | agente      |
  | Claude Code |
  | OpenCode    |
```

## MODIFIED Requirements

### Requirement: Habilitar y deshabilitar el wiki con /toggle-wiki
En cada agente soportado DEBE haber un comando `/toggle-wiki`, propio del proyecto y disponible también con el wiki deshabilitado, que, sin argumento, cambia el ajuste del wiki del proyecto al estado contrario. Al habilitarlo, DEBE añadir a las indicaciones de archivado de `openspec/config.yaml` los pasos de resincronización del wiki; al deshabilitarlo, DEBE quitarlos. En los dos casos NO DEBE cambiar nada más de `openspec/config.yaml`, NO DEBE cambiar el modo declarado del wiki, NO DEBE hacer commits y DEBE dejar sus cambios en el stage de git. Al terminar, DEBE informar de cómo queda el wiki y de qué cambios valen solo desde la sesión siguiente. Al deshabilitar, `.wiki/` DEBE conservarse. Con un argumento, el comando cambia el modo del wiki, y se rige por su propio requisito.

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

#### Scenario Outline: Deshabilitar y habilitar el wiki conserva su modo

```gherkin
Given un clon del proyecto con el wiki habilitado en el modo lite
When el usuario ejecuta `/toggle-wiki` en <agente>
And el usuario ejecuta `/toggle-wiki` en <agente>
Then el wiki del proyecto queda habilitado en el modo lite

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
