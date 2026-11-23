`acceptance-tests/` ya existe, así que se omite la puesta en marcha de la suite. Un commit nunca mezcla la zona de specs con la de código; los `tasks.md` y `openspec/config.yaml` son neutros.

Los tests solo se ejecutan al final, antes del archive, en la tarea 7.2: ninguna otra tarea pendiente ejecuta escenarios (tampoco acotados con `--name`), `npm run test:core` ni `npm run lint:specs`. Cada tarea define sus pasos o implementa lo que nombra y hace commit; los escenarios que nombra son los que cubre, y se comprueban en la pasada de la 7.2. Las tareas ya cerradas se hicieron con el ciclo rojo → verde de `spec-as-source`, y su texto lo refleja.

Los pasos pendientes salen de `npx cucumber-js --dry-run` sobre `.extracted/changes/add-wiki-lite-mode/specs/*/spec.feature`. Las referencias D1 a D8 son las del `design.md` del change. Lo que se compruebe en real y sirva en otra ocasión se apunta como lección candidata; el wiki de este repositorio está deshabilitado, así que no se registra nada en él.

## 1. Punto de partida

- [x] 1.1 Comprobar que la suite efectiva está en verde antes de tocar nada, salvo los pasos sin definir de este change (`npm test`, `npm run test:core`, `npm run lint:specs`), y guardar la guía y el recordatorio de hoy (`.agents/wiki/guide.md` y `reminder.md`, ya entregados por el núcleo para los dos agentes) como referencia del texto de `full` que no debe cambiar (D2)
  - Resultado: `npm run test:core` (234 tests) y `npm run lint:specs` en verde. En `npm test`, todos los escenarios pasan salvo los 44 sin definir de este change (118 pasos). Los 15 de `windows-readiness` necesitan `pwsh` (PowerShell 7) y pasan una vez instalado. En una de las dos ejecuciones falló por un `.git/index.lock` el paso `git add -A` de «Falla una operación de sesión» (autopilot), que pasa solo tres veces de tres: es intermitente y ajeno a este change. La referencia del texto de `full` son `.agents/wiki/guide.md` y `.agents/wiki/reminder.md` en el commit `22b779a`, que el test de 2.1 lee de git
- [x] 1.2 Comprobar en real que los dos comandos `/toggle-wiki` reciben el argumento con `$ARGUMENTS` (OpenCode 2.3.2 y Claude Code) y fijar con ello el paso `toggle-wiki:mode` de D6. Si no hay banco de OpenCode en la nube, avisar al usuario y seguir con lo que no dependa de él
  - Resultado: en los dos agentes, `$ARGUMENTS` se sustituye por el texto tal cual, también dentro de un bloque de código: `lite`, `full`, `light`, `Lite` (sin pasar a minúsculas), `lite extra` (varias palabras juntas) y la cadena vacía sin argumento. En Claude Code 2.1.330, con `claude -p "/probe <arg>"` en un proyecto de prueba. En OpenCode 2.3.2, con el banco de la lección 9 (instalación aprobada por el usuario) y un proveedor falso que devuelve el mensaje recibido, ejecutando el comando con `opencode api session.command` sobre `opencode serve`, porque `opencode run "/probe lite"` no expande comandos y en la nube no hay `tmux` para la TUI. Se comprobó con una sonda y con una copia del `toggle-wiki.md` real con `$ARGUMENTS` añadido; el comando llega sin el frontmatter. Por eso el paso `toggle-wiki:mode` muestra `$ARGUMENTS` una vez, compara el texto exacto con `lite` y `full`, y ejecuta un comando fijo por modo (`wiki mode lite .` o `wiki mode full .`), sin pegar `$ARGUMENTS` en el comando: vacío daría `wiki mode  .`, y varias palabras, argumentos de más

## 2. Núcleo: leer el modo y preparar los textos (D1, D2)

- [x] 2.1 Añadir a `core-tests/wiki-markers.test.js` pruebas de:
  - la tabla de D1: modo ausente, `"full"`, `"lite"`, y los valores inválidos (`"light"`, `"Lite"`, `""`, `lite` sin comillas, un número), con el wiki habilitado y deshabilitado;
  - el aviso del modo principal ante un valor inválido, con el prefijo `session-start:`, los modos `full` y `lite` y el valor recibido, y que `guide` y `reminder` usan `full` sin avisar;
  - los textos de `full` iguales, carácter a carácter, a los de la tarea 1.1, para los dos agentes;
  - los bloques mal formados (sin cerrar, de un modo que no existe, anidados), que no entregan el texto.

  Rojo sin la lectura del modo
