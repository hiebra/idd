`acceptance-tests/` ya existe, así que se omite la puesta en marcha de la suite. Se trabaja con el ciclo de `spec-as-source`: rojo → implementar → verde → commit. Un commit nunca mezcla `openspec/` con la zona de código, salvo este `tasks.md`.

Los pasos pendientes salen de `npx cucumber-js --dry-run` sobre `.extracted/changes/add-quote-comment-rule/specs/response-comments/spec.feature`. El `When` `se revisa qué indica sobre …` ya lo define `wiki.steps.js` (no hace nada; cada `Then` dice qué busca) y se reusa. Las referencias D1 a D6 son las del `design.md` del change.

## 1. Núcleo: fuente de la regla, modos y detección (D1, D2, D5)

- [x] 1.1 Comprobar que la suite efectiva está en verde antes de tocar nada, salvo los pasos sin definir de este change (`npm test`, `npm run test:core`)
- [x] 1.2 Añadir a `acceptance-tests/core-tests/` una prueba del núcleo para `comments-reminder`: con los mensajes de los dos Scenario Outline del recordatorio imprime el recordatorio o nada según corresponda; también con espacios iniciales, mayúsculas, acentos y "ya" dentro de la cadena inicial entre comillas (`'ya está bien' sobra` es un comentario, pero `'ya'` no cuenta como palabra de cierre); con `PROJECT_COMMENTS=off`, nada; y sale siempre con 0. Rojo sin el modo
- [x] 1.3 Crear `.agents/comments/rule.md`, con secciones `<!-- comments-rule:<id> -->`, y `.agents/comments/reminder.md`, con la frase fija literal y por debajo de 600 caracteres
- [x] 1.4 Añadir al núcleo los modos `comments-rule` y `comments-reminder` y la función de detección de D2, con `PROJECT_COMMENTS=off`, y documentarlos en la cabecera del script → verde la prueba de 1.2 → commit

## 2. Entrega al empezar la sesión (D3, D4): uno por paso pendiente; en cada uno, rojo por la causa correcta → implementar → verde → commit

- [x] 2.1 `response-comments: El agente recibe la regla de comentarios`, pasos `el contexto de la sesión incluye la regla de comentarios` y `esa regla procede del único archivo de la regla de comentarios del proyecto` (lo entregado contiene la regla tal como la imprime `comments-rule`), en `step-definitions/comments.steps.js`. Rojo en los dos agentes. En Claude Code, `session-start.sh` combina la guía del wiki y la regla en un solo `additionalContext`; en OpenCode, el plugin pide la regla al cargarse y la añade al `system` → verde en los dos → commit
- [x] 2.2 Mismo escenario, paso `el proyecto no tiene archivos de instrucciones que <agente> cargue siempre con la regla de comentarios`, con `alwaysLoadedInstructions`. Comprobar que está en verde sin tocar nada → commit
- [x] 2.3 Comprobar que los escenarios de entrega de la guía del wiki siguen en verde en los dos agentes, ahora que el `additionalContext` y el `system` llevan también la regla. Hecho: el paso `el agente no recibe la guía del wiki` exigía un contexto vacío y fallaba con el wiki desactivado, porque ahora llega la regla; pasa a comprobar que el contexto no incluye la guía, que es lo que pide la spec

## 3. Contenido de la regla: uno por paso pendiente; en cada uno, rojo → implementar → verde → commit

- [x] 3.1 Paso `la regla de comentarios del proyecto` (lee la fuente) y un helper que comprueba una sección por su identificador, como `assertGuideSection` del wiki
- [x] 3.2 `response-comments: La regla dice cómo contestar a un comentario`: los tres `Then` como secciones (`es-comentario`, `frase-fija`, `acumular`). `frase-fija` comprueba además que la sección contiene la frase fija literal de la spec. Rojo sin las secciones; escribirlas en `rule.md` → verde → commit
- [x] 3.3 `response-comments: La regla dice qué hacer con "ya"`: secciones `ya-responde-todos` e `ya-incluye-comentario`. Rojo → escribirlas → verde → commit
- [x] 3.4 `response-comments: La regla dice qué hacer con "reformula"`: secciones `reformula-completa`, `reformula-solo-leido` y `reformula-autonoma`. Rojo → escribirlas → verde → commit. Hecho para 3.2 a 3.4: las secciones ya estaban en `rule.md` desde 1.3, así que el rojo se comprobó quitando temporalmente un identificador de cada escenario

