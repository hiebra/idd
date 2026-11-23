# task-verification-limit

## Purpose
El límite de verificación acota cuánto le cuesta a una persona verificar una task, que en el modo normal del autopilot se revisa una a una. Es una regla del artefacto `tasks` (`rules.tasks` de `openspec/config.yaml`): llega igual a los dos agentes a través del CLI de OpenSpec, y cada proyecto cambia su valor en ese archivo. Se aplica al planificar, como estimación; no es una medida.

## ADDED Requirements

### Requirement: Límite de verificación por task predefinido
El proyecto DEBE nacer con una regla del artefacto `tasks`, en `rules.tasks` de `openspec/config.yaml`, que diga cuánto puede llevar como máximo a una persona verificar una task: 15 minutos. La regla DEBE decir qué cuenta como verificar una task: leer su diff, recorrer y ejecutar los escenarios de aceptación que la cubren y, si la persona quiere, depurarla. La regla DEBE dar una referencia para estimar ese tiempo.

#### Scenario: Las reglas del artefacto tasks llevan el límite de verificación

```gherkin
Given el `openspec/config.yaml` del proyecto
When se consultan las instrucciones del artefacto `tasks` de un change
Then indican que verificar una task no debe llevar a una persona más de 15 minutos
And indican qué cuenta como verificar una task
And dan una referencia para estimar el tiempo de verificación
```

### Requirement: Cada task lleva su estimación de verificación
La regla del artefacto `tasks` DEBE pedir que cada task lleve su estimación de verificación al final de su línea, como `(verificación: ~10 min)`. DEBE pedir también que la task cuya estimación pase del límite se divida en tasks que se puedan verificar por separado.

#### Scenario: Las reglas del artefacto tasks piden la estimación de cada task

```gherkin
Given el `openspec/config.yaml` del proyecto
When se consultan las instrucciones del artefacto `tasks` de un change
Then indican escribir al final de cada task su estimación de verificación
And indican dividir la task cuya estimación pase del límite
```