- [x] 2.2 Implementar en `.agents/hooks/session-bootstrap.sh` `wiki_current_mode`, el aviso del modo principal y el tratamiento de los bloques de modo en `wiki_text` (D2), con el recordatorio como párrafo único. Documentarlo en la cabecera del script → verde la prueba de 2.1 → commit

## 3. Núcleo: cambiar el modo (D5)

- [x] 3.1 Añadir a `core-tests/wiki-toggle.test.js` pruebas de `wiki mode <full|lite>` y de `status`:
  - escribe `"mode"`, inserta la clave si falta y crea `engine.json` si no existe, sin reescribir el resto del archivo;
  - no cambia `enabled`, `config.yaml` ni el motor, con el wiki habilitado y deshabilitado;
  - con el modo ya declarado, o ausente y pedido `full`, `changed=false` y nada en el stage; con un valor inválido, lo reescribe;
  - pasa al stage solo `engine.json`, sin commit;
  - otro argumento no escribe nada, avisa con los modos que existen y sale con 0;
  - `status` imprime `mode=` y avisa de un valor inválido;
  - `on` y `off` conservan `"mode"`.

  Rojo sin la acción
- [x] 3.2 Implementar `set_field` (generalizando `set_enabled`), la acción `mode` del modo `wiki` y `mode=` en `status` → verde la prueba de 3.1 → commit

## 4. Guía y recordatorio: los bloques de modo (D2, D3, D4)

- [x] 4.1 Añadir a `core-tests/wiki-markers.test.js` pruebas de que la guía y el recordatorio de `lite`, para los dos agentes:
  - tienen los identificadores `consultar-a-peticion` y `no-consultar-por-iniciativa`, y no `consultar-antes`, `peticiones-con-conocimiento`, `operaciones-sin-conocimiento` ni `discernir-peticiones`;
  - fuera de la consulta, tienen las mismas líneas que los de `full`;
  - la guía no pasa de 6.000 caracteres y el recordatorio, de 600;
  - el recordatorio dice «salvo que el usuario lo pida expresamente» y no «consulta antes».

  Rojo sin los bloques de `lite`
- [x] 4.2 Marcar en `.agents/wiki/guide.md` y `.agents/wiki/reminder.md` lo propio de cada modo y añadir lo de `lite` (D3, D4) → verde la prueba de 4.1 y la de 2.1 (`full` sin cambios) → commit

## 5. Suite: el modo es del clon (D8)

- [x] 5.1 Añadir al clon de prueba el modo de su `engine.json` (`wikiMode`, en `support/project.js`, junto a `enabled`: es un ajuste del clon, no de la máquina) y definir los pasos `un clon del proyecto con el wiki habilitado sin declarar ningún modo|en el modo <modo>|en un modo que no existe`, `... con el wiki deshabilitado y declarado el modo lite`, las variantes `una sesión de <agente> abierta en un proyecto con el wiki habilitado en el modo <modo>` y `un proyecto con el wiki habilitado en el modo lite`, y el paso de la plantilla sin modo. Añadir a `support/` la función que aplica los bloques de D2 (`support/wiki-modes.js`) y hacer que `guideAsDelivered(agente, modo)` la use, con el modo del clon por defecto: desde la tarea 4.2, sin ella, los escenarios vigentes que comparan la guía entregada fallan. Escenarios, acotados con `--name`: `Máquina sin hub del usuario`, `Una preferencia local no apaga el wiki del proyecto`, `La guía llega por el adaptador del arranque`, `La sesión siguiente a habilitar el wiki` y `La plantilla no declara el modo` (9 escenarios en verde), y `El agente recibe la guía del wiki` y `En el modo lite, la guía sale del mismo archivo` (4 escenarios), en verde salvo su último paso, «esa guía no incluye lo propio del modo …», que es de la tarea 5.3 → commit
  - Resultado: los 13 escenarios se ejecutan; 9 pasan, y los 4 restantes solo tienen sin definir el paso de la tarea 5.3. Ninguno falla. La función da, para los dos modos y los dos agentes, la misma guía que entrega el núcleo
