# openspec-change-lifecycle

## ADDED Requirements

### Requirement: Volver a la rama de origen con branch-change
`.agents/openspec/branch-change.mjs` DEBE permitir, a los dos agentes y al plugin, cambiar a la rama de origen (la última de `x-main`, o `main`) con el árbol limpio. Con el árbol sucio NO DEBE cambiar de rama y DEBE indicar que hay que hacer antes el commit o guardar los cambios. A ninguna otra rama permanente DEBE poder cambiarse así.

#### Scenario: Volver a la rama de origen con el árbol limpio

```gherkin
Given el clon está en una rama temporal `exportar-datos`, con el árbol limpio
When se vuelve a la rama de origen con `branch-change.mjs`
Then el clon queda en la rama de origen
```

#### Scenario: No se vuelve con el árbol sucio

```gherkin
Given el clon está en una rama temporal `exportar-datos`, con cambios sin commit
When se vuelve a la rama de origen con `branch-change.mjs`
Then el clon sigue en la rama `exportar-datos`
And se indica que hay que hacer antes el commit o guardar los cambios
```
