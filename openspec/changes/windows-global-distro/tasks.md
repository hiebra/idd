Se trabaja con el ciclo de `spec-as-source`: rojo → implementar → verde → commit. Un commit nunca mezcla `openspec/` con la zona de código, salvo este `tasks.md`. Las referencias D1 a D7 son las del `design.md`. Los escenarios de Windows solo se ejecutan en el job de Windows del workflow (D7). Se eligen por nombre, con la lista de `acceptance-tests/windows-scenarios.cjs`, porque un escenario extraído de un `spec.md` no puede llevar etiquetas: lo que las tasks llaman `@windows` son esos escenarios.

## 1. Punto de partida

- [x] 1.1 Comprobar que la suite está en verde antes de tocar nada (`npm test`, `npm run test:core`, `npm run lint:specs`), salvo los escenarios de este change
- [x] 1.2 Añadir al perfil por defecto de `cucumber.cjs` la exclusión de `@windows` y un perfil `windows` que solo los ejecuta → suite en verde → commit

## 2. Núcleo del arranque en Node (D1, ADR-0023)

- [x] 2.1 Hacer que `core-tests/` lance el núcleo por una sola ruta configurable, para poder cambiar de `session-bootstrap.sh` a `session-bootstrap.mjs` sin tocar cada prueba → verde con el núcleo de bash → commit
- [x] 2.2 Step `una máquina Windows con Node.js 22.12 o superior y npm y sin bash`, que simula el entorno sin `bash` en el `PATH`. Rojo
- [x] 2.3 Escribir `.agents/hooks/session-bootstrap.mjs`, solo con módulos `node:`. Lleva los mismos modos, salidas, avisos, sello y desactivaciones que el de bash, y comprueba `engines.node` con `process.versions.node`. Hacer que `core-tests/` lo use → `test:core` en verde
- [x] 2.4 Cambiar los adaptadores para que lancen el núcleo con `node`:
  - los hooks de `.claude/hooks/`;
  - `session-bootstrap/server.js`;
  - `response-comments/server.js`.

  Si `node` no existe, el adaptador avisa con el mismo texto que el núcleo → la suite y el escenario de 2.2 en verde → commit
- [x] 2.5 Borrar `session-bootstrap.sh` y actualizar sus referencias (README, cabeceras de los adaptadores, `acceptance-tests/README.md`) → verde → commit

## 3. `branch-change.mjs` dentro de la skill (D4)

- [x] 3.1 Steps de `branch-change.mjs viaja con la skill openspec-git-discipline`: dónde está el script en la plantilla completa y el script global que actúa sobre el proyecto desde el que se ejecuta. Rojo
- [x] 3.2 Mover el script a `.agents/skills/openspec-git-discipline/scripts/branch-change.mjs` y reescribir su `SKILL.md` con la ruta en una sola línea, «El script es: `<ruta>`» → verde
- [x] 3.3 Actualizar las demás referencias a `.agents/openspec/branch-change.mjs`: el README, los step definitions y el soporte de la suite, `core-tests/`, el núcleo y `openspec/config.yaml` si lo nombra → verde → commit
- [x] 3.4 Steps de `El plugin encuentra branch-change.mjs con la skill`, con un `<config>` simulado para el caso global. Rojo
- [x] 3.5 Buscar el script en un solo módulo del plugin autopilot: primero el proyecto y, si no está, junto a su instalación global. `lib/project.mjs` usa esa ruta, y `lib/prompts.mjs` la recibe → verde → commit

## 4. Modo global del arranque y de los plugins (D2, D3)

- [x] 4.1 En el OpenCode simulado de la suite (`opencode-host.mjs`, `opencode.js`), cargar también los plugins de un `<config>\opencode\plugins` simulado, y que el plugin sepa si se ha cargado desde el proyecto o desde `<config>` → suite en verde → commit
- [x] 4.2 Steps de `El arranque global solo actúa en proyectos intent-driven` y `El arranque global cede ante el del proyecto`. Rojo
- [x] 4.3 En el núcleo, el modo global:
  - detecta `schema: intent-driven` en `openspec/config.yaml`;
  - no descarga el motor ni crea symlinks;
  - toma el motor de `<data>\idd\wiki-engine` y los textos de su propia instalación.

  En `session-bootstrap`, ceder si el proyecto tiene su propio plugin → verde → commit
