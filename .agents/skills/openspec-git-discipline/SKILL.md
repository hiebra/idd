---
name: openspec-git-discipline
description: Use when running OpenSpec propose, continue, apply, verify, archive, or worktree workflows where proposal artifacts, branches, merges, commits, pushes, or archive timing affect git history.
license: MIT
compatibility: Requires git, Node.js and OpenSpec workflow artifacts.
---

# OpenSpec Git Discipline

<!-- Copia del origen (intent-driven-dev/intent-driven-template) reescrita a propósito con el ciclo de este proyecto: ADR-0015, que sustituye a ADR-0007, ADR-0013, que deja al modelo crear las ramas temporales, y ADR-0024, que lleva el script con la skill. No la sobrescribas al actualizar desde el origen sin revisarlo. La ruta del script va en una sola línea, «El script es: …», que la instalación global sustituye por la ruta absoluta. -->

## Regla central

<!-- lifecycle:core -->
Un change sigue una de las dos formas del ciclo de abajo. Las dos son válidas y las puertas admiten las dos.

El change de la rama, las puertas y las ramas temporales los decide un script de Node que viaja con esta skill, igual para los dos agentes. Ejecútalo desde el directorio del proyecto, que es sobre el que actúa. En las órdenes de esta skill, `<script>` es su ruta, entre comillas si tiene espacios.

El script es: `.agents/skills/openspec-git-discipline/scripts/branch-change.mjs`

- Las ramas permanentes son las de `x-main` en `openspec/config.yaml` (por defecto, `main`); la última es la rama de origen, de la que salen las temporales. Cualquier otra rama local es temporal.
- El change de la rama no se apunta en ningún sitio: se lee de git. Lo calcula `node <script> --json`. Compara con la más avanzada de la rama de origen local y `origin/<rama de origen>`.
- Las puertas las decide `node <script> check <propose|apply|archive|commit> [<change>]`: imprime `{ ok, message }` y sale con 0 si se puede seguir y con 1 si no. Ejecútalo y obedécelo; no lo sustituyas por tu propia lectura de git. Si no deja seguir, su `message` dice cómo seguir.

- Las ramas temporales las manejas solo con el script, nunca con git a mano:
  - `node <script> list` lista las ramas temporales con su change (`--json` para leerlo);
  - `node <script> start <change>` crea la rama del change desde la rama de origen, con el nombre del change, y cambia a ella;
  - `node <script> switch <rama>` cambia a una rama temporal que ya existe.

  Los dos últimos imprimen `{ ok, message }` y no hacen nada con el árbol de trabajo sucio. En un contenedor efímero no los uses: trabaja solo en la rama de la sesión (ver «Commits»).

<!-- lifecycle:forms -->
## Las dos formas del ciclo

- **Forma recomendada: una rama y una sola fusión.** Propuesta, implementación, archive y resincronización del wiki van en una rama temporal; el archive se hace en ella, y la rama llega a la rama de origen en una única fusión con `--no-ff`. La forma recomendada conviene casi siempre: el plan, el código, el archive y el wiki llegan juntos en una sola fusión, y la rama permanente no recibe commits directos.
- **Forma canónica de intent-driven: admitida.** La propuesta se fusiona con la rama de origen antes de implementar; la implementación se hace en otra rama y se fusiona; y el archive y la resincronización del wiki se hacen en la rama de origen, cuando todas las tasks están hechas. La forma canónica conviene cuando el plan se quiere revisar y fusionar aparte, o cuando hay que reservar pronto los números de ADR; a cambio, son tres fusiones y el archive y el wiki llevan commits en la rama permanente. Es una forma admitida, no un error: no la cuestiones si el usuario la sigue.

Sigue la forma que use el usuario; si no dice nada, la recomendada.

## Puertas

<!-- lifecycle:propose -->
### Antes de proponer (`openspec-new-change`)

Ejecuta `node <script> check propose`.

- En una rama temporal sin change, deja seguir.
- En la rama de origen también deja seguir (forma canónica) y avisa de que lo recomendado es una rama temporal. Sigue la forma recomendada salvo que el usuario siga la canónica: crea la rama del change nuevo con `node <script> start <nombre-del-change>` y vuelve a comprobar la puerta.
- Si no sale con 0 porque la rama temporal ya tiene otro change, crea igual la rama del change nuevo con `start`. En cualquier otro caso, explica al usuario su `message` y pregúntale cómo seguir.
- Si `start` no sale con 0 (por ejemplo, porque el árbol tiene cambios sin commit), avisa al usuario con su `message` y espera: no hagas tú el commit ni guardes sus cambios.
- En un contenedor efímero no uses `start`: si hace falta otra rama, explícaselo al usuario y espera.

Para seguir con un change que ya tiene rama, cambia a ella con `switch`; búscala con `list`.

<!-- lifecycle:apply -->
### Antes del apply (`openspec-apply-change`)

