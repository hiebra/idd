# ADR-0013: Un change, una rama temporal que puede crear el modelo, y commits solo del usuario

- Status: accepted, supersedes ADR-0007
- Date: 2026-11-22
- Supersedes: ADR-0007

## Context

ADR-0007 fijó el ciclo de un change: una rama temporal, una sola fusión y el archive en la rama. También fijó que los commits y las fusiones los hace siempre el usuario y que el modelo se los pide tras cada paso. La copia reescrita de `openspec-git-discipline` añadía que el modelo nunca crea ramas: en una rama permanente, avisa y espera.

Las pruebas del autopilot con OpenCode 2.3.2 y un modelo que no obedece (change `autopilot-sesion-operativa`) cambian dos premisas:

- **El modelo que pide el commit** no es fiable: pide commits en mitad de un paso o no los pide. Además, cuando el cierre de una revisión lo decide git (ADR-0014), el commit del usuario es la señal. Un modelo que lo pide, o que lo hace, la confunde.
- **Que el modelo no cree ramas** obliga a salir del agente para empezar un change desde una rama permanente, y a leer git a mano para saltar entre changes. La sesión operativa del autopilot arranca sola, también en una rama permanente, y necesita que el modelo cree la rama del change.

El resto de ADR-0007 sigue valiendo, y por eso se repite aquí entero.

Alternativas consideradas:

- **Matizar ADR-0007 sin sustituirlo.** Esta decisión cambia dos reglas de su Decision, no solo una premisa de su contexto (ADR-0011 matizó ADR-0008 por una premisa).
- **Que el plugin cree la rama.** Sería un caso solo de OpenCode. En Claude Code el modelo seguiría sin poder hacerlo, y el ciclo dejaría de ser el mismo (ADR-0006).
- **Que el modelo haga también el `git add`.** El stage es la propuesta que revisa el usuario. Si lo prepara el modelo, vuelve a depender de que obedezca.

## Decision

- **Ramas permanentes configurables**: la lista ordenada `x-main` de `openspec/config.yaml`, por defecto `["main"]`. Su último elemento es la rama de origen. Cualquier otra rama local es temporal; con HEAD separado no hay ninguna.
- **El change de una rama temporal se lee de git**: es lo que hay en `openspec/changes/` entre el merge-base de la rama con la rama de origen y el árbol de trabajo, con commit o sin él.
- **Una sola implementación neutral**, `.agents/openspec/branch-change.mjs`, sin dependencias, la usan los dos agentes y cualquier automatización. Calcula el change de la rama y las puertas del ciclo. Además, **lista las ramas temporales con su change, crea la rama de un change y cambia de rama temporal**.
- **El modelo crea la rama temporal del change y cambia entre ramas temporales**, solo con esos subcomandos, nunca con git a mano. La rama nueva sale siempre de la rama de origen y se llama como el change. No se crea ni se cambia con el árbol sucio.
- **Un change, una rama, una fusión**: propuesta, implementación, archive y resincronización del wiki se hacen en la rama temporal, que llega a la rama de origen en una única fusión. El archive se hace en la rama temporal, antes de esa fusión.
- **Los commits y las fusiones los hace siempre el usuario.**
  - Fuera del autopilot, el workflow pide el commit tras cada artefacto, cada task, el archive y la resincronización del wiki.
  - En el autopilot, el plugin pasa al stage el producto de cada paso y espera el commit del usuario. Ahí el modelo no pide commits ni toca el stage.
  - El commit del wiki va aparte y después del commit del archivado (ADR-0004).
- **La copia de `openspec-git-discipline` sigue reescrita** con estas reglas, con el mismo nombre y la misma descripción de activación.

El comportamiento está especificado en `openspec/specs/openspec-change-lifecycle/spec.md`.

## Consequences

- Un change sigue costando una rama y una fusión, y empezar uno desde una rama permanente ya no obliga a salir del agente.
- El modelo puede cambiar de rama. Si lo hace mal (por ejemplo, en mitad de otro change), lo frena el árbol sucio. En el autopilot, la ventana desde la que saltó pasa a ser ajena.
- El historial sigue siendo del usuario: ningún componente hace commits ni fusiones.
- En OpenCode con el autopilot, el modelo no pide commits. En Claude Code sí, porque no hay plugin. Lo versionado es igual (ADR-0006).
- Se mantienen las consecuencias de ADR-0007: el riesgo de no revisar la propuesta por separado, la inhibición con varios changes en una rama, la necesidad de la rama de origen para el merge-base y la copia de `openspec-git-discipline`, que no se sobrescribe desde el origen.
