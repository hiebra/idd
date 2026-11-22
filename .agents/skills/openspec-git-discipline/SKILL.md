---
name: openspec-git-discipline
description: Use when running OpenSpec propose, continue, apply, verify, archive, or worktree workflows where proposal artifacts, branches, merges, commits, pushes, or archive timing affect git history.
license: MIT
compatibility: Requires git, Node.js and OpenSpec workflow artifacts.
---

# OpenSpec Git Discipline

<!-- La base es la skill estándar del origen (intent-driven-dev/intent-driven-template, blob 835e065 de este mismo archivo), traducida, con su estructura. Lo que este proyecto añade es una única excepción, en su propia sección, con su causa (ADR-0020), y lo que la estándar no trata: las puertas de branch-change.mjs, los commits del agente en un contenedor efímero y la numeración de los ADR. No la sobrescribas al actualizar desde el origen sin revisarla. -->

## Regla central

<!-- lifecycle:core -->
Cada cambio de estado de OpenSpec cruza la rama de origen antes de que la fase siguiente dependa de él.

- La propuesta (propose y continue) puede redactarse en una rama, pero tiene que tener commit y estar fusionada con la rama de origen antes de empezar el apply.
- El apply puede hacerse en la rama de origen, en una rama o en un worktree, solo si la propuesta de ese change ya está en la rama de origen.
- El archive solo se hace desde la rama de origen, después de fusionar la implementación.

Nunca hagas commits, ramas ni fusiones si el usuario no lo pide explícitamente. Solo con la excepción (ver abajo) el modelo crea o cambia de rama, y únicamente con `branch-change.mjs`; sin la excepción, lo hace solo si el usuario lo pide. Los commits del agente en un contenedor efímero están en «Commits».

- **Ramas permanentes**: las de `x-main` en `openspec/config.yaml` (por defecto, `main`). La última es la rama de origen. Cualquier otra rama local es temporal.
- **Las comprobaciones las hace `node .agents/openspec/branch-change.mjs check <propose|apply|archive|commit> [<change>]`.** Imprime `{ ok, message }`, más `warning` si deja seguir con un aviso, y sale con 0 si se puede seguir y con 1 si no. Ejecútalo y obedécelo; no lo sustituyas por tu propia lectura de git. Si no deja seguir, su `message` dice cómo seguir. Si trae `warning`, díselo al usuario y pregúntale si sigue a propósito.
- **Las ramas temporales se manejan solo con `branch-change.mjs`**, nunca con git a mano:
  - `node .agents/openspec/branch-change.mjs list` lista las ramas temporales con su change (`--json` para leerlo);
  - `node .agents/openspec/branch-change.mjs start <change>` crea la rama del change desde la rama de origen, con el nombre del change, y cambia a ella;
  - `node .agents/openspec/branch-change.mjs switch <rama>` cambia a una rama temporal que ya existe.

  Los dos últimos imprimen `{ ok, message }` y no hacen nada con el árbol de trabajo sucio. En un contenedor efímero no los uses: trabaja solo en la rama de la sesión.

## La regla y su única excepción

<!-- lifecycle:forms -->
**La regla** es la de arriba, la de la skill estándar de intent-driven: la propuesta llega a la rama de origen antes del apply, y la regla es archivar en la rama de origen tras fusionar la implementación. Nada de lo que permite se detiene ni lleva avisos. Si el usuario no dice qué forma sigue, sigue la regla.

**Excepción: el acceso directo a las ramas permanentes está vetado.**

- **La causa**: la regla exige archivar en la rama de origen, y con el acceso directo a las ramas permanentes vetado eso no se puede hacer sin otra fusión.
- **Solo vale con `x-main-protected: true` en `openspec/config.yaml`.** Las puertas lo leen de ahí (es el campo `protected` de `branch-change.mjs --json`). Sin la clave, no hay excepción, aunque el usuario la prefiera: si cree que hay veto, que lo declare.
- **Con la excepción, el change va entero en una rama temporal**: la propuesta, el apply sin que la propuesta haya llegado a la rama de origen, el archive y la resincronización del wiki se hacen en la rama, que llega a la rama de origen en una sola fusión con `--no-ff`. Cada rama temporal lleva un solo change, y el modelo crea la rama del change con `start` y cambia entre ramas temporales con `switch`.

