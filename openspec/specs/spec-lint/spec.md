# spec-lint Specification

## Purpose
El lint de las specs (`npm run lint:specs` en `acceptance-tests/`) revisa el Gherkin de cada `spec.md` de `openspec/specs/` y de los changes activos, extraído a `.feature` con las mismas líneas. La extracción convierte cada requisito en un `Rule:`, así que todos los escenarios de una spec están dentro de uno.

## Requirements

### Requirement: El lint detecta los defectos de los escenarios de cada requisito
El lint de las specs DEBE fallar cuando un escenario de un requisito tiene un defecto que revisa su configuración, y DEBE informar de cada defecto en la línea del `spec.md` en la que está. Entre esos defectos DEBEN estar un Scenario Outline sin `Examples`, una tabla de `Examples` en un Scenario y un espacio al final de un paso.

#### Scenario Outline: Un defecto en un escenario de un requisito hace fallar el lint

```gherkin
Given una spec con un requisito cuyo escenario tiene <defecto>
When se pasa el lint de las specs
Then el lint falla
And informa del defecto en la línea del spec.md en la que está

Examples:
  | defecto                              |
  | un Scenario Outline sin Examples     |
  | una tabla de Examples en un Scenario |
  | un espacio al final de un paso       |
```

### Requirement: Las specs del proyecto pasan el lint
Las specs vigentes de `openspec/specs/` y los deltas de los changes activos DEBEN pasar el lint de las specs sin errores.

#### Scenario: El lint de las specs del proyecto termina sin errores

```gherkin
Given las specs vigentes y los deltas de los changes activos del proyecto
When se pasa el lint de las specs
Then el lint termina sin errores
```