- [x] 4.4 Steps de `El arranque global no instala el motor del wiki`. Rojo → implementar → verde → commit
- [x] 4.5 Steps de `La regla de comentarios global solo actúa donde actúa el arranque global`. Rojo. En `response-comments`, encontrar el núcleo en `../session-bootstrap/` cuando es global, actuar solo en proyectos intent-driven y ceder ante el del proyecto → verde → commit
- [x] 4.6 Steps de `El plugin global solo actúa en proyectos intent-driven` y `El plugin global cede ante el del proyecto` del autopilot. Rojo → implementar → verde → commit

## 5. Montaje de la release (D5)

- [x] 5.1 Crear `.agents/release/origins.json`:
  - el schema, en `intent-driven-dev/openspec-schemas@4bb6de2`;
  - las skills, en `intent-driven-dev/skills@15aa678`;
  - las skills propias: `openspec-git-discipline`, `acceptance-test-authoring` y `spec-as-source`.
- [x] 5.2 Añadir una prueba que compare el schema y las skills no propias con su origen en ese commit. Necesita red, así que corre en el job de release y no en el perfil por defecto → commit
- [x] 5.3 Steps de `slim-template` que se pueden comprobar en Linux sobre el zip montado: qué contiene y qué no, y que sale del tag. Rojo
- [x] 5.4 Escribir `scripts/release/build.mjs`, que monta desde un árbol dado, con su versión, tres artefactos:
  - `idd-global-<versión>.zip`, con el motor descargado según `.agents/wiki/engine.json`, las skills del motor `wiki-query` y `wiki-manager`, y el `SKILL.md` de `openspec-git-discipline` en tres piezas;
  - `idd-<versión>.bat`;
  - `idd-slim-<versión>.zip`.

  → los escenarios de 5.3 en verde → commit
- [x] 5.5 Steps de `windows-global-install` que se pueden comprobar en Linux sobre el zip: qué instala y que el schema es idéntico al de origen. Rojo → implementar lo que falte en `build.mjs` → verde → commit

- [x] 5.6 La variante adelgazada no hereda las specs de la plantilla, ni su suite, ni sus herramientas de release (decisión del usuario; spec `slim-template` y D5). Steps de «No hereda las specs ni la suite de la plantilla» y «La suite de un proyecto adelgazado empieza en verde» → rojo. En `build.mjs`:
  - se dejan fuera `openspec/specs/`, todo `openspec/changes/`, `acceptance-tests/`, `scripts/release/` y `.github/workflows/release.yml`;
  - se monta una suite vacía con las copias de la skill `acceptance-test-authoring` y el paquete de la suite, solo con los scripts `test`, `test:specs` y `lint:specs`;
  - como sin specs `extract-gherkin.cjs` no crea `.extracted`, `lint:specs` lo crea antes de llamar a gplint.

  → verde → commit

## 6. El `.bat` y la suite de Windows (D6, D7)

- [x] 6.1 Steps `@windows` de `windows-global-install` y `slim-template`. Ejecutan el `.bat` con `cmd.exe` sobre un `<data>` y un `<config>` temporales, con y sin variables XDG, y con un perfil con espacios en la ruta. Los zips los sirve un servidor local. Rojo en Windows
  - En `step-definitions/windows.steps.js` y `support/windows.js`. En Linux solo se comprueba que están todos definidos (`cucumber-js -p windows --dry-run`). No se vio el rojo en Windows: se ejecutaron por primera vez con el `.bat` ya escrito (5.4), y pasaron (6.4).
