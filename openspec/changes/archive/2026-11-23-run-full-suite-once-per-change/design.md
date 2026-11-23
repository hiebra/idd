## Context

La suite de aceptación completa (`npm test` en `acceptance-tests/`) se midió el 2026-11-22 en un contenedor de la nube de 4 CPUs: 9 min 49 s para 332 escenarios, con un solo núcleo ocupado, y 3 min 28 s con `--parallel 4` (una sola pasada, sin repetir). `lint:specs` tarda 0,4 s, `test:core` 66 s y un escenario suelto con `--name`, unos 7 s. El coste está en cada escenario (la copia del proyecto con su `git init` y su commit, unos 250 ms, más los `npm install` y los procesos del agente simulado), así que crece con el número de escenarios: los de las specs pasaron de 117 a 234 en un día.

Hoy solo hay una regla escrita, la plantilla de tasks de `spec-as-source` («3.1 Run the full suite»), más la invariante 4 de `acceptance-test-authoring` (una suite efectiva en verde es la puerta del sync y del archive). Lo demás son costumbres: 8 de 22 changes archivados empiezan con una pasada de base, y cada traída de `origin/main` a una rama relanza la suite entera antes de pedir el ok del usuario. Con la excepción de ADR-0020 (el change entero en una rama temporal, con `x-main-protected: true`), `main` recibe PRs de otras sesiones mientras corre la pasada: el 2026-11-22 hubo 26 fusiones de `main` en ramas para 16 PRs.

Restricciones que ya están en vigor y que este change respeta:

- ADR-0016: el agente solo fusiona cuando el usuario se lo pide. El agente propone traer `main`; no lo trae por su cuenta.
- ADR-0020 y las puertas de `branch-change.mjs`: el ciclo y sus puertas no cambian.
- ADR-0025: lo que gestiona el plugin en `operations.apply.guidance` es un bloque literal; nada de este change lo toca.
- `openspec/config.yaml` es neutro respecto a las zonas, y `.agents/skills/spec-as-source/references/tasks.md` ya está reescrito a propósito en el proyecto.

## Goals / Non-Goals

**Goals:**

- Que la suite completa se lance una sola vez por change, en la task de cierre y con la rama de origen ya traída.
- Que cada task ejecute solo los escenarios que cubre.
- Que traer una rama permanente a la rama del change se compruebe sin relanzar la suite completa.
- Que las reglas lleguen igual a Claude Code y a OpenCode, por el CLI de OpenSpec.

**Non-Goals:**

- Cambiar el runner o su configuración, incluido `--parallel`.
- Quitar o reducir escenarios.
- Cambiar `operations.apply.guidance` ni el bloque del autopilot.
- Automatizar la composición del `--name` de los dos lados de una fusión.
- Cambiar `check archive`, `check merge` o cualquier otra puerta para que exijan una pasada.

## Decisions

### D1. La regla va en `rules.tasks` y en la plantilla de tasks, no en las indicaciones de apply

`openspec instructions tasks` entrega `rules.tasks` al modelo cuando redacta `tasks.md`, y la plantilla de tasks de `spec-as-source` fija la forma de cada task. Con las dos, el `tasks.md` de cada change nace con una task de cierre que lanza la suite y con cada task de implementación acotada a sus escenarios. El apply solo ejecuta lo que dice cada task.

Alternativas:

- **`operations.apply.guidance`**: llega a cada apply, también a los de changes con tasks ya escritas. Se descartó porque el bloque lo gestiona el plugin del autopilot por su texto canónico, y una indicación fija en el proyecto rompería tres escenarios que parten de una configuración sin otras indicaciones de apply («Otras indicaciones de apply se conservan», «Sin indicaciones de apply previas no quedan claves vacías» y los pasos que comprueban que la clave `operations.apply` no existe). Cambiarlos exigiría un MODIFIED de dos requisitos del autopilot por una regla que no es del autopilot.
- **Solo la skill `acceptance-test-authoring`**: es una copia del origen, con cambios mínimos (gplint); la regla de cuántas veces se lanza es del proyecto, no de la skill del origen.
- **Una puerta nueva (`check suite`)**: añade código y un coste de mantenimiento para una decisión que es un acuerdo de trabajo, no un estado de git.

Coste: los changes con tasks ya escritas siguen con su pasada de base hasta que se reescriban. Es admisible: el ciclo no depende de ella.

### D2. La pasada única va con la rama de origen traída

La task de cierre incluye, antes de la pasada, `git fetch` y, si la rama de origen ha avanzado, proponer al usuario traerla a la rama del change. La regla de `rules.tasks` dice que se pida; traerla sigue siendo del usuario (ADR-0016) y se hace con `check merge`. Así la pasada prueba el árbol que llega a la rama de origen. Si entre la pasada y el PR vuelve a avanzar, rige D3.

### D3. Tras traer una rama permanente, una comprobación acotada

