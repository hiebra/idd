`acceptance-tests/` ya existe, así que se omite la puesta en marcha de la suite. Se trabaja con el ciclo de `spec-as-source`: rojo → implementar → verde → commit. Un commit nunca mezcla la zona de specs con la de código; los `tasks.md` son neutros y, desde la tarea 2.1, también `openspec/config.yaml` (D11).

Los pasos pendientes salen de `npx cucumber-js --dry-run` sobre `.extracted/changes/add-project-wiki-toggle/specs/*/spec.feature`. Las referencias D1 a D11 son las del `design.md` del change. Lo que se compruebe en real y sirva en otra ocasión se apunta como lección candidata, y se registra en el wiki solo si el usuario lo confirma.

## 1. Comprobaciones previas en real (antes de implementar lo que dependa de ellas)

- [x] 1.1 Comprobar que la suite efectiva está en verde antes de tocar nada, salvo los pasos sin definir de este change (`npm test`, `npm run test:core`, `npm run lint:specs`)
- [x] 1.2 Montar el banco de OpenCode fuera del repositorio (lección 9 de `.wiki/raw/notes/2026-11-21-ll-sesiones-opencode-autopilot.md`), con `XDG_CONFIG_HOME` aislado y la TUI en `tmux`. Pedir antes al usuario que apruebe `npm install @opencode/cli@2.3.2` o añadir reglas `allow` estrechas para ese paquete (`.wiki/raw/notes/2026-11-22-ll-modo-auto-instalar-opencode.md`). Si no se consigue en la nube, avisar al usuario y seguir con lo que no dependa del banco
- [x] 1.3 En OpenCode 2.3.2, comprobar en qué ruta del proyecto se cargan los comandos (`.opencode/command/` o `.opencode/commands/`), si admiten argumentos y si un comando añadido a mitad de sesión aparece en la TUI. Fija la ruta del comando de D4
  - Resultado: carga las dos rutas, admite `$ARGUMENTS` y un comando añadido a mitad de sesión aparece y se ejecuta en la TUI. Se fija `.opencode/commands/`, en plural como `plugins/` y `skills/`
- [x] 1.4 En Claude Code 2.1.330, comprobar si una skill y un comando que se enlazan a mitad de sesión (después del hook, desde una herramienta Bash) se pueden usar en esa misma sesión. Decide el aviso de D4 sobre lo que vale desde la sesión siguiente
  - Resultado: con `.claude/skills/` y `.claude/commands/` ya existentes al abrir la sesión y symlinks relativos a destinos dentro del proyecto, la skill y el comando enlazados a mitad de sesión se usan en esa misma sesión. Con destinos fuera del proyecto y los directorios creados a mitad de sesión, no; no se ha aislado cuál de las dos cosas lo impide
- [x] 1.5 Comprobar que DashScope (`dashscope-intl.aliyuncs.com`, con la credencial que pone el proxy) sirve como proveedor `@ai-sdk/openai-compatible` de OpenCode en el banco, con un modelo que use herramientas. Si no sirve, avisar al usuario: el nivel 2 de D9 necesita otro proveedor

## 2. Zonas: `openspec/config.yaml` neutro (D11)

- [x] 2.1 `openspec-change-lifecycle: La puerta check commit comprueba las zonas`, filas nuevas de `engine.json` con `config.yaml` y de `config.yaml` con un `design.md`. Rojo con el `zoneOf` actual; tratar `openspec/config.yaml` como neutro en `.agents/openspec/branch-change.mjs` → verde → commit
- [x] 2.2 Decir lo mismo en las skills `spec-as-source` y `openspec-git-discipline` (en `.agents/skills/`; la copia de `.claude/skills/` es un symlink), con el comentario de copia reescrita a propósito en `spec-as-source`, que viene del origen → commit

## 3. Núcleo: el ajuste y el modo `wiki` (D1, D2, D3, D5, D6, D8)

- [x] 3.1 Añadir a `core-tests/` pruebas del modo `wiki` del núcleo:
  - `status` informa del ajuste, de si existe `.wiki/` y de qué entraría y qué se excluiría en la ingesta inicial;
  - `on` y `off` cambian `enabled`, insertan o quitan el bloque entre marcas, conservan byte a byte el resto de `config.yaml` (comentarios incluidos), crean o quitan `operations.archive.guidance` si hace falta, pasan al stage `engine.json` y `config.yaml` y no hacen commit;
  - con un par de marcas mal formado o repetido no tocan `config.yaml` y avisan;
  - sale siempre con 0.

  Rojo sin el modo
- [x] 3.2 Crear `.agents/wiki/archive-guidance.yaml` con los pasos de resincronización que hoy están en `config.yaml`, incluida la parte de la primera entrada que habla del wiki (D2)
- [x] 3.3 Implementar en el núcleo:
  - la lectura de `enabled`, que solo acepta el literal `true`, sin Node;
  - `wiki_disabled` según el ajuste, sin leer `PROJECT_WIKI` (D6);
  - el modo `wiki <status|on|off>`;
  - la búsqueda de la guía, el recordatorio, `opencode-note.md` y `archive-guidance.yaml` junto al propio núcleo (D8);
  - la descarga del motor aislada en una sola función;
  - el aviso de bloque desfasado respecto a su fuente con el wiki encendido.

  Documentarlo en la cabecera del script → verde la prueba de 3.1 → commit
