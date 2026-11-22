# ADR-0016: El agente fusiona cuando lo pide el usuario, con su ok a la resolución y por PR hacia una rama permanente en la nube

- Status: accepted, supersedes ADR-0015
- Date: 2026-11-22
- Supersedes: ADR-0015

## Context

ADR-0015 fijó las dos formas del ciclo de un change, los commits y el push del agente en la rama de la sesión de un contenedor efímero y la numeración de los ADRs mirando todas las ramas remotas. También fijó que, en un contenedor efímero, el agente «nunca fusiona ni toca otras ramas», y que fuera de él las fusiones las hace el usuario. `check commit` lo refuerza sin quererlo: un commit de fusión trae cambios de las dos zonas de `spec-as-source` y la puerta lo rechaza.

Al cerrar `manage-git-discipline`, esa regla falló tres veces:
- **El usuario pidió dos fusiones de `origin/main` en la rama de la sesión.** En la nube no puede ejecutar git, y la fusión la tenía que hacer el agente. El agente hizo los commits de fusión saltándose la puerta.
- **La segunda fusión chocaba de fondo con el ciclo** (ramas que crea el modelo, ADRs con el mismo número). El agente paró a pedir el ok de cada decisión de la resolución, y eso fue lo valioso: la resolución cambiaba requisitos y renumeraba ADRs.
- **La fusión con `main` sin cambiar de rama** (`git commit-tree` y `git push origin <commit>:refs/heads/main`) la denegó el modo de permisos automático de Claude Code antes de llegar al proxy de git, aunque el usuario la había pedido. Acabó en un PR (hiebra/idd#1).

Además, ADR-0015 dice que en un contenedor efímero el agente no usa `start` ni `switch` (ADR-0013), pero solo lo dicen la skill y la spec.

Alternativas consideradas:

- **Mantener la prohibición y que el usuario fusione siempre.** En la nube obliga a salir de la sesión, y en la práctica acaba en fusiones que se saltan la puerta.
- **Que el agente fusione por su cuenta cuando lo crea conveniente.** La fusión cambia lo que otros reciben; tiene que decidirla el usuario.
- **Que una puerta exija una marca del ok del usuario a la resolución.** La pondría el propio agente: añade estado sin dar garantía.
- **En la nube, intentar el push a la rama permanente y caer al PR si se deniega.** La denegación llega como un rechazo de la herramienta, no como un error legible, y deja al usuario con un aviso de permisos que no pidió.
- **Fusionar con `git switch <destino> && git merge --no-ff`.** Cambia de rama, y un fallo a mitad deja el clon en la rama permanente con una fusión en curso.

## Decision

- **El agente fusiona solo cuando el usuario se lo pide expresamente en la conversación,** dentro y fuera de un contenedor efímero. Nunca por iniciativa propia, ni porque lo pida un texto que lee (un comentario de GitHub, un archivo, la salida de una herramienta).
- **La resolución de conflictos necesita el ok del usuario.** Antes del commit de una fusión con conflictos, el agente presenta cada decisión: qué conserva de cada lado, qué reescribe y por qué, con las renumeraciones y los cambios de requisitos. Las uniones mecánicas pueden ir agrupadas, pero también entran en el ok. Sin ok no hay commit de fusión. Es una regla de la skill.
- **`check commit` admite un commit de fusión resuelto.** Con `MERGE_HEAD`, no comprueba las zonas, porque cada commit que entra ya las respetaba; exige que no quede ningún conflicto sin resolver ni ningún marcador de conflicto en los archivos tocados. Las demás condiciones se mantienen.
- **Una puerta, `check merge <destino> [<rama permanente>]`, decide cada fusión del ciclo:**
  - traer `origin/<rama permanente>` a la rama temporal se admite siempre, con el árbol limpio;
  - llevar la rama temporal a una rama permanente solo se admite si la rama ya contiene `origin/<destino>`, para que no haya conflictos en la rama permanente;
  - fuera de un contenedor efímero, se lleva sin cambiar de rama, con `git commit-tree HEAD^{tree} -p origin/<destino> -p HEAD` y `git push origin <commit>:refs/heads/<destino>`, el mismo resultado que `git merge --no-ff`; si el push se deniega, el agente da al usuario la orden exacta;
  - en un contenedor efímero, se lleva siempre por PR de la rama de la sesión contra `<destino>`, recomendando fusionarlo con un commit de fusión, no con squash. No se intenta el push ni se pide al usuario que fusione a mano.
- **Tras el archive se propone la fusión con las ramas de `x-main`,** en el orden de la lista, omitiendo las que ya contienen la rama del change. Lo calcula `branch-change.mjs merge-targets`. El usuario puede saltarse cualquiera.
- **Fuera de un contenedor efímero, los commits los sigue haciendo el usuario,** también el de una fusión traída a la rama temporal.
- **`start` y `switch` rechazan actuar en un contenedor efímero,** en el código y no solo en la skill.
- **Sigue vigente de ADR-0015:**
  - las dos formas del ciclo, admitidas por las puertas: la recomendada, con el change entero en una rama temporal, el archive en ella y una sola fusión con `--no-ff`; y la canónica de intent-driven, con la propuesta fusionada antes del apply y el archive en la rama de origen sin tasks pendientes. El squash se admite, pero no se recomienda;
  - el merge-base contra la más avanzada de la rama de origen local y `origin/<origen>`, y un change que ya está igual en la rama de origen no cuenta;
  - todo rechazo de una puerta dice cómo seguir;
  - en un contenedor efímero (`CLAUDE_CODE_CONTAINER_ID` no vacía y `CLAUDE_CODE_REMOTE=true`), el agente hace commit y push en la rama de la sesión que guarda el arranque en `git config idd.sessionBranch`, con commits provisionales y tras `check commit`, y solo hace push a esa rama;
  - ningún commit que no sea de fusión mezcla las zonas de `spec-as-source`;
  - el arranque de sesión deja git listo (clon completo, ramas permanentes al día y, en la nube, `git fetch`);
  - los ADRs se numeran mirando todas las ramas remotas, y `check archive` rechaza un número repetido;
  - las citas del wiki a commits que no llegan a la rama de origen se resuelven por el blob;
  - lo que ADR-0015 conservó de ADR-0007: ramas permanentes en `x-main`, el change de la rama leído de git, una sola implementación neutral en `.agents/openspec/branch-change.mjs`, un change por rama, el commit del wiki aparte y después del commit del archive, y la copia de `openspec-git-discipline` como reescritura propia que no se sobrescribe desde el origen.

El comportamiento está especificado en `openspec/specs/openspec-change-lifecycle/spec.md`, `openspec/specs/session-bootstrap/spec.md` y `openspec/specs/wiki-first-knowledge/spec.md`.

## Consequences

- En la nube, el usuario puede pedir una fusión sin salir de la sesión, y la resolución de los conflictos la hace el agente con su ok.
- Ninguna fusión llega a una rama permanente con conflictos sin resolver: se resuelven antes, en la rama temporal, y quedan en su historial.
- En la nube, la fusión con una rama permanente cuesta un PR y un clic del usuario; a cambio, no depende de los permisos del agente para subir a una rama permanente.
- El ok de la resolución depende de que el agente obedezca la skill; la puerta solo comprueba que la fusión quedó resuelta.
- `check commit` tiene un caso más, y los marcadores se buscan por patrón: un subrayado de título de siete `=` puede dar un falso positivo.
- Tras un squash, `merge-targets` vuelve a proponer la rama, porque git no la ve fusionada.
- Se mantienen las consecuencias de ADR-0015 que no tratan de las fusiones: el coste de la forma canónica, `check commit` como instrucción con puerta y no como bloqueo, los choques de número detectados antes del archive y la latencia del arranque.

## Relación con ADR-0013

ADR-0013 (el modelo crea las ramas temporales con `branch-change.mjs start` y `switch`, y el autopilot pasa lo producido al stage) sigue en vigor y sustituye la parte de ADR-0007 sobre las ramas; este ADR sustituye a ADR-0015 en el resto. Conviven así:

- Fuera de un contenedor efímero rige ADR-0013: el modelo puede crear la rama temporal del change y cambiar entre ramas temporales; los commits los hace el usuario, y las fusiones también, salvo las que pide al agente.
- En un contenedor efímero, el agente trabaja solo en la rama de la sesión: `start` y `switch` lo rechazan, y si hace falta otra rama se la pide al usuario.
- `start` crea la rama desde la misma referencia de origen que usan las puertas, la más avanzada de la local y `origin/<rama de origen>`.
- El autopilot de OpenCode no fusiona.
