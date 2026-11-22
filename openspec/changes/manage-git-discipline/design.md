## Context

El ciclo git de un change lo fija ADR-0007: una rama temporal, una sola fusión y el archive en la rama. Lo aplican tres piezas:
- `.agents/openspec/branch-change.mjs`, el módulo neutral que lee de git el change de la rama y decide las puertas `propose`, `apply` y `archive`. Lo usan los workflows de los dos agentes, el plugin `openspec-autopilot` de OpenCode y la suite.
- `.agents/skills/openspec-git-discipline/SKILL.md`, la copia reescrita de la skill de intent-driven, que manda obedecer las puertas y pedir los commits al usuario.
- Las indicaciones de archivado de `openspec/config.yaml`, con la resincronización del wiki.

Lo que ha fallado en la práctica (ver la propuesta):
- **En la nube, el clon llega superficial y con `main` local atrasado.** `branchChange` prefiere `refs/heads/<origen>` aunque `origin/<origen>` vaya por delante, y en una rama recién salida de `main` vio tres changes ya archivados.
- **El contenedor es efímero y el usuario no ejecuta git.** El entorno avisa al final de cada turno de que hay que hacer commit y push.
- **Con ramas concurrentes, los ADRs repiten número.** El schema numera con el más alto de `adr/` en la rama de trabajo.
- **El agente conoce la forma canónica de intent-driven** y cuestiona la del proyecto, que la sustituyó en vez de admitirla.

Qué cambia en cada capability:
- **`openspec-change-lifecycle`:** el ciclo de una rama y una sola fusión pasa a ser la forma recomendada, y se admite también la forma canónica de intent-driven. Además se adapta a clones con la rama de origen local atrasada, a sesiones en contenedores efímeros (donde el agente hace commit y push en la rama de la sesión), al squash y a ramas concurrentes que crean ADRs.
- **`session-bootstrap`:** el arranque deja el clon listo para el ciclo de git: completo, con las ramas permanentes locales al día y, en un contenedor efímero, con la rama de la sesión guardada.
- **`wiki-first-knowledge`:** con el squash, el commit que citan los artículos puede no llegar nunca a la rama de origen; como los manifiestos del motor fijan cada archivo por su blob, la cita sigue siendo resoluble.

Restricciones:
- No se toca nada externo: el schema `intent-driven`, las skills que vienen de él (incluida `spec-as-source`), los workflows de OpenSpec ni el motor del wiki.
- La forma del resultado de `branchChange` la consume el autopilot y no debe romperse.

## Goals / Non-Goals

**Goals:**
- Que las puertas calculen bien el change de la rama con clones superficiales, ramas de origen locales atrasadas y fusiones con squash.
- Que en un contenedor efímero el agente haga commit y push en la rama de la sesión, y nada más, con una puerta que lo decida.
- Que el ciclo admita la forma canónica de intent-driven y recomiende la de una rama con `--no-ff`, sin que las puertas castiguen ninguna de las dos.
- Que los números de ADR no choquen entre ramas, o que el choque se detecte antes de archivar.
- Que las citas del wiki sigan siendo resolubles tras un squash.

**Non-Goals:**
- Bloquear de forma efectiva las órdenes de git, por ejemplo con un hook `PreToolUse`. Queda abierto.
- Cambiar la numeración `NNNN` de los ADRs o cualquier cosa del schema.
- Automatizar la forma canónica en el autopilot de OpenCode, que sigue la de una rama.
- Hacer `git fetch` dentro de las puertas.

## Decisions

### D1. La referencia de origen es la más avanzada de la local y la remota

`branchChange` resuelve `refs/heads/<origen>` (L) y `refs/remotes/origin/<origen>` (R):
- Si solo existe una, usa esa.
- Si L es ancestro de R, usa R; si R es ancestro de L, usa L. Lo comprueba con `git merge-base --is-ancestor`.
- Si han divergido, usa L y añade un aviso a `warnings`.

El resultado añade el campo `originRef` con la referencia usada. Los campos actuales no cambian, así que el autopilot no se entera.

Alternativas: usar siempre R, pero eso ignora el trabajo local sin subir en un clon de un usuario; o hacer `git fetch` en la puerta, pero eso es lento, necesita red y tiene efectos secundarios.

### D2. Un change ya presente en la rama de origen con el mismo contenido no cuenta

Después de sacar los changes del diff desde el merge-base, `branchChange` descarta los que cumplen dos condiciones:
- el árbol de su directorio en `originRef` es el mismo que en `HEAD`, comparando `git rev-parse <ref>:<dir>` con `HEAD:<dir>`;
- no tiene cambios sin commit en el árbol de trabajo.

Así, tras un squash, el change ya fusionado deja de contar aunque el merge-base no haya avanzado. En la forma canónica, en cambio, la rama del apply modifica `tasks.md`: el árbol difiere y el change sí cuenta.

