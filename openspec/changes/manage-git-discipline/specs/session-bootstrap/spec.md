# session-bootstrap

El arranque de sesión deja el clon listo para el ciclo de git del proyecto: completo, con las ramas permanentes locales al día y, en un contenedor efímero, con la rama de la sesión guardada.

## ADDED Requirements

### Requirement: Clon completo y ramas permanentes al día al abrir sesión
Al abrir una sesión, el arranque DEBE completar el clon si es superficial. También DEBE poner al día cada rama permanente local que esté atrasada respecto a `origin/<rama>` y la contenga. No DEBE tocar la rama en la que está el clon, ni una rama permanente local que haya divergido de la remota; de esta última DEBE avisar. Si no puede completar el clon o poner al día una rama, DEBE avisar, y la sesión DEBE arrancar igualmente.

#### Scenario: Un clon superficial queda completo

```gherkin
Given un clon superficial del proyecto
When se abre una sesión en el proyecto
Then el clon deja de ser superficial
```

#### Scenario Outline: Qué hace el arranque con la rama permanente local

```gherkin
Given un clon del proyecto en la rama temporal `claude/exportar`
And la rama permanente local `main` <estado>
When se abre una sesión en el proyecto
Then <resultado>

Examples:
  | estado                                  | resultado                                                     |
  | está atrasada respecto a `origin/main`  | `main` apunta al mismo commit que `origin/main`               |
  | está al día con `origin/main`           | `main` no cambia                                              |
  | ha divergido de `origin/main`           | `main` no cambia y se avisa de que ha divergido               |
```

#### Scenario: La rama en la que está el clon no se toca

```gherkin
Given un clon del proyecto en la rama permanente `main`
And `main` está atrasada respecto a `origin/main`
When se abre una sesión en el proyecto
Then `main` no cambia
And el árbol de trabajo no cambia
```

#### Scenario: Sin acceso al remoto, la sesión arranca

```gherkin
Given un clon superficial del proyecto sin acceso a su remoto
When se abre una sesión en el proyecto
Then se avisa de que no se pudo completar el clon
And la sesión arranca
```

### Requirement: Rama de la sesión guardada en un contenedor efímero
Al abrir una sesión en un contenedor efímero (`CLAUDE_CODE_CONTAINER_ID` no vacía y `CLAUDE_CODE_REMOTE=true`), el arranque DEBE guardar la rama en la que está el clon en `git config idd.sessionBranch`, si no hay ninguna guardada. NO DEBE escribir nada en el árbol de trabajo. Fuera de un contenedor efímero NO DEBE guardar ninguna rama.

#### Scenario Outline: Qué rama de la sesión queda guardada

```gherkin
Given un clon del proyecto en la rama `claude/exportar`
And <sesión>
When se abre una sesión en el proyecto
Then <resultado>
And el árbol de trabajo no cambia

Examples:
  | sesión                                                         | resultado                                         |
  | la sesión está en un contenedor efímero sin rama guardada      | la rama de la sesión guardada es `claude/exportar` |
  | la sesión está en un contenedor efímero con `claude/inicial` guardada | la rama de la sesión guardada es `claude/inicial`  |
  | la sesión no está en un contenedor efímero                     | no hay rama de la sesión guardada                 |
```
