# debug-mcp-contract

## Purpose
El contrato del MCP de depuración es la API que debe ofrecer un servidor MCP para que quien verifica un change pueda depurar con su IDE el código que revisa. La plantilla fija el contrato, en `.agents/debug/`, y no incluye ningún servidor. El servidor solo informa: dice qué se puede depurar y qué pasos lanzan el IDE en modo depuración, y esos pasos los hacen el modelo y la persona. Los primeros casos son Java sobre WLP y React sobre Vite, con VS Code.

## ADDED Requirements

### Requirement: El contrato es un archivo versionado con dos tools de MCP
La plantilla DEBE definir el contrato en `.agents/debug/contract.json`. El archivo DEBE declarar la versión del contrato, `1.0`, y dos tools, `debug_targets` y `debug_launch_plan`, y ninguna más. Cada tool DEBE tener la forma de una definición de tool de MCP: nombre, título, descripción, esquema de entrada y esquema de salida. Los dos esquemas DEBEN ser JSON Schema 2020-12 válidos.

#### Scenario: El contrato declara sus dos tools

```gherkin
Given el contrato del MCP de depuración del proyecto
When se lee como un conjunto de tools de MCP
Then declara la versión `1.0` del contrato
And declara las tools `debug_targets` y `debug_launch_plan`, y ninguna más
And cada tool tiene título, descripción y esquemas de entrada y de salida válidos
```

### Requirement: El MCP de depuración solo informa
Las tools del contrato DEBEN ser de solo lectura. DEBEN estar anotadas con `readOnlyHint: true` y `openWorldHint: false`, y su descripción DEBE decir que la tool no arranca ni para procesos, no abre el IDE y no escribe en el árbol de trabajo.

#### Scenario Outline: Cada tool se declara de solo lectura

```gherkin
Given el contrato del MCP de depuración del proyecto
When se lee la tool `<tool>` del contrato
Then está anotada como de solo lectura y de mundo cerrado
And su descripción dice que no arranca ni para procesos, no abre el IDE y no escribe en el árbol de trabajo

Examples:
  | tool              |
  | debug_targets     |
  | debug_launch_plan |
```

### Requirement: Cada llamada se entiende por sus argumentos
Las tools del contrato NO DEBEN depender de una sesión ni de las Roots de MCP. Las dos DEBEN aceptar el parámetro opcional `workspace`, la ruta absoluta del árbol de trabajo que se revisa; por defecto es el directorio en el que corre el servidor. `debug_targets` NO DEBE tener ningún parámetro obligatorio, y `debug_launch_plan` DEBE tener uno solo, `targets`.

#### Scenario Outline: El árbol de trabajo se pasa como parámetro

```gherkin
Given el contrato del MCP de depuración del proyecto
When se lee la tool `<tool>` del contrato
Then acepta el parámetro opcional `workspace`
And sus parámetros obligatorios son <obligatorios>

Examples:
  | tool              | obligatorios   |
  | debug_targets     | ninguno        |
  | debug_launch_plan | solo `targets` |
```

### Requirement: debug_targets dice qué se puede depurar
La respuesta de `debug_targets` DEBE dar el árbol de trabajo al que se refiere, los IDE con los que el servidor sabe lanzar la depuración, con si están disponibles, y los objetivos de depuración. Cada objetivo DEBE llevar un identificador, un título, las rutas de código que cubre, los IDE que lo depuran y su estado: `stopped`, `running`, `debuggable` o `unknown`. Con el parámetro `files`, cada objetivo DEBE decir cuáles de esos archivos le pertenecen, y la respuesta, cuáles no pertenecen a ninguno. Los IDE y los objetivos PUEDEN llevar problemas, cada uno con un código, un mensaje y, si lo hay, su arreglo. Un árbol de trabajo sin nada que depurar NO DEBE ser un error: su respuesta lleva una lista de objetivos vacía.

#### Scenario: Un árbol de trabajo sin nada que depurar es una respuesta válida

```gherkin
Given el contrato del MCP de depuración del proyecto
When se valida una respuesta de `debug_targets` sin objetivos
Then la respuesta cumple el contrato
```

#### Scenario Outline: Lo que no admite una respuesta de debug_targets

```gherkin
Given el contrato del MCP de depuración del proyecto
When se valida una respuesta de `debug_targets` con <defecto>
Then la respuesta no cumple el contrato

Examples:
  | defecto                          |
  | un objetivo sin identificador    |
  | un objetivo sin estado           |
  | un estado que no es del contrato |
```

