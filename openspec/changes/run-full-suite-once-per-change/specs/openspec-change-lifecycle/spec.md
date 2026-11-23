# openspec-change-lifecycle

## ADDED Requirements

### Requirement: Tras traer una rama permanente se comprueba lo traído, sin relanzar la suite completa
Antes del commit de una fusión con la que se trae una rama permanente a la rama del change, y antes de pedir el ok del usuario a su resolución, el agente DEBE ejecutar `npm run lint:specs` y `npm run test:core` en `acceptance-tests/` y, con `--name`, los escenarios de las specs que han cambiado en cualquiera de los dos lados desde su base común. DEBE comprobar que se ejecutó el número de escenarios esperado, porque un `--name` que no casa con ninguno termina con 0 y sin error. NO DEBE lanzar la suite completa: esa pasada la hace una sola vez la última task del change. La skill de disciplina de git DEBE indicarlo en la sección de la fusión.

#### Scenario: La skill indica qué se comprueba tras traer una rama permanente

```gherkin
Given la skill de disciplina de git del proyecto
When se revisa qué indica sobre lo que se ejecuta tras traer una rama permanente a la rama del change
Then indica ejecutar `lint:specs` y `test:core` antes de pedir el ok del usuario
And indica ejecutar con `--name` los escenarios de las specs que cambiaron en cualquiera de los dos lados
And indica comprobar que se ejecutó el número de escenarios esperado
And indica no lanzar la suite completa
```

#### Scenario: La comprobación va antes del commit de la fusión

```gherkin
Given la skill de disciplina de git del proyecto
When se revisa en qué orden indica comprobar lo traído y hacer el commit de la fusión
Then indica comprobar lo traído antes de pedir el ok del usuario
And indica que sin esa comprobación y sin el ok no se hace el commit de fusión
```
