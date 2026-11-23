# apply-progress

## Purpose
Mientras implementa tasks, el workflow de apply puede mostrar el plan en la lista de tareas del agente, si la tiene: la indicación de `operations.apply.guidance` de `openspec/config.yaml` lo pide en los dos agentes, igual en los dos modos del autopilot. `tasks.md` sigue siendo la única fuente de verdad.

## ADDED Requirements

### Requirement: La indicación de apply pide reflejar tasks.md en la lista de tareas del agente
`openspec/config.yaml` DEBE llevar esta indicación como primer elemento de `operations.apply.guidance`, literal:

```yaml
operations:
  apply:
    guidance:
      - >-
        If this agent has a built-in way to show the user a todo or task list
        (a progress checklist tool), use it while implementing tasks as a
        read-only mirror of the tracking file, so the user can follow the
        plan at a glance. At the start, load the tasks the CLI returns, in
        the same order and with their numbering, with the ones already done
        marked as completed; if that is more than about a dozen entries, use
        one entry per task group with its done/total count instead. Mark a
        task in progress when you start it, and completed only after its
        checkbox is `- [x]` and the rerun of the apply instructions confirms
        it. The tracking file stays the only source of truth: never show as
        completed something that is not checked there, and write nothing to
        the repository for this. If the agent has no such tool, this entry
        asks for nothing: the built-in progress output is enough.
```

El CLI de OpenSpec DEBE darla, la primera de `operationGuidance`, en las instrucciones de apply de cualquier change.

#### Scenario: El CLI da la indicación de la lista de tareas

```gherkin
Given un clon del proyecto con un change en curso `exportar-datos`
When se piden las instrucciones de apply de `exportar-datos`
Then la primera indicación de apply es la de la lista de tareas
```

### Requirement: La indicación no depende del modo del autopilot
La indicación de la lista de tareas DEBE estar igual en el modo normal y en el modo auto. Al ajustar `openspec/config.yaml` al modo, el plugin `openspec-autopilot` NO DEBE cambiarla ni moverla: las indicaciones de una task por sesión, cuando están, DEBEN ir después de ella.

#### Scenario Outline: La indicación sigue la primera en los dos modos

```gherkin
Given un clon del proyecto cuyo `openspec/config.yaml` tiene la indicación de la lista de tareas
And un usuario con el plugin en modo <modo>
When se carga el plugin
Then la primera indicación de apply es la de la lista de tareas
And las indicaciones de una task por sesión <después>

Examples:
  | modo   | después                       |
  | normal | van después de ella           |
  | auto   | no están                      |
```

#### Scenario: Ida y vuelta entre los modos

```gherkin
Given un clon del proyecto cuyo `openspec/config.yaml` tiene la indicación de la lista de tareas
And un usuario con el plugin en modo normal
When el usuario cambia el plugin a modo auto
And el usuario cambia el plugin a modo normal
Then `openspec/config.yaml` queda igual que antes de cargar el plugin
```

### Requirement: La lista de tareas no se activa desde el proyecto
Tener la lista de tareas es una preferencia de cada usuario. Los archivos versionados del proyecto NO DEBEN activar la herramienta de lista de tareas de ningún agente: ni `CLAUDE_CODE_ENABLE_TODO_TOOLS` en `.claude/settings.json` ni `experimental.todo` en una configuración de OpenCode del proyecto.

#### Scenario: Ningún archivo versionado activa la lista de tareas

```gherkin
Given el proyecto
When se leen sus archivos de configuración de los agentes
Then ninguno activa la herramienta de lista de tareas
```
