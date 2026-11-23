## Why

La suite de aceptación completa tarda unos 10 minutos en un contenedor de la nube (332 escenarios, un solo núcleo ocupado de cuatro) y su coste crece con cada change: los escenarios de las specs pasaron de 117 a 234 el 2026-11-22. Nada del proyecto dice cuántas veces debe lanzarse. Lo escrito es la plantilla de tasks de `spec-as-source` (una task final, «Run the full suite») y la invariante 4 de `acceptance-test-authoring` (una suite verde es la puerta del sync y del archive). El resto son costumbres que se copian de un `tasks.md` a otro:

- 8 de 22 changes archivados empiezan con una pasada completa de base, antes de tocar nada.
- Tras traer `origin/main` a la rama, cada sesión relanza la suite entera antes de pedir el ok del usuario. Con otras sesiones fusionando PRs, `main` avanza mientras corre y hay que traerlo otra vez (tres veces en hiebra/idd#14).

La pasada única, justo antes de archivar, es la que impone la regla del ciclo. Pero la pasada posterior a una fusión detectó un fallo real en hiebra/idd#14 (dos escenarios del autopilot rotos por el `branch-change.mjs` que llegaba de otro change), así que quitarla sin más dejaría una fusión sin comprobar.

## What Changes

- Una regla escrita sobre cuándo se lanza la suite completa, en `openspec/config.yaml` (el CLI de OpenSpec la entrega a los dos agentes):
  - `rules.tasks`: solo la última task del change lanza la pasada completa, con `origin/main` ya traído a la rama; no hay task de pasada completa de base.
  - Cada task de implementación dice qué escenarios cubre y ejecuta solo esos, con `--name`. Va en las reglas y en la plantilla de tasks de `spec-as-source`, no en `operations.apply.guidance`: una indicación fija ahí rompería tres escenarios del autopilot, que parten de una configuración sin otras indicaciones de apply.
- Qué se ejecuta al traer una rama permanente a la rama del change, antes de pedir el ok del usuario: `lint:specs` y `test:core` siempre, y los escenarios de los dos lados (los del change y los de los changes que llegan) con `--name`. La suite completa no se relanza. Se escribe en la skill `openspec-git-discipline`, en la sección de la fusión, y en la spec que la cubre.
- Antes de la pasada final, el agente hace `git fetch` y, si `main` ha avanzado, propone al usuario traerlo (la decisión sigue siendo suya, ADR-0016).

Fuera de alcance:

- Cambiar el runner: `npm test` en paralelo (`--parallel 4`) queda como pregunta abierta del design, porque una sola pasada no prueba que sea estable.
- Dar de baja o reducir escenarios existentes.
- Cambiar las indicaciones de `apply` ni el bloque del autopilot.
- Que `check merge` componga el `--name` de los escenarios de los dos lados; hoy se compone a mano.

## Capabilities

### New Capabilities
- `suite-run-policy`: cuándo se lanza la suite de aceptación completa y cuándo solo una parte, según las reglas de `openspec/config.yaml` que entrega el CLI al planificar las tasks y la plantilla de tasks de `spec-as-source`.

### Modified Capabilities
- `openspec-change-lifecycle`: qué indica la skill de disciplina de git que se ejecute tras traer una rama permanente a la rama del change, antes del ok del usuario. Es un requisito nuevo (ADDED): no cambia ninguno de los existentes, como el de «El agente fusiona solo cuando el usuario se lo pide».

## Impact

- `openspec/config.yaml`: `rules.tasks`. El archivo es neutro respecto a las zonas. No se toca `operations.apply.guidance`, que gestiona el plugin del autopilot.
- `.agents/skills/openspec-git-discipline/SKILL.md`: la sección «La fusión con la rama de origen».
- `.agents/skills/spec-as-source/references/tasks.md`: la plantilla de tasks (el paso de cada task de implementación y la task de cierre), que esta skill ya reescribe a propósito en el proyecto.
- Los `tasks.md` de los changes futuros, que dejan de empezar con la pasada de base.
- La suite de aceptación: escenarios nuevos de `suite-run-policy`, que leen las reglas por `openspec instructions`, y de `openspec-change-lifecycle`, que leen la skill.
- Sin cambios en el plugin del autopilot ni en `branch-change.mjs`.
