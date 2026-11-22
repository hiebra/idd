# session-bootstrap

## MODIFIED Requirements

### Requirement: Clon completo y ramas permanentes al día al abrir sesión
Al abrir una sesión, el arranque DEBE completar el clon si es superficial. También DEBE poner al día cada rama permanente local que esté atrasada respecto a `origin/<rama>` y la contenga. No DEBE tocar ninguna rama sacada en un directorio del clon (el principal o un worktree), ni una rama permanente local que haya divergido de la remota; de esta última DEBE avisar. Si no puede completar el clon o poner al día una rama, DEBE avisar, y la sesión DEBE arrancar igualmente.

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

#### Scenario: Una rama sacada en otro directorio del clon no se toca

```gherkin
Given el directorio principal del clon en la rama permanente `main`
And `main` está atrasada respecto a `origin/main`
And un worktree del clon en la rama temporal `exportar-datos`
When se abre una sesión en el worktree
Then `main` no cambia
And el árbol de trabajo y el índice del directorio principal no cambian
```

#### Scenario: Sin acceso al remoto, la sesión arranca

```gherkin
Given un clon superficial del proyecto sin acceso a su remoto
When se abre una sesión en el proyecto
Then se avisa de que no se pudo completar el clon
And la sesión arranca
```
