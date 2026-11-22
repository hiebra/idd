## Context

**La revisión de hoy.** En el modo normal, el autopilot abre una revisión tras cada task. `reviewPrompt` (`.opencode/plugins/openspec-autopilot/lib/prompts.mjs`) pide al modelo guiarla con los escenarios de aceptación y, si hay código ejecutable, dar al usuario una orden de terminal para depurarlo (`guiar-revision-con-tests`, D2). Esa orden la lanza el usuario porque un proceso que espera al depurador deja colgada la orden del modelo. La revisión la cierra git (ADR-0014), así que nada de lo que se ejecute en ella puede dejar archivos que git no ignore.

**El tamaño de las tasks.** `rules.tasks` solo exige la skill `spec-as-source`, y el schema pide que una task se pueda completar en una sesión. En el modo normal, además, el apply hace una task por sesión también fuera del autopilot (`operations.apply.guidance`, ADR-0025): la task es la unidad que se implementa y se verifica de una vez. Medido en este repositorio (`git log --numstat origin/main`, 159 commits con código, sin lockfiles, `.wiki/` ni `openspec/`): la mediana es de 42 líneas cambiadas, el percentil 75 de 103 y el 90 de 282, con un máximo de 3.843. Son commits, no tasks, pero dan el orden de magnitud.

**Lo que no hay.** No existe todavía ningún MCP de depuración, y este change no lo crea: fija qué debe ofrecer. Los primeros casos son VS Code con Java sobre WLP y con React sobre Vite.

**Lo que dicen las fuentes** (ingeridas en el wiki del proyecto, `.wiki/raw/articles/2026-11-22-*.md`):

- **MCP.** La revisión vigente es la `2026-07-28`. El protocolo ya no tiene sesiones, el estado entre llamadas va en argumentos explícitos y las Roots están obsoletas: los directorios se pasan como parámetros de las tools (`mcp-2026-07-28-key-changes`). Una tool lleva `name`, `title`, `description`, `inputSchema`, `outputSchema` y `annotations`; la salida estructurada va en `structuredContent` y, por compatibilidad, serializada en un bloque de texto; los errores que el modelo puede corregir se devuelven con `isError` (`mcp-2026-07-28-tools`).
- **OpenCode.** Habla por defecto el protocolo anterior (`protocol: legacy`), llama a cada tool `<server>_<tool>`, la expone por defecto dentro de Code Mode y arranca un servidor local por cada directorio abierto, en su carpeta (`opencode-mcp-servers`). Esa página no dice a qué versión corresponde.
- **VS Code.** El CLI `code` abre carpetas y archivos en una línea, pero no documenta ninguna opción para iniciar una sesión de depuración ni para poner puntos de ruptura (`vscode-cli-y-urls`). Desde fuera solo queda una URL `vscode://` que atienda una extensión, que sí puede iniciar la sesión y poner los puntos de ruptura (`vscode-api-debug-y-uri-handler`), o que la inicie la persona. Las configuraciones viven en `.vscode/launch.json`, en el ajuste de usuario `launch` o en un archivo de workspace (`vscode-debug-configuration`).
- **Java sobre Liberty.** `server debug` deja la JVM con JDWP en el 7777, suspendida hasta que se adjunta un depurador; el modo dev (`mvn liberty:dev`) permite adjuntarlo en cualquier momento, y se queda en primer plano (`liberty-modo-debug`). VS Code se adjunta con una configuración `java` de tipo `attach` (`vscode-java-attach`), y la extensión Liberty Tools arranca el modo dev y adjunta el depurador sola (`liberty-tools-vscode-debug`).
- **React sobre Vite.** El servidor de desarrollo escucha en `localhost:5173` (`vite-dev-server`). VS Code lanza Edge o Chrome con el depurador puesto contra esa URL, con el servidor ya en marcha (`vscode-browser-debugging`).
- **Antecedente.** DebugMCP, de Microsoft, es una extensión de VS Code con un servidor MCP con el que el agente maneja el depurador (`microsoft-debugmcp`). Aquí depura la persona, no el agente.

**ADRs en vigor que afectan.** ADR-0025 (una capacidad en un solo agente; sustituye a ADR-0006 y mantiene su política), ADR-0014 (la revisión la cierra git, y el plugin no tiene dependencias), ADR-0019 (las revisiones nacen con el agente `build`) y ADR-0010 (la plantilla no tiene instrucciones que un agente cargue siempre).

## Goals / Non-Goals

**Goals:**

- Que quien planifica las tasks las dimensione para quien las verifica, con un límite que el proyecto cambia en un solo sitio.
- Que quien verifica sepa, en la revisión del plan y en la de cada task, cuánto se estimó y cuál es el límite.
- Definir la API de un MCP de depuración de forma que se pueda implementar sin más preguntas: tools, esquemas, invariantes, errores y ejemplos de los dos casos iniciales.
- Que la revisión use ese MCP cuando la sesión lo tenga y siga funcionando como hoy cuando no.

**Non-Goals:**

- Implementar el servidor MCP, o una extensión de VS Code.
- Que el modelo maneje el depurador: paso a paso, variables o expresiones.
- Medir el tiempo real de verificación, o que el plugin valide las estimaciones.
- Cambiar el apply: qué hace el modelo si una task crece al implementarla.
- Un comprobador de conformidad contra un servidor real (ver Open Questions).

## Decisions

### El límite de verificación

#### D1. El límite es una regla de `rules.tasks`, con el número en su texto

La regla va en `openspec/config.yaml`, después de la de `spec-as-source`:

```yaml
rules:
  tasks:
    - Must use spec-as-source skill
    - "Dimensiona cada task para quien la verifica: leer su diff, recorrer y ejecutar los escenarios de aceptación que la cubren y, si quiere, depurarla no debe llevar a una persona más de 15 minutos. Para estimarlo, cuenta 1 minuto por cada 8 líneas de diff que haya que leer, con los tests y sin los archivos generados, y 2 minutos por cada escenario que haya que recorrer. Escribe la estimación al final de la línea de cada task, como «(verificación: ~10 min)». Si la estimación de una task pasa del límite, divídela en tasks que se puedan verificar por separado."
```