- [x] 5.2 `llm-wiki: Dos modos del wiki habilitado, declarados en el ajuste del proyecto` (los cuatro escenarios) y `Aviso ante un modo del wiki que no existe`. Rojo → definir los pasos, con `guideAsDelivered(agente, modo)` (tarea 5.1), y el aviso por `systemMessage` y por toast → verde → commit
- [x] 5.3 `wiki-first-knowledge: En el modo lite, el wiki se consulta solo a petición expresa` y los escenarios modificados de la guía, la consulta, el discernimiento y el hueco: los pasos `la guía del wiki del proyecto en el modo <modo>`, «solo cambia lo que indica sobre cuándo consultar el wiki», «no incluye lo propio del otro modo» y las indicaciones de archivado en `lite`. Escenarios, acotados con `--name`: `La guía del modo lite reserva la consulta a la petición expresa del usuario`, `La guía del modo lite nombra la operación de lectura de cada agente`, `Fuera de la consulta, la guía es la misma en los dos modos`, `En el modo lite, las indicaciones de archivado resincronizan el wiki`, `La guía exige consultar antes de responder`, `La guía nombra la operación de lectura de cada agente`, `La guía distingue las peticiones que requieren conocimiento`, `La guía ofrece las tres opciones ante un hueco`, `En el modo lite, la guía ofrece las mismas opciones ante un hueco`, `El agente recibe la guía del wiki` y `En el modo lite, la guía sale del mismo archivo` (15 escenarios). Rojo → verde → commit
- [ ] 5.4 `wiki-first-knowledge: Recordatorio del flujo en cada mensaje` en `lite`: definir los pasos del recordatorio de `lite` en los dos agentes → commit, sin ejecutar tests. Cubre `En el modo lite, el recordatorio no pide consultar antes de responder`, `El agente recibe el recordatorio con cada mensaje` y `Un fallo del recordatorio no bloquea el mensaje` (6 escenarios), que se comprueban en la 7.2

## 6. `/toggle-wiki` con argumento (D6)

- [ ] 6.1 `llm-wiki: Cambiar el modo del wiki con /toggle-wiki lite y /toggle-wiki full` y el escenario `Deshabilitar y habilitar el wiki conserva su modo`: añadir el paso `toggle-wiki:mode` y los textos del paso 5 a `.claude/commands/toggle-wiki.md` y `.opencode/commands/toggle-wiki.md`, y extender `support/toggle-wiki.js` y los pasos con el argumento → commit, sin ejecutar tests. Cubre, para comprobarlos en la 7.2: `Cambiar el modo del wiki`, `Cambiar el modo con el wiki deshabilitado`, `El wiki ya está en ese modo`, `Un argumento que no es un modo`, `La sesión siguiente a cambiar el modo` y `Deshabilitar y habilitar el wiki conserva su modo` (14 escenarios)
- [ ] 6.2 Comprobar en real, con el banco de la tarea 1.2 y un proyecto de prueba, `/toggle-wiki lite`, `/toggle-wiki full`, `/toggle-wiki light` y `/toggle-wiki` en los dos agentes. Es una prueba a mano de los comandos, no ejecuta la suite ni los tests del núcleo. Lo que no se pueda comprobar en la nube se dice al usuario

## 7. Documentación y cierre

- [ ] 7.1 Describir en `README.md` los dos modos, que el modo es el ajuste `"mode"` de `engine.json` y que se cambia con `/toggle-wiki lite|full` → commit
- [ ] 7.2 Hacer `git fetch` y, si la rama de origen ha avanzado, proponer al usuario traerla a la rama del change (lo decide el usuario). Después, la única ejecución de tests de las tareas pendientes, antes del archive: la suite completa (`npm test`, `npm run test:core`, `npm run lint:specs`). Cada escenario pasa, incluidos los que cubren las tareas 5.4 y 6.1, sin pasos pendientes ni sin definir, y se genera el informe HTML. Si algo falla, se corrige y se vuelve a ejecutar aquí
- [ ] 7.3 Ejecutar `openspec validate add-wiki-lite-mode --type change --strict` antes del archive
