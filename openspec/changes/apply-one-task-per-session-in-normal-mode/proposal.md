## Why

En el modo normal del autopilot, cada task va en su sesión y después viene su revisión. Pero el workflow de apply que lee `openspec/config.yaml` no sabe nada de eso: si se lanza a mano (en Claude Code, tras compactar, o con el plugin parado), recorre todas las tasks seguidas, puede delegarlas en un subagente y las preguntas del workflow (task poco clara, problema de diseño, alcance añadido, error) no llegan al usuario en la sesión. El dueño del proyecto quiere que, mientras use el modo normal, el apply haga una sola task por sesión y en la sesión interactiva, se lance como se lance. En el modo auto, en cambio, no las quiere: ese modo existe para avanzar sin paradas.

El modo es una preferencia de cada usuario (`options.auto` en su configuración global de OpenCode, README «Modo auto»), y hoy nada lo refleja en `openspec/config.yaml`, que es lo que leen los workflows en los dos agentes.

## What Changes

- **El plugin `openspec-autopilot` ajusta `openspec/config.yaml` al cargarse, según el modo**:
  - en el modo normal (sin `options.auto: true`), añade a `operations.apply.guidance` las cuatro indicaciones de «una task por sesión», si no están;
  - en el modo auto, las quita, si están.
  Como OpenCode recarga el plugin al cambiar la opción, el archivo sigue al modo en cada cambio.
- **Solo esas cuatro indicaciones**: el resto del archivo no cambia (comentarios, `rules`, `x-main`, las indicaciones de `archive` y cualquier otra indicación de `apply`). Si ya están, en modo normal no se toca nada; si no están, en modo auto tampoco.
- **Las cuatro indicaciones**, literales, en este orden:
  1. apply hace una task por sesión; el usuario interrumpe tras cada task completada (la pausa «User interrupts» declarada de antemano), así que la task de la sesión es la primera que el CLI da con `done: false`;
  2. la task se implementa en la sesión interactiva de primer nivel, sin delegarla en un subagente ni en otro agente no interactivo, para que cada pausa del workflow se pregunte y responda en la sesión;
  3. con la task marcada `- [x]` y confirmada al repetir las instrucciones de apply, se va al paso «On completion or pause, show status»: como completado si el CLI da `all_done`, o como pausa por el límite de la sesión, que se retoma en una sesión nueva con el mismo workflow;
  4. no cambia nada más del workflow, y la división en sesiones no añade nada (ni archivos de traspaso, ni marcas en `tasks.md`, ni commits de más); solo vale al implementar tasks, no en el verify ni en otros workflows.
- **El cambio de `config.yaml` sigue el ciclo de commits**: queda en el árbol de trabajo como cualquier otro cambio, con las reglas del autopilot sobre el árbol limpio y las zonas (se decide en el design).

Fuera de alcance: cambiar cómo el plugin encadena las tasks en los dos modos, que ya hace una task por sesión, y cualquier otra indicación de `config.yaml`.

## Capabilities

### New Capabilities

### Modified Capabilities
- `openspec-autopilot`: un requisito nuevo, el plugin mantiene en `openspec/config.yaml` las indicaciones de apply de «una task por sesión» según el modo: presentes en el modo normal y ausentes en el modo auto, sin tocar nada más del archivo.

## Impact

- `.opencode/plugins/openspec-autopilot/`: un módulo nuevo, sin dependencias, que añade o quita el bloque en `openspec/config.yaml` conservando el resto del archivo, y su llamada al cargar el servidor.
- `openspec/config.yaml`: pasa a llevar el bloque cuando un usuario carga el plugin en modo normal. Es un archivo versionado y lo leen también Claude Code y el CLI de OpenSpec, que debe seguir aceptándolo (`openspec validate`).
- ADR-0006 (asimetría entre agentes) pide que lo versionado sea igual con el plugin y sin él: este change hace que un archivo versionado dependa del modo del plugin, así que necesita un ADR nuevo que lo justifique y acote.
- Suite de aceptación: escenarios del autopilot con los dos modos y con el bloque presente y ausente.
- README («Modo auto») y el artículo del wiki `ciclo-de-un-change-y-autopilot`, que se resincroniza al archivar.