Las reglas de un artefacto llegan al modelo con `openspec instructions tasks --json`, en los dos agentes y también cuando `openspec-update-change` rehace las tasks. Comprobado: con el change recién creado, ese comando ya devuelve `rules: ["Must use spec-as-source skill"]`.

- Alternativa: una clave `x-task-verification-minutes` y una regla que la nombre. Descartada: el CLI entrega el texto de las reglas, no las claves `x-`, así que el modelo tendría que abrir el archivo para saber el número, y en este change nada lo lee de forma determinista. Se añadiría si algún día el plugin valida las estimaciones.
- Alternativa: `operations.apply.guidance`. Descartada: actúa al implementar, no al planificar, y es la lista en la que el plugin pone y quita las indicaciones de «una task por sesión» según el modo (ADR-0025).
- Alternativa: cambiar la instrucción del schema. Descartada: el schema es una copia del origen.

#### D2. Quince minutos, con una referencia para estimar

El usuario eligió minutos de verificación como unidad. Los minutos no se pueden medir al planificar, así que la regla da una referencia que hace comparables las estimaciones:

- **8 líneas de diff por minuto.** Solo cuentan las líneas que hay que leer: no los archivos generados ni una copia literal que se comprueba con una orden. Son unas 500 líneas por hora, el ritmo que SmartBear recomienda no superar al revisar código (`https://smartbear.com/learn/code-review/best-practices-for-peer-code-review/`, consultada el 2026-11-22; es material del fabricante y aún no está registrada en el wiki).
- **2 minutos por escenario** que haya que recorrer. Es un supuesto de partida, sin fuente.

Con esa referencia, 15 minutos son unas 100 líneas y uno o dos escenarios. En este repositorio, el 74 % de los commits de código no pasa de 100 líneas: el límite obliga a dividir más o menos la cuarta parte de lo que hasta ahora ha ido junto.

Los tres números son valores de partida. Cada proyecto los cambia en la regla, y lo que enseñe el uso entra como lección en el wiki.

- Alternativa: sin referencia. Descartada: cada modelo estimaría a su manera y el límite no acotaría nada.
- Alternativa: un límite más alto, de 20 o 30 minutos. No se descarta: menos tasks son menos revisiones, y cada revisión tiene un coste fijo que no se ha medido (el wiki lo recoge como algo que no se sabe). Se empieza por 15, que es lo que se mostró al usuario al elegir la unidad.

#### D3. La estimación va escrita en cada task

Cada task lleva su estimación al final de su línea: `- [ ] 2.1 <!-- feature: step --> … (verificación: ~10 min)`. Así la ve quien revisa el plan, se puede sumar y se puede comparar con lo que llevó de verdad. El texto añadido no cambia el seguimiento de las tasks. Comprobado con OpenSpec 1.17.0 en una copia del change: `openspec instructions apply --json` sigue contando las tasks por su casilla y da la línea entera, con la estimación, en `description`. El `tasks.md` de este change ya la llevará.

#### D4. La revisión lo dice; el plugin no calcula nada

`reviewPrompt` añade texto, según lo revisado:

- **El artefacto `tasks` y los cambios en el plan**: «Comprueba que cada task lleva su estimación de verificación al final de su línea y que ninguna pasa del límite de `rules.tasks` de `openspec/config.yaml`; señala las que no la lleven o lo pasen, y da el total de verificación del change.» En los cambios en el plan va precedido de «Si los cambios tocan `tasks.md`,».
- **Una task**: «Empieza por decir al usuario cuánto se estimó que lleva verificar esta task (la estimación del final de su línea en `tasks.md`) y cuál es el límite del proyecto (la regla de `rules.tasks` de `openspec/config.yaml`). Si lo que hay que verificar los supera con claridad, avísale: puede rechazar la revisión para que la task se divida.»
- **Las demás** (otros artefactos y el verify): nada.

El modelo lee la estimación y el límite de los archivos. El rechazo ya existe: sacar todo del stage lleva a `openspec-update-change`, que rehace las tasks con la misma regla.

- Alternativa: que el plugin lea el límite y las estimaciones y los pase a la instrucción, o que rechace un `tasks.md` que no cumple. Descartada por ahora: obliga a interpretar un número dentro de una frase, o a la clave de D1, y añade lógica de servidor a un change que solo cambia textos.

### El contrato del MCP de depuración

#### D5. La plantilla fija el contrato; el servidor lo pone otro

El contrato vive en `.agents/debug/`, la carpeta de las piezas neutrales:

- `contract.json`: la versión, las dos tools con la forma de una definición de tool de MCP y el modelo de errores. Un servidor puede registrar sus tools copiándolas de ahí.
- `examples/java-liberty.json` y `examples/react-vite.json`: una llamada a cada tool con su respuesta.

Es un contrato dirigido por quien lo consume: la instrucción de la revisión se escribe contra él, y quien construya el servidor tiene que cumplirlo. Un servidor puede ofrecer más tools; el contrato solo fija estas dos.

#### D6. El MCP solo informa, y devuelve un plan que separa lo del modelo de lo de la persona

Es la decisión central. Tres razones:

1. **Lanzar el IDE en modo depuración no es una orden.** El CLI de VS Code no tiene documentada ninguna opción para iniciar una sesión de depuración. Según cómo esté montado el proyecto, hace falta que la persona elija una configuración e inicie la sesión, que lo haga una extensión a la que se llega con una URL, o que una extensión como Liberty Tools arranque el servidor y se adjunte. Eso solo lo sabe quien conoce el stack, el IDE y el proyecto: el MCP. El modelo recibe pasos ya resueltos y la plantilla no aprende nada de WLP, de Vite ni de VS Code.
2. **El modelo solo puede ejecutar órdenes que terminan.** Un servidor en modo dev o un proceso suspendido a la espera del depurador dejan colgada su orden (`guiar-revision-con-tests`, D2). Por eso cada paso dice quién lo hace, y los de `agent` terminan solos y enseguida. Lo que se queda en marcha lo arranca la persona o su IDE, que además es quien depura.
3. **Solo lectura.** Es lo que pidió el usuario (el MCP aporta la información y el modelo lanza el IDE). Además, un MCP que no actúa no necesita vivir dentro del IDE, y la revisión sigue cumpliendo que nada modifica el árbol de trabajo (ADR-0014): el contrato exige que seguir un plan no deje archivos que git no ignore.

