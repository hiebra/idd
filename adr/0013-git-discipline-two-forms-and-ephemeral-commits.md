# ADR-0013: Dos formas del ciclo de un change y commits del agente en contenedores efímeros

- Status: accepted, supersedes ADR-0007
- Date: 2026-11-22
- Supersedes: ADR-0007

## Context

ADR-0007 sustituyó la disciplina de git heredada de intent-driven por un ciclo propio: un change en una rama temporal, una sola fusión, el archive en la rama y los commits siempre del usuario. Al usarlo han aparecido cuatro problemas:

- **Las sesiones en la nube rompen sus supuestos.**
  - El clon llega superficial y con la rama de origen local atrasada. `branch-change.mjs` prefería la rama local y, en una rama recién salida de `main`, contó tres changes ya archivados.
  - El contenedor es efímero, el usuario no puede ejecutar git, y el entorno pide commit y push al final de cada turno. La regla de que los commits los hace siempre el usuario choca con eso en casi todos los turnos.
- **Con ramas concurrentes, los ADRs repiten número.** El schema numera con el más alto de `adr/` en la rama de trabajo, y dos ramas que salen del mismo `main` eligen el mismo.
- **Sustituir la forma canónica en vez de admitirla genera fricción.** El agente conoce la forma de intent-driven (fusionar el plan antes del apply y archivar en la rama permanente tras fusionar) y cuestiona la del proyecto. Además, la forma canónica tiene ventajas reales: revisar el plan aparte y reservar pronto los números de ADR.
- **El squash, que se planteó para juntar plan y código en un commit, borra de `main` los commits que cita el wiki.** Además, una fusión con `--no-ff` da lo mismo con `git log --first-parent`.

Alternativas consideradas:

- **Mantener ADR-0007 y parchear solo la nube.** Deja sin resolver la fricción con la forma canónica y los choques de ADRs.
- **Volver a la disciplina heredada.** Recupera las tres fusiones por change y los commits directos en `main` que ADR-0007 quitó, y que chocan con un `main` protegido (intent-driven-template#11).
- **Hacer obligatoria la forma de una rama con `--no-ff`.** Impide la forma canónica, y obligar a `--no-ff` en local con `merge.ff=false` cambiaría también `git pull`.
- **Reconocer la rama de la sesión por el prefijo `claude/`** o porque sea temporal. Depende de convenciones del entorno; guardarla al arrancar es más estricto.
- **Etiquetar el commit del archive** para que el squash no rompa las citas del wiki. Exige crear, subir y proteger etiquetas, y los manifiestos del motor ya fijan cada archivo por su blob.
- **Numerar los ADRs por fecha o por nombre.** Evita los choques de raíz, pero cambia la convención del schema, que es externo.

## Decision

- **Dos formas del ciclo, las dos admitidas por las puertas:**
  - **La recomendada**: el change entero en una rama temporal, el archive en ella y una sola fusión con `--no-ff`. Cada change llega a la rama de origen en un commit de fusión, y `git log --first-parent` muestra un change por entrada.
  - **La canónica de intent-driven**: la propuesta se fusiona con la rama de origen antes del apply, y el archive se hace allí después de fusionar la implementación, si no quedan tasks sin hacer.
  - El squash se admite, pero no se recomienda.
  - La skill y las indicaciones de archivado explican cuándo conviene cada forma. Ninguna se presenta como infracción.
- **Las puertas no castigan ninguna de las dos formas.**
  - El merge-base se calcula contra la más avanzada entre la rama de origen local y `origin/<origen>`.
  - Un change que ya está en la rama de origen con el mismo contenido no cuenta para la rama temporal.
  - Todo rechazo dice cómo seguir.
- **En un contenedor efímero, el agente hace commit y push en la rama de la sesión.**
  - Contenedor efímero es el que tiene `CLAUDE_CODE_CONTAINER_ID` no vacía y `CLAUDE_CODE_REMOTE=true`.
  - El arranque de sesión guarda la rama de la sesión en `git config idd.sessionBranch`.
  - Antes de cada commit, la puerta `check commit` comprueba el contenedor, la rama de la sesión, que sea temporal y que los cambios sean de una sola zona de `spec-as-source`.
  - El agente hace commit en los momentos del ciclo y cuando avisa el final de turno, con commits provisionales si hace falta, y solo hace push a esa rama.
  - Nunca fusiona ni toca otras ramas.
  - Fuera de un contenedor efímero, los commits y las fusiones los sigue haciendo el usuario.
- **El arranque de sesión deja git listo:** completa un clon superficial, pone al día las ramas permanentes locales atrasadas sin tocar la del clon y, en la nube, hace `git fetch`.
- **Los ADRs se numeran mirando todas las ramas remotas,** tras un `git fetch`, por una regla del proyecto en `openspec/config.yaml`. `check archive` rechaza un ADR nuevo cuyo número ya existe en la rama de origen.
- **Las citas del wiki a commits que no llegan a la rama de origen se resuelven por el blob** del manifiesto del motor.
- **Sigue vigente de ADR-0007:**
  - las ramas permanentes configurables con `x-main`;
  - el change de la rama se lee de git, sin guardarlo en ningún sitio;
  - una sola implementación neutral en `.agents/openspec/branch-change.mjs`;
  - un change por rama;
  - el commit del wiki va aparte y después del commit del archive;
  - la copia de `openspec-git-discipline` es una reescritura propia que no se sobrescribe desde el origen.

El comportamiento está especificado en `openspec/specs/openspec-change-lifecycle/spec.md`, `openspec/specs/session-bootstrap/spec.md` y `openspec/specs/wiki-first-knowledge/spec.md`.

## Consequences

- En la nube, el aviso de final de turno deja de chocar con la disciplina del proyecto. Lo que se pierde al reciclar el contenedor se reduce a lo hecho desde el último turno.
- El agente puede seguir la forma canónica que ya conoce sin que el proyecto la trate como error.
- La forma canónica cuesta tres fusiones y commits del archive y del wiki en la rama permanente; con un `main` protegido, eso son PRs. Lo asume quien la elija. El autopilot de OpenCode sigue solo la recomendada.
- Las puertas tienen más casos: la rama permanente con la forma canónica, el squash y `check commit`. La suite tiene que cubrirlos.
- Los permisos del agente en la nube dependen de variables del entorno de Claude Code. Si cambian, la puerta remite al usuario, que es el comportamiento seguro.
- `check commit` es una instrucción con puerta, no un bloqueo. El bloqueo efectivo con un hook `PreToolUse` queda abierto.
- Dos ramas que numeran un ADR casi a la vez siguen chocando, pero el choque se detecta antes de archivar. Renumerar obliga a actualizar las referencias del change.
- El arranque usa la red para completar un clon superficial y, en la nube, para el `git fetch`. Eso añade latencia, pero un fallo solo avisa.
