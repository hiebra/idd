# wiki-first-knowledge

## ADDED Requirements

### Requirement: Modificar el wiki solo con su operación de escritura y con el usuario
La guía DEBE indicar al agente que modifica el wiki (registrar lecciones, ingerir fuentes, compilar, corregir artículos) solo con la operación del motor que lo modifica (`wiki-manager` o sus comandos), y solo cuando el usuario confirma lo que propone. NO DEBE usar esa operación para consultar.

#### Scenario: La guía reserva la operación que modifica el wiki

```gherkin
Given la guía del wiki del proyecto
When se revisa qué indica sobre modificar el wiki
Then indica modificarlo con la operación del motor que lo modifica
And indica hacerlo solo cuando el usuario confirma lo que el agente propone
And indica no usar esa operación para consultar
```

## MODIFIED Requirements

### Requirement: Consultar el wiki antes de responder
La guía DEBE indicar al agente que, ante una petición que requiere conocimiento, consulte el wiki en modo de solo lectura antes de usar su conocimiento interno: primero el wiki del proyecto y, si no basta, el topic que corresponda del hub del usuario, si existe. La consulta DEBE hacerse con la operación de solo lectura del motor en cada agente, nombrada como se invoca en él: la skill `wiki-query` en OpenCode y el comando `/wiki:query --local` en Claude Code.

#### Scenario: La guía exige consultar antes de responder

```gherkin
Given la guía del wiki del proyecto
When se revisa qué indica sobre las peticiones que requieren conocimiento
Then indica consultar el wiki en modo de solo lectura antes de usar el conocimiento interno
And indica consultar primero el wiki del proyecto y después el hub del usuario, si existe
```

#### Scenario Outline: La guía nombra la operación de lectura de cada agente

```gherkin
Given una sesión de <agente> abierta en el proyecto
When se revisa con qué operación indica la guía consultar el wiki
Then nombra <operación>
And no nombra `wiki-manager` para consultar

Examples:
  | agente      | operación                 |
  | Claude Code | `/wiki:query --local`     |
  | OpenCode    | la skill `wiki-query`     |
```

### Requirement: Registrar lo que se descubre al trabajar
La guía DEBE indicar al agente que lo que descubre mientras trabaja es conocimiento que se registra cuando servirá en otra ocasión, no solo para la tarea en curso, tanto lo que comprueba empíricamente (ejecutando, midiendo, leyendo código) como lo que encuentra en internet, también cuando busca por su cuenta en medio de una tarea. El agente discierne cuándo procede y lo propone al usuario en lugar de registrarlo sin más. Lo comprobado al trabajar DEBE apuntarlo como lección candidata, sin escribir nada, y DEBE proponer registrar las candidatas una sola vez, en un punto de cierre: al terminar una tarea, antes de un commit, cuando el usuario da la sesión por terminada o al archivar un change. Lo encontrado en internet DEBE proponerlo cuando lo encuentra.

#### Scenario: La guía trata lo descubierto al trabajar como conocimiento

```gherkin
Given la guía del wiki del proyecto
When se revisa qué indica sobre lo que el agente descubre mientras trabaja
Then indica proponer registrarlo cuando servirá en otra ocasión
And lo aplica a lo comprobado empíricamente y a lo encontrado en internet
And indica que el agente discierne cuándo procede
```

#### Scenario: Lo comprobado se registra en un punto de cierre

```gherkin
Given la guía del wiki del proyecto
When se revisa cuándo indica registrar lo comprobado al trabajar
Then indica apuntarlo como lección candidata mientras se trabaja, sin escribir nada
And indica proponer registrar las candidatas una sola vez, en un punto de cierre
And nombra como puntos de cierre el final de una tarea, antes de un commit, cuando el usuario da la sesión por terminada y el archive de un change
```

### Requirement: Recordatorio del flujo en cada mensaje
Cada agente soportado DEBE recibir, con cada mensaje del usuario, un recordatorio del flujo del wiki que remita a la guía: consultar antes de responder con la operación de solo lectura, preguntar ante un hueco, apuntar como candidato lo que se comprueba y proponer ingerir lo que se encuentra en internet, con cada operación nombrada como se invoca en ese agente. NO DEBE nombrar las lecciones aprendidas, que se proponen en un punto de cierre. NO DEBE ocupar más de 600 caracteres. Si no se puede generar, el mensaje del usuario DEBE llegar al agente igualmente.

#### Scenario Outline: El agente recibe el recordatorio con cada mensaje

```gherkin
Given una sesión de <agente> abierta en el proyecto
When el usuario envía un mensaje
Then el agente recibe el mensaje junto con el recordatorio del flujo del wiki
And el recordatorio recuerda consultar antes de responder y preguntar ante un hueco
And el recordatorio nombra la consulta y la ingesta de fuentes como se invocan en <agente>
And el recordatorio recuerda apuntar como candidato lo que se comprueba
And el recordatorio no nombra las lecciones aprendidas
And el recordatorio remite a la guía del wiki
And el recordatorio no ocupa más de 600 caracteres

Examples:
  | agente      |
  | Claude Code |
  | OpenCode    |
```

#### Scenario Outline: Un fallo del recordatorio no bloquea el mensaje

```gherkin
Given una sesión de <agente> abierta en el proyecto
And el recordatorio del flujo del wiki no se puede generar
When el usuario envía un mensaje
Then el agente recibe el mensaje del usuario

Examples:
  | agente      |
  | Claude Code |
  | OpenCode    |
```