Ejecuta `node <script> check apply <change>`. Si sale con 0, sigue: basta con que el change sea el de la rama temporal, tenga o no su propuesta en la rama de origen. También deja seguir si la propuesta ya se fusionó con la rama de origen (forma canónica). Si no sale con 0, detente y explica al usuario su `message`.

El apply puede hacerse en la rama temporal del change o en un worktree de esa rama; en un worktree, ejecuta el comando dentro del worktree.

<!-- lifecycle:archive -->
### Antes del archive (`openspec-archive-change`)

Haz antes `git fetch`, si puedes, para que la puerta vea los ADRs de la rama de origen remota. Ejecuta `node <script> check archive <change>`. Si no sale con 0, detente: no archives, y explica al usuario su `message` (por ejemplo, renumerar un ADR o terminar las tasks).

- En la forma recomendada, el archive se hace en la rama temporal del change, antes de su fusión con la rama de origen.
- En la forma canónica, se hace en la rama de origen, y la puerta solo deja si todas las tasks del change están hechas.

Tras el archive, la resincronización del wiki de las indicaciones de archivado de `openspec/config.yaml` se hace en la misma rama, después del commit del archive.

<!-- lifecycle:commits -->
## Commits

Los momentos de commit del ciclo son:

- tras cada artefacto del plan (proposal, specs, design, adr, tasks);
- tras cada task implementada;
- tras el archive, en un commit aparte;
- tras la resincronización del wiki, en un commit aparte y posterior al del archive.

Un commit, provisional o no, no mezcla la zona de specs (`openspec/`, salvo los `tasks.md`) con la zona de código (todo lo demás). Las fusiones las hace siempre el usuario.

**Fuera de un contenedor efímero**, nunca hagas commits ni fusiones: los hace siempre el usuario. Las únicas operaciones de ramas que haces son las del script (`start` y `switch`).

- **En una sesión del autopilot de OpenCode** (su instrucción empieza por `[openspec-autopilot]`), no pidas commits ni pases nada al stage: al terminar el paso, el plugin pasa lo producido al stage, y el usuario lo revisa y hace el commit.
- **En cualquier otro caso**, en cada momento de commit, pide al usuario el commit y espera a que lo haga o te diga que sigas sin él.

<!-- lifecycle:agent-commits -->
**En un contenedor efímero** (una sesión en la nube: `CLAUDE_CODE_CONTAINER_ID` no vacía y `CLAUDE_CODE_REMOTE=true`), el contenedor se pierde y el usuario no ejecuta git, así que haces tú el commit y el push, sin preguntar, en la rama de la sesión que guardó el arranque (`git config idd.sessionBranch`):

- Haz commit y push en los momentos de commit y cada vez que el entorno avise al final de un turno de que hay cambios pendientes. Valen los commits provisionales, que guardan trabajo a medias.
- Ejecuta `node <script> check commit` antes de cada commit. Si no sale con 0, no hagas el commit y sigue su `message`; por ejemplo, si las zonas están mezcladas, haz un commit por zona.
- Haz el push solo a la rama de la sesión: `git push -u origin <rama de la sesión>`, la orden que da la puerta.
- No fusiones, no cambies de rama, no crees ramas y no hagas push a otras ramas. Si hace falta, pídeselo al usuario.

<!-- lifecycle:merge -->
## La fusión con la rama de origen

La forma recomendada es fusionar la rama temporal con `git merge --no-ff`: con `git log --first-parent`, cada change es una entrada cuyo diff junta el plan, el código, el archive y el wiki, sin perder los commits provisionales. Recomiéndasela al usuario cuando vaya a fusionar.

La forma canónica y el squash también se admiten. El squash se admite porque ningún paso del ciclo depende de que los commits de la rama lleguen a la rama de origen: las citas del wiki a commits de la rama se resuelven entonces por su blob, que guardan los manifiestos de las fuentes. Tras un squash, el change fusionado deja de contar en la rama temporal.

<!-- lifecycle:red-flags -->
## Señales de alarma

- Exigir que la propuesta esté en la rama de origen antes del apply.
- Archivar un change con tasks sin hacer, o después de fusionar la rama temporal en la forma recomendada.
- Decidir una puerta leyendo git a mano en lugar de con el script (`check`).
- Más de un change en la misma rama temporal.
- Crear o cambiar de rama con git a mano, o una rama que no salga de la rama de origen.
- Hacer commit sin `check commit`, o hacer commits o fusiones fuera de un contenedor efímero sin que el usuario lo pida.
- Pedir commits en una sesión del autopilot.
- Fusionar, cambiar de rama, crear ramas o hacer push a otra rama en un contenedor efímero.
- Numerar un ADR sin mirar `adr/` en todas las ramas remotas.

Ante cualquiera de ellas: detente, explica el límite y pide al usuario que deje explícito el estado de git.