- [x] 6.2 Escribir el `.bat`, solo con `cmd`, `curl.exe` y `tar.exe`:
  - calcula `<data>` y `<config>`;
  - lee la versión instalada;
  - descarga y descomprime en un directorio temporal;
  - borra lo que lista `installed.txt`;
  - mueve lo nuevo a su sitio y escribe el `SKILL.md` con la ruta absoluta;
  - escribe al final `installed.txt` y `version`.

  → verde en Windows → commit
  - Escrito en `scripts/release/idd.bat` (5.4), en verde en Windows (6.4). No mueve directorios entre volúmenes: descomprime `data/` y `config/` directamente en `<data>` y `<config>` con `tar.exe --strip-components=1`, después de borrar lo de `installed.txt`; la versión se sigue escribiendo al final.
- [x] 6.3 Añadir `.github/workflows/release.yml`, que se dispara con los tags `v*`:
  - un job de Linux que pasa la suite, monta los artefactos y ejecuta la prueba de 5.2;
  - un job `windows-latest` que pasa el perfil `windows` con los artefactos montados;
  - la publicación de la release con los tres artefactos.

  → commit
  - Además, por decisión del usuario, se dispara con cada push a cualquier rama, sin publicar, para probar cada commit en Linux y en Windows sin crear tags de prueba. Un push nuevo a la misma rama cancela el run anterior.
- [x] 6.4 Probar el workflow sin publicar, con un disparo manual o un tag de prueba que se borra después, y comprobar que los dos jobs pasan → anotar el resultado aquí
  - 2026-11-22, tag `v0.0.0-ci1` sobre `3fcfaab`, ya borrado (run 45050800884). Ninguno de los dos jobs ha publicado nada.
    - **windows:** en verde, con los 8 escenarios de Windows (45 steps) en 1 min 18 s.
    - **linux:** en rojo en `test:core`, por «two sessions taking control at once: the oldest wins and the other is left free» (`core-tests/autopilot-plugin.test.js:168`): quedan dos sesiones operativas en lugar de una. El fallo es intermitente y anterior a este change (falla 2 de cada 4 veces en `2ba326e`). Por eso no llegaron a ejecutarse el lint, la suite, la prueba de origen ni el montaje de los artefactos en el runner.
  - 2026-11-22, tag `v0.0.0-ci2` sobre `368f17a` (run 45063319191). **windows** en verde. **linux** en rojo en el mismo test de `test:core`, pero ya con una sola operativa: ganó la sesión más nueva en vez de la más antigua (6.5).
  - 2026-11-22, tag `v0.0.0-ci3` sobre `6139514` (run 45067118439). Los dos jobs en verde y `publish` omitido, como corresponde a un tag `-ci`.
    - **linux:** pasan `test:core`, el lint, la suite (3 min 41 s), la prueba de origen y el montaje de los tres artefactos, que se suben como artefacto del run.
    - **windows:** pasan los 8 escenarios.
- [x] 6.5 Arreglar la carrera del autopilot que hace fallar a veces «two sessions taking control at once» y bloquea el job de Linux (6.4). Ocurre en los dos sitios donde una sesión toma el control de una rama: el mensaje `autopilot` y `ensureOperational`. El plugin escribe que es la operativa y después comprueba quién gana por antigüedad. Si la sesión más nueva comprueba antes de que escriba la más antigua, se ve sola y sigue; después la más antigua escribe, gana por antigüedad y sigue también, y la rama queda con dos operativas.
  - En `server.js`, tomar el control de una rama va en serie dentro del proceso (`claim`, con la cola en el registro de `globalThis` para que valga entre recargas): la segunda sesión ve ya escrita a la primera. Entre dos procesos de OpenCode sobre el mismo worktree sigue valiendo solo escribir y comprobar.
  - Con solo eso, gana la que entra primero en la cola, que no siempre es la más antigua. En el run de `v0.0.0-ci2` ganó la más nueva, porque la primera lectura de la rama (`branchChange`, que importa `branch-change.mjs` en frío) tardó más en la primera sesión. Por eso las peticiones del mensaje `autopilot` se juntan durante 150 ms desde que llega el mensaje, antes de leer nada del proyecto (`contend`), y se atienden de una en una de la más antigua a la más nueva (D4).
  - Con el test aislado: sin el arreglo falla 7 de 12 veces y con él 0 de 12. Con la primera lectura de la rama retrasada 400 ms a propósito, para reproducir el orden del runner, la versión solo en serie falla 6 de 6 y la definitiva 0 de 6.

