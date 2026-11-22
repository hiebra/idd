# response-comments Specification

## Purpose
El usuario puede comentar partes de una intervención del agente sin que cada comentario dispare una respuesta, y decidir después si el agente los responde todos o reformula su intervención. La regla llega a cada agente soportado (Claude Code y OpenCode 2 o superior) por el arranque de sesión, desde una única fuente, y cada usuario puede desactivarla en local.

## Requirements

### Requirement: Regla de comentarios en cada agente soportado, desde una única fuente
El proyecto DEBE tener una única regla de comentarios, y cada agente soportado DEBE recibirla en el contexto de cada sesión, sin configurar nada tras clonar: en Claude Code, por el adaptador del arranque de sesión; en OpenCode, por el plugin de comentarios del proyecto. El proyecto NO DEBE entregar la regla por archivos de instrucciones que el agente cargue siempre y el usuario no pueda desactivar.

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

### Requirement: En OpenCode, la regla llega por un plugin propio
En OpenCode, la regla de comentarios y su recordatorio DEBEN llegar por un plugin local propio del proyecto, separado del plugin del arranque de sesión. El plugin del arranque de sesión NO DEBE entregar nada de la regla de comentarios, y DEBE seguir funcionando igual sin el plugin de comentarios.

#### Scenario: Sin el plugin de comentarios, OpenCode arranca sin la regla

```gherkin
Given un clon del proyecto sin el plugin de comentarios de OpenCode
When se abre una sesión de OpenCode en el proyecto
And el usuario envía el mensaje ''el segundo punto'' no lo entiendo
Then el agente no recibe la regla de comentarios
And el agente no recibe el recordatorio de la regla de comentarios con los mensajes
And el contexto de la sesión incluye la guía del wiki
```

### Requirement: Un comentario no se responde
Un comentario es un mensaje del usuario que, sin los espacios ni las marcas de comentario HTML (`<!-- ... -->`) iniciales, empieza por una marca de comentario: una cadena no vacía entre comillas simples dobladas (`''así''`), pensada para donde no se puede citar, como la TUI de OpenCode, o una cita de Markdown (líneas que empiezan por `>`, como las que genera la app de Claude al citar un fragmento). También es un comentario un mensaje que incluye una cita de la web de OpenCode, que llega al modelo como texto dentro del mensaje: una línea `The user quoted the following from <origen>:`, seguida de una o más líneas que empiezan por `> ` y, si el usuario escribió algo, de `The user made the following comment regarding this quote: <comentario>`. Una cadena entre comillas simples sin doblar (`'así'`) NO es una marca de comentario. La regla DEBE indicar al agente que un comentario no se responde: el agente contesta solo con la frase fija "Añade más comentarios o pídeme que los procese (p) o reformule (r) en base a ellos", en el idioma en que está escrito el comentario, y acumula el comentario sin investigar ni modificar nada a raíz de él.

#### Scenario: La regla dice cómo contestar a un comentario

```gherkin
Given la regla de comentarios del proyecto
When se revisa qué indica sobre un mensaje que empieza por una marca de comentario
Then indica que es un comentario sobre la intervención anterior del agente
And indica que una cita de Markdown al principio del mensaje también es una marca de comentario
And indica que una cita de la web de OpenCode en el mensaje también lo convierte en un comentario
And indica contestar solo con la frase fija
And indica contestar en el idioma del comentario
And indica acumular el comentario sin investigar ni modificar nada a raíz de él
```

### Requirement: La regla se recuerda con los mensajes que la activan
Una palabra de cierre es "p", "procesa", "procesar", "r", "reformula" o "reformular" como palabra completa, sin distinguir mayúsculas, en un mensaje del usuario y fuera de la marca de comentario inicial, si la hay. Con cada mensaje del usuario que sea un comentario o contenga una palabra de cierre, cada agente soportado DEBE recibir, junto con el mensaje, un recordatorio breve de la regla de comentarios, por el mismo medio que la regla. Con los demás mensajes NO DEBE recibirlo.

#### Scenario Outline: El agente recibe el recordatorio con un mensaje que activa la regla