- Alternativa: una API que solo describa (puertos, órdenes de arranque, configuración de `launch.json`) y que el modelo componga el lanzamiento. Descartada: mete el conocimiento del stack y del IDE en el modelo y en la instrucción, y no resuelve quién arranca lo que no termina.
- Alternativa: tools que actúan (iniciar la sesión, poner puntos de ruptura), como DebugMCP. Descartada en la versión 1: exige un servidor dentro del IDE y no hace falta para que depure la persona. No se cierra: un servidor que las tenga puede ofrecerlas además de las dos del contrato.
- Alternativa: que el modelo escriba `.vscode/launch.json`. Descartada: la revisión no modifica archivos.

#### D7. Dos tools

**`debug_targets`: qué se puede depurar.**

| Entrada | Tipo | |
| --- | --- | --- |
| `workspace` | texto, opcional | Ruta absoluta del árbol de trabajo. Por defecto, el directorio en el que corre el servidor. |
| `files` | lista de textos, opcional | Archivos revisados, relativos a `workspace`. |

| Salida | Tipo | |
| --- | --- | --- |
| `contractVersion` | texto | Versión del contrato que implementa el servidor: `1.x`. |
| `workspace` | texto | Árbol de trabajo al que se refiere la respuesta. |
| `ides[]` | `id`, `name`, `available`, `problems[]` | IDE con los que el servidor sabe lanzar la depuración. El primer IDE previsto es `vscode`. |
| `targets[]` | ver abajo | Objetivos de depuración. Vacío si no hay nada que depurar: no es un error. |
| `unmatchedFiles[]` | lista de textos | Archivos de `files` que no son de ningún objetivo. |

Cada objetivo lleva `id` (estable dentro del árbol de trabajo), `title`, `technology` (texto libre, como `java-liberty`), `sources` (patrones del código que cubre), `files` (los de la entrada que le pertenecen), `ides` y `state`:

| `state` | |
| --- | --- |
| `stopped` | No está en marcha. |
| `running` | En marcha, pero un depurador no puede adjuntarse. |
| `debuggable` | En marcha, y un depurador puede adjuntarse o ya lo está. |
| `unknown` | El servidor no lo sabe. |

Un problema (`problems[]`, en un IDE o en un objetivo) lleva `code`, `message` y, si lo hay, `fix`: por ejemplo, que falta una extensión del IDE. El arreglo es para la persona; el modelo no lo ejecuta.

**`debug_launch_plan`: los pasos para lanzar el IDE en modo depuración.**

| Entrada | Tipo | |
| --- | --- | --- |
| `workspace` | texto, opcional | Como en `debug_targets`. |
| `targets` | lista de textos, al menos uno | Identificadores de `debug_targets`. Varios piden una sola sesión que los depure juntos. |
| `ide` | texto, opcional | Por defecto, el primero disponible que depure esos objetivos. |
| `breakpoints[]` | `file`, `line`, `condition` opcional | Puntos de ruptura que propone el modelo. |
| `scenarios[]` | lista de textos, opcional | Nombres de los escenarios de aceptación que ejercitan el código. |

| Salida | Tipo | |
| --- | --- | --- |
| `contractVersion`, `workspace`, `ide`, `targets` | | A qué se refiere el plan. |
| `summary` | texto, opcional | Qué sesión deja montada, en una frase. |
| `steps[]` | pasos, al menos uno | Qué hay que hacer, en orden; los de `agent` primero si se puede. |
| `cleanup[]` | pasos | Cómo dejar todo como estaba. Puede estar vacío. |
| `breakpoints[]` | `file`, `line`, `condition`, `status`, `reason` | Cada punto de ruptura pedido, como `planned` o `rejected`. |
| `configurations[]` | `name`, `origin`, `definition` | Opcional. La configuración de depuración que usa el plan, en el formato del IDE. `origin` dice si ya está en el proyecto (`project`) o la aporta el servidor (`generated`). |
| `endpoints[]` | `target`, `kind`, `url`, `host`, `port`, `protocol` | Opcional. Dónde escuchan la aplicación (`app`) y el depurador (`debug`). |
| `warnings[]` | lista de textos | Opcional. |

Un paso:

| Campo | |
| --- | --- |
| `id`, `title` | Obligatorios. |
| `actor` | `agent`: lo ejecuta el modelo. `user`: lo hace la persona. |
| `command` | `argv` (el programa y sus argumentos, sin sintaxis de shell), `cwd` (relativo a `workspace`) y `env`. Obligatorio en un paso de `agent`; en uno de `user`, es la orden que ejecuta la persona. |
| `instruction` | Qué hace la persona y cómo sabe que ha salido bien. Obligatoria en un paso de `user`. |
| `longRunning` | El paso deja algo en marcha o no termina hasta que se acaba de depurar. Solo en pasos de `user`. |

Los esquemas completos están en el anexo A. `argv` es una lista, y no una línea de shell, para que valga igual en bash y en PowerShell (ADR-0017).

Los escenarios se pasan por su nombre porque la sesión de depuración cambia cómo hay que lanzarlos: contra el servidor que ya está en marcha, o a mano en el navegador que lanzó el depurador. Eso lo sabe el MCP, y lo devuelve como pasos de `user`: un escenario que se detiene en un punto de ruptura no termina solo.

#### D8. Sin estado, y el árbol de trabajo como parámetro

Las dos tools son consultas: no hay identificadores de sesión ni de plan. El árbol de trabajo se pasa en `workspace` porque:

- las Roots de MCP están obsoletas, y su vía de migración es justo esa;
- una revisión puede hacerse en un worktree, que es otro directorio que el del proyecto (la rama `autopilot-rama-por-sesion` empieza los changes nuevos en un worktree);
- un servidor compartido entre directorios (`pool` en OpenCode) no tiene carpeta propia.

Por defecto vale el directorio del servidor, que en OpenCode es la carpeta del directorio abierto.

#### D9. El contrato no depende de la revisión del protocolo

Solo usa tools con esquema de salida. La revisión 2026-07-28 relaja esos esquemas, no los introduce, así que el contrato vale también con el protocolo anterior, que es el que OpenCode habla por defecto. Un servidor devuelve la respuesta en `structuredContent` y, serializada, en un bloque de texto, que es lo que lee un cliente que no entienda la salida estructurada.

