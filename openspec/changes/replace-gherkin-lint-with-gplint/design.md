## Context

El lint de las specs (`npm run lint:specs` en `acceptance-tests/`) extrae los `spec.md` a `.extracted/` y pasa `gherkin-lint` 4.2.4 con la configuración fijada `.gherkin-lintrc`, que es una copia literal de `references/gherkin-lintrc.json` de la skill `acceptance-test-authoring`. La skill describe la misma herramienta para los dos stacks: en JavaScript, como dependencia de `acceptance-tests/`; en Python, con `npx gherkin-lint` desde `run_acceptance.py --lint`; y, antes de que exista `acceptance-tests/`, con `npx gherkin-lint` desde la skill.

`gherkin-lint` depende de `gherkin` 9, que arrastra `cucumber-messages`, `protobufjs` y `uuid` vulnerables. `npm audit` informa de 6 vulnerabilidades (5 altas) y su único arreglo es bajar a `gherkin-lint` 0.0.15. El paquete no se mantiene.

Comprobado el 2026-11-22 con `gplint` 2.6.2 en un directorio aparte:

- **Mismas reglas.** Las 17 reglas de la configuración actual existen en `gplint` con el mismo nombre y las mismas opciones, y `gplint` no activa ninguna regla que no esté en la configuración.
- **Configuración.** Busca `.gplintrc` en el directorio de trabajo, admite comentarios y solo acepta los niveles `"off"`, `"warn"` y `"error"`: el `"on"` de `gherkin-lint` se eliminó en la 2.0.
- **Resultado sobre las specs del proyecto.** Sobre las 7 specs vigentes extraídas termina sin errores, igual que `gherkin-lint`.
- **Hijos de `Rule:`.** Sus reglas de AST entran en ellos. Con una spec de prueba pasada por `extract-gherkin.cjs`, `gplint` informa de un Scenario Outline sin `Examples`, de `Examples` en un Scenario y de un espacio al final de un paso, cada uno en su línea del `spec.md`. `gherkin-lint` solo informa del espacio. Como todos los escenarios de una spec extraída están dentro de un `Rule:`, hoy esas reglas no revisan ningún escenario.
- **Dependencias.** `npm audit` de un proyecto con solo `gplint` no encuentra vulnerabilidades.

## Goals / Non-Goals

**Goals:**
- Quitar `gherkin-lint`, y con él sus vulnerabilidades, de `acceptance-tests/` y de la skill.
- Mantener lo que revisa el lint y añadir lo que ya prometía y no hacía: los escenarios dentro de cada requisito.
- Que la suite compruebe lo que el lint garantiza (capability `spec-lint`).

**Non-Goals:**
- Activar reglas nuevas de `gplint` o cambiar las que están desactivadas. Cada una tiene su razón en la cabecera de la configuración y siguen valiendo.
- Corregir que el extractor deje en blanco un `#### Scenario:` sin nombre (ver la propuesta).
- Usar el `--fix` de `gplint`.

## Decisions

### D1. `gplint` en lugar de `gherkin-lint`

Se cambia de herramienta, no de versión.

Alternativas:
- **Mantener `gherkin-lint` y forzar con `overrides` versiones nuevas de `protobufjs` y `uuid`.** `gherkin` 9 usa la API antigua de `cucumber-messages`: forzar mayores distintas puede romper el parseo sin avisar, y el paquete sigue sin mantenerse y sin entrar en los hijos de `Rule:`.
- **Un lint propio sobre `@cucumber/gherkin`.** Es código que mantener para reproducir reglas que `gplint` ya tiene.
- **Quitar el lint.** Se pierden revisiones que la skill y `spec-as-source` piden.

### D2. La configuración se traslada tal cual

`references/gherkin-lintrc.json` pasa a ser `references/gplintrc.json`, y la copia de `acceptance-tests/`, `.gplintrc`. Las mismas reglas con el mismo estado: `"on"` pasa a `"error"` y `"off"` se queda. La cabecera nombra `gplint` y sigue explicando por qué cada regla desactivada está desactivada. Desaparece de ella, y de `SETUP.md` de JavaScript, la limitación de los hijos de `Rule:`.

### D3. Versión fijada

En `acceptance-tests/package.json`, `gplint` entra como `^2.6.2`, como el resto de dependencias, y el `package-lock.json` fija la versión exacta. Donde no hay `package.json` (el stack de Python y el comando de la skill antes de montar la suite), `npx gplint@2`. Así no se ejecuta una mayor nueva sin revisarla, que es lo que pasaría con un `npx gplint` sin versión.

### D4. Cómo prueba la suite el lint

Los escenarios no pueden ejecutar `npm run lint:specs` tal cual: reconstruye `.extracted/`, el directorio del que cucumber-js lee la suite en curso. El World ejecuta los mismos dos comandos del script, con otros directorios:

- `node extract-gherkin.cjs <openspec> <salida>`, sobre un `openspec/` temporal con la spec del escenario o sobre el `openspec/` del proyecto;
- `gplint` de `acceptance-tests/node_modules` con `-c .gplintrc` y `-f json`, para leer el código de salida y la línea de cada error.

Para que los dos comandos no se separen del script, un test de `core-tests/` comprueba que `lint:specs` es exactamente `node extract-gherkin.cjs && gplint .extracted`.

La spec de cada escenario tiene un solo requisito y un solo defecto, y el World guarda la línea del `spec.md` en la que lo escribió. El paso comprueba que hay un error en esa línea y ninguno en otra.

## Risks / Trade-offs

- [Un nivel que `gplint` no conoce, como `"on"`, lanza una excepción, pero `gplint` sale con 0 y el lint pasa sin revisar nada] → la configuración solo usa `"error"` y `"off"`, y los escenarios de `spec-lint` fallarían si el lint dejara de revisar: comprueban que falla ante cada defecto.
- [`gplint` fija versiones exactas de varias dependencias, y una vulnerabilidad nueva en ellas no se arregla con un `npm update`] → `npm audit` de `acceptance-tests/` en el cierre del change, y en el futuro cuando se suba de versión.
- [Una versión nueva de `gplint` informe de defectos que hoy no ve en las specs] → el escenario "Las specs del proyecto pasan el lint" lo detecta en la suite.

## Migration Plan

1. `npm uninstall gherkin-lint && npm install -D gplint@^2.6.2` en `acceptance-tests/`.
2. Renombrar la configuración y cambiar el script `lint:specs`.
3. Rollback: revertir los commits del change y `npm install`.

Quien tenga ya el clon recibe la dependencia nueva con el `npm install` del arranque de sesión.

## Open Questions

Ninguna. Ningún ADR en vigor trata la herramienta del lint.
