## Context

La fusión de la rama temporal con una rama permanente la decide la puerta `check merge <rama permanente>` de `.agents/openspec/branch-change.mjs`. La fija ADR-0020, que conserva lo que ADR-0016 decidió sobre las fusiones: sin cambiar de rama fuera de un contenedor efímero y por PR dentro. Hoy la puerta da:

- **Fuera de un contenedor efímero**, `git commit-tree HEAD^{tree} -p origin/<destino> -p HEAD -m "Merge <rama> into <destino>"` y su push. El título nombra la rama.
- **En un contenedor efímero**, subir la rama de la sesión, abrir un PR contra `<destino>` y recomendar fusionarlo con un commit de fusión, no con squash. No dice nada del título del PR ni del título del commit de fusión.

Lo que muestra el historial de `main`, comprobado el 2026-11-22 con `git log --first-parent` y con los PR del repositorio:

- **Las fusiones locales nombraban la rama.** `32639ba` (*Merge autopilot-sesion-operativa into main*) y `499764b` (*Merge replace-gherkin-lint-with-gplint into main*) nombran el change solo porque la rama se llamaba como él.
- **Las 11 fusiones de PR llevan el título por defecto de GitHub**, *Merge pull request #N from hiebra/claude/…*, que nombra la rama de la sesión. Ninguna se editó al fusionar.
- **GitHub deja el título del PR en el cuerpo del commit de fusión**, en las 11.
- **El título del PR lo ha elegido el agente cada vez.** De los 8 PR que trajeron un change, 5 lo nombraban (#1, #7, #9, #10 y #11) y 3 no (#5, #6 y #8).
- **Un título de PR bien formado no basta.** El PR #7 se tituló *Merge allow-user-requested-merges into main*, y su fusión (`af2153e`) lleva el título por defecto: el título del PR no llega al título del commit si el usuario no lo cambia al fusionar.

El wiki lo recoge en la lección 3 de `.wiki/raw/notes/2026-11-22-ll-fusion-no-ff-y-trazabilidad.md` y en el registro del inventario `nombrar-el-change-en-el-titulo-de-la-fusion`, que anota que el usuario puede editar el título al fusionar el PR.

La puerta ya sabe qué change lleva la rama sin mirar su nombre: `branchChange()` da `changes`, con el nombre y el estado de cada uno, ordenados por nombre (requisito «El change de una rama temporal se lee de git»).

En vigor, además de ADR-0020:
- **ADR-0006:** lo común al ciclo va en una pieza neutral. El título lo compone el módulo, igual para los dos agentes; lo que cambia la orden es el entorno (contenedor efímero o no), no el agente.
- **ADR-0003:** una sola copia de la skill, en `.agents/skills/`.

Restricciones:
- La puerta se ejecuta antes de que exista el PR, y no ve GitHub.
- La forma de la salida de `check` (`{ ok, message }`) y la de `branchChange` no cambian.
- No se toca nada externo: el schema `intent-driven`, los workflows de OpenSpec ni el motor del wiki.

## Goals / Non-Goals

**Goals:**
- Que el título de cada fusión con una rama permanente que prepara el agente nombre el change, para que `git log --first-parent` sirva de índice de changes por nombre.
- Que el título lo componga la puerta, no el modelo: el mismo texto en la orden local, en el título del PR y en la recomendación para el commit de fusión del PR.
- Que el nombre del change llegue al commit de fusión de un PR aunque el usuario no cambie el título.

**Non-Goals:**
- Comprobar el título después de fusionar un PR.
- Cambiar la configuración del repositorio en GitHub.
- Que el agente fusione el PR. Fusionarlo lo sigue decidiendo el usuario en GitHub.
- El título de las fusiones que traen una rama permanente a la rama temporal.
- Cambiar qué cuenta como change de la rama.
- Sanear el nombre de la rama en las órdenes de las puertas (ver Risks).

## Decisions

### D1. El título de la fusión es `Merge <changes> into <destino>`

`<changes>` son los nombres de los changes de la rama, separados por una coma y un espacio. Con un solo change, que es lo habitual: `Merge exportar-datos into main`. Si la rama no lleva ningún change, se nombra la rama, como hasta ahora: `Merge <rama> into <destino>`.

El formato es el que ya tienen las fusiones locales de `main` y la orden actual de la puerta. Solo cambia de dónde sale el nombre: del change, no de la rama.

Solo se aplica a llevar la rama temporal a una rama permanente. Traer una rama permanente a la temporal conserva el título de git (`git merge --no-edit`): esas fusiones quedan en el lado del segundo padre y `git log --first-parent` de la rama permanente no las muestra.

Alternativas:
- **Seguir nombrando la rama y confiar en que se llame como el change.** Es lo que falla: en un contenedor efímero la rama es la de la sesión (`claude/…`), y fuera de él el usuario puede crearla con otro nombre.
- **Un título libre que redacte el modelo** (`<change>: <resumen>`). No es determinista ni lo puede dar la puerta, y los títulos de los PR muestran el resultado: 3 de 8 sin el nombre del change.
- **Nombrar el change y la rama** (`Merge <change> (<rama>) into <destino>`). El nombre de la rama de una sesión no aporta nada: el segundo padre de la fusión ya la identifica.

### D2. Los changes del título son los que da `branchChange`

El título usa `changes` del estado que la puerta ya calcula. No hay una segunda definición de «el change de la rama»:

- **En curso o archivado, el nombre es el mismo.** El título no cambia entre antes y después del archive.
- **Varios changes, todos.** Los nombres, sin repetir y en el orden de `changes`, que es alfabético. Pasa sin la excepción, con varias propuestas en una rama, y también cuando una rama retoca el directorio de un change ya archivado: la rama del PR #9 (`windows-support`) corrigió un enlace en el `adr.md` archivado de `replace-gherkin-lint-with-gplint`, y su título habría sido `Merge replace-gherkin-lint-with-gplint, windows-support into main`.
- **Ninguno, la rama.** Las ramas que solo tocan el wiki (los PR #2, #3 y #4) y las que no tienen rama de origen con la que comparar (`kind: unknown`).
- **Se calcula contra la rama de origen**, también cuando el destino es otra rama permanente.

Alternativas:
- **Rechazar la fusión si la rama lleva varios changes.** `check merge` no es la puerta que limita los changes por rama: con la excepción ya lo hace `check propose`, y sin ella varias propuestas en una rama son legítimas.
- **Calcular los changes contra la rama de destino.** Sería otra definición, distinta de la que usan las demás puertas; con una sola rama permanente las dos coinciden.

### D3. Solo se nombran changes con nombre kebab-case

El título va dentro de una orden de shell que el agente ejecuta tal cual (`-m "…"`) y en el título de un PR. El nombre de un change es el nombre de un directorio de la rama, que puede venir de otra persona: un directorio `openspec/changes/$(…)/` acabaría ejecutándose dentro de las comillas dobles.

Por eso el título solo nombra los changes cuyo nombre cumple la gramática con la que OpenSpec crea los changes y `start` crea las ramas: `^[a-z0-9]+(?:-[a-z0-9]+)*$`. Un directorio de `openspec/changes/` con otro nombre no se nombra; si no queda ninguno, se nombra la rama. Con esa gramática, el nombre no puede cerrar las comillas, abrir una sustitución ni partir el texto entre acentos graves del mensaje.

La spec lo dice en una frase del requisito. No tiene escenario: lo cubre `core-tests/branch-change.test.js`, como los demás casos límite del módulo.

Alternativas:
- **Escapar el título con comillas simples.** Evita la sustitución, pero un nombre con un acento grave seguiría partiendo las órdenes del mensaje, que van entre acentos graves.
- **Rechazar la fusión.** Un directorio mal nombrado no es motivo para impedir fusionar; basta con no nombrarlo.

### D4. Fuera de un contenedor efímero, el título es el mensaje del commit

La orden que da la puerta solo cambia en el `-m`:

> `commit=$(git commit-tree HEAD^{tree} -p origin/main -p HEAD -m "Merge exportar-datos into main")` y `git push origin "$commit":refs/heads/main`

El resto del mensaje, el árbol, los padres y el push no cambian.

### D5. En un contenedor efímero, el PR lleva el título y se recomienda para su commit de fusión

El mensaje de la puerta añade dos cosas a lo que ya indica (el texto exacto se ajusta al implementar):

> … abre un PR de `claude/exportar` contra `main` con las herramientas de GitHub de la sesión, con el título `Merge exportar-datos into main` (si el PR ya está abierto, ponle ese título), y recomienda al usuario fusionarlo con un commit de fusión, no con squash, y con ese mismo título en el commit de fusión: el que propone GitHub nombra la rama de la sesión. …

- **El PR lleva el título de la fusión.** Si ya había un PR abierto de la rama contra ese destino, el agente le cambia el título en vez de abrir otro.
- **El agente recomienda ese mismo título para el commit de fusión.** Es una recomendación porque el título lo escribe el usuario al fusionar, y la puerta no ve esa fusión.

Por qué el mismo texto en los dos sitios:
- **El usuario lo tiene delante al fusionar.** No tiene que volver a la conversación a buscarlo.
- **Si no cambia el título, el change queda nombrado igualmente.** GitHub deja el título del PR en el cuerpo del commit de fusión, así que el mensaje del commit contiene `Merge <change> into <destino>` en los dos casos, y `git log --first-parent --grep` lo encuentra.
- **Si el repositorio se configura para que el commit de fusión tome el título del PR**, no hay nada que cambiar al fusionar. Esa configuración queda fuera de alcance, y es conocimiento interno, sin comprobar en este proyecto.

El resumen del change, que algunos PR llevaban en el título, va en la descripción del PR.

Alternativas:
- **Que el título del PR empiece por el nombre del change y siga con un resumen**, y pedir `Merge <change> into <destino>` solo para el commit de fusión. Son dos textos: el del commit habría que dictarlo en la conversación, y sin el cambio del usuario el cuerpo llevaría un título libre.
- **Que el agente fusione el PR y ponga él el título del commit.** La skill deja la fusión del PR al usuario, y este change no lo cambia.
- **Decir el título recomendado solo en la conversación.** Se pierde si el usuario fusiona más tarde desde GitHub.

### D6. La skill y la documentación

- **La skill `openspec-git-discipline`**, en «La fusión con una rama permanente»:
  - el título de la fusión es el que da la puerta, `Merge <change> into <destino>`, y no se cambia;
  - en un contenedor efímero, el PR lleva ese título, también si ya estaba abierto, y el resumen del change va en su descripción;
  - el agente recomienda ese mismo título para el commit de fusión, y dice por qué: el que propone GitHub nombra la rama de la sesión.

  Se añade una señal de alarma: dar a la fusión con una rama permanente, o a su PR, un título distinto del de la puerta.
- **`README.md`**, en «Quién fusiona, y cómo»: el título de la fusión.
- **La cabecera de `branch-change.mjs`:** el título en la puerta `merge`.
- **Las indicaciones de archivado de `openspec/config.yaml` no cambian.** Su paso 8 ya manda ejecutar `check merge <rama>`, que da el título.

### D7. La suite

Pasos nuevos en `acceptance-tests/step-definitions/change-lifecycle.steps.js`:

- **`la rama temporal lleva <changes>`** parte de la rama que ya monta `temporaryBranchWithRemote`, que contiene `origin/main`. Añade los changes con `addChange` y `archiveChange` y hace commit, porque la puerta no deja seguir con el árbol sucio.
- **`el commit de fusión que da su orden se titula …`** toma del mensaje la orden `git commit-tree`, la ejecuta sin el push y lee el título del commit creado. Comprueba la orden, no solo el texto del mensaje.
- **Los dos pasos del PR** leen el mensaje de la puerta: el título del PR, que valga para un PR ya abierto y la recomendación para el commit de fusión.
- **Los dos pasos de la skill** leen su sección `<!-- lifecycle:merge -->`.

Los cinco escenarios vigentes del requisito no cambian: sus ramas no llevan ningún change, y el título sigue nombrando la rama.

En `core-tests/branch-change.test.js`, lo que no tiene escenario:
- un directorio de `openspec/changes/` con un nombre que no es kebab-case no se nombra (D3);
- un change en curso y archivado con el mismo nombre se nombra una vez;
- con `x-main: [main, develop]`, el título hacia `main` nombra el change calculado contra `develop`.

## Risks / Trade-offs

- [El usuario fusiona el PR sin cambiar el título] → El cuerpo del commit de fusión lleva el título del PR, con el change en el mismo formato. Comprobarlo queda fuera de alcance.
- [El título del PR deja de describir el cambio en la lista de PR] → El resumen va en la descripción del PR.
- [El título recomendado pierde el número del PR que lleva el de GitHub] → Quien lo quiera lo añade al cambiar el título.
- [Si el usuario cambia el título y deja el cuerpo, el commit repite la misma línea] → Es inocuo.
- [Una rama que retoca un change ya archivado nombra los dos (D2)] → Es lo que dice `branchChange`, y el usuario puede cambiar el título.
- [Con varias ramas permanentes, una rama que ya llegó a la rama de origen deja de tener change, y el título hacia las demás nombra la rama] → `merge-targets` propone las ramas en el orden de `x-main`, con la de origen al final.
- [El nombre de la rama sigue yendo sin sanear a las órdenes de las puertas: al `-m` cuando no hay change, y a `git push -u origin <rama>`] → Ya era así, afecta a todas las puertas y no lo empeora este change. Sanearlo es un change aparte.
- [Tres ramas concurrentes sin fusionar tocan `branch-change.mjs`, la skill, `change-lifecycle.steps.js`, el `README.md` y la spec `openspec-change-lifecycle`: las de `autopilot-rama-por-sesion`, `windows-global-distro` y `add-project-wiki-toggle`] → Ninguna modifica este requirement ni el título, porque las tres salen de un `main` anterior a `check merge`. `windows-global-distro` mueve además `branch-change.mjs` a `.agents/skills/openspec-git-discipline/scripts/`. La rama que llegue después trae `origin/main` y resuelve los conflictos en ella, como exige `check merge`.

## Migration Plan

No hay migración. El cambio solo afecta al texto del mensaje de `check merge` hacia una rama permanente, y nada lo lee salvo el agente. Los títulos de las fusiones ya hechas no se tocan.

La puerta nueva se aplica al change que la introduce: su propio PR se titulará `Merge name-change-in-merge-title into main`.

Para deshacerlo, se revierte la fusión del change.

## Open Questions

- **Ningún ADR en vigor necesita revisarse.** ADR-0020 fija que `check merge` da la fusión sin cambiar de rama o el PR; el título de esa fusión no lo fija ningún ADR.
- **El título del PR igual al de la fusión (D5)** cambia cómo se leen los PR en GitHub. Si se prefiere que el PR conserve un título descriptivo, la alternativa es la primera de D5.
- **Sanear el nombre de la rama en las órdenes de las puertas** queda sin dueño. Se propone anotarlo en el inventario del wiki al archivar.
