# session-bootstrap

## ADDED Requirements

### Requirement: En OpenCode, la parte de TUI libera su suscripción a los avisos
En OpenCode, la parte de TUI del adaptador del arranque de sesión DEBE dar de baja su suscripción a los avisos de la parte de servidor cuando OpenCode la descarga: antes de cada recarga en caliente y al cerrarse la TUI. Tras una recarga, cada aviso nuevo DEBE mostrarse una sola vez. Al cerrar una TUI que lleva su propio servidor (`opencode --standalone`), el adaptador NO DEBE dejar ningún error en el terminal.

#### Scenario: Tras recargar, cada aviso nuevo se muestra una vez

```gherkin
Given una sesión de OpenCode abierta en la TUI en el proyecto
And OpenCode ha recargado el plugin del arranque dos veces
When la parte de servidor del arranque emite un aviso nuevo
Then el aviso se muestra una sola vez en la TUI
```

#### Scenario: Al cerrar la TUI no queda ningún error

```gherkin
Given una sesión de OpenCode abierta en la TUI con su propio servidor, en el proyecto
When el usuario cierra la TUI
Then el terminal no muestra ningún error del arranque de sesión
```