```gherkin
Given una sesión de <agente> abierta en el proyecto
When el usuario envía el mensaje <mensaje>
Then el agente recibe el mensaje junto con el recordatorio de la regla de comentarios

Examples:
  | agente      | mensaje                                      |
  | Claude Code | ''el segundo punto'' no lo entiendo          |
  | Claude Code | > el segundo punto                           |
  | Claude Code | p                                            |
  | Claude Code | Reformula, por favor                         |
  | OpenCode    | ''el segundo punto'' no lo entiendo          |
  | OpenCode    | > el segundo punto                           |
  | OpenCode    | p                                            |
  | OpenCode    | Reformula, por favor                         |
```

#### Scenario: En OpenCode, una cita desde la web activa el recordatorio

```gherkin
Given una sesión de OpenCode abierta en el proyecto
When el usuario cita "el segundo punto" desde la web de OpenCode con el comentario "no lo entiendo"
Then el agente recibe el mensaje junto con el recordatorio de la regla de comentarios
```

#### Scenario Outline: El agente no recibe el recordatorio con otros mensajes

```gherkin
Given una sesión de <agente> abierta en el proyecto
When el usuario envía el mensaje <mensaje>
Then el agente recibe el mensaje sin el recordatorio de la regla de comentarios

Examples:
  | agente      | mensaje                                      |
  | Claude Code | 'foo' no aparece en el log                   |
  | Claude Code | "foo" no aparece en el log                   |
  | Claude Code | ya lo veo                                    |
  | Claude Code | ¿lo reformulamos mañana?                     |
  | Claude Code | el resultado es a > b                        |
  | OpenCode    | 'foo' no aparece en el log                   |
  | OpenCode    | "foo" no aparece en el log                   |
  | OpenCode    | ya lo veo                                    |
  | OpenCode    | ¿lo reformulamos mañana?                     |
  | OpenCode    | el resultado es a > b                        |
```

### Requirement: Desactivar la regla en local
Cada usuario DEBE poder desactivar la regla de comentarios para sí mismo, sin modificar ningún archivo versionado del proyecto. Desactivada, el agente NO DEBE recibir ni la regla al empezar la sesión ni el recordatorio con los mensajes.

#### Scenario Outline: Un usuario desactiva la regla de comentarios

```gherkin
Given el usuario ha desactivado la regla de comentarios para sí mismo en <agente>
When se abre una sesión de <agente> en el proyecto
And el usuario envía el mensaje ''el segundo punto'' no lo entiendo
Then el agente no recibe la regla de comentarios
And el agente no recibe el recordatorio de la regla de comentarios con los mensajes
And ningún archivo versionado del proyecto ha cambiado

Examples:
  | agente      |
  | Claude Code |
  | OpenCode    |
```

### Requirement: Procesar responde a todos los comentarios
La regla DEBE indicar al agente que, ante un mensaje con una palabra de cierre de procesar ("p", "procesa" o "procesar"), responda en un solo mensaje a todos los comentarios acumulados. Los comentarios acumulados son los que el usuario ha hecho desde la última respuesta completa del agente. Si ese mensaje es además un comentario, el agente lo acumula antes de responder.

#### Scenario: La regla dice qué hacer al procesar

```gherkin
Given la regla de comentarios del proyecto
When se revisa qué indica sobre un mensaje con la palabra "p"
Then indica responder en un solo mensaje a todos los comentarios acumulados
And indica incluir entre ellos el propio mensaje si es un comentario
```

### Requirement: Reformular repite la intervención por sí sola
La regla DEBE indicar al agente que, ante un mensaje con una palabra de cierre de reformular ("r", "reformula" o "reformular"), repita su intervención completa, reescrita para incorporar los comentarios acumulados. El agente DEBE asumir que el usuario solo ha leído las partes que citó, así que la intervención reformulada se entiende por sí sola: no remite a la anterior ni da por leído nada de lo que el usuario no comentó.

#### Scenario: La regla dice qué hacer al reformular

```gherkin
Given la regla de comentarios del proyecto
When se revisa qué indica sobre un mensaje con la palabra "r"
Then indica repetir la intervención completa incorporando los comentarios acumulados
And indica asumir que el usuario solo ha leído las partes que citó
And indica que la intervención reformulada no remite a la anterior
```