#### D10. Errores

Lo que el modelo puede corregir se devuelve como error de ejecución (`isError: true`), con un texto que empieza por el código, dos puntos y cómo corregir la llamada:

| Código | Tool | Cuándo |
| --- | --- | --- |
| `invalid-workspace` | las dos | `workspace` no es la ruta absoluta de un directorio que exista. |
| `unknown-target` | `debug_launch_plan` | Algún identificador de `targets` no es de ese árbol de trabajo. El texto dice cuáles hay. |
| `ide-unavailable` | `debug_launch_plan` | `ide` no es un IDE que el servidor conozca, o no depura esos objetivos. El texto dice cuáles sí. |

No son errores: un árbol de trabajo sin objetivos (`targets` vacío) y un punto de ruptura que no se puede poner (`rejected`, con su motivo).

#### D11. Versión del contrato

`contractVersion` es `mayor.menor`. Una versión menor solo añade campos opcionales; por eso los esquemas de salida admiten propiedades de más y los de entrada no. Un cambio incompatible sube la mayor, y el esquema de salida de la versión 1 lo rechaza. Comprobado con el borrador: `1.3` con un campo nuevo cumple, y `2.0` no.

#### D12. Ejemplos para los dos casos iniciales

Los dos ejemplos (anexo B) muestran el contrato sin extensión propia, que es el peor caso:

- **Java sobre WLP.** El modelo abre VS Code en el proyecto y el archivo en la línea (`code`, `code --goto`). La persona pone el punto de ruptura, ejecuta «Liberty: Start in debug mode» de Liberty Tools, que arranca el modo dev y adjunta el depurador en el 7777, y lanza el escenario en otro terminal.
- **React sobre Vite.** El modelo abre VS Code igual. La persona arranca el servidor de desarrollo en el 5173, inicia la configuración «Vite: frontend» del `launch.json` del proyecto, que lanza el navegador con el depurador puesto, y sigue el escenario a mano en ese navegador. Un punto de ruptura en un `.css` vuelve como `rejected`.

Con una extensión que atienda una URL `vscode://`, los mismos planes tendrían un solo paso de `agent` que pone los puntos de ruptura e inicia la sesión. El contrato no cambia.

Los ejemplos son ilustrativos: no se han ejecutado en una máquina con VS Code, Liberty y Vite. Sí cumplen los esquemas (ver D14).

#### D13. Cómo lo usa la revisión

La frase de la depuración de `reviewPrompt`, para una task y para el verify, pasa a ser:

> Si lo revisado incluye código fuente que se puede ejecutar, ofrece al usuario depurarlo y dile dónde le conviene poner los puntos de ruptura. Si la sesión tiene un MCP de depuración (las tools `debug_targets` y `debug_launch_plan`, con el prefijo de su servidor o dentro de Code Mode), úsalo: pregunta a `debug_targets` por los archivos revisados y, si da algún objetivo y el usuario quiere depurar, pide a `debug_launch_plan` el plan con esos puntos de ruptura y con los escenarios que ejercitan el código. Enseña el plan al usuario antes de ejecutar ningún paso. Después sigue los pasos en orden: ejecuta tú solo los de `agent`, y los de `user` díselos al usuario, que es quien arranca lo que se queda en marcha y quien depura. Si un IDE o un objetivo trae problemas, díselos con su arreglo, sin arreglarlos tú. Cuando el usuario termine de depurar, sigue igual los pasos de `cleanup`. Si la sesión no lo tiene, o no da ningún objetivo para lo revisado, ofrécele ejecutarlo en modo depuración: dale la orden exacta para lanzarlo con el depurador del stack del proyecto (por ejemplo, el escenario de aceptación que lo ejercita, bajo `node --inspect-brk` en JavaScript o `python -m debugpy --wait-for-client` en Python). Esa orden la ejecuta el usuario en su terminal, no tú: se queda esperando al depurador.

- El modelo reconoce el MCP por el nombre de las tools, que no depende del nombre que cada usuario dé al servidor. Con un servidor llamado `ide`: `ide_debug_targets` en OpenCode, `mcp__ide__debug_targets` en Claude Code y `tools.ide.debug_targets(…)` en Code Mode.
- Sin MCP, la instrucción es la de hoy.
- El plugin no habla con el MCP: no tiene cliente, y no lo necesita.
- En Claude Code no hay sesiones de revisión (ADR-0025). Un usuario puede pedir lo mismo a mano, y las descripciones de las tools dicen cómo se usan.

#### D14. Qué comprueba la suite

- **El contrato**: forma de las tools, anotaciones, parámetros y textos obligatorios de las descripciones, leyendo `contract.json`.
- **Los esquemas**: cada ejemplo cumple, y cada defecto de las specs, aplicado sobre un ejemplo válido, hace que deje de cumplir. Se valida con `ajv` (JSON Schema 2020-12), dependencia de desarrollo nueva de `acceptance-tests/`. El borrador del anexo ya ha pasado esas comprobaciones con `ajv` 8.20.0 en modo estricto: los dos esquemas compilan, los dos ejemplos cumplen y los 10 defectos de las specs se rechazan.
- **La instrucción**: sus frases, como en `guiar-revision-con-tests`.
- **El límite**: lo que devuelve el CLI de OpenSpec para el artefacto `tasks`, con el `config.yaml` del proyecto.

- Alternativa: un validador propio, sin dependencias. Descartada: reimplementar `if`/`then` y `$ref` para ahorrar una dependencia de desarrollo de la suite no compensa. El plugin sigue sin dependencias.

#### D15. El README

Tres apartados nuevos: el límite de verificación y cómo se cambia; el contrato del MCP de depuración, con lo que hace cada tool; y cómo se conecta un servidor que lo cumpla (`mcp.servers` en OpenCode, con `codemode` a elección del usuario).

## Risks / Trade-offs