- [x] 6.6 Arreglar la otra carrera del autopilot que hizo fallar el job de Linux en el run de `v0.0.0-ci4`. Fallaba «auto mode: the verify without a verdict does not chain to the archive», con un diálogo que no se esperaba; aquí no se reproduce, ni con la máquina cargada. `chainTo` crea la sesión del paso siguiente y después navega a ella y archiva la anterior. Si la TUI consulta la pantalla entre medias, sigue en la sesión anterior, ya libre y sin archivar, y la trataba como una ventana ajena (`directive` daba `modal`).
  - En `lib/screen.mjs`, una sesión que acaba de pasar el control (`phase: 'done'`) cuenta como una archivada: no da el modal.
  - Caso nuevo en `core-tests/autopilot-product.test.js`: rojo sin el arreglo, verde con él.

## 7. Integración con `windows-support`

`windows-support` (rama `claude/vigilant-cori-oo4t14`) se reduce a lo que no depende del núcleo del arranque: `.gitattributes` con LF y su requisito en `session-bootstrap`, `openspecCommand()` del autopilot (el CLI del proyecto como `node <bin.openspec del paquete>`), la capability `windows-readiness` con el diagnóstico `scripts/windows/Test-OfflineInstall.ps1`, y ADR-0017 reescrito sin decidir nada del núcleo. Se fusiona y archiva antes que este change.

- [x] 7.1 Cuando `windows-support` esté archivado en la rama de origen, hacer `git merge` de la rama de origen, sin rebase. En `lib/project.mjs` del autopilot, conservar a la vez `openspecCommand()` y la búsqueda de `branch-change.mjs` de `lib/branch-script.mjs` → suite en verde → commit
  - 2026-11-22, `d525d72`, con el ok del usuario a la resolución. Trajo también ADR-0020 y la skill estándar con su excepción (change `git-discipline-standard-with-exception`).
    - El `SKILL.md` de `main` lleva reaplicados la línea «El script es: …» y `<script>`.
    - El mensaje de `check merge` da la ruta del propio script.
    - Se pusieron al día las rutas a `branch-change.mjs` que llegaron de `main`: `openspec/config.yaml`, el README, `branches-support.test.js`, y el núcleo en Node en el step de finales de línea.
  - Con la fusión en curso, `test:core` pasa (170). En la suite pasan 266 de 281 escenarios. Los 15 restantes son los de `windows-readiness`: necesitan `pwsh`, que este contenedor no tiene; los pasa el job de Linux del workflow.
- [x] 7.2 Rehacer los deltas de `session-bootstrap` y `openspec-autopilot` sobre las specs ya archivadas, sin pisar el requisito de LF ni el del CLI con `node`. Si con el núcleo en Node el requisito de LF deja de servir, retirarlo con REMOVED y su motivo → `openspec validate` → commit
  - 2026-11-22, `a2046a9`:
    - `openspec-change-lifecycle`: los requisitos MODIFIED salen ahora del texto de `main` («La puerta check commit…», que ya admite el commit de una fusión, y «El modelo crea la rama temporal…», con el escenario del contenedor efímero). Se añaden los dos de `main` que citaban la ruta antigua: «La puerta check merge…» y «Tras el archive se propone la fusión…». En los cuatro solo cambia cómo se nombra el script: con la ruta que da la skill `openspec-git-discipline`.
    - `session-bootstrap` y `openspec-autopilot` no cambian: este change solo añade requisitos, y ninguno coincide con los de `main` (el de LF y el del CLI con `node`).
    - El requisito de LF sigue sirviendo con el núcleo en Node: los hooks de Claude Code siguen siendo de bash, y el núcleo procesa la guía, el recordatorio y la regla de comentarios. No se retira.
  - `openspec validate` y `lint:specs` sin errores. La suite pasa 268 de 283 escenarios; los 15 restantes son los de `windows-readiness`, que necesitan `pwsh`.
  - En el workflow (run 45079491565, push de `644bd0e` a la rama, sin tag) los dos jobs pasan. En Linux pasan los 283 escenarios, entre ellos los de `windows-readiness`, `test:core` (170), el lint y `test:release`. En Windows pasan los 8 escenarios.
