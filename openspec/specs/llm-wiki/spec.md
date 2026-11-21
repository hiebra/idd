# llm-wiki Specification

## Purpose
TBD - created by archiving change add-llm-wiki-support. Update Purpose after archive.

## Requirements

### Requirement: Motor del wiki disponible en cada agente soportado
En cada agente soportado (Claude Code y OpenCode 2 o superior) DEBEN estar disponibles, sin configurar nada tras clonar salvo lo que haga el arranque de sesión, la consulta de solo lectura del wiki y la gestión del wiki (investigar, ingerir, compilar, revisar), ambas del motor del wiki en la versión fijada por el proyecto. El motor del wiki es la herramienta externa que aporta esas operaciones, hoy nvk/llm-wiki; cambiar de motor no cambia estos requisitos.

#### Scenario Outline: El agente dispone de las operaciones del wiki

```gherkin
Given un clon del proyecto en el que ya se ha abierto una sesión de <agente>
When <agente> carga las instrucciones, skills y plugins del proyecto
Then dispone de la consulta de solo lectura del wiki
And dispone de la gestión del wiki
And las dos corresponden a la versión del motor fijada por el proyecto

Examples:
  | agente      |
  | Claude Code |
  | OpenCode    |
```

### Requirement: Una sola versión fijada del motor
El proyecto DEBE declarar la versión del motor del wiki en un único sitio, y todos los agentes soportados DEBEN usar esa versión. Cambiar la versión declarada DEBE bastar para que, desde la siguiente sesión, cada agente use la nueva.

#### Scenario: Los dos agentes usan la misma versión

```gherkin
Given un clon del proyecto en el que ya se han abierto sesiones de Claude Code y de OpenCode
When se comprueba qué versión del motor usa cada agente
Then los dos usan la versión fijada por el proyecto
```

#### Scenario Outline: Subir la versión del motor

```gherkin
Given un clon del proyecto que usa una versión del motor
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
Given un clon del proyecto sin wiki del proyecto
When el motor inicializa el wiki del proyecto
Then el wiki del proyecto queda en `.wiki/`
And git no ignora ningún archivo de `.wiki/`
```

### Requirement: Hub del usuario opcional
El hub del usuario DEBE ser opcional. Su ausencia, por ejemplo en una sesión en la nube, NO DEBE producir avisos ni errores, y el wiki del proyecto DEBE seguir disponible.

#### Scenario Outline: Máquina sin hub del usuario

```gherkin
Given una máquina sin hub del usuario
And un clon del proyecto
When se abre una sesión de <agente> en el proyecto
Then la sesión arranca con normalidad
And no se avisa de nada relacionado con el hub
And el wiki del proyecto está disponible

Examples:
  | agente      |
  | Claude Code |
  | OpenCode    |
```

### Requirement: Desactivable en local
Cada usuario DEBE poder desactivar el wiki para sí mismo, en cada agente soportado, sin cambiar ningún archivo versionado del proyecto. Con el wiki desactivado, el arranque de sesión NO DEBE instalar el motor y el agente NO DEBE recibir la guía ni el recordatorio del wiki.

#### Scenario Outline: El usuario desactiva el wiki

```gherkin
Given un clon del proyecto
And el usuario ha desactivado el wiki para sí mismo en <agente>
When se abre una sesión de <agente> en el proyecto
Then no se instala el motor del wiki
And el agente no recibe la guía del wiki
And el agente no recibe el recordatorio del wiki con los mensajes
And ningún archivo versionado del proyecto ha cambiado

Examples:
  | agente      |
  | Claude Code |
  | OpenCode    |
```
