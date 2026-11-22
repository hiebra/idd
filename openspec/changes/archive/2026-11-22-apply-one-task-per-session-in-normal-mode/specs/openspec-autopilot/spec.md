# openspec-autopilot

## ADDED Requirements

### Requirement: Indicaciones de apply según el modo
El modo del plugin decide si el workflow de apply hace una sola task por sesión, también cuando se lanza a mano. Al cargarse su parte de servidor, el plugin DEBE dejar `openspec/config.yaml` con las indicaciones de «una task por sesión» en `operations.apply.guidance` si el modo es normal, y sin ellas si el modo es auto. Las indicaciones son estas cuatro, literales y en este orden, cada una como un elemento de la lista:

```yaml
operations:
  apply:
    guidance:
      - >-
        Standing instruction from the project owner: apply runs one tracked
        task per session. Take it as given that the user interrupts after every
        completed task; this is the built-in "User interrupts" pause, declared
        in advance. So in this session the task to work on is the first one the
        CLI returns with `done: false`.
      - >-
        Implement that task in this top-level interactive session. Do not
        delegate it to a subagent or any other non-interactive agent, so that
        every built-in pause (unclear task, design issue, added scope, error or
        blocker) is asked to the user and answered in this session.
      - >-
        When the task is marked `- [x]` and the rerun of the apply instructions
        confirms it, that pause applies: go to the built-in "On completion or
        pause, show status" step instead of continuing to the next task. Show
        it as completion if the CLI now reports `all_done`; otherwise as a
        pause whose reason is the session boundary and whose way forward is a
        new session (fresh context) running this same apply workflow for this
        change. The built-in loop resumes there from the first pending task, as
        any resumed apply does.
      - >-
        Change nothing else. Steps, CLI commands, checkbox updates, pause
        conditions, status and completion output, and completion criteria stay
        exactly as the built-in workflow defines them, so the change ends up as
        a single uninterrupted apply would leave it. Add nothing on account of
        the session split: no handoff or progress files, no notes or markers in
        the tracking file, no extra commits. This guidance applies only while
        implementing tasks, not to verification or any other workflow that
        reads this output.
```

#### Scenario Outline: El archivo sigue al modo

```gherkin
Given un clon del proyecto cuyo `openspec/config.yaml` <estado previo> las indicaciones de una task por sesión
And un usuario con el plugin en modo <modo>
When se carga el plugin
Then `openspec/config.yaml` <resultado> las indicaciones de una task por sesión
And el resto de `openspec/config.yaml` no cambia

Examples:
  | estado previo | modo   | resultado |
  | no tiene      | normal | tiene     |
  | tiene         | normal | tiene     |
  | tiene         | auto   | no tiene  |
  | no tiene      | auto   | no tiene  |
```

### Requirement: El ajuste de config.yaml no toca nada más
Al añadir o quitar las indicaciones de una task por sesión, el plugin NO DEBE cambiar nada más de `openspec/config.yaml`: ni sus comentarios, ni las demás claves, ni otras indicaciones de `apply` o de `archive`. Si el archivo ya está como pide el modo, NO DEBE escribirlo. Si `operations` o `operations.apply` no existen, DEBE crearlos para añadir las indicaciones, y al quitarlas NO DEBE dejar claves vacías que no estaban. El CLI de OpenSpec DEBE seguir leyendo el archivo sin errores en los dos modos. Si no hay `openspec/config.yaml` o el plugin no puede leerlo o escribirlo, NO DEBE crearlo ni bloquear OpenCode: DEBE avisar y seguir.

#### Scenario: Sin cambio de modo no se reescribe el archivo

```gherkin
Given un clon del proyecto cuyo `openspec/config.yaml` tiene las indicaciones de una task por sesión
And un usuario con el plugin en modo normal
When se carga el plugin
Then `openspec/config.yaml` no se escribe
```

#### Scenario: Otras indicaciones de apply se conservan

```gherkin
Given un clon del proyecto cuyo `openspec/config.yaml` tiene en apply la indicación "Keep test summaries concise"
And un usuario con el plugin en modo normal
When se carga el plugin
And el usuario cambia el plugin a modo auto
Then `openspec/config.yaml` tiene en apply solo la indicación "Keep test summaries concise"
```

#### Scenario: Sin indicaciones de apply previas no quedan claves vacías

```gherkin
Given un clon del proyecto cuyo `openspec/config.yaml` no tiene la clave `operations.apply`
And un usuario con el plugin en modo normal
When se carga el plugin
And el usuario cambia el plugin a modo auto
Then `openspec/config.yaml` queda igual que antes de cargar el plugin
```

#### Scenario: El CLI de OpenSpec acepta el archivo en los dos modos

```gherkin
Given un clon del proyecto con un change en curso `exportar-datos`
And un usuario con el plugin en modo normal
When se carga el plugin
Then `openspec instructions apply --change exportar-datos` da las indicaciones de una task por sesión
```

#### Scenario: Sin config.yaml no se crea

```gherkin
Given un clon del proyecto sin `openspec/config.yaml`
And un usuario con el plugin en modo normal
When se carga el plugin
Then no existe `openspec/config.yaml`
And OpenCode sigue funcionando
```
