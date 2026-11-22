# session-bootstrap

## ADDED Requirements

### Requirement: Finales de línea del repositorio en cualquier clon
El repositorio DEBE fijar finales de línea LF en todos sus archivos de texto, entre ellos los scripts del arranque de sesión y los textos que el arranque entrega o procesa (la guía y el recordatorio del wiki, la regla de comentarios y su recordatorio), para que un clon con `core.autocrlf=true`, el valor por defecto de Git for Windows, los extraiga con LF.

#### Scenario: Clon con conversión de finales de línea

```gherkin
Given un clon del proyecto extraído con `core.autocrlf=true`
When se abre una sesión de OpenCode en el proyecto
Then los scripts del arranque de sesión del clon tienen finales de línea LF
And la guía del wiki se entrega sin los identificadores de sección
```
