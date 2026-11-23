# openspec-autopilot

## MODIFIED Requirements

### Requirement: Pasar a una sesión es pasar a su rama
Cuando la TUI entra en una sesión, el plugin DEBE dejar el directorio de esa sesión en la rama de trabajo de la sesión. Si la sesión está en otro directorio (otro worktree u otro repositorio), ese directorio ya está en su rama: el plugin NO DEBE hacer checkout y DEBE avisar de la rama y del directorio. Si la sesión está en el mismo directorio que la ventana anterior y su rama no es la de HEAD, el plugin DEBE hacer checkout de la rama de la sesión y avisar de ello. Con cambios sin commit, o con otra sesión de ese directorio trabajando, NO DEBE hacer checkout: la TUI DEBE volver a la sesión anterior, o a la pantalla de inicio si no la hay, con un aviso que diga el motivo y, con cambios sin commit, que se puede hacer el commit o usar un worktree. Excepción: si `openspec/config.yaml` declara `x-main-protected: true` y la rama de la sesión es una de las de `x-main` (o `main` si no está), el plugin DEBE hacer el checkout aunque haya cambios sin commit, que DEBEN pasar a esa rama como en un `git checkout` normal, sin forzar ni guardarlos en un stash, y el aviso DEBE decirlo; con otra sesión trabajando sigue sin hacer checkout. Sin la clave, o con cualquier otro valor, no hay excepción. Si git rechaza el checkout, el plugin NO DEBE tocar nada más, y la TUI DEBE volver a la ventana anterior con un aviso que lleve el error de git. Esto NO DEBE ocurrir justo después de que el plugin salte solo a una sesión al encadenar.

#### Scenario Outline: Entrar en una sesión pone su rama

```gherkin
Given la TUI está en una sesión de la rama de origen, con el árbol limpio
And la sesión operativa de `exportar-datos` está en <dónde>
When la TUI entra en la sesión operativa de `exportar-datos`
Then el directorio de esa sesión está en la rama `exportar-datos`
And se avisa de que se está en la rama `exportar-datos` <cómo>

Examples:
  | dónde                           | cómo             |
  | un worktree de `exportar-datos` | en su worktree   |
  | el mismo directorio             | tras un checkout |
```

#### Scenario Outline: Con cambios sin commit no se cambia de rama

```gherkin
Given la TUI venía de <origen>, en el mismo directorio que la sesión operativa de `exportar-datos`
And el directorio está en la rama de origen con cambios sin commit
When la TUI entra en la sesión operativa de `exportar-datos`
Then el directorio sigue en la rama de origen
And la TUI vuelve a <destino>
And se avisa de que hay cambios sin commit y de que se puede hacer el commit o usar un worktree

Examples:
  | origen                          | destino                         |
  | una sesión de la rama de origen | esa sesión de la rama de origen |
  | ninguna sesión                  | la pantalla de inicio           |
```

#### Scenario: Con otra sesión trabajando no se cambia de rama

```gherkin
Given la TUI está en una sesión de la rama de origen, con el árbol limpio, en el mismo directorio que la sesión operativa de `exportar-datos`
And otra sesión de ese directorio está trabajando
When la TUI entra en la sesión operativa de `exportar-datos`
Then el directorio sigue en la rama de origen
And la TUI vuelve a esa sesión de la rama de origen
And se avisa de que hay una sesión trabajando en ese directorio
```

#### Scenario Outline: Con x-main-protected, los cambios sin commit pasan a una rama de x-main

```gherkin
Given un proyecto cuyo `openspec/config.yaml` declara `x-main: [develop, main]` y `x-main-protected: <protegido>`
And la TUI está en una sesión de la rama temporal `exportar-datos`, con cambios sin commit
And la sesión libre de la rama `<destino>` está en el mismo directorio
When la TUI entra en la sesión de la rama `<destino>`
Then el directorio <resultado>

Examples:
  | protegido | destino        | resultado                                                      |
  | true      | main           | pasa a la rama `main` con sus cambios sin commit               |
  | true      | develop        | pasa a la rama `develop` con sus cambios sin commit            |
  | true      | importar-datos | sigue en la rama `exportar-datos` con sus cambios sin commit   |
  | false     | main           | sigue en la rama `exportar-datos` con sus cambios sin commit   |
```

#### Scenario: Con x-main-protected y otra sesión trabajando no se cambia de rama

```gherkin
Given un proyecto cuyo `openspec/config.yaml` declara `x-main-protected: true`
And la TUI está en una sesión de la rama temporal `exportar-datos`, con cambios sin commit
And la sesión libre de la rama `main` está en el mismo directorio
And otra sesión de ese directorio está trabajando
When la TUI entra en la sesión de la rama `main`
Then el directorio sigue en la rama `exportar-datos` con sus cambios sin commit
And se avisa de que hay una sesión trabajando en ese directorio
```

#### Scenario: Git rechaza el checkout con cambios sin commit

```gherkin
Given un proyecto cuyo `openspec/config.yaml` declara `x-main-protected: true`
And la TUI está en una sesión de la rama temporal `exportar-datos`, con un cambio sin commit en un archivo que difiere en `main`
And la sesión libre de la rama `main` está en el mismo directorio
When la TUI entra en la sesión de la rama `main`
Then el directorio sigue en la rama `exportar-datos` con sus cambios sin commit
And la TUI vuelve a la sesión de la rama `exportar-datos`
And se avisa con el error de git
```
