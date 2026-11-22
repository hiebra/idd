# response-comments

## ADDED Requirements

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

## MODIFIED Requirements

### Requirement: Un comentario no se responde
Un comentario es un mensaje del usuario que, sin los espacios ni las marcas de comentario HTML (`<!-- ... -->`) iniciales, empieza por una marca de comentario: una cadena entre comillas simples (`'así'`) o una cita de Markdown (líneas que empiezan por `>`, como las que genera la app de Claude al citar un fragmento). La regla DEBE indicar al agente que un comentario no se responde: el agente contesta solo con la frase fija "Puedes seguir añadiendo comentarios, pedirme que los procese (p) o que reformule (r) el mensaje en base a ellos", en el idioma en que está escrito el comentario, y acumula el comentario sin investigar ni modificar nada a raíz de él.

#### Scenario: La regla dice cómo contestar a un comentario

```gherkin
Given la regla de comentarios del proyecto
When se revisa qué indica sobre un mensaje que empieza por una marca de comentario
Then indica que es un comentario sobre la intervención anterior del agente
And indica que una cita de Markdown al principio del mensaje también es una marca de comentario
And indica contestar solo con la frase fija
And indica contestar en el idioma del comentario
And indica acumular el comentario sin investigar ni modificar nada a raíz de él
```

### Requirement: La regla se recuerda con los mensajes que la activan
Una palabra de cierre es "p", "procesa", "procesar", "r", "reformula" o "reformular" como palabra completa, sin distinguir mayúsculas, en un mensaje del usuario y fuera de la marca de comentario inicial, si la hay. Con cada mensaje del usuario que sea un comentario o contenga una palabra de cierre, el adaptador del arranque de cada agente soportado DEBE entregar al agente, junto con el mensaje, un recordatorio breve de la regla de comentarios. Con los demás mensajes NO DEBE entregarlo.

#### Scenario Outline: El agente recibe el recordatorio con un mensaje que activa la regla

```gherkin
Given una sesión de <agente> abierta en el proyecto
When el usuario envía el mensaje <mensaje>
Then el agente recibe el mensaje junto con el recordatorio de la regla de comentarios

Examples:
  | agente      | mensaje                                      |
  | Claude Code | 'el segundo punto' no lo entiendo            |
  | Claude Code | > el segundo punto                           |
  | Claude Code | p                                            |
  | Claude Code | Reformula, por favor                         |
  | OpenCode    | 'el segundo punto' no lo entiendo            |
  | OpenCode    | > el segundo punto                           |
  | OpenCode    | p                                            |
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
  | Claude Code | ya lo veo                                    |
  | Claude Code | ¿lo reformulamos mañana?                     |
  | Claude Code | el resultado es a > b                        |
  | OpenCode    | "foo" no aparece en el log                   |
  | OpenCode    | ya lo veo                                    |
  | OpenCode    | ¿lo reformulamos mañana?                     |
  | OpenCode    | el resultado es a > b                        |
```

## REMOVED Requirements

### Requirement: "ya" responde a todos los comentarios
**Reason**: "ya" deja de ser palabra de cierre; lo sustituyen "p", "procesa" y "procesar".

**Migration**: Usa "p", "procesa" o "procesar" donde antes usabas "ya". Ver "Procesar responde a todos los comentarios".

### Requirement: "reformula" repite la intervención por sí sola
**Reason**: Las palabras de cierre de reformular pasan a ser "r", "reformula" y "reformular".

**Migration**: "reformula" sigue valiendo; también "r" y "reformular". Ver "Reformular repite la intervención por sí sola".
