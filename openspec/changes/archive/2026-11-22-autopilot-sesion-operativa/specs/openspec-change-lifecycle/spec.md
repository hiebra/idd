# openspec-change-lifecycle

El modelo puede crear la rama temporal del change y cambiar entre ramas temporales, siempre con el módulo neutral `branch-change.mjs`, para no leer ni escribir git a mano. El commit y la fusión siguen siendo del usuario.

## ADDED Requirements

### Requirement: El modelo crea la rama temporal del change y cambia entre ramas temporales
`.agents/openspec/branch-change.mjs` DEBE permitir, a los dos agentes, listar las ramas temporales con el change de cada una, crear la rama temporal de un change y cambiar a una rama temporal existente. La rama nueva DEBE salir siempre de la rama de origen (la última de `x-main`, o `main`) y llamarse como el change. Crear o cambiar de rama NO DEBE hacerse con el árbol de trabajo sucio, ni a una rama permanente, ni sobre una rama que ya exista al crearla. Los workflows DEBEN usar estos subcomandos en lugar de leer o escribir git a mano.

#### Scenario: Crear la rama del change desde cualquier rama

```gherkin
Given el clon está en una rama temporal con el change en curso `importar-datos`, con el árbol limpio
When se crea la rama del change `exportar-datos` con `branch-change.mjs`
Then el clon queda en la rama `exportar-datos`
And la rama `exportar-datos` sale de la rama de origen
```

#### Scenario: No se crea la rama con el árbol sucio

```gherkin
Given el clon está en la rama de origen con cambios sin commit
When se crea la rama del change `exportar-datos` con `branch-change.mjs`
Then no se crea ninguna rama
And se indica que hay que hacer antes el commit o guardar los cambios
```

#### Scenario: Listar las ramas temporales con su change

```gherkin
Given una rama temporal `exportar-datos` con el change en curso `exportar-datos`
And una rama temporal `pruebas` sin change
When se listan las ramas temporales con `branch-change.mjs`
Then la lista tiene la rama `exportar-datos` con el change `exportar-datos`
And la lista tiene la rama `pruebas` sin change
And la lista no tiene la rama de origen
```

#### Scenario: Cambiar a otra rama temporal

```gherkin
Given una rama temporal `exportar-datos` con el change en curso `exportar-datos`
And el clon está en la rama de origen con el árbol limpio
When se cambia a la rama `exportar-datos` con `branch-change.mjs`
Then el clon queda en la rama `exportar-datos`
```

## MODIFIED Requirements

### Requirement: Los commits y las fusiones los hace el usuario
Ningún workflow de OpenSpec ni ningún componente del proyecto DEBE hacer commits ni fusiones por su cuenta: los hace siempre el usuario. El modelo PUEDE crear la rama temporal del change y cambiar entre ramas temporales, solo con `branch-change.mjs`. El plugin `openspec-autopilot` PUEDE pasar al stage de git el producto de un paso, y en sus sesiones el modelo NO DEBE pedir commits, porque el plugin espera el commit del usuario. Fuera del autopilot, cuando un paso del ciclo necesita un commit, el workflow DEBE pedírselo al usuario. El commit del wiki DEBE ir aparte y después del commit del archive.

#### Scenario: Un artefacto terminado queda sin commit

```gherkin
Given una rama temporal con el change en curso `exportar-datos`
When un workflow termina un artefacto de `exportar-datos` fuera del autopilot
Then el artefacto queda sin commit
And se pide al usuario que haga el commit
```

#### Scenario: En el autopilot, el modelo no pide commits

```gherkin
Given una sesión del autopilot que crea un artefacto de `exportar-datos`
When se lee la instrucción del paso
Then la instrucción no pide al usuario ningún commit
And la instrucción dice que el modelo no haga commits ni pase nada al stage
```