### Requirement: debug_launch_plan da los pasos para lanzar el IDE en modo depuración
`debug_launch_plan` DEBE aceptar los objetivos que se quieren depurar (`targets`, al menos uno), el IDE (`ide`), los puntos de ruptura (`breakpoints`, cada uno con un archivo relativo al árbol de trabajo, una línea y, si la hay, una condición) y los nombres de los escenarios de aceptación que ejercitan el código (`scenarios`). Su respuesta DEBE dar los pasos (`steps`) en el orden en que hay que hacerlos, al menos uno, y los pasos que dejan todo como estaba (`cleanup`). DEBE decir qué pasa con cada punto de ruptura pedido: `planned`, si algún paso lo pone o pide ponerlo, o `rejected`, con el motivo. PUEDE dar además las configuraciones de depuración del IDE que usa el plan y las direcciones de la aplicación y del depurador.

#### Scenario Outline: Lo que no admite una respuesta de debug_launch_plan

```gherkin
Given el contrato del MCP de depuración del proyecto
When se valida una respuesta de `debug_launch_plan` con <defecto>
Then la respuesta no cumple el contrato

Examples:
  | defecto                                            |
  | un plan sin pasos                                  |
  | un plan sin pasos de limpieza                      |
  | un punto de ruptura sin decir si se ha planificado |
```

### Requirement: Cada paso dice quién lo hace
Cada paso de un plan DEBE llevar un identificador, un título y quién lo hace (`actor`): `agent`, el modelo, o `user`, la persona. Un paso de `agent` DEBE llevar su orden como una lista de argumentos (`command.argv`) y NO DEBE ser de larga duración: termina solo y enseguida, sin arrancar servidores, sin esperar a un depurador y sin ejecutar código que pueda detenerse en un punto de ruptura. Un paso de `user` DEBE llevar una instrucción para la persona, PUEDE llevar la orden que ella ejecuta y PUEDE ser de larga duración. La descripción de `debug_launch_plan` DEBE decir todo eso, y DEBE decir que seguir un plan no deja en el árbol de trabajo archivos que git no ignore.

#### Scenario Outline: Lo que no admite un paso

```gherkin
Given el contrato del MCP de depuración del proyecto
When se valida una respuesta de `debug_launch_plan` con <defecto>
Then la respuesta no cumple el contrato

Examples:
  | defecto                              |
  | un paso de `agent` sin orden         |
  | un paso de `agent` de larga duración |
  | un paso de `user` sin instrucción    |
  | un paso sin decir quién lo hace      |
```

#### Scenario: La descripción de debug_launch_plan dice lo que el modelo puede ejecutar

```gherkin
Given el contrato del MCP de depuración del proyecto
When se lee la tool `debug_launch_plan` del contrato
Then su descripción dice que un paso de `agent` termina solo y enseguida
And su descripción dice que seguir un plan no deja archivos que git no ignore
```

### Requirement: Los errores de una llamada dicen cómo corregirla
El contrato DEBE enumerar los errores de ejecución de sus tools, cada uno con su código y con cuándo se da: `invalid-workspace`, `unknown-target` e `ide-unavailable`. DEBE decir que se devuelven como error de ejecución de la tool (`isError`), con un texto que empieza por el código y dice cómo corregir la llamada. Un punto de ruptura que no se puede poner NO DEBE ser un error de la llamada: va en la respuesta como `rejected`.

#### Scenario: El contrato enumera los errores de ejecución

```gherkin
Given el contrato del MCP de depuración del proyecto
When se leen los errores de ejecución del contrato
Then están `invalid-workspace`, `unknown-target` e `ide-unavailable`, cada uno con cuándo se da
And el contrato dice que se devuelven con `isError` y un texto que empieza por el código
```

### Requirement: Ejemplos para Java sobre WLP y React sobre Vite con VS Code
El contrato DEBE traer en `.agents/debug/examples/` un ejemplo por cada caso inicial, Java sobre WLP y React sobre Vite, con VS Code como IDE. Cada ejemplo DEBE llevar una llamada a cada tool con su respuesta, y todas DEBEN cumplir los esquemas del contrato.

#### Scenario Outline: Los ejemplos cumplen el contrato

```gherkin
Given el ejemplo `<ejemplo>` del contrato del MCP de depuración
When se validan sus llamadas y sus respuestas con los esquemas del contrato
Then todas cumplen el contrato
And el plan del ejemplo es para el IDE `vscode`
And el plan del ejemplo tiene pasos de `agent` y pasos de `user`

Examples:
  | ejemplo      |
  | java-liberty |
  | react-vite   |
```
