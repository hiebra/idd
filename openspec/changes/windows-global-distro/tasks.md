Se trabaja con el ciclo de `spec-as-source`: rojo → implementar → verde → commit. Un commit nunca mezcla `openspec/` con la zona de código, salvo este `tasks.md`. Las referencias D1 a D7 son las del `design.md`. Los escenarios con la etiqueta `@windows` solo se ejecutan en el job de Windows del workflow (D7).

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

## 6. El `.bat` y la suite de Windows (D6, D7)

- [ ] 6.1 Steps `@windows` de `windows-global-install` y `slim-template`. Ejecutan el `.bat` con `cmd.exe` sobre un `<data>` y un `<config>` temporales, con y sin variables XDG, y con un perfil con espacios en la ruta. Los zips los sirve un servidor local. Rojo en Windows
- [ ] 6.2 Escribir el `.bat`, solo con `cmd`, `curl.exe` y `tar.exe`:
  - calcula `<data>` y `<config>`;
  - lee la versión instalada;
  - descarga y descomprime en un directorio temporal;
  - borra lo que lista `installed.txt`;
  - mueve lo nuevo a su sitio y escribe el `SKILL.md` con la ruta absoluta;
  - escribe al final `installed.txt` y `version`.

  → verde en Windows → commit
- [ ] 6.3 Añadir `.github/workflows/release.yml`, que se dispara con los tags `v*`:
  - un job de Linux que pasa la suite, monta los artefactos y ejecuta la prueba de 5.2;
  - un job `windows-latest` que pasa el perfil `windows` con los artefactos montados;
  - la publicación de la release con los tres artefactos.

  → commit
- [ ] 6.4 Probar el workflow sin publicar, con un disparo manual o un tag de prueba que se borra después, y comprobar que los dos jobs pasan → anotar el resultado aquí

## 7. Documentación y cierre

- [ ] 7.1 README:
  - las dos variantes;
  - cómo instalar y actualizar en Windows con el `.bat`;
  - cómo pasar un proyecto existente a la variante adelgazada;
  - cómo se publica una release.

  → commit
- [ ] 7.2 Antes del archive:
  - hacer `git fetch` y comprobar que los ADRs 0023 y 0024 siguen sin choque;
  - comprobar si `windows-support` (ADR-0017) se ha fusionado o abandonado, y ajustar el `Supersedes` de ADR-0023;
  - comprobar si ya han llegado a `main` el ADR-0021 (ON/OFF del wiki) y el ADR-0022 (autopilot dueño de su rama), y hacer que ADR-0024 los tenga en cuenta.
- [ ] 7.3 Ejecutar la suite entera (`npm test`), `npm run test:core`, `npm run lint:specs` y `openspec validate windows-global-distro`. Va sin `--strict`, porque los avisos de SHALL/MUST en español y de los escenarios en Gherkin los dan también las specs vigentes. Anotar aquí los resultados
