# openspec-change-lifecycle

## MODIFIED Requirements

### Requirement: La puerta check merge decide las fusiones del ciclo
Antes de una fusión, el agente DEBE ejecutar `node .agents/openspec/branch-change.mjs check merge <rama de destino> [<rama permanente>]`, que imprime `{ ok, message }` y sale con 0 si se puede seguir y con 1 si no. Con el árbol de trabajo sucio, o en un contenedor efímero fuera de la rama de la sesión, NO DEBE dejar seguir.
- **Traer una rama permanente a la rama temporal**: si `<rama de destino>` es la rama actual y es temporal, DEBE dejar seguir, con la orden que trae `origin/<rama permanente>` (por defecto, la rama de origen).
- **Llevar la rama temporal a una rama permanente**: si `<rama de destino>` es permanente, DEBE dejar seguir solo si la rama actual ya contiene `origin/<destino>`; si no, NO DEBE dejar seguir y su mensaje DEBE pedir traer antes `origin/<destino>` a la rama actual.
  - El título de la fusión DEBE nombrar el change de la rama (el del requisito «El change de una rama temporal se lee de git», en curso o archivado): `Merge <change> into <destino>`. Si la rama tiene varios changes, DEBE nombrarlos todos, en orden alfabético y separados por una coma y un espacio. Si no tiene ninguno, DEBE nombrar la rama: `Merge <rama> into <destino>`. Un directorio de `openspec/changes/` cuyo nombre no es kebab-case, que es como OpenSpec nombra los changes, NO DEBE contar para el título.
  - Fuera de un contenedor efímero, su mensaje DEBE dar la fusión sin cambiar de rama: `git commit-tree HEAD^{tree} -p origin/<destino> -p HEAD`, con el título de la fusión como mensaje del commit, y `git push origin <commit>:refs/heads/<destino>`. Si el push se deniega, el agente DEBE dar al usuario la orden exacta y no dejar nada a medias.
  - En un contenedor efímero, su mensaje NO DEBE dar ninguna orden de push: DEBE indicar abrir un PR de la rama de la sesión contra `<destino>` y recomendar fusionarlo con un commit de fusión, no con squash. Si la rama lleva algún change, DEBE indicar además que el PR lleve el título de la fusión, también si ya estaba abierto, y recomendar ese mismo título para el commit de fusión, porque el que propone GitHub nombra la rama de la sesión y no el change. Si no lleva ninguno, NO DEBE dar ningún título para el PR: lo titula el agente, como hasta ahora.
- Cualquier otro destino NO DEBE dejar seguir.

La skill de disciplina de git DEBE indicar que el título de la fusión con una rama permanente es el que da la puerta, y que un PR sin change lo titula el agente.

#### Scenario: Traer la rama de origen a la rama temporal

```gherkin
Given un clon en una rama temporal que no contiene `origin/main`
When se ejecuta la puerta `check merge` hacia la rama temporal
Then la puerta deja seguir
And su mensaje da la orden que trae `origin/main` a la rama temporal
```

#### Scenario: Hacia una rama permanente que la rama no contiene, primero hay que traerla

```gherkin
Given un clon en una rama temporal que no contiene `origin/main`
And la sesión no está en un contenedor efímero
When se ejecuta la puerta `check merge` hacia `main`
Then la puerta no deja seguir
And su mensaje pide traer antes `origin/main` a la rama temporal
```

#### Scenario: Fuera de un contenedor efímero, la fusión con la rama permanente se hace sin cambiar de rama

```gherkin
Given un clon en una rama temporal que contiene `origin/main`
And la sesión no está en un contenedor efímero
When se ejecuta la puerta `check merge` hacia `main`
Then la puerta deja seguir
And su mensaje da la orden `git commit-tree` con los padres `origin/main` y `HEAD` y su push a `main`
And el commit que da esa orden tiene el árbol de la rama temporal y los padres `origin/main` y la rama temporal
```

#### Scenario: En un contenedor efímero, la fusión con la rama permanente se hace por PR

```gherkin
Given un contenedor efímero con `claude/exportar` guardada como rama de la sesión
And el clon está en la rama temporal `claude/exportar`, que contiene `origin/main`
When se ejecuta la puerta `check merge` hacia `main`
Then la puerta deja seguir
And su mensaje indica abrir un PR de `claude/exportar` contra `main` y fusionarlo con un commit de fusión, no con squash
And su mensaje no da ninguna orden de push a `main`
```

#### Scenario: Con el árbol sucio no se fusiona

```gherkin
Given un clon en una rama temporal que no contiene `origin/main`
And hay cambios pendientes en `src/exportar.js`
When se ejecuta la puerta `check merge` hacia la rama temporal
Then la puerta no deja seguir
And se indica que hay que hacer antes el commit o guardar los cambios
```

#### Scenario Outline: El título de la fusión nombra el change de la rama

```gherkin
Given el clon está en la rama temporal `feature/exportar`, que contiene `origin/main`
And la rama temporal lleva <changes>
And la sesión no está en un contenedor efímero
When se ejecuta la puerta `check merge` hacia `main`
Then el commit de fusión que da su orden se titula `<título>`

Examples:
  | changes                                                  | título                                         |
  | el change en curso `exportar-datos`                      | Merge exportar-datos into main                 |
  | el change archivado `exportar-datos`                     | Merge exportar-datos into main                 |
  | los changes en curso `exportar-datos` e `importar-datos` | Merge exportar-datos, importar-datos into main |
  | solo código, sin ningún change                           | Merge feature/exportar into main               |
```

#### Scenario: En un contenedor efímero, el título del PR nombra el change de la rama

```gherkin
Given un contenedor efímero con `claude/exportar` guardada como rama de la sesión
And el clon está en la rama temporal `claude/exportar`, que contiene `origin/main`
And la rama temporal lleva el change archivado `exportar-datos`
When se ejecuta la puerta `check merge` hacia `main`
Then su mensaje indica que el PR lleve el título `Merge exportar-datos into main`, también si ya estaba abierto
And su mensaje recomienda ese mismo título para el commit de fusión
```

#### Scenario: En un contenedor efímero, sin change la puerta no da título al PR

```gherkin
Given un contenedor efímero con `claude/exportar` guardada como rama de la sesión
And el clon está en la rama temporal `claude/exportar`, que contiene `origin/main`
And la rama temporal lleva solo código, sin ningún change
When se ejecuta la puerta `check merge` hacia `main`
Then la puerta deja seguir
And su mensaje no da ningún título para el PR
```

#### Scenario: La skill indica que el título de la fusión es el que da la puerta

```gherkin
Given la skill de disciplina de git del proyecto
When se revisa qué indica sobre el título de la fusión con una rama permanente
Then indica que el título de la fusión es el que da la puerta `check merge`, que nombra el change de la rama
And indica poner ese título al PR y recomendarlo para su commit de fusión
And indica que un PR sin change lo titula el agente, como hasta ahora
```
