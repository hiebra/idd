## Why

El workflow de apply recorre `tasks.md`, y el usuario solo ve cómo avanza en la salida de texto de la sesión. Claude Code y OpenCode tienen una lista de tareas que se ve aparte (`TaskCreate`/`TaskUpdate` en Claude Code, `todowrite` en OpenCode), pero el workflow no la usa. En una prueba con el CLI 1.17.0, un agente sin indicaciones hizo el apply sin buscarla. Lo único que el workflow lee siempre, en los dos agentes, es `operations.apply.guidance` de `openspec/config.yaml`. Una indicación ahí puede pedir que, si el agente tiene esa lista, la use como reflejo de `tasks.md`.

## What Changes

- **Una indicación nueva en `operations.apply.guidance`, la primera de la lista**: si el agente tiene una lista de tareas para el usuario, la usa mientras implementa tasks como reflejo de solo lectura del archivo de tracking:
  - la carga con las tasks que da el CLI, en su orden y con su numeración, con las hechas ya completadas, o con una entrada por grupo, con su recuento, si son más de una docena;
  - marca una task en curso al empezarla y completada solo cuando su checkbox está `- [x]` y lo confirma la repetición de las instrucciones de apply;
  - `tasks.md` sigue siendo la única fuente de verdad: no escribe nada en el repositorio por la lista;
  - sin esa herramienta, la indicación no pide nada.
- **No depende del modo del autopilot**: está igual en el modo normal y en el auto, y el plugin no la toca. Su bloque de «una task por sesión» sigue añadiéndose al final de la lista y quitándose sin tocar nada más del archivo.
- **La herramienta no se activa desde el proyecto**: que el agente la tenga es una preferencia de cada usuario. Por defecto, Claude Code solo la da en algunos modelos, y en OpenCode es experimental y está desactivada. El README dice cómo activarla en local, sin archivos versionados: `CLAUDE_CODE_ENABLE_TODO_TOOLS=1` en Claude Code y `experimental.todo: true` en la configuración global de OpenCode.
- **La suite admite otras indicaciones de apply junto al bloque**: los pasos y la prueba del núcleo que hoy dan por hecho que el bloque es la única indicación de apply del proyecto.

Fuera de alcance: crear o mantener un archivo de progreso, cambiar el workflow de apply o el CLI, y comprobar en la suite cómo usa el modelo la lista, que no se puede ejecutar allí.

## Capabilities

### New Capabilities
- `apply-progress`: la indicación de apply que pide reflejar `tasks.md` en la lista de tareas del agente, si la tiene, con su texto literal y su lugar en `openspec/config.yaml`.

### Modified Capabilities

## Impact

- `openspec/config.yaml`: la indicación nueva, al principio de `operations.apply.guidance`.
- `acceptance-tests/`: pasos de la capability nueva; generalizar `withoutBlock`, `applyItems` y la prueba `the project config.yaml keeps every other byte in both modes`. Hoy fallan tres comprobaciones con la indicación.
- `.opencode/plugins/openspec-autopilot/lib/apply-guidance.mjs`: no cambia. Ya conserva otras indicaciones de apply, que es lo que exige su spec.
- README: la sección del modo auto dice «cuatro indicaciones»; hay que añadir la indicación nueva y cómo activar la lista en cada agente.
- ADR-0025 no aplica: la indicación no depende de ninguna preferencia ni la escribe un plugin.
- El wiki, en la resincronización tras el archive.
