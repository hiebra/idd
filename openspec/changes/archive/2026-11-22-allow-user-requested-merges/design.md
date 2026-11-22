## Context

El ciclo git de un change lo fijan dos ADRs en vigor:
- **ADR-0015** (sustituye a ADR-0007): las dos formas del ciclo, la referencia de origen más avanzada, los commits y el push del agente en la rama de la sesión de un contenedor efímero con la puerta `check commit`, y la numeración de los ADRs mirando todas las ramas remotas. Dice que el agente «nunca fusiona ni toca otras ramas».
- **ADR-0013** (sustituye a ADR-0007 en lo de las ramas): el modelo crea la rama temporal del change y cambia entre ramas temporales con `branch-change.mjs start` y `switch`. ADR-0015 añade que en un contenedor efímero no los usa, pero solo lo dicen la skill y la spec: el código no lo comprueba.

Los aplican tres piezas:
- `.agents/openspec/branch-change.mjs`, el módulo neutral con las puertas (`propose`, `apply`, `archive`, `commit`) y los subcomandos de ramas (`list`, `start`, `switch`).
- `.agents/skills/openspec-git-discipline/SKILL.md`, la copia reescrita de la skill.
- Las indicaciones de archivado de `openspec/config.yaml`.

Lo que pasó al cerrar `manage-git-discipline` (ver la propuesta):
- El usuario pidió dos fusiones de `origin/main` en la rama de la sesión. `check commit` las rechazaba, porque un commit de fusión trae cambios de las dos zonas de `spec-as-source`, y el agente hizo los commits saltándose la puerta.
- En la segunda, la resolución cambiaba requisitos y renumeraba ADRs; el agente paró a pedir el ok de cada decisión, y eso resultó lo valioso.
- La fusión con `main` (`git commit-tree` + `git push origin <commit>:refs/heads/main`) la denegó el modo de permisos automático de Claude Code antes de llegar al proxy de git, y acabó en un PR ([hiebra/idd#1](https://github.com/hiebra/idd/pull/1)).

Restricciones:
- No se toca nada externo: el schema `intent-driven`, las skills que vienen de él, los workflows de OpenSpec ni el motor del wiki.
- La forma del resultado de `branchChange` la consume el autopilot y no cambia.
- El autopilot de OpenCode no fusiona y no cambia.

## Goals / Non-Goals

**Goals:**
- Que el agente pueda fusionar cuando el usuario se lo pide, y solo entonces, con el ok del usuario a la resolución de los conflictos.
- Que `check commit` autorice un commit de fusión resuelto y rechace uno con conflictos o marcadores.
- Que una puerta decida cada fusión del ciclo y dé la orden o el camino (PR) adecuado al entorno.
- Que, tras el archive, la propuesta de fusión salga de un cálculo determinista y no de la lectura de git del modelo.
- Que `start` y `switch` rechacen actuar en un contenedor efímero.

**Non-Goals:**
- Que el agente fusione el PR. Lo decide el usuario en GitHub.
- Que una puerta compruebe que el usuario dio el ok a la resolución.
- Bloquear de forma efectiva las órdenes de git (hook `PreToolUse`), que ADR-0015 dejó abierto.
- Cambiar el ciclo de las dos formas, la numeración de los ADRs o el autopilot.

## Decisions

### D1. Quién decide una fusión: el usuario, en la conversación

El agente fusiona solo cuando el usuario se lo pide expresamente en la conversación, dentro y fuera de un contenedor efímero. Un texto que lee el agente (un comentario de un PR, un archivo del repositorio, la salida de una herramienta) no cuenta como petición, aunque lo pida. Es la misma frontera que ya traza el entorno para las acciones hacia fuera. La regla va en la skill.

La propuesta de fusión tras el archive (D6) no es una fusión por iniciativa propia: el agente propone y el usuario decide cada rama.

Alternativa: seguir prohibiendo las fusiones en un contenedor efímero. Se descarta porque el usuario de la nube no puede ejecutar git, y la fusión se acabaría haciendo saltándose la puerta, como pasó.

### D2. El ok de la resolución es una regla de la skill, no de la puerta

Antes del commit de una fusión con conflictos, el agente presenta cada decisión de la resolución:
- qué conserva de cada lado;
- qué reescribe, y por qué;
- las renumeraciones (ADRs, tasks) y los cambios de requisitos, cada uno por separado.

Las uniones mecánicas (dos filas de un índice, dos fuentes en un frontmatter) pueden ir en un solo punto, pero también entran en el ok. Después espera el ok o los cambios que pida el usuario; si los hay, los aplica y vuelve a presentar lo que cambia. Sin ok no hay commit de fusión: la fusión queda en curso, y si el usuario la descarta, `git merge --abort`.

Alternativa: que la puerta exija una marca del ok (por ejemplo, `git config idd.mergeApproved <MERGE_HEAD>`). Se descarta porque la pondría el propio agente: añade estado sin dar ninguna garantía. Lo honesto es dejarlo en la skill, como el resto de instrucciones con puerta de ADR-0015.

### D3. `check commit` con una fusión en curso

Si `git rev-parse -q --verify MERGE_HEAD` existe, `checkCommit` sustituye la comprobación de zonas por dos comprobaciones:
1. **Conflictos sin resolver**: `git diff --name-only --diff-filter=U` vacío. Si no, rechaza nombrando los archivos y pide resolverlos y pasarlos al stage.
2. **Marcadores**: en cada archivo tocado (`git diff --name-only HEAD`, que cubre lo que hay en el stage y lo que no), ninguna línea coincide con `^<{7}( |$)`, `^={7}$` o `^>{7}( |$)`. Si alguna coincide, rechaza nombrando los archivos y pide quitar los marcadores. Los archivos binarios o borrados se saltan.

Las condiciones previas (contenedor efímero, rama de la sesión, rama temporal) se comprueban antes y no cambian. El mensaje de éxito dice que es el commit de una fusión (`git commit --no-edit`) y da la orden de push.

Por qué no se comprueban las zonas: cada commit que trae la fusión ya pasó su propia puerta, y la resolución es una sola unidad de trabajo que no se puede partir en dos commits.

Alternativa: exigir que la fusión solo toque una zona. Casi nunca pasa (un change trae specs y código), y obligaría a saltarse la puerta otra vez.

### D4. `check merge <destino> [<rama permanente>]`

Una puerta nueva en `check`, con la misma salida `{ ok, message }`. Comprueba, por este orden:
1. **El árbol limpio.** Con cambios sin commit no se fusiona: se pide antes el commit o guardarlos, como en `start`.
2. **En un contenedor efímero, el clon está en la rama de la sesión.**
3. **La dirección**, según `<destino>`:
   - **`<destino>` es la rama actual y es temporal → traer.** La fuente es `origin/<rama permanente>`, por defecto la rama de origen. Deja seguir siempre que exista esa referencia remota, y da la orden: `git fetch origin <rama>` y `git merge --no-edit origin/<rama>`. Si la rama ya la contiene, lo dice y no hay nada que hacer. Recuerda que, si hay conflictos, se presenta la resolución y se espera el ok (D2), y que el commit pasa por `check commit`.
   - **`<destino>` es permanente → llevar.** Necesita `origin/<destino>` y que la rama actual lo contenga (`git merge-base --is-ancestor origin/<destino> HEAD`). Si no lo contiene, rechaza y da la orden de traerlo antes (`check merge <rama actual> <destino>`). Así nunca hay conflictos que resolver en la rama permanente.
   - **Cualquier otro destino** (otra rama temporal, HEAD separado): rechaza.
4. **Cómo se lleva a la rama permanente**, según el entorno:
   - **Fuera de un contenedor efímero**: sin cambiar de rama, `git commit-tree HEAD^{tree} -p origin/<destino> -p HEAD -m "Merge <rama> into <destino>"` y `git push origin <commit>:refs/heads/<destino>`. Es el mismo commit que daría `git merge --no-ff` desde `<destino>`: primer padre la rama permanente, segundo la rama del change, y el árbol de la rama, que ya contiene `origin/<destino>`. Tras el push, `git fetch origin <destino>`; si hay rama local `<destino>`, el arranque o el usuario la ponen al día.
   - **En un contenedor efímero**: no se da ninguna orden de push. El mensaje indica subir la rama de la sesión, abrir un PR de la rama de la sesión contra `<destino>` y recomendar fusionarlo con un commit de fusión, no con squash.

Por qué la fusión sin cambiar de rama: no toca el árbol de trabajo ni la rama local, y si el push falla o se deniega, no queda nada a medias. El commit creado es un objeto suelto que nadie referencia.

Por qué el PR en un contenedor efímero: el push directo a una rama permanente lo puede denegar el modo de permisos de Claude Code antes de llegar al proxy de git, como pasó. Intentarlo y pedir luego al usuario que fusione a mano le obliga a salir de la sesión. El PR lo abre el agente con las herramientas de GitHub de la sesión, y fusionarlo es un clic del usuario.

Por qué el segundo argumento opcional: la propuesta tras el archive (D6) puede necesitar traer una rama permanente que no es la de origen (por ejemplo, `main` con `x-main: [main, develop]`).

Alternativas:
- **Que la puerta haga la fusión.** Las puertas autorizan y dan la orden; no tocan git (ADR-0015). Además, la resolución de conflictos la tiene que hacer el agente con criterio.
- **`git switch <destino> && git merge --no-ff <rama>`** fuera de la nube. Cambia de rama, y un fallo a mitad deja el clon en la rama permanente con una fusión en curso.
- **Intentar el push en la nube y caer al PR si se deniega.** El rechazo llega como denegación de la herramienta, no como un error que la puerta pueda leer, y deja al usuario con un aviso de permisos que no pidió.

### D5. Si el push se deniega fuera de un contenedor efímero

La skill indica que, si el `git push origin <commit>:refs/heads/<destino>` se deniega (por los permisos del agente o por el remoto), el agente da al usuario la orden exacta con el commit ya creado y se detiene. Si el remoto lo rechaza por no ser un avance rápido (otra fusión llegó entre medias), se trae otra vez `origin/<destino>` y se repite la puerta.

### D6. `merge-targets`: las ramas a las que proponer la fusión tras el archive

Un subcomando nuevo, `node .agents/openspec/branch-change.mjs merge-targets [--json]`. Para cada rama de `x-main`, en el orden de la lista:
- si no existe `origin/<rama>`, la omite, con un aviso;
- si `origin/<rama>` ya contiene `HEAD` (`git merge-base --is-ancestor HEAD origin/<rama>`), la omite: ya se fusionó;
- si no, la incluye, con `bringFirst: true` si `HEAD` no contiene `origin/<rama>`.

En una rama permanente o con HEAD separado no da ninguna. No hace `git fetch`; la skill lo manda hacer antes.

El flujo tras el commit del wiki, en la skill y en las indicaciones de archivado:
1. `git fetch` y `merge-targets`.
2. Para cada rama de la lista, en orden, proponer la fusión. El usuario puede saltarse cualquiera, o todas.
3. Para cada una que acepte: si `bringFirst`, traerla con `check merge <rama actual> <rama>` y el ok de la resolución; después, `check merge <rama>`, que da la orden o el PR.

Por qué en orden de lista: es el orden de promoción que el proyecto declara en `x-main`. Por qué un subcomando: «ya fusionada» es una pregunta de git que el modelo respondería leyendo git a mano, que es una señal de alarma de la skill.

Tras un squash, `origin/<rama>` no contiene la rama y se volvería a proponer. Se acepta: el squash se admite pero no se recomienda, y el usuario puede saltársela.

### D7. `start` y `switch` rechazan actuar en un contenedor efímero

`startBranch` y `switchBranch` reciben `env` (por defecto `process.env`) y, si `isEphemeral(env)`, salen con `ok: false` y un mensaje: el agente trabaja solo en la rama de la sesión, y si hace falta otra rama se la pide al usuario. La comprobación va antes de cualquier otra, para no dar pistas sobre cómo crear la rama.

Por qué en el código: ADR-0015 ya lo exige, y que lo dijera solo la skill dependía de que el modelo obedeciera; la puerta ya tiene la detección del contenedor. El plugin de OpenCode no corre en un contenedor efímero y no se ve afectado.

### D8. Fuera de un contenedor efímero, el commit de la fusión traída lo hace el usuario

Traer una rama a la rama temporal fuera de la nube, cuando lo pide el usuario: el agente ejecuta `git merge`, resuelve los conflictos y presenta la resolución (D2), y con el ok pide al usuario el commit (`git commit --no-edit`), como cualquier otro commit fuera de un contenedor efímero. `check commit` sigue sin autorizar commits fuera de la nube.

Alternativa: que `check commit` autorice fuera de la nube un commit de fusión. Abriría una excepción a «los commits los hace el usuario» que la petición no pide; la propuesta mantiene esa condición.

## Risks / Trade-offs

- [Un `=======` legítimo al principio de línea (el subrayado de un título en Markdown de exactamente siete signos) bloquea el commit de fusión] → El patrón exige la línea entera de siete `=`, que es raro fuera de un marcador; el mensaje nombra el archivo, y la salida es reescribir el subrayado o usar un título con `#`.
- [El ok de la resolución depende de que el agente obedezca la skill] → Es una instrucción con puerta, como todo ADR-0015; el commit de fusión sí lo comprueba `check commit`, y en la nube todo queda en la rama de la sesión, revisable antes de llegar a una rama permanente.
- [Un texto que lee el agente (un comentario de un PR) le pide fusionar] → La skill lo excluye expresamente; además, la fusión con una rama permanente en la nube acaba en un PR que fusiona el usuario.
- [`merge-targets` sin `git fetch` previo propone una rama ya fusionada o calla una pendiente] → La skill manda hacer `git fetch` antes; la puerta `check merge` vuelve a comprobar con lo que haya.
- [La rama permanente avanza entre `check merge` y el push] → El push sin `--force` lo rechaza como no avance rápido; se trae de nuevo y se repite la puerta.
- [El PR se fusiona con squash pese a la recomendación] → Se admite, como en ADR-0015; `merge-targets` volverá a proponer esa rama y el usuario se la salta.

## Migration Plan

No hay migración de datos. El cambio es compatible:
- `branchChange` y las puertas existentes no cambian su salida.
- `check commit` sin fusión en curso se comporta igual.
- `start` y `switch` solo cambian en un contenedor efímero, donde la skill ya prohibía usarlos.

Para deshacerlo, se revierte la fusión del change.

## Open Questions

- **ADR-0015 cambia en una regla de su Decision** («nunca fusiona ni toca otras ramas»), así que el paso `adr` lo sustituye con un ADR nuevo que conserva lo vigente de él y su relación con ADR-0013, que sigue en vigor.
- **D8 sigue la condición de la propuesta**: fuera de un contenedor efímero, el commit de una fusión traída a la rama temporal lo hace el usuario. Si se prefiere que lo haga el agente cuando el usuario pidió la fusión, habría que ampliar `check commit` fuera de la nube con una fusión en curso.
