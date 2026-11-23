# wiki-first-knowledge Specification

## Purpose
TBD - created by archiving change add-llm-wiki-support. Update Purpose after archive.

## Requirements

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

### Requirement: Registrar en el ámbito correcto
La guía DEBE indicar al agente dónde registrar el conocimiento: en el wiki del proyecto, lo específico del proyecto y lo externo que le concierne; en el hub del usuario, el conocimiento general del usuario. Cuando no esté claro qué ámbito corresponde, DEBE preguntar. El conocimiento del hub DEBE llegar al wiki del proyecto incorporándolo directamente o mediante un checkpoint del hub, nunca copiando artículos a mano.

#### Scenario: La guía distingue los dos ámbitos

```gherkin
Given la guía del wiki del proyecto
When se revisa qué indica sobre dónde registrar el conocimiento
Then asigna al wiki del proyecto lo específico del proyecto y lo externo que le concierne
And asigna al hub del usuario el conocimiento general del usuario
And indica preguntar cuando no está claro qué ámbito corresponde
And indica pasar conocimiento del hub al proyecto incorporándolo o mediante un checkpoint
```

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

### Requirement: Cada tipo de descubrimiento se registra con su operación del motor
La guía DEBE indicar con qué operación del motor se registra cada tipo de descubrimiento: lo comprobado al trabajar, con las lecciones aprendidas; lo encontrado en internet, ingiriendo la fuente para conservar su procedencia.

#### Scenario: La guía asigna una operación a cada tipo de descubrimiento

```gherkin
Given la guía del wiki del proyecto
When se revisa cómo indica registrar lo descubierto al trabajar
Then asigna estas operaciones del motor:
  | descubrimiento                | operación                 |
  | comprobado al trabajar        | lecciones aprendidas      |
  | encontrado en internet        | ingesta de la fuente      |
```

### Requirement: Los productos del proyecto son fuentes del wiki
La guía DEBE indicar que las specs, los ADRs y el código del proyecto entran en el wiki del proyecto como fuentes fijadas a un commit, por ruta e identificador de versión y sin copiar su contenido, y que los artículos citan la versión exacta de la que sale cada conocimiento. Al crear el wiki del proyecto DEBE hacerse una ingesta inicial del repositorio que excluya lo generado y lo que no aporta conocimiento.

#### Scenario: La guía trata los productos del proyecto como fuentes fijadas

```gherkin
Given la guía del wiki del proyecto
When se revisa qué indica sobre las specs, los ADRs y el código del proyecto
Then indica incorporarlos como fuentes fijadas a un commit sin copiar su contenido
And indica que los artículos citan la versión exacta de la fuente
And indica hacer una ingesta inicial del repositorio al crear el wiki del proyecto
And indica excluir de esa ingesta lo generado y lo que no aporta conocimiento
```

### Requirement: Resincronizar el wiki al archivar un change
Con el wiki del proyecto habilitado, las indicaciones de archivado de OpenSpec del proyecto DEBEN incluir la resincronización del wiki del proyecto con lo que tocó el change, mediante las operaciones del motor. Tras fijar las fuentes, DEBEN evaluar sin escribir lo que cambia en el wiki (los artículos cuyas fuentes cambiaron, las lecciones aprendidas y los registros del inventario), presentarlo al usuario y escribir solo lo que confirme, compilando después de registrar las lecciones. DEBEN dejar el wiki sin errores de lint y hacer su commit después del commit del archivado. NO DEBEN incluir la revisión con el librarian, que no revisa el contenido de los artículos. Con el wiki deshabilitado, NO DEBEN mencionar el wiki.

#### Scenario: Las indicaciones de archivado incluyen la resincronización del wiki

```gherkin
Given un proyecto con el wiki habilitado
And un change del proyecto listo para archivar
When se consultan las indicaciones de archivado de OpenSpec para ese change
Then incluyen resincronizar el wiki del proyecto con estos pasos, en este orden:
  | paso                                                                                          |
  | fijar como fuentes, en el commit del archivado, el código, specs y ADRs que tocó              |
  | refrescar sin escribir los artículos que citan lo que tocó el change                          |
  | extraer las lecciones aprendidas sin escribir                                                 |
  | revisar sin escribir los registros del inventario que el change completa o deja obsoletos     |
  | presentarlo al usuario y escribir solo lo que confirme: refresco, lecciones, compile, inventario |
  | pasar el lint del wiki hasta dejarlo sin errores                                              |
  | hacer el commit del wiki después del commit del archivado                                     |
And no incluyen la revisión con el librarian
```

#### Scenario: Sin resincronización con el wiki deshabilitado

```gherkin
Given un proyecto con el wiki deshabilitado
And un change del proyecto listo para archivar
When se consultan las indicaciones de archivado de OpenSpec para ese change
Then no mencionan el wiki
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

### Requirement: Citas cuyo commit no está en la rama de origen
La guía DEBE indicar cómo resolver una cita a un producto del proyecto cuyo commit no existe en el clon o no está en la rama de origen: se toma el blob de esa ruta en el manifiesto citado y se resuelve con git por su blob, sin tratar la cita como rota.

#### Scenario: La guía indica resolver la cita por el blob del manifiesto

```gherkin
Given la guía del wiki del proyecto
When se revisa qué indica sobre una cita cuyo commit no está en la rama de origen
Then indica tomar el blob de la ruta en el manifiesto citado
And indica resolverlo con git por su blob
And indica no tratar la cita como rota
```

### Requirement: Resincronizar el wiki al archivar en la rama de origen
Con el wiki del proyecto habilitado, cuando un change se archiva en la rama de origen, en la forma canónica, las indicaciones de archivado DEBEN calcular las rutas que tocó el change a partir de las fusiones de su propuesta y de su implementación con la rama de origen, más el commit del archive, en vez de a partir del merge-base de una rama temporal. El commit del wiki DEBE ir igualmente aparte y después del commit del archive.

#### Scenario: Las indicaciones de archivado cubren el archive en la rama de origen

```gherkin
Given el `openspec/config.yaml` de un proyecto con el wiki habilitado
When se consultan las indicaciones de archivado para un change archivado en la rama de origen
Then indican calcular las rutas que tocó el change a partir de las fusiones de su propuesta y de su implementación y del commit del archive
And indican hacer el commit del wiki después del commit del archive
```

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
