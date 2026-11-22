# llm-wiki

## ADDED Requirements

### Requirement: Modo del wiki elegido en local
El wiki DEBE tener dos modos, `full` y `lite`. Cada usuario DEBE poder elegir el modo para sí mismo, en cada agente soportado, sin cambiar ningún archivo versionado del proyecto. Si no elige ninguno, el modo DEBE ser `full`. En cualquiera de los dos modos, el arranque de sesión DEBE instalar el motor del wiki, y el agente DEBE disponer de sus operaciones y recibir la guía del wiki de ese modo.

#### Scenario Outline: El wiki está en el modo que eligió el usuario

```gherkin
Given un clon del proyecto
And el usuario <elección> en <agente>
When se abre una sesión de <agente> en el proyecto
Then el agente recibe la guía del wiki del modo <modo>
And el motor del wiki queda disponible para <agente> en la versión fijada por el proyecto
And ningún archivo versionado del proyecto ha cambiado

Examples:
  | agente      | elección                                       | modo |
  | Claude Code | no ha elegido ningún modo del wiki             | full |
  | Claude Code | ha elegido el modo full del wiki para sí mismo | full |
  | Claude Code | ha elegido el modo lite del wiki para sí mismo | lite |
  | OpenCode    | no ha elegido ningún modo del wiki             | full |
  | OpenCode    | ha elegido el modo full del wiki para sí mismo | full |
  | OpenCode    | ha elegido el modo lite del wiki para sí mismo | lite |
```

### Requirement: Aviso ante un modo del wiki que no existe
Si el usuario elige un modo del wiki que no existe, el arranque de sesión DEBE avisar de ello y nombrar los modos que existen, NO DEBE impedir que la sesión arranque y DEBE dejar el wiki en el modo `full`.

#### Scenario Outline: El usuario elige un modo que no existe

```gherkin
Given un clon del proyecto
And el usuario ha elegido para sí mismo en <agente> un modo del wiki que no existe
When se abre una sesión de <agente> en el proyecto
Then la sesión arranca con normalidad
And se avisa de que ese modo del wiki no existe
And el aviso nombra los modos `full` y `lite`
And el agente recibe la guía del wiki del modo full

Examples:
  | agente      |
  | Claude Code |
  | OpenCode    |
```
