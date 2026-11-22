# wiki-first-knowledge

## ADDED Requirements

### Requirement: En el modo lite, el wiki se consulta solo a petición expresa
En el modo `lite`, la guía DEBE indicar al agente que no consulte el wiki por iniciativa propia, aunque la petición requiera conocimiento, y que lo consulte solo cuando el usuario se lo pide expresamente, en modo de solo lectura, con la misma operación y en el mismo orden que en el modo `full`. NO DEBE indicarle que consulte el wiki antes de usar su conocimiento interno ni que discierna qué peticiones requieren conocimiento. Todo lo demás que indica la guía DEBE ser igual en los dos modos.

#### Scenario: La guía del modo lite reserva la consulta a la petición expresa del usuario

```gherkin
Given la guía del wiki del proyecto en el modo lite
When se revisa qué indica sobre consultar el wiki
Then indica consultarlo solo cuando el usuario lo pide expresamente
And indica no consultarlo por iniciativa propia, aunque la petición requiera conocimiento
And indica consultarlo entonces en modo de solo lectura
And indica consultar primero el wiki del proyecto y después el hub del usuario, si existe
And no indica consultar el wiki antes de usar el conocimiento interno
And no indica discernir qué peticiones requieren conocimiento
```

#### Scenario Outline: La guía del modo lite nombra la operación de lectura de cada agente

```gherkin
Given una sesión de <agente> abierta en un proyecto con el wiki habilitado en el modo lite
When se revisa con qué operación indica la guía consultar el wiki
Then nombra <operación>
And no nombra `wiki-manager` para consultar

Examples:
  | agente      | operación             |
  | Claude Code | `/wiki:query --local` |
  | OpenCode    | la skill `wiki-query` |
```

#### Scenario: Fuera de la consulta, la guía es la misma en los dos modos

```gherkin
Given la guía del wiki del proyecto en el modo lite
When se compara con la guía del modo full
Then solo cambia lo que indica sobre cuándo consultar el wiki
```

#### Scenario: En el modo lite, las indicaciones de archivado resincronizan el wiki

```gherkin
Given un proyecto con el wiki habilitado en el modo lite
And un change del proyecto listo para archivar
When se consultan las indicaciones de archivado de OpenSpec para ese change
Then incluyen resincronizar el wiki del proyecto, igual que en el modo full
```

## MODIFIED Requirements

### Requirement: Guía del wiki en cada agente soportado, desde una única fuente
El proyecto DEBE tener una única guía del wiki, en un solo archivo que contiene lo común a los dos modos del wiki y lo propio de cada uno. Con el wiki del proyecto habilitado, cada agente soportado (Claude Code y OpenCode 2 o superior) DEBE recibir en el contexto de cada sesión la guía del modo del proyecto, sin configurar nada tras clonar, y NO DEBE recibir lo propio del otro modo. La guía DEBE ser breve, porque ocupa contexto en todas las sesiones.

#### Scenario Outline: El agente recibe la guía del wiki

```gherkin
Given un clon del proyecto con el wiki habilitado
When se abre una sesión de <agente> en el proyecto
Then el contexto de la sesión incluye la guía del wiki
And esa guía procede del único archivo de guía del proyecto
And esa guía no incluye lo propio del modo lite

Examples:
  | agente      |
  | Claude Code |
  | OpenCode    |
```

#### Scenario Outline: En el modo lite, la guía sale del mismo archivo

```gherkin
Given un clon del proyecto con el wiki habilitado en el modo lite
When se abre una sesión de <agente> en el proyecto
Then el contexto de la sesión incluye la guía del wiki
And esa guía procede del único archivo de guía del proyecto
And esa guía no incluye lo propio del modo full

Examples:
  | agente      |
  | Claude Code |
  | OpenCode    |
```

### Requirement: Consultar el wiki antes de responder
En el modo `full`, la guía DEBE indicar al agente que, ante una petición que requiere conocimiento, consulte el wiki en modo de solo lectura antes de usar su conocimiento interno: primero el wiki del proyecto y, si no basta, el topic que corresponda del hub del usuario, si existe. La consulta DEBE hacerse con la operación de solo lectura del motor en cada agente, nombrada como se invoca en él: la skill `wiki-query` en OpenCode y el comando `/wiki:query --local` en Claude Code.

#### Scenario: La guía exige consultar antes de responder

```gherkin
Given la guía del wiki del proyecto en el modo full
When se revisa qué indica sobre las peticiones que requieren conocimiento
Then indica consultar el wiki en modo de solo lectura antes de usar el conocimiento interno
And indica consultar primero el wiki del proyecto y después el hub del usuario, si existe
```