- **[El contrato no se ha probado contra un servidor real]** → No hay ninguno. La versión del contrato permite corregirlo, y los ejemplos están marcados como no probados. Lo primero que hay que hacer cuando exista un servidor está en Open Questions.
- **[No se ha probado que la revisión llegue a las tools de un MCP]** → Las revisiones nacen con el agente `build` (ADR-0019), que tiene las tools de cualquier sesión, pero no se ha probado con las de un MCP, ni con Code Mode ni sin él: no hay servidor. Si no llegara a ellas, la instrucción cae en la alternativa de hoy.
- **[El modelo ejecuta un paso que no le toca, o un arreglo]** → La instrucción lo prohíbe, las descripciones de las tools lo repiten y los permisos del agente siguen siendo del usuario (`<server>_*`). El contrato limita los pasos de `agent` a órdenes que terminan.
- **[Las órdenes de un plan las dicta el servidor]** → Es un servidor local que configura el usuario. La instrucción pide enseñar el plan antes de ejecutar nada.
- **[`code --goto` puede abrir el archivo en otra ventana]** → La documentación no dice en qué ventana abre. Es un detalle del ejemplo, no del contrato.
- **[Las estimaciones fallan]** → Son estimaciones, y la referencia de D2 son supuestos. La estimación queda escrita, así que el desvío se ve y se corrige en la regla.
- **[Más tasks, más revisiones]** → Un límite bajo multiplica las sesiones de revisión, cuyo coste fijo no se ha medido. El valor se cambia en una línea.
- **[La regla alarga las instrucciones de `tasks`]** → Unas 100 palabras más en cada planificación.
- **[Ramas sin fusionar]** → `windows-global-distro`, `autopilot-rama-por-sesion` y `add-project-wiki-toggle` tocan `prompts.mjs` fuera del bloque de verificación (comprobado en sus diffs contra `main`), y la última saca de `config.yaml` las indicaciones del wiki, en otra zona del archivo. Puede haber conflictos de contexto al fusionar, no de contenido. `apply-one-task-per-session-in-normal-mode` y `autopilot-plan-explore` ya están en `main` y en esta rama (`ed2f488`), sin más conflicto que los índices del wiki.

## Migration Plan

- Un proyecto creado desde la plantilla nace con la regla. En uno existente, la regla vale para las tasks que se planifiquen o se rehagan después; los `tasks.md` ya escritos no cambian.
- Las revisiones que se abran tras fusionar reciben la instrucción nueva. Sin MCP, la parte de depuración se comporta como hoy.
- Marcha atrás: quitar la regla de `rules.tasks` y revertir el commit de `prompts.mjs`. El contrato no afecta a nada si nadie lo implementa.

## Open Questions

- **ADR.** La decisión D6 es duradera: la depuración en la verificación se apoya en un MCP externo que solo informa, con un contrato que fija la plantilla. El paso adr debe registrarla en un ADR nuevo, ADR-0027: el número más alto en `main` es ADR-0025, y la rama `origin/claude/exciting-shannon-bgr8tv` (`add-wiki-lite-mode`) ya usa ADR-0026. No sustituye a ninguno.
- **Cuando exista un servidor.** Hay que probar el contrato con OpenCode real (que el agente de la revisión llega a las tools, con Code Mode y sin él), ejecutar los dos ejemplos en una máquina con VS Code, Liberty y Vite, y entonces escribir el comprobador de conformidad. Antes solo se probaría contra un servidor falso escrito por nosotros.
- **La fuente de SmartBear** de D2 no está en el wiki. Se propone al usuario registrarla.
- **Si el límite debe ser legible por máquina.** Depende de si se quiere que el plugin valide las estimaciones (D1 y D4).

## Anexo A: `contract.json`

Es el contenido de `.agents/debug/contract.json`.

