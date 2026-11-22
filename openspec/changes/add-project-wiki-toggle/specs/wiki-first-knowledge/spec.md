# wiki-first-knowledge

## MODIFIED Requirements

### Requirement: Guía del wiki en cada agente soportado, desde una única fuente
El proyecto DEBE tener una única guía del wiki, y con el wiki del proyecto habilitado cada agente soportado (Claude Code y OpenCode 2 o superior) DEBE recibirla en el contexto de cada sesión, sin configurar nada tras clonar. La guía DEBE ser breve, porque ocupa contexto en todas las sesiones.

#### Scenario Outline: El agente recibe la guía del wiki

```gherkin
Given un clon del proyecto con el wiki habilitado
When se abre una sesión de <agente> en el proyecto
Then el contexto de la sesión incluye la guía del wiki
And esa guía procede del único archivo de guía del proyecto

Examples:
  | agente      |
  | Claude Code |
  | OpenCode    |
```

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
Given una sesión de <agente> abierta en un proyecto con el wiki habilitado
When se revisa con qué operación indica la guía consultar el wiki
Then nombra <operación>
And no nombra `wiki-manager` para consultar

Examples:
  | agente      | operación                 |
  | Claude Code | `/wiki:query --local`     |
  | OpenCode    | la skill `wiki-query`     |
```

### Requirement: Resincronizar el wiki al archivar un change
Con el wiki del proyecto habilitado, las indicaciones de archivado de OpenSpec del proyecto DEBEN incluir la resincronización del wiki del proyecto con lo que tocó el change, mediante las operaciones del motor, escribiendo solo lo que confirme el usuario, dejando el wiki sin errores de lint y en un commit posterior al del archivado. Con el wiki deshabilitado, NO DEBEN mencionar el wiki.

#### Scenario: Las indicaciones de archivado incluyen la resincronización del wiki

```gherkin
Given un proyecto con el wiki habilitado
And un change del proyecto listo para archivar
When se consultan las indicaciones de archivado de OpenSpec para ese change
Then incluyen resincronizar el wiki del proyecto con estos pasos, en este orden:
  | paso                                                                                 |
  | fijar como fuentes, en el commit del archivado, el código, specs y ADRs que tocó     |
  | refrescar los artículos cuyas fuentes cambiaron y compilar las fuentes nuevas        |
  | revisar con el librarian, sin modificar, lo que quedó obsoleto o contradicho         |
  | extraer las lecciones aprendidas sin escribir                                        |
  | presentarlo al usuario y escribir solo lo que confirme                               |
  | pasar el lint del wiki hasta dejarlo sin errores                                     |
  | hacer el commit del wiki después del commit del archivado                            |
```

#### Scenario: Sin resincronización con el wiki deshabilitado

```gherkin
Given un proyecto con el wiki deshabilitado
And un change del proyecto listo para archivar
When se consultan las indicaciones de archivado de OpenSpec para ese change
Then no mencionan el wiki
```

### Requirement: Recordatorio del flujo en cada mensaje
Con el wiki del proyecto habilitado, cada agente soportado DEBE recibir, con cada mensaje del usuario, un recordatorio del flujo del wiki que remita a la guía: consultar antes de responder con la operación de solo lectura, preguntar ante un hueco, apuntar como candidato lo que se comprueba y proponer ingerir lo que se encuentra en internet, con cada operación nombrada como se invoca en ese agente. NO DEBE nombrar las lecciones aprendidas, que se proponen en un punto de cierre. NO DEBE ocupar más de 600 caracteres. Si no se puede generar, el mensaje del usuario DEBE llegar al agente igualmente.

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

### Requirement: Resincronizar el wiki al archivar en la rama de origen
Con el wiki del proyecto habilitado, cuando un change se archiva en la rama de origen, en la forma canónica, las indicaciones de archivado DEBEN calcular las rutas que tocó el change a partir de las fusiones de su propuesta y de su implementación con la rama de origen, más el commit del archive, en vez de a partir del merge-base de una rama temporal. El commit del wiki DEBE ir igualmente aparte y después del commit del archive.

#### Scenario: Las indicaciones de archivado cubren el archive en la rama de origen

```gherkin
Given el `openspec/config.yaml` de un proyecto con el wiki habilitado
When se consultan las indicaciones de archivado para un change archivado en la rama de origen
Then indican calcular las rutas que tocó el change a partir de las fusiones de su propuesta y de su implementación y del commit del archive
And indican hacer el commit del wiki después del commit del archive
```