Alternativa: descartar por nombre si el directorio existe en origen. Se descarta porque rompería el apply canónico, cuyo change existe en origen pero se está modificando.

### D3. Las puertas admiten las dos formas del ciclo

`check` cambia así:
- **`propose` en una rama permanente** deja seguir, con un mensaje que avisa de que lo recomendado es una rama temporal. Con HEAD separado sigue sin dejar.
- **`apply <change>` en una rama temporal sin change propio** deja seguir si `<change>` está en curso en `originRef`. Es el apply canónico antes de marcar ninguna task.
- **`apply <change>` en una rama permanente** deja seguir si `<change>` está en curso en el árbol de trabajo, con aviso. La forma canónica permite el apply en `main`.
- **`archive <change>` en una rama permanente** deja seguir si `<change>` está en curso en el árbol de trabajo y su `tasks.md` no tiene ninguna `- [ ]`. Si faltan tasks o el change no está, no deja seguir.
- **Todo rechazo dice cómo seguir:** crear una rama temporal, dejar un solo change, terminar las tasks o renumerar un ADR.

`kind` sigue valiendo `permanent` en una rama permanente. El autopilot sigue inhibiéndose ahí, y las excepciones de la forma canónica viven solo en `check`.

### D4. La puerta `check commit`

Condiciones, en orden, cada una con su mensaje:
1. **Contenedor efímero:** `CLAUDE_CODE_CONTAINER_ID` no vacía y `CLAUDE_CODE_REMOTE=true`. Si no lo es, el mensaje dice que los commits los hace el usuario.
2. **Rama de la sesión:** `git config --get idd.sessionBranch` existe y coincide con la rama actual.
3. **Rama temporal:** la rama no está en `x-main` ni el HEAD está separado.
4. **Una sola zona:** las rutas de `git status --porcelain`, sin commit o sin seguimiento, se clasifican así:
   - `tasks.md`, en cualquier sitio, es neutro;
   - el resto de `openspec/` es la zona de specs;
   - todo lo demás es la zona de código.
   Si aparecen las dos zonas, no deja seguir.

Si deja seguir, el mensaje incluye la orden de push, `git push -u origin <rama>`. La puerta no hace commit ni push: solo los autoriza. La skill dice al agente que la ejecute antes de cada commit, en los momentos de commit y cuando avisa el final de turno, y que no fusione ni toque otras ramas.

Es una pieza neutral: depende del entorno, no del agente. OpenCode nunca corre en un contenedor de este tipo, así que allí la puerta siempre remite al usuario. Por eso no es una asimetría de ADR-0006: el ciclo y lo versionado son iguales, solo cambia quién ejecuta el commit.

Alternativa: detectar la rama de la sesión por el prefijo `claude/`, o por que sea temporal. Se descarta a favor de guardarla al arrancar, que es más estricto y no depende de convenciones del entorno.

### D5. El arranque prepara git

`session-bootstrap.sh`, en su modo por defecto, añade un paso `prepare_git` antes de instalar dependencias. Ese paso:
- **Si el clon es superficial** (`git rev-parse --is-shallow-repository`), ejecuta `git fetch --unshallow --quiet` con `timeout`. Si falla, avisa.
- **Solo en un contenedor efímero,** hace además `git fetch --quiet origin` para tener las referencias remotas al día. En un clon de un usuario no usa la red, salvo para completar un clon superficial.
- **Pone al día cada rama permanente local** (`x-main`, leída con `node branch-change.mjs --json` si hay Node, o `main` si no) que no sea la rama del clon y sea ancestro de `origin/<rama>`. Usa `git update-ref refs/heads/<rama> <nuevo> <viejo>`, que no toca el árbol de trabajo. Si la rama ha divergido, avisa.
- **En un contenedor efímero,** si no hay `idd.sessionBranch` y el clon está en una rama, la guarda con `git config idd.sessionBranch <rama>`. Es configuración local de `.git/`, no un archivo del árbol: el aviso de final de turno no lo ve.

Como el resto del arranque, cualquier fallo solo avisa y la sesión arranca.

### D6. La numeración de ADRs

- **Prevención:** en `openspec/config.yaml` se añade `rules.adr`, que el proyecto puede usar sin tocar el schema. Manda hacer `git fetch` y tomar como número más alto el máximo de `adr/NNNN-*` en `origin/<origen>` y en todas las `origin/*`, leído con `git ls-tree --name-only <ref> adr/`.
- **Detección:** `check archive` toma los ADRs que la rama añade desde el merge-base, los `adr/NNNN-*.md` nuevos. Si `originRef` tiene otro archivo con el mismo `NNNN`, no deja seguir y pide renumerar los de la rama y sus referencias. En cualquier archive, también rechaza dos archivos con el mismo número en el árbol de trabajo.
- La regla del schema de no editar los ADRs aceptados no se rompe: los ADRs de la rama aún no han llegado a la rama de origen.