La excepción no es una forma preferible a la regla: solo existe por su causa.

## Puertas

| Momento | Puerta |
| --- | --- |
| Antes de proponer | `check propose`. Mejor en la rama de origen; si no, la puerta avisa y preguntas al usuario si sigue a propósito. |
| Durante continue | Antes de crear el siguiente artefacto, pide al usuario el commit del anterior, o que siga explícitamente sin él. |
| Tras proponer | Pide al usuario el commit de la propuesta y ofrécele crear una rama para revisarla en un PR. |
| Antes del apply | `check apply <change>`: la propuesta tiene commit en la rama de origen; entonces el apply puede hacerse en la rama de origen, en una rama o en un worktree. |
| Antes del archive | `check archive <change>`: detente salvo que la implementación esté fusionada con la rama de origen y el archive se haga desde ella. |
| Tras el archive | Pide al usuario el commit del archive y de la sincronización de las specs; después, la resincronización del wiki, en un commit aparte. |

<!-- lifecycle:propose -->
### Antes de proponer (`openspec-new-change`)

Ejecuta `node .agents/openspec/branch-change.mjs check propose`.

- En la rama de origen, deja seguir.
- En una rama temporal sin la excepción, deja seguir con un `warning`: díselo al usuario y pregúntale si sigue ahí a propósito. La propuesta tendrá que llegar a la rama de origen antes del apply.
- Con la excepción, en la rama de origen o en una rama temporal que ya tiene otro change, crea la rama del change con `node .agents/openspec/branch-change.mjs start <nombre-del-change>` y vuelve a comprobar la puerta. Para seguir con un change que ya tiene rama, cambia a ella con `switch`; búscala con `list`.
- Si `start` no sale con 0 (por ejemplo, porque el árbol tiene cambios sin commit), avisa al usuario con su `message` y espera: no hagas tú el commit ni guardes sus cambios.
- En un contenedor efímero no uses `start`: si hace falta otra rama, explícaselo al usuario y espera.
- En cualquier otro caso en que no salga con 0, explica al usuario su `message` y pregúntale cómo seguir.

<!-- lifecycle:apply -->
### Antes del apply (`openspec-apply-change`)

Ejecuta `node .agents/openspec/branch-change.mjs check apply <change>`, en el worktree si el apply se hace en uno. Si no sale con 0, detente y explica al usuario su `message`. Cuando la propuesta aún no ha llegado a la rama de origen, dilo así:

> Todavía no debo aplicar este change porque su propuesta no ha llegado a la rama de origen. Una propuesta puede redactarse en una rama, pero el apply solo empieza cuando la propuesta está en la rama de origen. Fusiónala primero con la rama de origen, y después puedo aplicarla desde ella, desde una rama o desde un worktree.

Con la excepción, la puerta deja aplicar el change de la rama temporal aunque su propuesta no esté en la rama de origen.

<!-- lifecycle:archive -->
### Antes del archive (`openspec-archive-change`)

Haz antes `git fetch`, si puedes, para que la puerta vea los ADRs de la rama de origen remota. Ejecuta `node .agents/openspec/branch-change.mjs check archive <change>`. Si no sale con 0, detente: no archives, y explica al usuario su `message` (por ejemplo, fusionar antes la implementación o renumerar un ADR). Cuando la implementación no ha llegado a la rama de origen, dilo así:

> Todavía no debo archivar este change porque el archive se hace desde la rama de origen después de fusionar la implementación. Verify deja un change listo para fusionarse; no sustituye a la fusión.

Con la excepción, el archive se hace en la rama temporal del change, antes de su fusión con la rama de origen.

Tras el archive, la resincronización del wiki de las indicaciones de archivado de `openspec/config.yaml` se hace en la misma rama, después del commit del archive.

## Commits

<!-- lifecycle:commits -->
Los momentos de commit del ciclo son:

