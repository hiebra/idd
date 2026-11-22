## Context

El autopilot (ADR-0014) ya hace una task por sesión en los dos modos: el paso `task` pide a `openspec-apply-change` una sola task (`lib/prompts.mjs`). Pero el workflow de apply, lanzado fuera de ese paso (a mano en Claude Code, tras compactar, con el plugin parado), recorre todas las tasks y puede delegarlas. Lo que el workflow sí lee siempre es `operations.apply.guidance` de `openspec/config.yaml`, que el CLI entrega con `openspec instructions apply`.

El modo lo elige cada usuario con `options.auto` en su configuración global de OpenCode; el plugin lo lee al cargarse (`server.js`, `const mode = ctx.options?.auto === true ? 'auto' : 'normal'`), y OpenCode recarga el plugin al cambiar la opción. `config.yaml`, en cambio, está versionado, lo leen los dos agentes y hoy tiene comentarios, `rules` y una lista larga de indicaciones de `archive`, que no se pueden perder.

Restricciones:
- El plugin no tiene dependencias: solo módulos `node:` (cabecera de `server.js`). No hay un parser de YAML a mano.
- El plugin nunca bloquea OpenCode ni lanza excepciones hacia él.
- El autopilot exige el árbol limpio al empezar un paso y cierra las revisiones comparando git con su inicio (`lib/git.mjs`, `verdict`).
- ADR-0006: con una capacidad de un solo agente, lo versionado tiene que ser igual con ella y sin ella.

## Goals / Non-Goals

**Goals:**
- `config.yaml` lleva las cuatro indicaciones en modo normal y no las lleva en modo auto, tras cada carga del plugin.
- El resto del archivo queda byte a byte igual.
- Escribir el archivo no rompe el ciclo del autopilot: ni el árbol limpio de los pasos ni el cierre de las revisiones.

**Non-Goals:**
- Cambiar el encadenamiento de tasks del plugin o el texto del paso `task`.
- Editar YAML en general: solo se reconoce y escribe este bloque.
- Hacer el commit de `config.yaml`: lo hace el usuario, como el resto de lo que produce el autopilot (ADR-0013).
- Nada en Claude Code: allí el archivo queda como lo dejó la última carga en OpenCode.

## Decisions

### D1. Un módulo puro, `lib/apply-guidance.mjs`, que edita el texto

`adjust(text, mode)` devuelve `{ text, changed }`, sin I/O; `syncApplyGuidance(directory, mode)` lee, llama a `adjust` y escribe solo si `changed`. Se prueba con `node --test` como `next-step.mjs`.

- Alternativa: una librería de YAML. Rechazada: el plugin no tiene dependencias, y reescribir el documento desde un árbol pierde los comentarios y el formato.
- Alternativa: un archivo aparte con la guidance. Rechazada: el CLI solo lee `operations` de `config.yaml`.

### D2. El bloque se reconoce por su texto canónico

El módulo guarda las cuatro indicaciones en su forma canónica: cada una como `      - >-` seguido de sus líneas a 8 espacios, como en la spec. Hay bloque si esas líneas aparecen seguidas dentro de `operations.apply.guidance`; quitar es borrar exactamente esas líneas. Si el usuario reformatea el bloque a mano, deja de reconocerse: en modo normal se añade otra vez y en modo auto no se quita, y el plugin avisa de que hay texto parecido que no reconoce (busca la primera frase de la primera indicación).

- Alternativa: una marca en un comentario (`# openspec-autopilot: begin`). Rechazada: la spec pide el bloque literal, y una marca es un resto del plugin en un archivo que lee Claude Code.

### D3. Dónde se inserta y qué se poda

Se localizan las claves por su sangría (2 espacios por nivel, la del archivo actual), ignorando comentarios:
- con `operations.apply.guidance`, el bloque va al final de esa lista;
- con `operations.apply` sin `guidance`, o con `operations` sin `apply`, se crean las claves que faltan como primeras hijas de su padre;
- sin `operations`, se añade al final del archivo.

Al quitar, si `guidance` queda vacía se borra, y lo mismo con `apply` y con `operations`. Así, añadir y quitar deja el archivo como estaba (spec: «no quedan claves vacías»). Una clave que ya estuviera vacía antes se perdería, pero vacía no tiene efecto para el CLI.