- [x] 7.3 Adaptar el diagnóstico `Test-OfflineInstall.ps1` a la instalación global: el schema en `<data>\openspec\schemas`, el motor en `<data>\idd\wiki-engine`, y las skills y los plugins copiados a `<config>\opencode` (`%XDG_CONFIG_HOME%` o `%USERPROFILE%\.config`). Con sus escenarios de `windows-readiness`, rojo → verde → commit
  - Spec `windows-readiness` (requisito nuevo «La instalación global en un proyecto adelgazado», con tres escenarios) y D8 del design, en `f802924`. El diagnóstico y sus steps van en `e33614e`:
    - la recogida añade `project.ownSchema` y `global` (`<data>` y `<config>` como el `.bat`, `<data>\idd\version` y lo que instala);
    - la evaluación da el componente `global-install` y, en un proyecto adelgazado, el motor del wiki de la instalación global.
  - El rojo no se vio: los escenarios no se pueden ejecutar aquí sin `pwsh`, y el diagnóstico se escribió antes de ejecutarlos. En el workflow (run 45080641431) pasan los 286 escenarios, entre ellos los tres nuevos, y los 8 de Windows. Sin el componente `global-install`, los tres fallarían al buscarlo en el informe.
  - La recogida de hechos en una máquina Windows real se comprueba en la 7.4.
- [ ] 7.4 Verificar en Windows 11 real, y anotar aquí el resultado:
  - Guía paso a paso: `guia-verificacion-windows.md`, en este mismo directorio.
  - el diagnóstico con PowerShell 5.1 y con PowerShell 7;
  - el `.bat` de una release, en una instalación nueva y en una actualización;
  - una sesión real de OpenCode 2 en un proyecto adelgazado: arranque, guía del wiki, regla de comentarios y autopilot.