```json
{
  "contractVersion": "1.0",
  "title": "MCP de depuración",
  "description": "Lo que debe ofrecer un servidor MCP para que quien verifica un change depure con su IDE el código que revisa. El servidor solo informa: dice qué se puede depurar y qué pasos lanzan el IDE en modo depuración; los pasos los hacen el modelo y la persona.",
  "tools": [
    {
      "name": "debug_targets",
      "title": "Objetivos de depuración",
      "description": "Dice qué se puede depurar en un árbol de trabajo, con qué IDE y en qué estado está cada objetivo. Con `files`, dice a qué objetivo pertenece cada archivo. Solo informa: no arranca ni para procesos, no abre el IDE y no escribe en el árbol de trabajo. Un árbol de trabajo sin nada que depurar no es un error: devuelve `targets` vacío.",
      "annotations": { "readOnlyHint": true, "openWorldHint": false },
      "inputSchema": {
        "type": "object",
        "properties": {
          "workspace": {
            "type": "string",
            "description": "Ruta absoluta del árbol de trabajo que se revisa. Por defecto, el directorio en el que corre el servidor."
          },
          "files": {
            "type": "array",
            "items": { "type": "string" },
            "description": "Archivos que se revisan, con rutas relativas a `workspace`. Con ellos, cada objetivo dice cuáles le pertenecen."
          }
        },
        "additionalProperties": false
      },
      "outputSchema": {
        "type": "object",
        "required": ["contractVersion", "workspace", "ides", "targets"],
        "properties": {
          "contractVersion": {
            "type": "string",
            "pattern": "^1\\.[0-9]+$",
            "description": "Versión del contrato que implementa el servidor."
          },
          "workspace": { "type": "string", "description": "Ruta absoluta del árbol de trabajo al que se refiere la respuesta." },
          "ides": {
            "type": "array",
            "items": { "$ref": "#/$defs/ide" },
            "description": "IDE con los que el servidor sabe lanzar la depuración."
          },
          "targets": {
            "type": "array",
            "items": { "$ref": "#/$defs/target" },
            "description": "Objetivos de depuración del árbol de trabajo. Vacío si no hay nada que depurar."
          },
          "unmatchedFiles": {
            "type": "array",
            "items": { "type": "string" },
            "description": "Archivos de `files` que no pertenecen a ningún objetivo."
          }
        },
        "$defs": {
          "problem": {
            "type": "object",
            "required": ["code", "message"],
            "properties": {
              "code": { "type": "string", "description": "Identificador estable del problema, como `extension-missing`." },
              "message": { "type": "string", "description": "Qué pasa, para decírselo a la persona." },
              "fix": { "type": "string", "description": "Cómo lo arregla la persona. El modelo no lo ejecuta por su cuenta." }
            }
          },
          "ide": {
            "type": "object",
            "required": ["id", "name", "available"],
            "properties": {
              "id": { "type": "string", "description": "Identificador del IDE, como `vscode`." },
              "name": { "type": "string" },
              "available": { "type": "boolean", "description": "Si el IDE se puede lanzar en esta máquina." },
              "problems": { "type": "array", "items": {"$ref": "#/$defs/problem"} }
            }
          },
          "target": {
            "type": "object",
            "required": ["id", "title", "sources", "ides", "state"],
            "properties": {
              "id": { "type": "string", "description": "Identificador estable del objetivo dentro del árbol de trabajo." },
              "title": { "type": "string" },
              "technology": { "type": "string", "description": "Texto libre, como `java-liberty` o `react-vite`." },
              "sources": {
                "type": "array",
                "items": { "type": "string" },
                "description": "Patrones glob, relativos a `workspace`, del código que cubre el objetivo."
              },
              "files": {
                "type": "array",
                "items": { "type": "string" },
                "description": "Archivos de `files` que pertenecen al objetivo."
              },
              "ides": {
                "type": "array",
                "items": { "type": "string" },
                "description": "Identificadores de los IDE que depuran el objetivo."
              },
              "state": {
                "enum": ["stopped", "running", "debuggable", "unknown"],
                "description": "`stopped`: no está en marcha. `running`: en marcha, pero un depurador no puede adjuntarse. `debuggable`: en marcha y un depurador puede adjuntarse o ya lo está. `unknown`: el servidor no lo sabe."
              },
              "problems": { "type": "array", "items": {"$ref": "#/$defs/problem"} }
            }
          }
        }
      }
    },
    {
      "name": "debug_launch_plan",
      "title": "Plan para lanzar la depuración",
      "description": "Da los pasos para lanzar el IDE en modo depuración sobre unos objetivos, con unos puntos de ruptura. Solo informa: no arranca ni para procesos, no abre el IDE y no escribe en el árbol de trabajo. Cada paso dice quién lo hace: `agent`, el modelo, que ejecuta `command.argv`; o `user`, la persona, que sigue `instruction`. Un paso de `agent` termina solo y enseguida: no arranca servidores, no espera a un depurador y no ejecuta código que pueda detenerse en un punto de ruptura. Los pasos van en el orden en que hay que hacerlos, con los de `agent` primero si se puede. Seguir un plan no deja en el árbol de trabajo archivos que git no ignore. `cleanup` da los pasos que dejan todo como estaba.",
      "annotations": { "readOnlyHint": true, "openWorldHint": false },
      "inputSchema": {
        "type": "object",
        "required": ["targets"],
        "properties": {
          "workspace": {
            "type": "string",
            "description": "Ruta absoluta del árbol de trabajo que se revisa. Por defecto, el directorio en el que corre el servidor."
          },
          "targets": {
            "type": "array",
            "items": { "type": "string" },
            "minItems": 1,
            "description": "Identificadores de objetivos de `debug_targets`. Con varios, el plan los depura en una misma sesión."
          },
          "ide": {
            "type": "string",
            "description": "Identificador del IDE. Por defecto, el primero disponible que depure esos objetivos."
          },
          "breakpoints": {
            "type": "array",
            "items": {
              "type": "object",
              "required": ["file", "line"],
              "properties": {
                "file": { "type": "string", "description": "Ruta relativa a `workspace`." },
                "line": { "type": "integer", "minimum": 1 },
                "condition": { "type": "string", "description": "Expresión que debe cumplirse para detenerse." }
              },
              "additionalProperties": false
            },
            "description": "Puntos de ruptura que se quieren poner."
          },
          "scenarios": {
            "type": "array",
            "items": { "type": "string" },
            "description": "Nombres de los escenarios de aceptación que ejercitan el código. Con ellos, el plan dice cómo lanzarlos contra lo que se depura."
          }
        },
        "additionalProperties": false
      },
      "outputSchema": {
        "type": "object",
        "required": ["contractVersion", "workspace", "ide", "targets", "steps", "cleanup", "breakpoints"],
        "properties": {
          "contractVersion": {
            "type": "string",
            "pattern": "^1\\.[0-9]+$",
            "description": "Versión del contrato que implementa el servidor."
          },
          "workspace": { "type": "string", "description": "Ruta absoluta del árbol de trabajo al que se refiere el plan." },
          "ide": { "type": "string", "description": "Identificador del IDE para el que es el plan." },
          "targets": { "type": "array", "items": {"type": "string"}, "minItems": 1 },
          "summary": { "type": "string", "description": "Qué sesión de depuración deja montada el plan, en una frase." },
          "steps": {
            "type": "array",
            "items": { "$ref": "#/$defs/step" },
            "minItems": 1,
            "description": "Pasos para lanzar la depuración, en orden."
          },
          "cleanup": {
            "type": "array",
            "items": { "$ref": "#/$defs/step" },
            "description": "Pasos que dejan todo como estaba, en orden."
          },
          "breakpoints": {
            "type": "array",
            "items": { "$ref": "#/$defs/breakpoint" },
            "description": "Qué pasa con cada punto de ruptura pedido."
          },
          "configurations": {
            "type": "array",
            "items": { "$ref": "#/$defs/configuration" },
            "description": "Configuraciones de depuración del IDE que usa el plan."
          },
          "endpoints": {
            "type": "array",
            "items": { "$ref": "#/$defs/endpoint" },
            "description": "Direcciones de la aplicación y del depurador."
          },
          "warnings": { "type": "array", "items": {"type": "string"} }
        },
        "$defs": {
          "command": {
            "type": "object",
            "required": ["argv"],
            "properties": {
              "argv": {
                "type": "array",
                "items": { "type": "string" },
                "minItems": 1,
                "description": "El programa y sus argumentos, sin sintaxis de ninguna shell."
              },
              "cwd": {
                "type": "string",
                "description": "Directorio de trabajo, relativo a `workspace`. Por defecto, `workspace`."
              },
              "env": {
                "type": "object",
                "additionalProperties": { "type": "string" },
                "description": "Variables de entorno que se añaden."
              }
            }
          },
          "step": {
            "type": "object",
            "required": ["id", "title", "actor"],
            "properties": {
              "id": { "type": "string", "description": "Identificador del paso, único en el plan." },
              "title": { "type": "string" },
              "actor": { "enum": ["agent", "user"], "description": "`agent`: lo ejecuta el modelo. `user`: lo hace la persona." },
              "command": { "$ref": "#/$defs/command" },
              "instruction": { "type": "string", "description": "Lo que tiene que hacer la persona, y cómo sabe que ha salido bien." },
              "longRunning": {
                "type": "boolean",
                "description": "El paso deja algo en marcha o no termina hasta que la persona acaba de depurar."
              }
            },
            "allOf": [
              {
                "if": { "properties": {"actor": {"const": "agent"}}, "required": ["actor"] },
                "then": { "required": ["command"], "properties": {"command": true, "longRunning": {"const": false}} }
              },
              {
                "if": { "properties": {"actor": {"const": "user"}}, "required": ["actor"] },
                "then": { "required": ["instruction"], "properties": {"instruction": true} }
              }
            ]
          },
          "breakpoint": {
            "type": "object",
            "required": ["file", "line", "status"],
            "properties": {
              "file": { "type": "string" },
              "line": { "type": "integer", "minimum": 1 },
              "condition": { "type": "string" },
              "status": {
                "enum": ["planned", "rejected"],
                "description": "`planned`: algún paso lo pone o pide ponerlo. `rejected`: no se puede poner."
              },
              "reason": { "type": "string", "description": "Por qué se rechaza." }
            }
          },
          "configuration": {
            "type": "object",
            "required": ["name", "origin", "definition"],
            "properties": {
              "name": { "type": "string" },
              "origin": {
                "enum": ["project", "generated"],
                "description": "`project`: ya está en el proyecto. `generated`: la aporta el servidor, y los pasos dicen cómo llega al IDE."
              },
              "definition": {
                "type": "object",
                "description": "La configuración en el formato del IDE; en VS Code, una entrada de `launch.json`."
              }
            }
          },
          "endpoint": {
            "type": "object",
            "required": ["target", "kind"],
            "properties": {
              "target": { "type": "string" },
              "kind": { "enum": ["app", "debug"] },
              "url": { "type": "string" },
              "host": { "type": "string" },
              "port": { "type": "integer" },
              "protocol": { "type": "string", "description": "Texto libre, como `jdwp`." }
            }
          }
        }
      }
    }
  ],
  "errors": {
    "description": "Un error de ejecución se devuelve como resultado de la tool con `isError: true` y un bloque de texto que empieza por el código del error, seguido de dos puntos y de cómo corregir la llamada. Un punto de ruptura que no se puede poner no es un error: va en `breakpoints` como `rejected`.",
    "codes": [
      {
        "code": "invalid-workspace",
        "tools": ["debug_targets", "debug_launch_plan"],
        "when": "`workspace` no es la ruta absoluta de un directorio que exista."
      },
      {
        "code": "unknown-target",
        "tools": ["debug_launch_plan"],
        "when": "Algún identificador de `targets` no es de un objetivo de ese árbol de trabajo. El texto dice cuáles hay."
      },
      {
        "code": "ide-unavailable",
        "tools": ["debug_launch_plan"],
        "when": "`ide` no es un IDE que el servidor conozca, o no puede depurar esos objetivos. El texto dice cuáles sí."
      }
    ]
  }
}
```

