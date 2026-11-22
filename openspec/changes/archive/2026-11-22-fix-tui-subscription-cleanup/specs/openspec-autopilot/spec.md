# openspec-autopilot

## ADDED Requirements

### Requirement: La parte de TUI libera sus suscripciones
La parte de TUI del plugin DEBE dar de baja todas sus suscripciones a los eventos del plugin cuando OpenCode la descarga: antes de cada recarga en caliente y al cerrarse la TUI. Tras una recarga, solo la carga nueva de la parte de TUI DEBE recibir los eventos del plugin. Al cerrar una TUI que lleva su propio servidor (`opencode --standalone`), el plugin NO DEBE dejar ningún error en el terminal.

#### Scenario: Tras recargar, solo recibe eventos la carga nueva

```gherkin
Given OpenCode abierto en la TUI en una rama temporal
When OpenCode recarga el plugin dos veces
Then solo la última carga de la parte de TUI del plugin recibe sus eventos
```

#### Scenario Outline: Al cerrar la TUI no queda ningún error

```gherkin
Given OpenCode abierto en la TUI con su propio servidor, en una rama temporal
And OpenCode ha recargado el plugin <recargas>
When el usuario cierra la TUI
Then el terminal no muestra ningún error del plugin

Examples:
  | recargas    |
  | ninguna vez |
  | dos veces   |
```
