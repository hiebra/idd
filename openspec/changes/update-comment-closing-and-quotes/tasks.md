Se trabaja con el ciclo de `spec-as-source`: rojo → implementar → verde → commit. Un commit nunca mezcla `openspec/` con la zona de código, salvo este `tasks.md`. Las referencias D1 a D4 son las del `design.md`.

## 1. Núcleo: detección (D1, D2)

- [ ] 1.1 Comprobar que la suite está en verde antes de tocar nada (`npm test`, `npm run test:core`), salvo los escenarios de este change
- [x] 1.2 Actualizar `core-tests/comments-reminder.test.js`. Debe activar: citas (`> …`, `>sin espacio`, `<!-- attach -->\n> …\n\ntexto`, varias marcas HTML), `p`, `R`, `procesa`, `Procesar`, `reformular`. No debe activar: `ya`, `ya lo veo`, `a > b`, un comentario HTML sin nada más. Rojo
- [x] 1.3 Cambiar `activates_comments` del núcleo según D1 y D2 → verde → commit

## 2. Regla y recordatorio (D3, D4)

- [x] 2.1 Actualizar `comments.steps.js`: la `FIXED_REPLY` nueva y las secciones `es-comentario-cita`, `idioma`, `procesar-responde-todos` y `procesar-incluye-comentario`. Rojo
- [x] 2.2 Reescribir `.agents/comments/rule.md` y `reminder.md` (menos de 600 caracteres) con la marca de cita, la frase nueva, el idioma y las palabras de cierre nuevas → verde → commit
- [x] 2.3 Comprobar los escenarios del recordatorio con los mensajes nuevos en los dos agentes

## 3. Documentación y cierre

- [x] 3.1 README: actualizar la regla de comentarios (citas, frase, `p`/`r`) → commit
- [ ] 3.2 Ejecutar la suite entera (`npm test`), `npm run test:core` y `npm run lint:specs`
