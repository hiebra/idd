## Why

La disciplina de git del proyecto (ADR-0007) da por hecho un clon local completo y al día, y un usuario que hace él mismo cada commit. En las sesiones en la nube no se cumple nada de eso:

- **El clon llega superficial y con el `main` local desactualizado.** Por eso `branch-change.mjs` calcula mal el merge-base: en una rama recién creada a partir de `main` vio los tres changes ya archivados y bloqueó el `propose`.
- **El usuario no puede ejecutar git**, y el entorno avisa al final de cada turno de que hay que hacer commit y push porque el contenedor es efímero. La regla de que los commits los hace siempre el usuario choca con ese aviso en casi todos los turnos.

Además, con ramas concurrentes, dos changes eligen el mismo número de ADR. Y ADR-0007 sustituyó la forma canónica de intent-driven en vez de admitirla junto a la suya: el agente, que conoce la canónica, sigue cuestionando que el archive se haga en la rama temporal.

## What Changes

- **El arranque de sesión deja el clon listo para git.** Si el clon es superficial, lo completa. Si el `main` local va por detrás de `origin/main`, lo pone al día. Las ramas permanentes son las de `x-main`. El arranque no toca la rama de trabajo.
- **`branch-change.mjs` no se fía de una rama de origen local atrasada.** Si `origin/<rama de origen>` va por delante de la local, calcula el merge-base contra la remota.
- **El arranque guarda la rama de la sesión en un contenedor efímero.** Lo reconoce por las variables del entorno de la nube (`CLAUDE_CODE_CONTAINER_ID` y `CLAUDE_CODE_REMOTE`), y guarda la rama en la configuración local de git (`idd.sessionBranch`), no en el árbol de trabajo. Si ya hay una guardada, la conserva.
- **En un contenedor efímero, el agente hace commit y push en la rama de la sesión.**
  - Lo hace en los momentos de commit del ciclo y cuando avisa el final de turno, sin preguntar, con commits provisionales.
  - Solo puede hacerlo en la rama guardada, y lo decide una puerta nueva, `branch-change.mjs check commit`.
  - Fusionar, tocar otras ramas o subir a una rama permanente sigue prohibido.
  - Fuera de un contenedor efímero, los commits y las fusiones los sigue haciendo el usuario.
- **Los commits provisionales respetan las zonas de `spec-as-source`.** Cada commit es de una sola zona. El commit del archive sigue yendo aparte y antes del commit del wiki.
- **El ciclo de una rama pasa a ser la forma recomendada, y se admite también la forma canónica de intent-driven.**
  - La forma recomendada hace todo el change en una rama temporal, archiva en ella y la lleva a la rama de origen en una sola fusión con `--no-ff`. Con `git log --first-parent`, cada change es una entrada cuyo diff junta el plan, el código, el archive y el wiki.
  - La forma canónica fusiona la propuesta antes del apply y archiva en la rama de origen después de fusionar la implementación. Las puertas la admiten: el apply con la propuesta ya en la rama de origen y el archive en la rama de origen de un change con todas sus tasks hechas.
  - La resincronización del wiki funciona en los dos sitios.
  - Las puertas no castigan salirse de la forma recomendada: `check propose` deja proponer en la rama de origen con un aviso, un change que ya está en la rama de origen no cuenta para la rama temporal (lo que evita el bloqueo tras un squash), y todo rechazo dice cómo seguir.
- **El squash se admite, pero no se recomienda.** Las citas del wiki siguen siendo válidas porque sus manifiestos fijan cada archivo por su blob. La guía del wiki explica cómo resolver una cita cuyo commit no ha llegado a la rama de origen.
- **El número de un ADR nuevo se elige mirando todas las ramas del remoto.** Una regla del proyecto para el artefacto `adr` en `openspec/config.yaml` lo saca del número más alto de `adr/` en `origin/<rama de origen>` y en cada `origin/*`, tras un `git fetch`. `check archive` detiene el archive si un ADR nuevo de la rama usa un número que ya existe en la rama de origen, y la rama renumera sus propios ADRs.
- **Cuándo conviene cada forma queda donde el agente lo lee:** en la skill `openspec-git-discipline` y en las indicaciones de archivado de `openspec/config.yaml`. La forma canónica se presenta como admitida, no como una infracción, para que el agente no la cuestione ni cuestione la recomendada.
- **Un ADR nuevo sustituye a ADR-0007.** Mantiene el ciclo de una rama como forma recomendada y cambia: la forma canónica admitida, la fusión con `--no-ff`, quién hace los commits en un contenedor efímero, los commits provisionales, el squash admitido y la numeración de los ADRs.

Fuera de alcance:
- **Un bloqueo efectivo de las órdenes de git**, por ejemplo con un hook `PreToolUse`: queda abierto para el futuro.
- **Cambiar la numeración `NNNN` de los ADRs.**
- **Modificar nada externo:** el schema `intent-driven`, las skills que vienen de él (incluida `spec-as-source`), los workflows de OpenSpec y el motor del wiki.

## Capabilities

### New Capabilities

### Modified Capabilities
- `openspec-change-lifecycle`:
  - el merge-base contra la rama de origen más avanzada;
  - la rama de la sesión y la puerta `check commit`;
  - los commits y el push del agente en un contenedor efímero, en vez de «los hace siempre el usuario»;
  - los commits provisionales por zonas;
  - la forma recomendada con `--no-ff` y la forma canónica admitida;
  - el squash admitido;
  - la numeración de los ADRs sin choques entre ramas;
  - cuándo conviene cada forma.
- `session-bootstrap`:
  - completar un clon superficial;
  - poner al día las ramas permanentes locales atrasadas;
  - guardar la rama de la sesión en un contenedor efímero.
- `wiki-first-knowledge`: resolver por el blob del manifiesto una cita cuyo commit no está en la rama de origen, y resincronizar el wiki cuando el archive se hace en la rama de origen.

## Impact

- **`.agents/openspec/branch-change.mjs`:**
  - la elección de la referencia de origen;
  - la puerta nueva `check commit`;
  - el apply y el archive de la forma canónica;
  - la comprobación de números de ADR en `check archive`.
- **`.agents/hooks/session-bootstrap.sh`:** completar el clon, poner al día las ramas permanentes y guardar la rama de la sesión. Los adaptadores de los dos agentes no cambian, salvo que haga falta pasarles algo nuevo.
- **`.agents/skills/openspec-git-discipline/SKILL.md`** (la copia reescrita del proyecto): las dos formas del ciclo, la fusión con `--no-ff`, los commits en un contenedor efímero, los commits provisionales y el squash.
- **`openspec/config.yaml`:**
  - la regla para el artefacto `adr`;
  - en sus indicaciones de archivado, cuándo conviene cada forma y la resincronización tras archivar en la rama de origen.
- **`.agents/wiki/guide.md`:** cómo resolver una cita por su blob.
- **`adr/`:** el ADR nuevo que sustituye a ADR-0007.
- **Suite de aceptación:** escenarios con clones superficiales, ramas de origen atrasadas, contenedor efímero o no, `check commit` y números de ADR repetidos, sobre repos git de prueba.
- **README:** las dos formas del ciclo y los commits del agente en la nube.
- **El plugin `openspec-autopilot` de OpenCode no cambia.** Sigue pidiendo al usuario el commit, porque OpenCode no corre en un contenedor efímero.