- [x] 7.5 Volver a integrar `main`, que ha avanzado desde la 7.1 (`git merge`, sin rebase, y el ok del usuario a la resolución antes del commit de fusión). Han llegado el change del ON/OFF del wiki (ADR-0021), el del autopilot dueño de su rama y sus worktrees (ADR-0022) y el ADR-0025: 148 archivos. `git merge-tree` da conflictos en 17:
  - `.agents/hooks/session-bootstrap.sh`: borrado aquí y modificado en `main`. Los cambios del ON/OFF del wiki hay que portarlos a `session-bootstrap.mjs` y al modo global, y comprobar la guía y el recordatorio que instala el `.bat`;
  - el autopilot: `server.js`, `lib/project.mjs`, `lib/prompts.mjs` y `lib/screen.mjs`. Hay que conservar a la vez lo de ADR-0022 y lo nuestro (`branchScript()`, el control de una rama de uno en uno con `claim` y `contend`, y que una sesión que acaba de pasar el control no se trate como ajena);
  - `openspec-git-discipline`: `SKILL.md` (otra vez la línea «El script es: …») y `branch-change.mjs`;
  - `README.md`, `acceptance-tests/README.md`, `openspec/config.yaml` y los tests, steps y soporte de la suite: `autopilot-product`, `prepare-git`, `wiki-markers`, `autopilot.steps.js`, `change-lifecycle.steps.js`, `opencode-sim.js`, `opencode-sim.mjs` y `machine.js`.
  - Lo averiguado al empezar (2026-11-22, fusión abortada, sin cambios): lo grande es el núcleo. `main` añadió a `session-bootstrap.sh` unas 280 líneas:
    - el wiki está habilitado solo si `.agents/wiki/engine.json` dice `"enabled": true` (ya no vale `PROJECT_WIKI=off`), con `wiki_enabled`, `set_enabled` y `fetch_engine` separada de `install_wiki_engine`;
    - un modo nuevo, `wiki <status|on|off> <dir>`, que usa `/toggle-wiki`: edita a mano `openspec/config.yaml` entre las marcas `# wiki:archive-guidance:begin` y `# wiki:archive-guidance:end` (con un `awk` de ~100 líneas), lista las fuentes de la ingesta inicial y pasa al stage `engine.json` y `config.yaml`; y `warn_stale_block`;
    - la guía, el recordatorio, `opencode-note.md` y `archive-guidance.yaml` se buscan en `../wiki/` respecto al script, no en el proyecto (D8 de `add-project-wiki-toggle`); el modo global y el zip de la release (`build.mjs`, que copia esos textos junto al plugin) tienen que seguir ese cambio, y añadir `archive-guidance.yaml`;
    - `prepare_git` no mueve una rama permanente sacada en otro worktree.
  - Lo más cómodo es portar con ese mismo contrato: primero los tests de `core-tests/` de `main` (`wiki-markers`, `prepare-git`) contra `session-bootstrap.mjs`, y después el código. `main` también trae la skill `/toggle-wiki`.
  - Resuelta el 2026-11-22, con el ok del usuario, en el commit de fusión:
    - **Arranque:** el ON/OFF del wiki va en `session-bootstrap.mjs`, con el modo `wiki status|on|off`. En modo global vale el ajuste del proyecto, y los textos se toman de `wiki/` junto al núcleo. `build.mjs` copia también `archive-guidance.yaml`. El escenario «La sesión usa el motor de la instalación global» lleva «el wiki habilitado en el proyecto». El `.bat` no cambia.
    - **Autopilot:** `server.js` conserva ADR-0022 y también `claim`, `contend` y el plugin global. `prompts.mjs` es el de `main`: con ADR-0022, ningún prompt pide al modelo ejecutar `branch-change.mjs`. `lib/worktree.mjs` lee la rama de origen con `branchScript()`.
    - **La 6.6:** `screen.mjs` es el de `main`, sin la guarda de `phase: 'done'` y sin su caso en `autopilot-product.test.js`. ADR-0022 quita el modal de ventana ajena. El único modal que queda, el de `/new`, solo sale en la pantalla de inicio o en una sesión sin mensajes, así que una sesión que acaba de pasar el control ya no puede dar un diálogo.
    - **Deltas:** el de `openspec-change-lifecycle` se ha rehecho sobre la spec de `main`: el título de la fusión, la propuesta de fusión con el wiki deshabilitado y el requisito nuevo de volver a la rama de origen. Solo cambia la ruta del script. En el de `openspec-autopilot`, la ruta del script ya no la comprueba el prompt del paso `new`, sino la estrategia de worktree, que lee la rama de origen con ese script.
  - Terminada el 2026-11-23, después de la fusión:
    - **El ajuste del wiki en la variante adelgazada:** va en `.agents/wiki/engine.json`, que el zip no lleva. El zip tampoco lleva el `.wiki/` de la plantilla (decisión del usuario), así que un proyecto adelgazado empieza con el wiki deshabilitado y sin wiki.
    - **`/toggle-wiki` global:** la instalación global trae el comando de OpenCode, en `<config>/opencode/commands/toggle-wiki.md`.
      - Sale del comando de OpenCode del proyecto (`scripts/release/toggle-wiki-command.mjs`, que usan `build.mjs` y la suite). Sus órdenes llaman a `node <script> --global wiki …`.
      - El `.bat` lo escribe con la línea «El script es: …», con la ruta absoluta del núcleo. Es la misma línea, solo ASCII, que la del `SKILL.md`, porque el `.bat` la escribe con `echo`.
      - Si el comando de la plantilla cambia y la adaptación ya no encaja, el montaje falla.
      - `wiki on` imprime `wiki-engine=<ruta>`, que el comando usa como `CLAUDE_PLUGIN_ROOT` en la misma sesión.
    - **Specs:**
      - en `slim-template`, la variante no lleva `.wiki/` y hay un requisito nuevo: «El wiki de un proyecto adelgazado se habilita con /toggle-wiki»;
      - en `windows-global-install`, el comando entra en lo que instala, con el escenario «El comando /toggle-wiki da la ruta del núcleo instalado».
    - **Tests:**
      - un `core-test` de `wiki-engine=`;
      - los escenarios nuevos y «Qué no contiene», vistos en rojo sin el cambio de producto y en verde con él. Para que «Qué no contiene» detecte `.wiki/`, la release de la suite lleva un `.wiki/` versionado, como el tag real;
      - el step de Windows que compara `installed.txt` con el zip trata aparte la entrada del comando, que escribe el `.bat`. No se ha ejecutado en Windows: queda para la 7.4.
    - **ADR-0024 y design:** tienen en cuenta ADR-0021 (el ajuste es del proyecto y la instalación global trae `/toggle-wiki`) y ADR-0022 (sustituye a ADR-0014, y la estrategia de worktree usa el mismo `branch-change.mjs`).
    - **Fallo intermitente:** en una de cuatro pasadas de los `core-tests` del autopilot falló «the worktree strategy: one registration across reloads…». No se ha buscado la causa.
  - Después: rehacer los deltas de `session-bootstrap` y `openspec-autopilot` sobre las specs nuevas, hacer que ADR-0024 tenga en cuenta ADR-0021 y ADR-0022, y que el instalador y la variante adelgazada incluyan el ajuste del wiki. Orden recomendado: la 7.5, después la 7.4 en Windows y por último la 8.3, porque la 7.5 cambia código que la 7.4 verifica.

