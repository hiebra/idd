# response-comments Specification

## Purpose
El usuario puede comentar partes de una intervención del agente sin que cada comentario dispare una respuesta, y decidir después si el agente los responde todos o reformula su intervención. La regla llega a cada agente soportado (Claude Code y OpenCode 2 o superior) por el arranque de sesión, desde una única fuente, y cada usuario puede desactivarla en local.

## Requirements

### Requirement: Regla de comentarios en cada agente soportado, desde una única fuente
El proyecto DEBE tener una única regla de comentarios, y el adaptador del arranque de sesión de cada agente soportado DEBE entregarla en el contexto de cada sesión, sin configurar nada tras clonar. El proyecto NO DEBE entregar la regla por archivos de instrucciones que el agente cargue siempre y el usuario no pueda desactivar.

#### Scenario Outline: El agente recibe la regla de comentarios

```gherkin
Given un clon del proyecto
When se abre una sesión de <agente> en el proyecto
Then el contexto de la sesión incluye la regla de comentarios
And esa regla procede del único archivo de la regla de comentarios del proyecto
And el proyecto no tiene archivos de instrucciones que <agente> cargue siempre con la regla de comentarios

Examples:
  | agente      |
  | Claude Code |
  | OpenCode    |
```

### Requirement: Un comentario no se responde
Un comentario es un mensaje del usuario que empieza por una cadena entre comillas simples (`'así'`). La regla DEBE indicar al agente que un comentario no se responde: el agente contesta solo con la frase fija "Puedes seguir comentando mi intervención, pedirme que conteste a todos tus comentarios introduciendo en el prompt la palabra "ya", o pedirme que reformule mi intervención introduciendo la palabra "reformula".", y acumula el comentario sin investigar ni modificar nada a raíz de él.

#### Scenario: La regla dice cómo contestar a un comentario

```gherkin
Given la regla de comentarios del proyecto
When se revisa qué indica sobre un mensaje que empieza por una cadena entre comillas simples
Then indica que es un comentario sobre la intervención anterior del agente
And indica contestar solo con la frase fija
And indica acumular el comentario sin investigar ni modificar nada a raíz de él
```

### Requirement: "ya" responde a todos los comentarios
La regla DEBE indicar al agente que, ante un mensaje con la palabra de cierre "ya", responda en un solo mensaje a todos los comentarios acumulados. Los comentarios acumulados son los que el usuario ha hecho desde la última respuesta completa del agente. Si ese mensaje es además un comentario, el agente lo acumula antes de responder.

#### Scenario: La regla dice qué hacer con "ya"

```gherkin
Given la regla de comentarios del proyecto
When se revisa qué indica sobre un mensaje con la palabra "ya"
Then indica responder en un solo mensaje a todos los comentarios acumulados
And indica incluir entre ellos el propio mensaje si es un comentario
```

### Requirement: "reformula" repite la intervención por sí sola
La regla DEBE indicar al agente que, ante un mensaje con la palabra de cierre "reformula", repita su intervención completa, reescrita para incorporar los comentarios acumulados. El agente DEBE asumir que el usuario solo ha leído las partes que citó, así que la intervención reformulada se entiende por sí sola: no remite a la anterior ni da por leído nada de lo que el usuario no comentó.

#### Scenario: La regla dice qué hacer con "reformula"

```gherkin
Given la regla de comentarios del proyecto
When se revisa qué indica sobre un mensaje con la palabra "reformula"
Then indica repetir la intervención completa incorporando los comentarios acumulados
And indica asumir que el usuario solo ha leído las partes que citó
And indica que la intervención reformulada no remite a la anterior
```

### Requirement: La regla se recuerda con los mensajes que la activan
Una palabra de cierre es "ya" o "reformula" como palabra completa, sin distinguir mayúsculas, en un mensaje del usuario y fuera de la cadena inicial entre comillas simples, si la hay. Con cada mensaje del usuario que sea un comentario o contenga una palabra de cierre, el adaptador del arranque de cada agente soportado DEBE entregar al agente, junto con el mensaje, un recordatorio breve de la regla de comentarios. Con los demás mensajes NO DEBE entregarlo.

#### Scenario Outline: El agente recibe el recordatorio con un mensaje que activa la regla

```gherkin
Given una sesión de <agente> abierta en el proyecto
When el usuario envía el mensaje <mensaje>
Then el agente recibe el mensaje junto con el recordatorio de la regla de comentarios

Examples:
  | agente      | mensaje                                      |
  | Claude Code | 'el segundo punto' no lo entiendo            |
  | Claude Code | ya                                           |
  | Claude Code | Reformula, por favor                         |
  | OpenCode    | 'el segundo punto' no lo entiendo            |
  | OpenCode    | ya                                           |
  | OpenCode    | Reformula, por favor                         |
```

#### Scenario Outline: El agente no recibe el recordatorio con otros mensajes

```gherkin
Given una sesión de <agente> abierta en el proyecto
When el usuario envía el mensaje <mensaje>
Then el agente recibe el mensaje sin el recordatorio de la regla de comentarios

Examples:
  | agente      | mensaje                                      |
  | Claude Code | "foo" no aparece en el log                   |
  | Claude Code | mayo empieza el lunes                        |
  | Claude Code | ¿lo reformulamos mañana?                     |
  | OpenCode    | "foo" no aparece en el log                   |
  | OpenCode    | mayo empieza el lunes                        |
  | OpenCode    | ¿lo reformulamos mañana?                     |
```

### Requirement: Desactivar la regla en local
Cada usuario DEBE poder desactivar la regla de comentarios para sí mismo, sin modificar ningún archivo versionado del proyecto. Desactivada, el agente NO DEBE recibir ni la regla al empezar la sesión ni el recordatorio con los mensajes.

#### Scenario Outline: Un usuario desactiva la regla de comentarios

```gherkin
Given el usuario ha desactivado la regla de comentarios para sí mismo en <agente>
When se abre una sesión de <agente> en el proyecto
And el usuario envía el mensaje 'el segundo punto' no lo entiendo
Then el agente no recibe la regla de comentarios
And el agente no recibe el recordatorio de la regla de comentarios con los mensajes
And ningún archivo versionado del proyecto ha cambiado

Examples:
  | agente      |
  | Claude Code |
  | OpenCode    |
```
