# ADR-0007: Un change, una rama temporal y una sola fusión, con el archive en la rama

- Status: accepted
- Date: 2026-11-21
- Supersedes: -

## Context

El proyecto hereda del origen (`intent-driven-dev/intent-driven-template`) la skill `openspec-git-discipline`, una copia sin cambios en `.agents/skills/`. Su regla central es que cada cambio de estado de OpenSpec cruza `main` antes de la fase siguiente. En la práctica:

- la propuesta se fusiona con `main` antes del apply;
- el archive solo se hace desde `main`, después de fusionar la implementación.

Ni el proyecto ni el origen registran por qué. La crítica abierta en el origen ([intent-driven-dev/intent-driven-template#11](https://github.com/intent-driven-dev/intent-driven-template/issues/11)) cuenta 13 pasos y tres PR por change. Las indicaciones de archivado de `openspec/config.yaml` dan además por hecho que el archive va tras la fusión con `main`.

Para automatizar el ciclo (change `add-openspec-autopilot`), el agente tiene que saber, sin preguntar, qué change corresponde a la rama en la que trabaja. Tampoco hay una noción configurable de qué ramas son permanentes: se da por hecho `main`.

Alternativas consideradas:

- **Mantener las puertas heredadas.** Tres fusiones por change, y un estado del ciclo repartido entre ramas que un plugin no puede seguir.
- **Añadir una skill propia y dejar la heredada.** Los workflows cargarían dos reglas contradictorias.
- **Retirar la heredada sin sustituto.** Se pierden las puertas de commit, que siguen valiendo.
- **Registrar el change de cada rama en un archivo**, o deducirlo de su nombre. Es un estado más que mantener y desincronizar, y ata el ciclo a convenciones de nombres.

## Decision

- **Ramas permanentes configurables**: la lista ordenada `x-main` de `openspec/config.yaml`, por defecto `["main"]`. Su último elemento es la rama de origen, de la que salen todas las ramas temporales. Cualquier otra rama local es temporal; con HEAD separado no hay ninguna.
- **El change de una rama temporal se lee de git**: es lo que hay en `openspec/changes/` entre el merge-base de la rama con la rama de origen y el árbol de trabajo, con commit o sin él. No se guarda en ningún otro sitio ni depende del nombre de la rama.
- **Una sola implementación neutral** calcula ese estado (`.agents/openspec/branch-change.mjs`, sin dependencias). La usan los workflows de los dos agentes y cualquier automatización.
- **Un change, una rama, una fusión**: propuesta, implementación, archive y resincronización del wiki se hacen en la rama temporal, que llega a la rama de origen en una única fusión. El archive se hace en la rama temporal, antes de esa fusión, y nunca en una rama permanente.
- **Los commits y las fusiones los hace siempre el usuario.** Cuando un paso necesita un commit, se le pide. El commit del wiki va aparte y después del commit del archivado (ADR-0004).
- **La copia de `openspec-git-discipline` se reescribe** con estas puertas, con el mismo nombre y la misma descripción de activación. Diverge del origen a propósito.

El comportamiento está especificado en `openspec/specs/openspec-change-lifecycle/spec.md`.

## Consequences

- Un change cuesta una rama y una fusión en lugar de tres, en los dos agentes.
- El estado del ciclo se deduce siempre del repositorio, así que no hay nada que se desincronice, y una automatización puede seguirlo.
- Se asume un riesgo: la propuesta ya no se revisa ni se fusiona por separado antes de implementarla. La vuelta de la fusión intermedia queda como discusión abierta.
- Una rama temporal con más de un change no tiene un change claro, y las automatizaciones se inhiben en ella.
- El merge-base exige que la rama de origen exista en local o como `origin/<rama>`. Sin ella, no se sabe qué change tiene la rama.
- La copia de `openspec-git-discipline` ya no es la del origen: al actualizar desde `intent-driven-template` hay que revisarla, no sobrescribirla.
- Las indicaciones de archivado de `openspec/config.yaml` calculan lo que tocó el change desde el merge-base de la rama, no tras fusionar con `main`.
- Los proyectos derivados heredan el ciclo. Pueden cambiar sus ramas permanentes con `x-main` sin tocar ningún workflow.