## 8. Documentación y cierre

- [x] 8.1 README:
  - las dos variantes;
  - cómo instalar y actualizar en Windows con el `.bat`;
  - cómo pasar un proyecto existente a la variante adelgazada;
  - cómo se publica una release.

  → commit
- [ ] 8.2 Antes del archive:
  - hacer `git fetch` y comprobar que los ADRs 0023 y 0024 siguen sin choque;
  - quitar ADR-0017 del `Supersedes` de ADR-0023, que solo sustituye a ADR-0002: el ADR-0017 reescrito de `windows-support` ya no decide nada del núcleo;
  - comprobar si ya han llegado a `main` el ADR-0021 (ON/OFF del wiki) y el ADR-0022 (autopilot dueño de su rama), y hacer que ADR-0024 los tenga en cuenta.
  - Hecho el 2026-11-22:
    - el `git fetch` no da choques: 0023 y 0024 solo están en esta rama. En otras ramas están 0019, 0021, 0022 y 0025, y en `main`, 0017, 0018 y 0020;
    - ADR-0017 está fuera del `Supersedes` de ADR-0023 (`5f4ea17`);
    - ADR-0021 y ADR-0022 han llegado a `main` después (ver la 7.5), junto con el ADR-0025. Nuestros 0023 y 0024 siguen sin choque.
  - Queda:
    - repetir el `git fetch` y la comprobación justo antes del archive;
    - ~~que ADR-0024 cite ADR-0020~~: hecho el 2026-11-22. ADR-0024 cita ADR-0020 en lugar de ADR-0013 y ADR-0017 por el diagnóstico, y recoge lo que no lleva la variante adelgazada (5.6) y los escenarios de Windows elegidos por nombre.
- [ ] 8.3 Ejecutar la suite entera (`npm test`), `npm run test:core`, `npm run lint:specs` y `openspec validate windows-global-distro`. Va sin `--strict`, porque los avisos de SHALL/MUST en español y de los escenarios en Gherkin los dan también las specs vigentes. Anotar aquí los resultados