- [x] 3.4 Añadir a `core-tests/` una prueba de que el aviso de bloque desfasado sale solo con el wiki encendido y el bloque distinto de la fuente, y de que el arranque no reescribe `config.yaml` → commit

## 4. Suite: el estado del wiki es del clon (D7)

- [x] 4.1 Sustituir en `support/machine.js` el `wikiDisabled` y `PROJECT_WIKI` por el `enabled` del `engine.json` del proyecto de prueba, y definir los pasos `un clon del proyecto con el wiki habilitado`, `... con el wiki deshabilitado`, `... deshabilitado y con \`.wiki/\``, `... deshabilitado y sin \`.wiki/\``, `un proyecto con el wiki habilitado|deshabilitado`, `el wiki del proyecto se ha deshabilitado` y las variantes `... en el que ya se ha abierto una sesión de <agente>`, `... en el que ya se han abierto sesiones de Claude Code y de OpenCode`, `... que usa una versión del motor` y `una sesión de <agente> abierta en un proyecto con el wiki habilitado`
- [x] 4.2 Comprobar que los escenarios vigentes que ahora dicen "con el wiki habilitado" (motor, versión, hub, guía, recordatorio, resincronización) pasan en los dos agentes; quitar el paso `el usuario ha desactivado el wiki para sí mismo en <agente>` y su escenario, que se va con el requisito retirado → commit

## 5. Arranque con el wiki deshabilitado: uno por paso pendiente; en cada uno, rojo → implementar → verde → commit

- [ ] 5.1 `llm-wiki: Un proyecto con el wiki deshabilitado` y `session-bootstrap: El wiki se ha deshabilitado con el motor instalado`: pasos `las indicaciones de archivado de OpenSpec no mencionan el wiki`, `el motor del wiki está instalado y expuesto a <agente>`, `el motor del wiki no está disponible para <agente>` y `git no muestra como cambio nada de lo retirado`, en los dos agentes
- [ ] 5.2 `llm-wiki: Sin operaciones del wiki con el wiki deshabilitado`: pasos `no dispone de la consulta de solo lectura del wiki` y `no dispone de la gestión del wiki`
- [ ] 5.3 `llm-wiki: Una preferencia local no apaga el wiki del proyecto`: pasos `el usuario tiene \`PROJECT_WIKI=off\` en el entorno de <agente>` (en Claude Code, en `.claude/settings.local.json`; en OpenCode, en el entorno) y `el agente recibe la guía del wiki`
- [ ] 5.4 `wiki-first-knowledge: Sin resincronización con el wiki deshabilitado`: paso `no mencionan el wiki`, sobre las indicaciones de archivado que devuelve `openspec instructions archive`

## 6. `/toggle-wiki` (D4): uno por paso pendiente; en cada uno, rojo → implementar → verde → commit

- [ ] 6.1 Escribir el comando en `.claude/commands/toggle-wiki.md` y en la ruta de OpenCode que fijó la tarea 1.3, con el mismo texto salvo cómo se invocan las operaciones del motor, que guía al modelo por los pasos de D4
- [ ] 6.2 `llm-wiki: El comando está disponible con el wiki deshabilitado`: paso `el agente dispone del comando \`/toggle-wiki\``, en los dos agentes
- [ ] 6.3 `llm-wiki: Habilitar el wiki` y `Deshabilitar el wiki`: pasos `el usuario ejecuta \`/toggle-wiki\` en <agente>` (el modelo con guion de la suite sigue los pasos del comando y ejecuta el modo `wiki`), `el wiki del proyecto queda habilitado|deshabilitado`, `las indicaciones de archivado de OpenSpec incluyen la resincronización del wiki`, `el resto de \`openspec/config.yaml\` no ha cambiado`, `\`.wiki/\` se conserva sin cambios`, `los cambios quedan en el stage de git, sin commit` y `se informa de que el wiki queda …`
- [ ] 6.4 `llm-wiki: La sesión siguiente a habilitar el wiki`: paso `un clon del proyecto en el que se acaba de habilitar el wiki con \`/toggle-wiki\``
- [ ] 6.5 `llm-wiki: El usuario confirma la ingesta inicial` y `El usuario no confirma la ingesta inicial`: pasos `el usuario ejecuta \`/toggle-wiki\``, `confirma|no confirma la ingesta inicial que se le propone`, `\`.wiki/\` tiene como fuentes los productos del proyecto, fijados al commit actual`, `las fuentes no incluyen lo generado ni la copia del motor`, `el wiki del proyecto sigue deshabilitado`, `no existe \`.wiki/\`` y `ningún archivo del proyecto ha cambiado`. La ingesta la hace el modelo con guion a partir de la lista de `wiki status`; la prueba del comportamiento con el motor real va en la sección 10
- [ ] 6.6 `llm-wiki: La plantilla trae el wiki deshabilitado`: pasos `la plantilla del proyecto`, `se comprueba el ajuste del wiki del proyecto` y `el wiki está deshabilitado`. Rojo hasta la tarea 9.1