## 4. Recordatorio con los mensajes (D3, D4): uno por paso pendiente; en cada uno, rojo → implementar → verde → commit

- [x] 4.1 Paso `el usuario envía el mensaje <mensaje>`, como expresión regular que toma el resto de la línea (los mensajes llevan comillas simples y dobles), y que envía ese texto con `sendMessage`
- [x] 4.2 `response-comments: El agente recibe el recordatorio con un mensaje que activa la regla`, paso `el agente recibe el mensaje junto con el recordatorio de la regla de comentarios`: el mensaje llega y algún texto de `reminders` contiene el recordatorio de `reminder.md`. Rojo en los dos agentes. En Claude Code, añadir `json_field` a `.claude/hooks/json.sh` y hacer que `user-prompt-submit.sh` lea el `prompt`, pida `comments-reminder` y combine el resultado con el recordatorio del wiki en un solo `additionalContext`. En OpenCode, en el hook `context`, pedir `comments-reminder` con el último mensaje del usuario, guardar el resultado por texto e insertarlo antes del último mensaje → verde en los dos → commit
- [x] 4.3 `response-comments: El agente no recibe el recordatorio con otros mensajes`, paso `el agente recibe el mensaje sin el recordatorio de la regla de comentarios`. Comprobar que está en verde → commit
- [x] 4.4 Añadir a `core-tests/` una prueba de `json_field`: prompts con comillas, barras, saltos de línea, `\uXXXX` y acentos dan el texto original; un JSON sin `prompt` o mal formado da una cadena vacía → commit
- [x] 4.5 Comprobar que los escenarios del recordatorio del wiki siguen en verde en los dos agentes, incluido `Un fallo del recordatorio no bloquea el mensaje`

## 5. Desactivación (D5): rojo → implementar → verde → commit

- [x] 5.1 `response-comments: Un usuario desactiva la regla de comentarios`: paso `el usuario ha desactivado la regla de comentarios para sí mismo en <agente>` (`PROJECT_COMMENTS=off` en `.claude/settings.local.json` en Claude Code y en el entorno en OpenCode, como el paso equivalente del wiki), y los pasos `el agente no recibe la regla de comentarios` y `el agente no recibe el recordatorio de la regla de comentarios con los mensajes`. Reusa `ningún archivo versionado del proyecto ha cambiado`. Verde si el núcleo ya respeta la variable; si no, corregirlo → commit. Hecho: verde a la primera, porque el núcleo ya la respetaba desde 1.4; se comprobó que falla si el núcleo la ignora

## 6. Documentación y cierre

- [x] 6.1 README: añadir la regla de comentarios a "Qué ofrece", con cómo se usa (`'…'`, "ya", "reformula") y cómo se desactiva (`PROJECT_COMMENTS=off`), y enlazar ADR-0010 → commit
- [ ] 6.2 Ejecutar la suite efectiva entera (`npm test` en `acceptance-tests/`): todos los escenarios de este change y de las specs vigentes pasan, sin pasos pendientes ni sin definir de este change, y se genera el informe HTML. Ejecutar también `npm run test:core` y `npm run lint:specs`
- [ ] 6.3 Abrir una sesión nueva de Claude Code en el proyecto y comprobar a mano que recibe la regla al empezar, que un mensaje que empieza por `'` recibe el recordatorio y que el agente contesta con la frase fija
- [ ] 6.4 Ejecutar `openspec validate add-quote-comment-rule --type change --strict` antes del archive. Como en los changes anteriores, el criterio es la validación sin `--strict`; en modo estricto solo deben quedar los avisos de idioma (SHALL/MUST) y de formato (Gherkin en bloques de código)