#### Scenario Outline: La guía nombra la operación de lectura de cada agente

```gherkin
Given una sesión de <agente> abierta en un proyecto con el wiki habilitado en el modo full
When se revisa con qué operación indica la guía consultar el wiki
Then nombra <operación>
And no nombra `wiki-manager` para consultar

Examples:
  | agente      | operación                 |
  | Claude Code | `/wiki:query --local`     |
  | OpenCode    | la skill `wiki-query`     |
```

### Requirement: Discernir qué peticiones requieren conocimiento
En el modo `full`, la guía DEBE indicar que requieren conocimiento las peticiones sobre el dominio del proyecto, decisiones técnicas, herramientas o hechos externos; que las operaciones sobre el código que no lo requieren (renombrar, reformatear, mover, aplicar un cambio ya decidido) no exigen consulta; y que es el agente quien discierne en cada caso.

#### Scenario: La guía distingue las peticiones que requieren conocimiento

```gherkin
Given la guía del wiki del proyecto en el modo full
When se revisa qué peticiones exigen consultar el wiki
Then incluye las peticiones sobre dominio, decisiones técnicas, herramientas y hechos externos
And excluye las operaciones sobre el código que no requieren conocimiento
And indica que el agente discierne en cada caso
```

### Requirement: Preguntar cuando el wiki no responde
La guía DEBE indicar al agente que, si el wiki no responde a una consulta, pregunte al usuario antes de seguir y le ofrezca: responder con su conocimiento interno, indicando que no viene del wiki; investigar fuera y registrar lo encontrado en el wiki; o no hacer nada más. En el modo `full`, la consulta es la de una petición que requiere conocimiento; en el modo `lite`, la que el usuario ha pedido expresamente.

#### Scenario: La guía ofrece las tres opciones ante un hueco

```gherkin
Given la guía del wiki del proyecto en el modo full
When se revisa qué indica cuando el wiki no responde
Then indica preguntar al usuario antes de seguir
And ofrece estas opciones:
  | opción                                                      |
  | responder con conocimiento interno, indicando su origen     |
  | investigar fuera y registrar lo encontrado en el wiki       |
  | no hacer nada más                                           |
```

#### Scenario: En el modo lite, la guía ofrece las mismas opciones ante un hueco

```gherkin
Given la guía del wiki del proyecto en el modo lite
When se revisa qué indica cuando el wiki no responde a una consulta que pidió el usuario
Then indica preguntar al usuario antes de seguir
And ofrece estas opciones:
  | opción                                                      |
  | responder con conocimiento interno, indicando su origen     |
  | investigar fuera y registrar lo encontrado en el wiki       |
  | no hacer nada más                                           |
```

### Requirement: Recordatorio del flujo en cada mensaje
Con el wiki del proyecto habilitado, cada agente soportado DEBE recibir, con cada mensaje del usuario, un recordatorio del flujo del wiki que remita a la guía, con cada operación nombrada como se invoca en ese agente. En el modo `full`, DEBE recordar consultar antes de responder con la operación de solo lectura y preguntar ante un hueco. En el modo `lite`, DEBE recordar no consultar el wiki salvo que el usuario lo pida expresamente, y NO DEBE recordar consultar antes de responder. En los dos modos DEBE recordar apuntar como candidato lo que se comprueba y proponer ingerir lo que se encuentra en internet. NO DEBE nombrar las lecciones aprendidas, que se proponen en un punto de cierre. NO DEBE ocupar más de 600 caracteres. Si no se puede generar, el mensaje del usuario DEBE llegar al agente igualmente.

#### Scenario Outline: El agente recibe el recordatorio con cada mensaje

```gherkin
Given una sesión de <agente> abierta en un proyecto con el wiki habilitado
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

#### Scenario Outline: En el modo lite, el recordatorio no pide consultar antes de responder

```gherkin
Given una sesión de <agente> abierta en un proyecto con el wiki habilitado en el modo lite
When el usuario envía un mensaje
Then el agente recibe el mensaje junto con el recordatorio del flujo del wiki
And el recordatorio recuerda no consultar el wiki salvo que el usuario lo pida expresamente
And el recordatorio no recuerda consultar antes de responder
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
Given una sesión de <agente> abierta en un proyecto con el wiki habilitado
And el recordatorio del flujo del wiki no se puede generar
When el usuario envía un mensaje
Then el agente recibe el mensaje del usuario

Examples:
  | agente      |
  | Claude Code |
  | OpenCode    |
```
