Se trabaja con el ciclo de `spec-as-source`: rojo → implementar → verde → commit. Un commit nunca mezcla `openspec/` con la zona de código, salvo este `tasks.md`. Las referencias D1 a D6 son las del `design.md`.

## 1. Núcleo: detección (D1, D1b)

- [x] 1.1 Comprobar que la suite está en verde antes de tocar nada (`npm test`, `npm run test:core`), salvo los escenarios de este change
- [x] 1.2 Actualizar `core-tests/comments-reminder.test.js`. Debe activar: `''…''` (también tras marcas HTML), citas `>`, la cita de la web de OpenCode (con y sin comentario, con texto antes). No debe activar: `'…'` sin doblar, `''` sin cierre, `The user quoted the following from …:` sin líneas `> ` debajo. Rojo
- [x] 1.3 Cambiar `activates_comments` del núcleo según D1 y D1b → verde → commit

## 2. Suite: varios plugins en el OpenCode simulado (D5)

- [x] 2.1 `opencode-host.mjs`: cargar `options.plugins` en orden, con `options.plugin` como lista de uno; ejecutar los hooks `context` de todos sobre la misma petición, y la limpieza de cada uno
- [x] 2.2 `opencode.js`: abrir la sesión con los plugins de sesión del proyecto que existan (`session-bootstrap` y `response-comments`) → suite en verde → commit

## 3. Plugin `response-comments` (D2, D3, D4)

- [x] 3.1 Steps: `un clon del proyecto sin el plugin de comentarios de OpenCode` y `el usuario cita "<fragmento>" desde la web de OpenCode con el comentario "<comentario>"`. Rojo
- [x] 3.2 Crear `.opencode/plugins/response-comments/server.js` y quitar la parte de comentarios de `session-bootstrap/server.js` → verde → commit

## 4. Regla y recordatorio (D6)

- [x] 4.1 Actualizar `comments.steps.js`: la `FIXED_REPLY` nueva y la sección de la cita de la web de OpenCode. Rojo
- [x] 4.2 Reescribir `.agents/comments/rule.md` y `reminder.md` (menos de 600 caracteres) con la marca `''así''`, la cita de la web de OpenCode y la frase nueva → verde → commit
- [x] 4.3 Actualizar la cabecera de uso del núcleo, que aún nombra "ya" y "reformula" → commit

## 5. Documentación y cierre

- [ ] 5.1 README: la marca `''así''`, la frase nueva y el plugin `response-comments` → commit
- [ ] 5.2 Ejecutar la suite entera (`npm test`), `npm run test:core`, `npm run lint:specs` y `openspec validate update-comment-phrase-and-opencode-marker` (sin `--strict`: los avisos de SHALL/MUST en español y de los escenarios en Gherkin los dan también las specs vigentes)
