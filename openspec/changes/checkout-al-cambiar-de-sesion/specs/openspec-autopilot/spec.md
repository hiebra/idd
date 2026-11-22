# openspec-autopilot

## ADDED Requirements

### Requirement: Checkout al entrar en la sesión operativa de otra rama
Cada vez que la TUI entra en una sesión o recupera el foco en ella, si la sesión es la dueña no archivada de una rama distinta de la de HEAD, en el mismo directorio que el plugin, y no está trabajando, el plugin DEBE hacer `git checkout` de esa rama antes de aplicar ninguna otra regla, si el árbol está limpio. El checkout NO DEBE forzarse ni usar un stash. Si no lo hace o git lo rechaza, NO DEBE tocar nada más, DEBE avisar al usuario (con el error de git, si lo hay) y DEBE seguir con las reglas de la rama actual. Con HEAD separado, en un contenedor efímero, con una sesión de otro directorio o mientras alguna sesión del autopilot de la rama actual está trabajando, NO DEBE hacer ningún checkout.

#### Scenario: Árbol limpio

```gherkin
Given un clon en la rama temporal `importar-datos`, con el árbol limpio
And la rama temporal `exportar-datos` tiene su sesión operativa en el mismo directorio
When la TUI entra en la sesión operativa de `exportar-datos`
Then el clon pasa a la rama `exportar-datos`
And la sesión operativa de `exportar-datos` se valida con las reglas de su rama
```

#### Scenario: Árbol sucio sin x-main-protected

```gherkin
Given un clon en la rama temporal `importar-datos`, con cambios sin commit
And la rama temporal `exportar-datos` tiene su sesión operativa en el mismo directorio
When la TUI entra en la sesión operativa de `exportar-datos`
Then el clon sigue en la rama `importar-datos` con sus cambios sin commit
And se avisa de que los cambios sin commit impiden cambiar a la rama `exportar-datos`
```

#### Scenario: Sesión de otro directorio

```gherkin
Given un clon en la rama temporal `importar-datos`, con el árbol limpio
And la rama temporal `exportar-datos` tiene su sesión operativa en otro worktree
When la TUI entra en la sesión operativa de `exportar-datos`
Then el clon sigue en la rama `importar-datos`
```

#### Scenario: La sesión operativa de la rama actual está trabajando

```gherkin
Given un clon en la rama temporal `importar-datos`, con el árbol limpio
And la sesión operativa de `importar-datos` está trabajando
And la rama temporal `exportar-datos` tiene su sesión operativa en el mismo directorio
When la TUI entra en la sesión operativa de `exportar-datos`
Then el clon sigue en la rama `importar-datos`
And se avisa de que la sesión operativa de `importar-datos` está trabajando
```

### Requirement: Checkout con el árbol sucio hacia una rama de x-main protegida
Si `openspec/config.yaml` declara `x-main-protected: true` y la rama de la sesión operativa en la que entra la TUI es una de las ramas de `x-main` (o `main` si `x-main` no está), el plugin DEBE hacer el checkout aunque el árbol no esté limpio, y los cambios locales DEBEN pasar a esa rama como en un `git checkout` normal. Sin la clave o con cualquier otro valor DEBE regir la regla del árbol limpio; un valor que no es booleano DEBE tratarse como `false` y avisar.

#### Scenario Outline: Árbol sucio con x-main-protected

```gherkin
Given un proyecto cuyo `openspec/config.yaml` declara `x-main: [develop, main]` y `x-main-protected: <protegido>`
And un clon en la rama temporal `exportar-datos`, con cambios sin commit
And la rama `<destino>` tiene su sesión operativa en el mismo directorio
When la TUI entra en la sesión operativa de `<destino>`
Then el clon <resultado>

Examples:
  | protegido | destino        | resultado                                                   |
  | true      | main           | pasa a la rama `main` con los cambios sin commit            |
  | true      | develop        | pasa a la rama `develop` con los cambios sin commit         |
  | true      | importar-datos | sigue en la rama `exportar-datos` con sus cambios sin commit |
  | false     | main           | sigue en la rama `exportar-datos` con sus cambios sin commit |
```

#### Scenario: x-main-protected con un valor que no es booleano

```gherkin
Given un proyecto cuyo `openspec/config.yaml` declara `x-main-protected: si`
And un clon en la rama temporal `exportar-datos`, con cambios sin commit
And la rama `main` tiene su sesión operativa en el mismo directorio
When la TUI entra en la sesión operativa de `main`
Then el clon sigue en la rama `exportar-datos` con sus cambios sin commit
And se avisa de que `x-main-protected` no es un booleano
```

#### Scenario: Git rechaza el checkout

```gherkin
Given un proyecto cuyo `openspec/config.yaml` declara `x-main-protected: true`
And un clon en la rama temporal `exportar-datos`, con un cambio sin commit en un archivo que difiere en `main`
And la rama `main` tiene su sesión operativa en el mismo directorio
When la TUI entra en la sesión operativa de `main`
Then el clon sigue en la rama `exportar-datos` con sus cambios sin commit
And se avisa con el error de git
```

## MODIFIED Requirements

### Requirement: Validación al volver a la sesión operativa
Cada vez que la TUI entra en la sesión operativa o recupera el foco en ella, si la sesión no está trabajando, el plugin DEBE validarla contra el repositorio. Si HEAD no está en su rama, el plugin DEBE intentar antes el checkout de esa rama según "Checkout al entrar en la sesión operativa de otra rama"; si HEAD sigue sin estar en su rama, DEBE aplicar las reglas de la rama actual. Si su change ya no está en la rama, DEBE quitarle el control, archivarla y actuar como al arrancar en una rama sin change. Si esperaba el árbol limpio y ya lo está, DEBE arrancar el paso. Si su paso no encaja con `openspec status`, DEBE mostrar un modal que explique la discrepancia, sin arreglarla. Que el producto del paso ya exista NO DEBE contar como discrepancia.

#### Scenario: El change de la sesión operativa ya no está en la rama

```gherkin
Given una rama temporal con el change en curso `exportar-datos` y su sesión operativa
And el usuario borra el change `exportar-datos` de la rama
When la TUI recupera el foco en la sesión operativa
Then la sesión deja de ser la operativa y queda archivada
And se crea una sesión operativa que arranca `openspec-new-change`
```

#### Scenario: Esperaba el commit y el árbol ya está limpio

```gherkin
Given una sesión operativa que espera el commit del usuario para empezar el artefacto `design` de `exportar-datos`
And el usuario hace el commit
When la TUI recupera el foco en la sesión operativa
Then la sesión empieza el artefacto `design` sin que el usuario escriba nada
```

#### Scenario: El paso no encaja con openspec status

```gherkin
Given una sesión operativa parada que hace el artefacto `tasks` de `exportar-datos`
And `openspec status` da como siguiente el artefacto `specs`
When la TUI entra en la sesión operativa
Then se muestra un modal que explica que el paso de la sesión no encaja con `openspec status`
And no se crea ni se archiva ninguna sesión
```

#### Scenario: El producto ya existe

```gherkin
Given una sesión operativa parada que hace el artefacto `design` de `exportar-datos`
And el artefacto `design` ya está escrito
When la TUI entra en la sesión operativa
Then no se muestra ningún modal
```
