# openspec-change-lifecycle

## ADDED Requirements

### Requirement: Tras traer una rama permanente se comprueba lo traído, sin relanzar la suite completa
Tras traer una rama permanente a la rama del change, el agente DEBE ejecutar `npm run lint:specs` y `npm run test:core` en `acceptance-tests/` y, con `--name`, los escenarios de las specs que han cambiado en cualquiera de los dos lados desde su base común, y DEBE comprobar que se ejecutó el número de escenarios esperado, porque un `--name` que no casa con ninguno termina con 0 y sin error. Con conflictos, DEBE hacerlo antes de pedir el ok del usuario a la resolución, y por tanto antes del commit de fusión. Sin conflictos, `git merge` hace el commit de fusión él solo: el agente DEBE hacerlo después de ese commit y antes del push, y si algo falla DEBE arreglarlo en un commit aparte antes del push. NO DEBE lanzar la suite completa: esa pasada la hace una sola vez la última task del change. La skill de disciplina de git DEBE indicarlo en la sección de la fusión.

#### Scenario: La skill indica qué se comprueba tras traer una rama permanente

```gherkin
Given la skill de disciplina de git del proyecto
When se revisa qué indica sobre lo que se ejecuta tras traer una rama permanente a la rama del change
Then indica ejecutar `lint:specs` y `test:core`
And indica ejecutar con `--name` los escenarios de las specs que cambiaron en cualquiera de los dos lados
And indica comprobar que se ejecutó el número de escenarios esperado
And indica no lanzar la suite completa
```

#### Scenario: La comprobación va antes del ok o, sin conflictos, antes del push

```gherkin
Given la skill de disciplina de git del proyecto
When se revisa cuándo indica comprobar lo traído
Then indica comprobarlo antes de pedir el ok del usuario a la resolución, si hay conflictos
And indica comprobarlo tras el commit de fusión que hace git y antes del push, si no los hay
And indica arreglar lo que falle en un commit aparte antes del push
```