## Anexo B: ejemplos

Cada ejemplo lleva las dos llamadas (`arguments`) con su respuesta (`result`, el `structuredContent`).

### `examples/java-liberty.json`

```json
{
  "title": "Java sobre WLP con VS Code",
  "note": "Ejemplo ilustrativo: los nombres, las rutas y los puertos son de un proyecto inventado, y no se ha probado en una máquina real. Supone la extensión Liberty Tools en VS Code y una suite de aceptación con cucumber-js.",
  "calls": [
    {
      "tool": "debug_targets",
      "arguments": {
        "workspace": "/home/ana/pedidos",
        "files": ["backend/src/main/java/com/acme/pedidos/ExportarPedidos.java", "README.md"]
      },
      "result": {
        "contractVersion": "1.0",
        "workspace": "/home/ana/pedidos",
        "ides": [{ "id": "vscode", "name": "Visual Studio Code", "available": true }],
        "targets": [
          {
            "id": "backend",
            "title": "API de pedidos (Java sobre WLP)",
            "technology": "java-liberty",
            "sources": ["backend/src/main/java/**"],
            "files": ["backend/src/main/java/com/acme/pedidos/ExportarPedidos.java"],
            "ides": ["vscode"],
            "state": "stopped"
          }
        ],
        "unmatchedFiles": ["README.md"]
      }
    },
    {
      "tool": "debug_launch_plan",
      "arguments": {
        "workspace": "/home/ana/pedidos",
        "targets": ["backend"],
        "ide": "vscode",
        "breakpoints": [{ "file": "backend/src/main/java/com/acme/pedidos/ExportarPedidos.java", "line": 42 }],
        "scenarios": ["Exportar los pedidos del mes en CSV"]
      },
      "result": {
        "contractVersion": "1.0",
        "workspace": "/home/ana/pedidos",
        "ide": "vscode",
        "targets": ["backend"],
        "summary": "Liberty en modo dev, con el depurador de Java de VS Code adjunto en el puerto 7777.",
        "steps": [
          {
            "id": "open-ide",
            "title": "Abrir el proyecto en VS Code",
            "actor": "agent",
            "command": { "argv": ["code", "/home/ana/pedidos"] }
          },
          {
            "id": "open-breakpoint-1",
            "title": "Abrir ExportarPedidos.java en la línea 42",
            "actor": "agent",
            "command": { "argv": ["code", "--goto", "/home/ana/pedidos/backend/src/main/java/com/acme/pedidos/ExportarPedidos.java:42"] }
          },
          {
            "id": "set-breakpoints",
            "title": "Poner el punto de ruptura",
            "actor": "user",
            "instruction": "En VS Code, haz clic en el margen, a la izquierda del número de la línea 42 de ExportarPedidos.java: aparece un círculo rojo."
          },
          {
            "id": "start-debug",
            "title": "Arrancar Liberty en modo depuración",
            "actor": "user",
            "instruction": "En VS Code, ejecuta «Liberty: Start in debug mode» desde la paleta de comandos y elige `backend`. Liberty arranca en modo dev en un terminal de VS Code, y el depurador de Java se adjunta solo cuando el servidor está listo.",
            "longRunning": true
          },
          {
            "id": "run-scenario",
            "title": "Lanzar el escenario que ejercita el código",
            "actor": "user",
            "instruction": "Con el depurador adjunto, lanza en otro terminal el escenario «Exportar los pedidos del mes en CSV». La ejecución se detiene en el punto de ruptura y sigue cuando la reanudas.",
            "command": { "argv": ["npx", "cucumber-js", "--name", "Exportar los pedidos del mes en CSV"], "cwd": "acceptance-tests" },
            "longRunning": true
          }
        ],
        "cleanup": [
          {
            "id": "stop-debug",
            "title": "Parar la depuración y Liberty",
            "actor": "user",
            "instruction": "En VS Code, para la sesión de depuración y para la aplicación con el comando Stop de Liberty Tools."
          }
        ],
        "breakpoints": [
          { "file": "backend/src/main/java/com/acme/pedidos/ExportarPedidos.java", "line": 42, "status": "planned" }
        ],
        "configurations": [
          {
            "name": "Liberty: adjuntar a backend",
            "origin": "generated",
            "definition": {
              "type": "java",
              "request": "attach",
              "name": "Liberty: adjuntar a backend",
              "hostName": "localhost",
              "port": 7777,
              "projectName": "backend"
            }
          }
        ],
        "endpoints": [
          { "target": "backend", "kind": "debug", "protocol": "jdwp", "host": "localhost", "port": 7777 },
          { "target": "backend", "kind": "app", "url": "http://localhost:9080" }
        ]
      }
    }
  ]
}
```