### D7. La fusión recomendada y el squash

- La skill recomienda la forma de una rama y pedir al usuario la fusión con `--no-ff`. Con `git log --first-parent`, cada change es una entrada cuyo diff junta el plan, el código, el archive y el wiki, sin perder los commits provisionales.
- La forma canónica y el squash quedan admitidos y descritos en la skill y en las indicaciones de archivado, con cuándo conviene cada uno. No se presentan como infracciones.
- Ningún paso del ciclo depende de que los commits de la rama lleguen a `main`. Lo que podría depender de eso son las citas del wiki, y las resuelve D8.

### D8. Citas del wiki y resincronización en la forma canónica

- **Citas tras un squash:** los manifiestos `--manifest-only` del motor ya fijan cada ruta por su blob. La guía del wiki del proyecto (`.agents/wiki/guide.md`) añade una línea: si el commit de una cita no está en la rama de origen, se toma el blob del manifiesto y se resuelve con `git cat-file -p <blob>` o con `git log --find-object=<blob>`. `/wiki:refresh` no usa git, así que no le afecta.
- **Resincronizar tras archivar en la rama de origen:** en ese caso las indicaciones de archivado calculan las rutas que tocó el change con un diff desde el primer padre del commit que trajo `openspec/changes/<change>/proposal.md` a la rama de origen hasta el commit del archive. El commit del wiki sigue yendo aparte y después.

### D9. Textos de la skill y de config.yaml

- La skill `openspec-git-discipline` reorganiza sus secciones `lifecycle:*`:
  - las dos formas del ciclo y cuándo conviene cada una;
  - las puertas, incluida `check commit`;
  - los commits: del usuario fuera de un contenedor efímero, y del agente dentro, provisionales y de una zona;
  - la fusión con `--no-ff` recomendada.
- Las señales de alarma dejan de incluir archivar en una rama permanente y pasan a incluir, entre otras, hacer commit sin `check commit` y fusionar en un contenedor efímero.
- Las indicaciones de archivado de `openspec/config.yaml` explican las dos formas, con su motivo, y la resincronización en cada una.

## Risks / Trade-offs

- **[Completar un clon grande tarda]** → `timeout`, aviso y la sesión arranca. Si no se puede completar, D1 sigue funcionando con las referencias que haya.
- **[`git fetch` en cada arranque en la nube añade latencia]** → Solo en contenedores efímeros, donde las referencias llegan atrasadas de todas formas.
- **[Dos ramas numeran el mismo ADR casi a la vez]** → D6 lo detecta en `check archive`, antes de que llegue a la rama de origen. Renumerar exige actualizar las referencias del change.
- **[`check archive` compara con un `origin/<origen>` sin actualizar]** → La skill manda hacer `git fetch` antes de archivar. En la nube, el arranque ya hizo uno.
- **[La puerta `check commit` se puede saltar]** → Es una instrucción con una puerta, no un bloqueo. El bloqueo efectivo queda abierto (Non-Goals).
- **[Las rutas de la resincronización canónica incluyen cambios de otros changes fusionados entretanto]** → Se acepta. Solo amplía las fuentes fijadas, y el librarian revisa lo que quedó obsoleto.
- **[El squash sigue borrando de `main` los commits citados]** → Se resuelve por blob (D8). Además, la skill recomienda `--no-ff`.
- **[Las variables que delatan el contenedor efímero son del entorno de Claude Code y pueden cambiar]** → Están en un solo sitio, la detección de `branch-change.mjs`, y el arranque la reutiliza. Si cambian, la puerta remite al usuario, que es el comportamiento seguro.

## Migration Plan

- Nada que migrar en los repositorios: las ramas y los changes existentes siguen siendo válidos.
- La rama de la sesión de las sesiones ya abiertas se guarda en el siguiente arranque.
- Marcha atrás: revertir el change devuelve el comportamiento de ADR-0007. La clave `idd.sessionBranch` que quede en `.git/config` es inofensiva.

## Open Questions

- **ADR-0007 debe sustituirse** por un ADR nuevo, que registre el paso de step `adr`: la forma de una rama pasa a ser la recomendada; se admite la forma canónica; se recomienda `--no-ff` y se admite el squash; el agente hace los commits en un contenedor efímero; hay commits provisionales; y los ADRs se numeran mirando las ramas remotas.
- **El bloqueo efectivo de git** con un hook `PreToolUse` queda abierto.
- **El proxy de git de la nube** permite el push a la rama de la sesión. No hace falta para este change subir a ninguna otra referencia.
- **Si conviene configurar en GitHub que solo se admitan commits de fusión,** para hacer efectiva la recomendación de `--no-ff`, lo decide el usuario. No es parte del repositorio.