Tras traer una rama permanente, el agente ejecuta lo que sigue. Con conflictos, lo hace antes de pedir el ok a la resolución, y por tanto antes del commit de fusión. Sin conflictos, `git merge --no-edit`, la orden que da `check merge`, hace el commit de fusión él solo: el agente lo hace después de ese commit y antes del push, y arregla lo que falle en un commit aparte antes de subir. Se descartó traer siempre con `--no-commit`, que contradice la orden de la puerta y obligaría a cambiar `branch-change.mjs`, y exigirlo solo con conflictos, porque una fusión limpia también rompe escenarios (hiebra/idd#14).

1. `npm run lint:specs`, que detectó una resolución mal unida (se perdió el cierre de un bloque) y cuesta 0,4 s.
2. `npm run test:core`, unos 66 s. Si falla `two sessions taking control at once`, se repite sola antes de atribuirlo (lecciones de allow-user-requested-merges).
3. Los escenarios de las specs cuyas líneas cambiaron en cualquiera de los dos lados desde su base común, con `--name`.

No se relanza la suite completa. Queda sin cubrir un escenario que ninguno de los dos lados tocó y que depende de código que sí cambió. Lo vería la pasada final del siguiente change. Es el riesgo que se acepta a cambio de 8-10 minutos por fusión, y de la ventana en la que `main` vuelve a avanzar.

Cómo se obtienen los escenarios (manual, sin ayudante):

```
base=$(git merge-base HEAD origin/<rama>)
git diff -U0 "$base" HEAD         -- 'openspec/specs/*/spec.md'
git diff -U0 "$base" origin/<rama> -- 'openspec/specs/*/spec.md'
```

Para cada hunk, el escenario es la última cabecera `#### Scenario` anterior a la línea cambiada; si cambia la cabecera de un requisito, todos los suyos. El resultado entra en un solo `--name` con una alternancia de patrones `^…$`, con los caracteres de las expresiones regulares escapados. Solo `--name` o los tags acotan una pasada: las rutas que se pasan a `cucumber-js` se suman a las del perfil (lección de allow-user-requested-merges).

Alternativas:

- **Solo `lint:specs` y `test:core`**: no ejecuta ningún escenario y habría dejado pasar el fallo de hiebra/idd#14 (dos escenarios del autopilot rotos por el `branch-change.mjs` de otro change).
- **Suite completa tras cada traída (hoy)**: caro y circular, porque `main` avanza mientras corre.
- **Escenarios de la capability entera, en vez de los cambiados**: más simple de componer, pero la del autopilot tiene 102 de 332 escenarios y unos 190 s en una pasada secuencial.

### D4. Dónde se escribe lo de la fusión

En la sección «La fusión con la rama de origen» de `openspec-git-discipline`, con un identificador de sección propio (`<!-- lifecycle:merge-checks -->`) para que la suite compruebe la estructura sin depender de la redacción, como hace con las demás. No se toca la skill del origen más allá de esa sección, y su comentario inicial ya declara lo que el proyecto añade.

### D5. Cómo se comprueba

- `suite-run-policy`: pasos nuevos que leen `openspec instructions tasks --change exportar-datos --json` y comprueban por patrones las reglas (`suite completa`, `--name`, `git fetch`), con un `Given` que ya existe (`un clon del proyecto con un change en curso`). El contenido se comprueba en lo entregado por el CLI, no en `config.yaml`, porque el CLI es lo que ve el modelo. Un escenario más comprueba que las indicaciones de `apply` no mencionan la suite, para que nadie las use para esto sin tocar este change.
- La plantilla de tasks: pasos que leen `.agents/skills/spec-as-source/references/tasks.md`.
- La skill: pasos que leen la sección `lifecycle:merge-checks`, como los demás de `openspec-change-lifecycle`.
- Los pasos nuevos van en un archivo propio (`step-definitions/suite-run-policy.steps.js`); antes de definirlos se contrastan sus expresiones con las genéricas y con las que empiezan igual, y las capturas se restringen a los valores de los `Examples` (lección de fix-wiki-flow-operations).

## Risks / Trade-offs

- **[Un fallo que ningún lado tocó llega a `main`]** → la pasada final del siguiente change lo detecta; el lint y el núcleo siguen cubriendo lo que tocan las specs y el código. Es el trato de D3.
- **[Una task acotada con `--name` omite un escenario que sí rompió]** → la task de cierre ejecuta la suite completa, que es la puerta de sync y de archive (invariante 4 de `acceptance-test-authoring`); si falla ahí, se arregla antes de archivar.
- **[Un `--name` mal escapado ejecuta cero escenarios y da verde]** → las dos reglas piden comprobar el número de escenarios ejecutados con el esperado. Comprobado: con un `--name` que no casa, cucumber-js muestra `0 scenarios` y sale con 0.
- **[Los changes en vuelo conservan su pasada de base]** → sin efecto sobre el ciclo; se reescriben o no, a elección de quien los continúa.
- **[Reglas en texto libre: sin identificadores de sección]** → los pasos comprueban palabras clave de la regla (`--name`, `git fetch`); una reescritura que las cambie rompe el escenario, y es lo que se quiere.

## Migration Plan

No hay migración de datos. Al archivar, las dos specs se sincronizan (`suite-run-policy` es nueva; el requisito de `openspec-change-lifecycle` es ADDED, así que no sustituye ninguno) y las skills y la configuración llegan a las demás ramas con la fusión. Para volver atrás basta revertir la fusión: las reglas son texto y la suite no depende de ellas fuera de sus escenarios.

## Open Questions

- **`--parallel 4` en `npm test`.** Redujo la pasada de 9 min 49 s a 3 min 28 s con el mismo resultado, pero es una sola pasada y la prueba del autopilot «two sessions taking control at once» ya es intermitente con la máquina cargada. Queda fuera de este change; habría que repetirla varias veces para fijarlo. Cada escenario trabaja sobre su copia del proyecto, pero `.extracted/` y `reports/` son compartidos entre ejecuciones.
- **Un ayudante para el `--name` de los dos lados** (por ejemplo, un subcomando de `branch-change.mjs`). No se hace aquí: la composición manual de D3 es suficiente mientras el número de fusiones no crezca; si lo hace, será otro change.
- Ningún ADR en vigor necesita revisarse: ADR-0016, ADR-0020 y ADR-0025 se respetan tal como están.
