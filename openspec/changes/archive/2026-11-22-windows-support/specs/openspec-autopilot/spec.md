# openspec-autopilot

## ADDED Requirements

### Requirement: El plugin ejecuta el CLI de OpenSpec del proyecto en cualquier sistema
El plugin DEBE ejecutar el CLI de OpenSpec del proyecto, en la versión fijada por su `package.json`, aunque `node_modules/.bin/openspec` no sea un ejecutable, como ocurre en Windows. Si el proyecto no tiene su CLI instalado, DEBE usar el `openspec` del `PATH`, como hasta ahora.

#### Scenario: El enlace de binarios del CLI no es ejecutable

```gherkin
Given un proyecto con un change en la rama y sus dependencias instaladas
And `node_modules/.bin/openspec` del proyecto no es un ejecutable
When se abre OpenCode en el proyecto con la TUI
Then la sesión operativa arranca con el paso que dice `openspec status`
```