- tras cada artefacto del plan (proposal, specs, design, adr, tasks);
- tras cada task implementada;
- tras el archive, en un commit aparte;
- tras la resincronización del wiki, en un commit aparte y posterior al del archive.

Un commit, provisional o no, no mezcla la zona de specs (`openspec/`, salvo los `tasks.md`) con la zona de código (todo lo demás). Las fusiones las hace siempre el usuario.

**Fuera de un contenedor efímero**, nunca hagas commits ni fusiones: los hace siempre el usuario. Las únicas operaciones de ramas que haces son las de `branch-change.mjs` (`start` y `switch`), con la excepción o si el usuario lo pide.

- **En una sesión del autopilot de OpenCode** (su instrucción empieza por `[openspec-autopilot]`), no pidas commits ni pases nada al stage: al terminar el paso, el plugin pasa lo producido al stage, y el usuario lo revisa y hace el commit.
- **En cualquier otro caso**, en cada momento de commit, pide al usuario el commit y espera a que lo haga o te diga que sigas sin él.

<!-- lifecycle:agent-commits -->
**En un contenedor efímero** (una sesión en la nube: `CLAUDE_CODE_CONTAINER_ID` no vacía y `CLAUDE_CODE_REMOTE=true`), el contenedor se pierde y el usuario no ejecuta git, así que haces tú el commit y el push, sin preguntar, en la rama de la sesión que guardó el arranque (`git config idd.sessionBranch`):

- Haz commit y push en los momentos de commit y cada vez que el entorno avise al final de un turno de que hay cambios pendientes. Valen los commits provisionales, que guardan trabajo a medias.
- Ejecuta `node .agents/openspec/branch-change.mjs check commit` antes de cada commit. Si no sale con 0, no hagas el commit y sigue su `message`; por ejemplo, si las zonas están mezcladas, haz un commit por zona.
- Haz el push solo a la rama de la sesión: `git push -u origin <rama de la sesión>`, la orden que da la puerta.
- No fusiones, no cambies de rama, no crees ramas y no hagas push a otras ramas. Si hace falta, pídeselo al usuario.

## La fusión con la rama de origen

<!-- lifecycle:merge -->
Según la regla, la propuesta y la implementación llegan a la rama de origen en fusiones separadas, y el archive y el wiki se hacen después en ella. Con la excepción, la rama temporal llega a la rama de origen en una sola fusión, con `git merge --no-ff`: con `git log --first-parent`, cada change es una entrada cuyo diff junta el plan, el código, el archive y el wiki, sin perder los commits provisionales.

El squash también se admite. El squash se admite porque ningún paso del ciclo depende de que los commits de la rama lleguen a la rama de origen: las citas del wiki a commits de la rama se resuelven entonces por su blob, que guardan los manifiestos de las fuentes. Tras un squash, el change fusionado deja de contar en la rama temporal.

## Señales de alarma

<!-- lifecycle:red-flags -->
- Aplicar una propuesta que solo existe en la rama o el worktree actuales, sin la excepción.
- Tomar lo que se ve en un worktree como prueba de que la propuesta llegó a la rama de origen.
- Crear el siguiente artefacto de continue sin preguntar por el commit del anterior.
- Archivar desde una rama temporal sin la excepción, o antes de fusionar la implementación con la rama de origen.
- Seguir la excepción sin `x-main-protected: true`, o presentarla como preferible a la regla.
- Con la excepción: más de un change en la misma rama temporal, o archivar después de fusionar la rama temporal.
- Decidir una puerta leyendo git a mano en lugar de con `branch-change.mjs check`.
- Crear o cambiar de rama con git a mano, o una rama que no salga de la rama de origen.
- Hacer commits, ramas o fusiones sin que el usuario lo pida, fuera de la excepción y del contenedor efímero.
- Hacer commit sin `check commit`, o pedir commits en una sesión del autopilot.
- Fusionar, cambiar de rama, crear ramas o hacer push a otra rama en un contenedor efímero.
- Numerar un ADR sin mirar `adr/` en todas las ramas remotas.

Ante cualquiera de ellas: detente, explica el límite y pide al usuario que deje explícito el estado de git.