## 7. Autopilot (D5): rojo → implementar → verde → commit

- [ ] 7.1 `openspec-autopilot: El ciclo termina en el archive` y `Con el wiki habilitado sigue el paso del wiki`: pasos `una rama temporal con el change \`exportar-datos\` en un proyecto con el wiki habilitado|deshabilitado`, `la sesión operativa ha terminado el archive de \`exportar-datos\``, `el usuario hace el commit del archive`, `no se crea ninguna sesión para resincronizar el wiki`, `se avisa de que el ciclo de \`exportar-datos\` ha terminado y de que queda fusionar la rama`, `el aviso no menciona el commit del wiki` y `se crea una sesión nueva con el control para resincronizar el wiki`. Implementar en `lib/next-step.mjs` (`archive` → `wiki` o `end` según el ajuste al terminar el archive) y el aviso final de `server.js`
- [ ] 7.2 `openspec-autopilot: La resincronización del wiki recibe las candidatas del change`, con su nuevo `Given`. Añadir a `core-tests/autopilot-next-step.test.js` los casos del paso siguiente con el wiki encendido y apagado, y de la espera de commit tras el archive
- [ ] 7.3 Redactar en condicional ("con el wiki del proyecto habilitado") lo que dicen del wiki `lib/prompts.mjs` y la skill `openspec-git-discipline`; paso `indica que el commit del wiki solo existe con el wiki del proyecto habilitado` → commit

## 8. Documentación

- [ ] 8.1 README: el wiki viene deshabilitado; cómo encenderlo y apagarlo con `/toggle-wiki`, y que el cambio vale para todo el proyecto; quitar "Desactivar el wiki en local" y la mención a `PROJECT_WIKI` en "Desactivar el arranque en local"; la migración (quitar `PROJECT_WIKI`, y ejecutar `/toggle-wiki` en un proyecto anterior que use el wiki); enlazar ADR-0021 → commit
- [ ] 8.2 `acceptance-tests/README.md`: la desactivación pasa a ser el ajuste del clon (D7) → commit

## 9. Estado de este repositorio (D2, D10)

- [ ] 9.1 Poner `"enabled": false` en `.agents/wiki/engine.json` → verde 6.6 → commit
- [ ] 9.2 En `openspec/config.yaml`, quitar los pasos de resincronización y reescribir la primera entrada de `operations.archive.guidance` sin mencionar el wiki. Comprobar con `wiki on` y `wiki off` que el bloque se inserta y se quita sin tocar lo demás → commit

## 10. Pruebas con OpenCode real y con Claude Code real (D9)

- [ ] 10.1 Nivel 1, con el proveedor falso, en la TUI de OpenCode, con un clon de esta rama:
  - con el wiki apagado, la petición al modelo no lleva la guía, ni el recordatorio, ni las skills `wiki-manager` y `wiki-query`;
  - `/toggle-wiki` está disponible;
  - tras encenderlo, en la sesión siguiente llegan la guía, el recordatorio y las skills, y se ve qué llega ya en la misma sesión.
- [ ] 10.2 Nivel 2, con un modelo real, en la TUI de OpenCode:
  - `/toggle-wiki` en los dos sentidos, con y sin `.wiki/`, incluida la propuesta de ingesta inicial y su confirmación o rechazo;
  - consultar con `wiki-query`, con el helper del motor encontrado por `CLAUDE_PLUGIN_ROOT` desde el Bash de OpenCode;
  - ingerir una URL, lecciones en dry-run y el lint con `wiki-manager`;
  - el archive de un change de prueba con el autopilot, con el wiki encendido (paso `wiki` y espera de su commit) y apagado (fin del ciclo).
- [ ] 10.3 En Claude Code real, `/toggle-wiki` en los dos sentidos y la ingesta inicial con confirmación, y qué queda disponible en la misma sesión
- [ ] 10.4 Apuntar como lecciones candidatas lo comprobado en 1.2 a 1.5 y en 10.1 a 10.3, y proponer registrarlas en el wiki del proyecto (`/wiki:ll --dry-run --local`) cuando el wiki esté encendido. Si algo no se pudo probar, decirlo con el motivo y no archivar el change sin la decisión del usuario

## 11. Cierre

- [ ] 11.1 Ejecutar la suite efectiva entera (`npm test` en `acceptance-tests/`): todos los escenarios de este change y de las specs vigentes pasan, sin pasos pendientes ni sin definir de este change, y se genera el informe HTML. Ejecutar también `npm run test:core` y `npm run lint:specs`
- [ ] 11.2 Ejecutar `openspec validate add-project-wiki-toggle --type change --strict` y revisar que solo quedan los avisos conocidos (SHALL/MUST y WHEN/GIVEN en castellano)
- [ ] 11.3 Recordar al usuario, antes del archive, que con el wiki apagado este change no resincronizará el wiki (D10). Si quiere que quede registrado, que lo encienda antes con `/toggle-wiki`