### D4. Cuándo: al cargarse el servidor, una vez

`start(ctx)` llama a `syncApplyGuidance` en cuanto conoce el modo, antes de registrar el RPC, dentro de `guard` y con límite de tiempo. No vigila el archivo: el cambio de modo ya provoca una recarga. Si no hay `config.yaml`, no hace nada; si falla la lectura o la escritura, lo registra, avisa con un toast y sigue.

### D5. El cambio queda en el árbol, sin stage, y el usuario hace su commit

El plugin no pasa `config.yaml` al stage ni hace commit. Avisa: «openspec-autopilot: he ajustado `openspec/config.yaml` al modo <modo>; haz su commit aparte». Es zona de specs, así que el commit va solo.

- Alternativa: pasarlo al stage. Rechazada: si hay una revisión abierta de una task (zona de código), su commit mezclaría zonas.
- El árbol sucio hace esperar al paso siguiente, como ya hace el autopilot con cualquier cambio pendiente: no hace falta nada nuevo.

### D7. El proyecto versiona `config.yaml` como lo deja el modo por defecto

El `openspec/config.yaml` del proyecto lleva el bloque. El modo por defecto es el normal, así que, en un clon recién hecho, la carga del plugin en modo normal no escribe nada y el autopilot arranca con el árbol limpio. Solo quien activa el modo auto ve el archivo modificado en su primera carga, y hace el commit o descarta el cambio (con el árbol sucio, el autopilot espera).

- Alternativa: no versionar el bloque y que lo añada la primera carga. Rechazada al implementarlo: en un clon nuevo, el primer paso del autopilot en modo normal se queda esperando un commit, y se rompían seis escenarios que ya existían (el arranque, el reinicio, el arranque sin TUI y la revisión del verify).
- Alternativa: que el autopilot no cuente su propio ajuste como árbol sucio. Rechazada: añade código y otra excepción al cierre de las revisiones para un caso que D7 evita en el modo por defecto.

### D6. Una revisión abierta no se cierra por el ajuste

`verdict` da `ko` si git cambió, no hay nada en el stage y HEAD no avanzó. En la revisión del verify, que empieza con el árbol limpio, el ajuste solo bastaría para cerrarla como no satisfactoria. Por eso, si `syncApplyGuidance` escribe, el plugin actualiza la firma de inicio (`review.git.signature`) de la revisión abierta de la rama con el estado de git después de escribir. HEAD no cambia, así que un commit posterior sigue dando `ok`.

## Risks / Trade-offs

- [Lo versionado depende del modo de quien hizo el último commit] → El ADR nuevo lo acota a este bloque. La guidance da un apply igual de válido en los dos agentes: el change acaba igual que con un apply seguido (la propia indicación lo exige).
- [Dos usuarios con modos distintos se pisan `config.yaml`] → Cada carga deja un diff de solo esas líneas, fácil de ver; el usuario decide si hace el commit o lo descarta. Con el árbol sucio, el autopilot se para y lo pide.
- [El reconocimiento por texto es frágil ante ediciones a mano] → Aviso cuando hay texto parecido sin reconocer (D2), y escenarios de la suite con el archivo real del proyecto.
- [Una rama concurrente (`origin/claude/exciting-ramanujan-802ws8`, ADR-0022) cambia la sesión operativa del autopilot] → Puede chocar con `server.js` al fusionar. El cambio en `server.js` se limita a una llamada en `start` y a actualizar una firma (D6).

## Migration Plan

El change versiona el bloque en `openspec/config.yaml` (D7), así que no hay migración en modo normal; en modo auto, la primera carga lo quita y el usuario hace el commit o lo descarta. Para dar marcha atrás, se activa el modo auto (el plugin quita el bloque) o se desactiva el plugin y se borra el bloque a mano.

## Open Questions

- ADR-0006 exige que lo versionado sea igual con la capacidad y sin ella. Este change hace que `openspec/config.yaml` dependa del modo del plugin. El paso adr tiene que registrar un ADR nuevo, ADR-0025: el número más alto en las ramas remotas es ADR-0024. Ese ADR sustituye a ADR-0006, mantiene su política y añade una excepción acotada: un plugin puede mantener en un archivo versionado un bloque declarado y literal que leen igual los dos agentes, si el resultado del ciclo no cambia.
