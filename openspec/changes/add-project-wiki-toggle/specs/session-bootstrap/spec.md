# session-bootstrap

## MODIFIED Requirements

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
