## Context

El CLI de OpenSpec (1.17.0) entrega en `operationGuidance` las indicaciones de `operations.apply.guidance` de `openspec/config.yaml`, en cada `openspec instructions apply`. El workflow de apply (`openspec-apply-change`) las lee como consejo adicional: sigue las que son aplicables y compatibles con sus pasos, y explica por qué no sigue las demás. Hoy la lista tiene solo el bloque de «una task por sesión», que el plugin `openspec-autopilot` mantiene según el modo (`lib/apply-guidance.mjs`, ADR-0025):

- lo reconoce por su texto canónico;
- en el modo normal lo añade al final de la lista;
- en el modo auto lo quita y poda las claves que quedan vacías.

Lo que se comprobó al preparar el change, en copias desechables del proyecto:

- **Con la indicación delante del bloque**, añadir y quitar el bloque deja el archivo byte a byte igual. Si va detrás, al volver al modo normal el bloque se añade al final, la indicación queda delante y el archivo cambia.
- **Agentes sin la herramienta**: un agente sin la indicación no buscó la lista. Con ella, la buscó, no la tenía y siguió con la salida normal, diciéndolo al final. Con el bloque, además, hizo una sola task y paró, como hoy.
- **La suite**: fallan tres comprobaciones, porque sus helpers dan por hecho que el bloque es la única indicación de apply del proyecto:
  - `withoutBlock`, de `step-definitions/apply-guidance.steps.js`, solo poda `apply:` y `guidance:` si la lista queda vacía;
  - en el escenario «Sin indicaciones de apply previas no quedan claves vacías», el paso `Given` exige que el proyecto no tenga `operations.apply`;
  - la prueba del núcleo `the project config.yaml keeps every other byte in both modes` cuenta las claves que crea el plugin.

Qué hace cada agente con la lista:

- **Claude Code** da `TaskCreate`/`TaskUpdate` por defecto solo en algunos modelos, y en las sesiones en la nube y en segundo plano. En los demás, se activa con `CLAUDE_CODE_ENABLE_TODO_TOOLS=1`. La lista es de la sesión, sobrevive a la compactación y se ve con Ctrl+T.
- **OpenCode 2** da `todowrite` solo con `experimental.todo: true`, y es experimental.

Restricciones:

- **ADR-0021**, que mantiene de ADR-0010 que toda instrucción llega por el arranque. La guidance de `config.yaml` es configuración de los workflows de OpenSpec, como las indicaciones de archive y el bloque de apply, no una instrucción de sesión.
- **ADR-0025**: un plugin solo puede escribir en un archivo versionado un bloque declarado que depende de una preferencia.
- **`spec-as-source`**: `config.yaml` es neutro entre zonas.

## Goals / Non-Goals

**Goals:**
- Que el apply refleje `tasks.md` en la lista de tareas del agente cuando la tiene, en los dos agentes y en los dos modos del autopilot.
- Que la indicación conviva con el bloque del plugin sin que ninguno de los dos cambie al otro.
- Que la suite admita otras indicaciones de apply junto al bloque.

**Non-Goals:**
- Activar la lista de tareas desde el proyecto.
- Cambiar el workflow de apply, el CLI o `lib/apply-guidance.mjs`.
- Comprobar en la suite cómo usa el modelo la lista: no hay modelo en la suite.
- Un archivo de progreso o cualquier otro rastro en el repositorio.

## Decisions

### D1. Una indicación fija en `operations.apply.guidance`, la primera de la lista

El texto literal es el de la spec. Va en inglés, como el resto de la guidance de apply, y la condición está en la propia indicación: si el agente no tiene la herramienta, no pide nada.

Alternativas:
- **`context`.** Rechazada: es una entrada obligatoria, y el CLI la inyecta también al escribir cada artefacto, no solo en el apply.
- **Una regla de `rules.tasks`.** Rechazada: se aplica al escribir `tasks.md`, no al implementarlo.
- **Una instrucción de sesión por el arranque (ADR-0021).** Rechazada: llegaría a todas las peticiones, no solo al apply, y tendría que repetir qué es el archivo de tracking, algo que el CLI ya da en el apply.

### D2. Delante del bloque, y el plugin no cambia

El plugin ya conserva las demás indicaciones de apply (su spec lo exige) y añade el bloque al final de la lista. Con la indicación la primera, la ida y vuelta entre modos deja el archivo como estaba, y el bloque queda siempre después de ella.

Alternativa: que el plugin gestione también la indicación. Rechazada: no depende de ninguna preferencia, así que no es el caso de la excepción de ADR-0025, y añadiría código sin necesidad.

### D3. Reflejo de solo lectura, completado solo tras confirmarlo el CLI

La lista no es una segunda fuente de verdad. Una task se marca completada en la lista solo cuando su checkbox está `- [x]` y lo confirma la repetición de las instrucciones de apply, el mismo criterio con el que el workflow da una task por hecha.

Con más de una docena de tasks, la lista lleva una entrada por grupo con su recuento, porque Claude Code solo muestra unas pocas entradas a la vez y cada entrada cuesta una llamada en cada sesión. Los changes del proyecto tienen entre 6 y 50 tasks.

### D4. La activación es de cada usuario y se documenta en el README

Que el agente tenga la lista es una preferencia de cada usuario, como el modo del autopilot. El README dice cómo activarla en local en cada agente. Ningún archivo versionado la activa, y lo comprueba un escenario.

Alternativa: `env` en `.claude/settings.json`. Rechazada: la impone a todo el equipo y cambia las herramientas del agente en todas las sesiones, no solo en el apply.

### D5. La suite, generalizada sobre la lista de apply

- **`withoutBlock`** quita las líneas exactas del bloque y poda `guidance:` y `apply:` solo si quedan sin elementos, como `adjust`.
- **Los `Given` del escenario de las claves vacías** parten del proyecto sin la indicación de la lista, para que ese escenario siga probando el caso sin `operations.apply`.
- **La prueba del núcleo** compara con el resultado de `adjust`. No cuenta las claves que crea, porque con otra indicación de apply el plugin ya no crea ninguna.
- **Pasos nuevos de la capability `apply-progress`**:
  - la primera indicación de apply es la de la lista, en el CLI y en el archivo;
  - el bloque va después de ella o no está;
  - ningún archivo versionado activa la lista.

  Los pasos leen el texto literal de la spec, como los del bloque.

## Risks / Trade-offs

- [La indicación es un consejo y el modelo puede no seguirla] → Es el contrato de `operationGuidance`. Si no la sigue, la salida normal del workflow sigue mostrando el progreso, así que no se pierde nada.
- [Coste en contexto y en llamadas de cada sesión, con la lista activa] → Lo acotan el agrupado por encima de una docena de tasks y que la activación es una decisión de cada usuario.
- [Las herramientas de lista cambian de nombre o de condiciones entre versiones de los agentes] → La indicación no nombra ninguna herramienta, y la activación está solo en el README.
- [Alguien pone la indicación detrás del bloque] → La ida y vuelta entre modos la deja delante, en un diff de solo el bloque. El escenario de los dos modos lo detecta.

## Migration Plan

`openspec/config.yaml` lleva la indicación desde este change. Los clones siguen como estaban: la indicación no hace nada sin la herramienta. Para dar marcha atrás, se borra la indicación del archivo.

## Open Questions

- Ninguna sobre los ADRs en vigor:
  - ADR-0021 (con lo que mantiene de ADR-0010) no se contradice: la guidance es configuración de OpenSpec;
  - ADR-0025 no aplica, porque la indicación no depende de ninguna preferencia;
  - ADR-0022 y ADR-0020 no se tocan.
