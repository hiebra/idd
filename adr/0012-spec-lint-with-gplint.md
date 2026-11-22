# ADR-0012: El lint de las specs usa gplint, con una configuración fijada común a los dos stacks

- Status: accepted
- Date: 2026-11-22
- Supersedes: -

## Context

El lint de las specs revisa el Gherkin de cada `spec.md`, extraído a `.feature` con las mismas líneas. La skill `acceptance-test-authoring` lo describe igual para los dos stacks (JavaScript y Python), con una configuración fijada común. Hasta ahora usaba `gherkin-lint` 4.2.4, que presenta dos problemas:

- **Vulnerabilidades sin arreglo.** Arrastra `gherkin` 9, `cucumber-messages`, `protobufjs` y `uuid` en versiones vulnerables: 6 avisos de `npm audit`, 5 de ellos altos. El paquete no se mantiene, y el único arreglo que ofrece `npm audit` es bajar a la 0.0.15.
- **No revisa los escenarios.** Sus reglas de AST no entran en los hijos de `Rule:`, y la extracción convierte cada requisito en un `Rule:`. Por eso las reglas sobre escenarios no revisaban ninguno.

`gplint` es su fork mantenido: tiene las mismas reglas y opciones, parsea con `@cucumber/gherkin` actual y entra en los hijos de `Rule:`. Se comprobó el 2026-11-22 con la 2.6.2 (change `replace-gherkin-lint-with-gplint`).

Alternativas consideradas:

- **Forzar con `overrides` versiones nuevas de las dependencias de `gherkin-lint`.** Puede romper el parseo sin avisar y no arregla los hijos de `Rule:`.
- **Un lint propio sobre `@cucumber/gherkin`.** Es más código que mantener para reproducir las mismas reglas.
- **Quitar el lint.** Se pierden revisiones que piden la skill y `spec-as-source`.

## Decision

- **El lint de las specs usa `gplint`, en los dos stacks.** En JavaScript es una dependencia de `acceptance-tests/`. Donde no hay `package.json` se ejecuta con `npx gplint@2`, fijado a la versión mayor.
- **La configuración fijada es `references/gplintrc.json` de la skill**, copiada a `acceptance-tests/.gplintrc`. Solo usa los niveles `"error"` y `"off"`, y su cabecera explica cada regla desactivada.
- **La suite comprueba lo que garantiza el lint** (capability `spec-lint`): que falla ante los defectos de los escenarios de un requisito y que las specs del proyecto lo pasan.

## Consequences

- `acceptance-tests/` deja de tener las vulnerabilidades de `gherkin-lint`, y el lint revisa por primera vez los escenarios de cada requisito.
- `gplint` sale con 0 si la configuración tiene un nivel que no conoce, sin revisar nada. Los escenarios de `spec-lint` lo detectan, porque esperan que el lint falle ante cada defecto.
- `gplint` fija versiones exactas de varias dependencias. Al subirlo de versión hay que pasar `npm audit` en `acceptance-tests/` y la suite de `spec-lint`.
- Una regla nueva de `gplint` solo se activa con un change que la añada a la configuración fijada de la skill.