### `examples/react-vite.json`

```json
{
  "title": "React sobre Vite con VS Code",
  "note": "Ejemplo ilustrativo: los nombres, las rutas y los puertos son de un proyecto inventado, y no se ha probado en una máquina real. Supone una configuración «Vite: frontend» en el `.vscode/launch.json` del proyecto.",
  "calls": [
    {
      "tool": "debug_targets",
      "arguments": {
        "workspace": "/home/ana/pedidos",
        "files": ["frontend/src/pedidos/BotonExportar.tsx", "frontend/src/pedidos/BotonExportar.css"]
      },
      "result": {
        "contractVersion": "1.0",
        "workspace": "/home/ana/pedidos",
        "ides": [{ "id": "vscode", "name": "Visual Studio Code", "available": true }],
        "targets": [
          {
            "id": "frontend",
            "title": "Web de pedidos (React sobre Vite)",
            "technology": "react-vite",
            "sources": ["frontend/src/**"],
            "files": ["frontend/src/pedidos/BotonExportar.tsx", "frontend/src/pedidos/BotonExportar.css"],
            "ides": ["vscode"],
            "state": "stopped"
          }
        ],
        "unmatchedFiles": []
      }
    },
    {
      "tool": "debug_launch_plan",
      "arguments": {
        "workspace": "/home/ana/pedidos",
        "targets": ["frontend"],
        "breakpoints": [
          { "file": "frontend/src/pedidos/BotonExportar.tsx", "line": 18 },
          { "file": "frontend/src/pedidos/BotonExportar.css", "line": 3 }
        ],
        "scenarios": ["Exportar los pedidos del mes en CSV"]
      },
      "result": {
        "contractVersion": "1.0",
        "workspace": "/home/ana/pedidos",
        "ide": "vscode",
        "targets": ["frontend"],
        "summary": "El servidor de desarrollo de Vite en el puerto 5173 y un navegador lanzado por el depurador de VS Code.",
        "steps": [
          {
            "id": "open-ide",
            "title": "Abrir el proyecto en VS Code",
            "actor": "agent",
            "command": { "argv": ["code", "/home/ana/pedidos"] }
          },
          {
            "id": "open-breakpoint-1",
            "title": "Abrir BotonExportar.tsx en la línea 18",
            "actor": "agent",
            "command": { "argv": ["code", "--goto", "/home/ana/pedidos/frontend/src/pedidos/BotonExportar.tsx:18"] }
          },
          {
            "id": "set-breakpoints",
            "title": "Poner el punto de ruptura",
            "actor": "user",
            "instruction": "En VS Code, haz clic en el margen, a la izquierda del número de la línea 18 de BotonExportar.tsx: aparece un círculo rojo."
          },
          {
            "id": "start-dev-server",
            "title": "Arrancar el servidor de desarrollo de Vite",
            "actor": "user",
            "instruction": "En un terminal, arranca el servidor de desarrollo y déjalo en marcha. Está listo cuando muestra la dirección http://localhost:5173.",
            "command": { "argv": ["npm", "run", "dev", "--", "--port", "5173", "--strictPort"], "cwd": "frontend" },
            "longRunning": true
          },
          {
            "id": "start-debug",
            "title": "Iniciar la depuración en el navegador",
            "actor": "user",
            "instruction": "En la vista Run and Debug de VS Code, elige «Vite: frontend» e inicia la depuración. Se abre un navegador en http://localhost:5173 con el depurador puesto.",
            "longRunning": true
          },
          {
            "id": "run-scenario",
            "title": "Seguir el escenario en el navegador",
            "actor": "user",
            "instruction": "En ese navegador, sigue a mano los pasos del escenario «Exportar los pedidos del mes en CSV». Si el código del punto de ruptura se ejecuta al cargar la página, recárgala."
          }
        ],
        "cleanup": [
          {
            "id": "stop-debug",
            "title": "Parar la depuración y el servidor de desarrollo",
            "actor": "user",
            "instruction": "Para la sesión de depuración en VS Code y el servidor de desarrollo en su terminal."
          }
        ],
        "breakpoints": [
          { "file": "frontend/src/pedidos/BotonExportar.tsx", "line": 18, "status": "planned" },
          { "file": "frontend/src/pedidos/BotonExportar.css", "line": 3, "status": "rejected", "reason": "No es código en el que el depurador pueda detenerse." }
        ],
        "configurations": [
          {
            "name": "Vite: frontend",
            "origin": "project",
            "definition": {
              "type": "msedge",
              "request": "launch",
              "name": "Vite: frontend",
              "url": "http://localhost:5173",
              "webRoot": "${workspaceFolder}/frontend"
            }
          }
        ],
        "endpoints": [{ "target": "frontend", "kind": "app", "url": "http://localhost:5173" }]
      }
    }
  ]
}
```
