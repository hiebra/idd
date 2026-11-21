## Context

Hoy un change de OpenSpec se lleva a mano: el usuario lanza cada workflow (`openspec-new-change`, `openspec-continue-change` por artefacto, `openspec-apply-change`, `openspec-verify-change`, `openspec-archive-change` y la resincronización del wiki de `openspec/config.yaml`) en sesiones que acumulan contexto. Encima rige la disciplina heredada de `openspec-git-discipline` (`.agents/skills/`, copia sin cambios del origen), que obliga a fusionar la propuesta con `main` antes del apply y a archivar desde `main` tras fusionar la implementación.

Lo que ya hay y condiciona el design:

- **El arranque de sesión** (ADR-0002, ADR-0005) es un núcleo neutral en `.agents/hooks/` con un adaptador por agente. En OpenCode, el adaptador es el plugin local `.opencode/plugins/session-bootstrap/`: una parte de servidor (`server.js`) y otra de TUI (`tui.js`), cada una un objeto literal `{ id, setup }`, sin dependencias, solo con módulos `node:`, todo dentro de `try/catch` y con los avisos llevados a la TUI por el RPC del plugin.
- **Las skills** tienen una sola copia (ADR-0003): las del schema en `.agents/skills/` y los workflows de OpenSpec en `.claude/skills/`, que OpenCode también lee.
- **El wiki** (ADR-0004) se resincroniza al archivar, en un commit posterior al del archivado, y lo descubierto se registra a propuesta del agente y con la confirmación del usuario.
- **La suite de aceptación** ejecuta el Gherkin de las specs con cucumber-js y no arranca los agentes reales: OpenCode es un host Node que carga el plugin con contextos falsos (`acceptance-tests/support/agents/opencode-host.mjs`), hoy ligado a `session-bootstrap` y a una sola sesión.
- **Las pruebas con OpenCode 2.3.2** (`.wiki/raw/notes/2026-11-21-ll-sesiones-opencode-autopilot.md`) fijan qué se puede hacer y desde dónde: archivar solo desde la TUI (lección 1), metadata que se sustituye entera (2), tools visibles solo con `codemode: false` (3), recarga en caliente con opciones (4), escuchadores RPC duplicados tras cada recarga (5), encadenar desde `experimental.idle` (6), una instancia del plugin por TUI sin operaciones atómicas en lo compartido (7), claves `x-*` aceptadas por OpenSpec y un verify sin código de salida (8), y un modelo real que cierra una revisión antes de tiempo (10).

ADRs en vigor: 0002 (sustituye a 0001), 0003, 0004 y 0005. Ninguno queda contradicho por este design (ver Open Questions).

## Goals / Non-Goals

**Goals:**
- Una sola implementación de "qué change tiene esta rama", que usen igual el plugin y los workflows de los dos agentes.
- Sustituir las puertas heredadas de `openspec-git-discipline` por el ciclo de una rama y una fusión, con el archive en la rama temporal.
- Un plugin de OpenCode que encadene los pasos del change en sesiones nuevas, con el estado solo en la metadata de las sesiones, robusto frente a varias TUIs, recargas en caliente, interrupciones y fallos de OpenCode.
- Que ninguna decisión que corresponde al usuario dependa solo del modelo: el cierre de una revisión se confirma en la TUI.
- Que todo lo que piden las specs se pueda verificar con la suite simulando OpenCode, sin el agente real.

**Non-Goals:**
- Automatizar sin TUI (`opencode run`, OpenCode Desktop) o en Claude Code.
- Hacer commits o fusiones: siempre los hace el usuario.
- Tasks concurrentes, varias dueñas por rama o varios changes por rama.
- Tratar de forma especial el agente plan o `openspec-explore`.
- Cambiar los workflows generados por OpenSpec (`.claude/skills/openspec-*`) o el motor del wiki.

## Decisions

### D1. El change de la rama se calcula en un módulo neutral, fuera del plugin

Un módulo Node sin dependencias, `.agents/openspec/branch-change.mjs`, exporta una función que, dado el directorio del proyecto, devuelve `{ kind, branch, origin, permanent, changes }`, y se puede ejecutar como CLI (`node .agents/openspec/branch-change.mjs --json`). El plugin lo importa; los workflows de los dos agentes lo ejecutan desde la skill del ciclo (D2).

- **Ramas permanentes**: la lista `x-main` de `openspec/config.yaml`, o `["main"]`. El módulo lee solo esa clave con un lector mínimo (lista en flujo `[a, b]` o en bloque de escalares simples), para no depender de un paquete YAML; cualquier otra forma se trata como ausente y se avisa.
- **Rama actual**: `git symbolic-ref --short -q HEAD`; si falla, HEAD separado y no hay rama temporal.
- **Base**: `git merge-base HEAD <origen>`, con `<origen>` la rama local o, si no existe, `refs/remotes/origin/<origen>`. Sin ninguna de las dos, el resultado es `kind: "unknown"` y el plugin se inhibe con un aviso.
- **Changes de la rama**: las rutas de `openspec/changes/` en `git diff --name-only <base>` (árbol de trabajo contra la base, con lo que tiene commit y lo que no) más las no seguidas de `git ls-files --others --exclude-standard`, quedándose solo con las que existen hoy en el árbol de trabajo. `openspec/changes/<nombre>/…` da un change en curso y `openspec/changes/archive/<fecha>-<nombre>/…` uno archivado. Así un change archivado en la rama deja de aparecer en curso, y los changes de la rama de origen no cuentan.
- **Resultado**: `permanent` (rama permanente o HEAD separado), `none`, `active` (un change en curso), `archived` (solo archivado) o `several` (más de un change, con sus nombres).

Alternativas: implementarlo dentro del plugin (Claude Code no tendría la misma regla y habría dos implementaciones, contra el espíritu de ADR-0002); dejar que cada workflow lo deduzca con git desde la skill (el comportamiento dependería del modelo y la suite no podría verificarlo); guardar el change de la rama en un archivo (la spec lo prohíbe). El módulo no es parte del plugin: es el ciclo de `openspec-change-lifecycle`, común a los dos agentes, así que no contradice que Claude Code no tenga nada del plugin.

### D2. Las puertas heredadas se sustituyen reescribiendo la copia de `openspec-git-discipline`

La skill `.agents/skills/openspec-git-discipline/SKILL.md` se reescribe con el ciclo del proyecto, conservando su nombre y su descripción de activación, para que la sigan cargando los mismos workflows en los dos agentes:

- Antes de proponer: si `branch-change` da `permanent`, avisar de que el change se hace en una rama temporal.
- Antes del apply: ya no se exige que la propuesta esté en la rama de origen; basta con que el change sea el de la rama.
- Antes del archive: detenerse si la rama no es temporal o su change no es el que se archiva; el archive se hace en la rama temporal, antes de la única fusión.
- Tras cada artefacto, task, archive y resincronización del wiki: pedir el commit al usuario; nunca hacer commits, ramas ni fusiones.

Las indicaciones de archivado de `openspec/config.yaml` cambian en consecuencia: las rutas que tocó el change son las del diff entre el merge-base de la rama con la rama de origen y el commit del archivado (ya no "tras fusionarla con main"), y las lecciones salen de las candidatas que reciba la sesión (D10) o, sin ellas, de la sesión en curso.

Alternativas: añadir una skill propia y dejar la heredada (los workflows cargarían dos reglas contradictorias); retirar la heredada sin sustituto (se pierden las puertas de commit, que siguen valiendo); arreglarlo solo en `config.yaml` (las indicaciones de archive no alcanzan al apply). La copia diverge del origen a propósito; el ADR lo registra para que no se pise al actualizar desde `intent-driven-template`.

### D3. Un plugin propio, `openspec-autopilot`, separado del arranque

El plugin vive en `.opencode/plugins/openspec-autopilot/` con el patrón de `session-bootstrap`: `server.js` y `tui.js` como objetos literales `{ id, setup }`, sin dependencias, solo módulos `node:` y nunca una excepción hacia OpenCode. La lógica que no toca OpenCode va en módulos aparte del mismo directorio (`lib/`), importados con rutas relativas, para probarla sin host:

- `lib/next-step.mjs`: decide el paso siguiente (D6) a partir del modo, del paso terminado, de `openspec status --json` y de `tasks.md`.
- `lib/state.mjs`: lee y escribe el estado en la metadata de las sesiones (D4).
- `lib/prompts.mjs`: el texto con el que arranca cada paso y la sesión de revisión.

El servidor hace todo lo que no exige la TUI; la TUI hace lo que solo se puede hacer desde ella: archivar (lección 1), navegar (`ui.router.navigate`), diálogos (`ui.dialog.select`) y toasts. Se comunican por el RPC del plugin, como `session-bootstrap`.

Alternativas: ampliar `session-bootstrap` (mezcla un adaptador del arranque, que debe funcionar siempre, con una automatización opcional; un fallo de una tumbaría la otra); un paquete npm (el proyecto no instala dependencias para sus plugins y el arranque es lo que instala las del proyecto).

### D4. El estado vive en la clave `openspec` de la metadata de cada sesión

Cada sesión que el plugin orquesta lleva en su metadata un objeto bajo la clave `openspec`:

```
{ v: 1, worktree, branch, change, role: "owner" | "free",
  step: { kind, id }, seq, phase, handoff, review, lessons }
```

- `step.kind` es `new`, `artifact`, `task`, `verify`, `archive`, `wiki`, `review` o `update`; `step.id` es el artefacto, la task o lo revisado.
- `phase` es `waiting-commit`, `running` o `handed-off`; `handoff` guarda lo que la tool recibió hasta que se encadena el paso siguiente.
- `review` guarda resultado y conclusiones; `lessons`, las lecciones candidatas.
- `seq` ordena las sesiones del change para el índice (D9).

**La dueña** es la sesión no archivada de ese `worktree` y esa `branch` con `role: "owner"`. Una sesión sin la clave, o con `role: "free"`, es libre. Las sesiones archivadas conservan su metadata y forman el historial del change (`list()` sin filtro las incluye).

**Escritura**: siempre se lee con `get`, se combina y se escribe entera (lección 2), conservando las demás claves; y tras escribir se vuelve a leer para confirmarlo (lección 1).

**Varias TUIs** (lección 7): no hay operaciones atómicas, así que tomar el control es "escribir y comprobar". Una sesión que se marca dueña vuelve a listar las dueñas de la rama; si hay más de una, gana la de `time.created` más antiguo y las demás pasan a libres con un aviso. La regla es determinista, así que dos instancias que la aplican a la vez llegan al mismo resultado.

Alternativas: `ctx.storage` (compartido pero sin atomicidad, y no se archiva con la sesión); un archivo en el repositorio o en `.git/` (la spec lo prohíbe, y ensucia el árbol que se comprueba limpio).

### D5. Qué pasa al abrir una sesión: decidir en su primera petición al modelo

Una sesión de la TUI no existe hasta su primer mensaje (lección 7). El plugin decide en el hook `context` de la primera petición de una sesión sin la clave `openspec`, sea cual sea su agente (D5 no mira el agente):

| `branch-change` y dueña | Decisión |
|---|---|
| `permanent`, `unknown` | nada |
| `several` | aviso nombrando los changes; nada más |
| `none` | toma el control; paso `new` (`openspec-new-change`, con el mensaje del usuario como descripción) |
| `active`, sin dueña | toma el control; paso que diga `openspec status` (D6) |
| `active`, dueña trabajando | libre; aviso de qué sesión tiene el control |
| `active`, dueña parada | diálogo: ir a la dueña (navegar; la nueva libre), archivarla y seguir aquí (archivar; la nueva toma el control) o cerrar sin elegir (libre) |
| `archived` | libre |

"Trabajando" se lee con `get`: `time.busy` posterior a `time.idle`, o sin `time.idle` (lección 6). Una dueña no archivada nunca ha terminado su paso (al terminar se archiva), así que "parada" es cualquier dueña que no trabaja: esperando un commit, una respuesta a una pregunta o tras una interrupción.

Cuando la sesión toma el control, el hook añade a esa petición la instrucción del paso (D7). El hook `context` no guarda lo que añade (como en `session-bootstrap`), pero la respuesta del modelo, que ya carga la skill, sí queda en el historial; por eso solo se inyecta una vez por sesión, y cambiar de agente después no hace que se inyecte nada.

El diálogo de "dueña parada" se espera dentro del hook, con un límite de tiempo: si vence o el usuario cierra sin elegir, la sesión queda libre y la petición sigue. Un fallo en cualquier punto deja la sesión libre (D12).

Alternativas: decidir en el evento de creación de la sesión (llega cuando la TUI ya ha enviado el primer mensaje, sin forma de añadirle la instrucción); interrumpir la primera petición y relanzarla con un `prompt` (duplica el mensaje del usuario y depende del orden de eventos); preguntar siempre (la spec quiere tomar el control sin preguntar cuando no hay conflicto).

### D6. El paso siguiente se decide con `openspec status` y `tasks.md`

`lib/next-step.mjs` es una función pura que recibe el paso terminado, su resultado, el modo y el estado leído:

- Sin la planificación completa (`isPlanningComplete`, o `isComplete` en versiones antiguas): el primer artefacto `ready`.
- Con la planificación completa: la primera task sin marcar de `tasks.md` (cada línea `- [ ]` es una task, identificada por su número, p. ej. `2.3`); con todas marcadas, el verify.
- Verify sin problemas críticos: archive. Archive: resincronización del wiki. Tras la resincronización del wiki, el ciclo termina: la última sesión pide el commit del wiki y se archiva, y la rama queda con el change archivado.
- **Modo normal**: tras cada artefacto, cada task y el verify, una revisión de ese paso; revisión satisfactoria → lo anterior; no satisfactoria → `update`, y tras `update`, una revisión del plan (`step.id: "plan"`). Una revisión del verify satisfactoria lleva al archive.
- **Modo auto**: sin revisiones; el verify con problemas críticos se para (D8).

Antes de encadenar se comprueba que el paso hizo algo: un artefacto terminado tiene que aparecer como `done` en `openspec status`, y una task terminada tiene que estar marcada. Si no, no se encadena y se avisa: la tool del modelo es una afirmación, no una prueba (lección 1).

`openspec` se ejecuta desde `node_modules/.bin/` del proyecto, el mismo que el arranque pone en el `PATH`.

Cada paso usa este workflow y este agente, elegidos por el plugin:

| Paso | Workflow | Agente |
|---|---|---|
| `new` | `openspec-new-change` | build |
| `artifact` | `openspec-continue-change` | build |
| `task` | `openspec-apply-change`, limitado a esa task | build |
| `verify` | `openspec-verify-change` | build |
| `archive` | `openspec-archive-change` | build |
| `wiki` | las indicaciones de archivado de `config.yaml`, con las lecciones candidatas (D10) | build |
| `update` | `openspec-update-change`, con conclusiones e índice (D9) | build |
| `review` | instrucción propia del plugin (`lib/prompts.mjs`) | plan |

La revisión va con plan porque no debe modificar archivos; si en la primera task se comprueba que plan no puede llamar a la tool del plugin, se usa build con la instrucción de no editar (Open Questions).

### D7. Una sesión por paso, encadenada desde `experimental.idle` tras la tool de traspaso

Todos los pasos terminan igual: el modelo llama a la tool del plugin `openspec_handoff`, declarada con `options: { codemode: false }` (lección 3), con `{ result?, conclusions?, lessons? }`. La instrucción de cada paso le pide llamarla al terminar, y solo entonces.

1. **La tool** valida los argumentos y, si el paso lo exige, pide la confirmación del usuario (D8). Después guarda `handoff` en la metadata con `phase: "handed-off"` y devuelve al modelo que el paso está cerrado.
2. **`experimental.idle`** de una dueña en `handed-off` hace el traspaso:
   - decide el paso siguiente (D6);
   - crea la sesión con `session.create({ title, agent, metadata })`, ya dueña y con un `seq` más;
   - marca la anterior como libre con `phase` terminado;
   - pide a la TUI que navegue a la nueva y archive la anterior, y comprueba con `get` que quedó archivada;
   - comprueba el árbol (D11) y, si está limpio, arranca el paso con `session.prompt({ text, skills: [{ id }] })` (lección 6).
3. **Sin la tool**, `idle` no hace nada: la sesión espera al usuario, que es como se para un workflow que pregunta.

Tras una interrupción no corre `idle` (lección 6), así que un paso interrumpido queda parado con el control, y se retoma escribiendo en él.

El traspaso es idempotente: `idle` solo actúa si `phase` es `handed-off` y la marca con el `seq` de la sesión siguiente antes de crearla. Una segunda ejecución (otra instancia viva tras una recarga, D13) encuentra que ya está hecho y no hace nada.

Alternativas: encadenar dentro de la tool (la sesión sigue ejecutándose y su respuesta llegaría tras navegar a otra); detectar el fin del paso solo con `idle` y `openspec status` (no distingue un paso terminado de un workflow que pregunta, y no hay forma de pasar resultado, conclusiones ni lecciones); `synthetic` en `idle` para seguir en la misma sesión (es lo contrario de una sesión por paso).

### D8. Confirmación del cierre en la TUI, dentro de la tool

Cuando la tool cierra una revisión, o un verify del modo auto con problemas críticos, su `execute` pide a la TUI un `ui.dialog.select` con el resultado y las conclusiones, y espera la respuesta:

- **Confirmado**: sigue como en D7.
- **No confirmado** (rechazo, Esc o límite de tiempo): la tool devuelve al modelo que el usuario no ha dado la revisión por terminada y que siga con ella. No se guarda `handoff` y `idle` no encadena.

El veredicto del verify en modo auto sin problemas críticos no pide confirmación; con problemas críticos, la tool no traspasa: deja la sesión parada con el control y una instrucción que la convierte en una revisión del verify, que se cierra con la confirmación de arriba.

Alternativas: confiar en la tool (la lección 10 muestra que un modelo real cierra ante "Gracias, lo miro luego."); confirmar en `idle` (el modelo ya no se enteraría de la negativa); un comando del usuario para cerrar en lugar de la tool (pierde las conclusiones que redacta el modelo).

### D9. Índice de sesiones y lectura de una sesión concreta

La sesión de `update` recibe en su texto inicial las conclusiones de la revisión que la lanzó y un índice construido con `list()` sin filtro de las sesiones de ese `worktree`, `branch` y `change`, ordenadas por `seq`: para cada una, su identificador, su paso y, en las revisiones, resultado y conclusiones. No lleva transcripciones.

Una segunda tool, `openspec_session`, también con `codemode: false`, devuelve el contenido de una sesión del índice (los mensajes de texto, sin las salidas de las tools), y se niega con cualquier sesión que no sea del change.

Alternativa: incluir transcripciones resumidas (gasta contexto y la spec lo excluye).

### D10. Lecciones candidatas en la metadata, entregadas a la resincronización del wiki

El argumento `lessons` de la tool se guarda en `openspec.lessons` de la sesión y nunca se escribe en el repositorio. La sesión `wiki` recibe todas las candidatas del change (sacadas del índice, D9) con la instrucción de presentarlas al usuario junto al resto de lo que proponen las indicaciones de archivado y registrar solo lo confirmado, en el commit del wiki. Sin el plugin (en Claude Code, o en OpenCode sin él), las indicaciones siguen sacando las lecciones de la sesión en curso; es la forma que generaliza `fix-wiki-flow-operations`.

### D11. Árbol limpio y zonas

Antes de arrancar un paso (D7, paso 2, y D5 al tomar el control), el servidor ejecuta `git status --porcelain`:

- **Modo normal**: se comprueba en todos los pasos.
- **Modo auto**: solo en el primer paso tras un cambio de zona.

Las zonas son las de `spec-as-source`, y `lib/next-step.mjs` marca como cambio de zona las tres transiciones del ciclo: del plan a la primera task, de la última task al archive (pasando por el verify, que no escribe) y del archive a la resincronización del wiki.

Si el árbol no está limpio, la sesión se crea con el control y `phase: "waiting-commit"`, pero no se le envía `prompt`. Un toast pide el commit y el título de la sesión lo indica. Cuando el usuario escribe en ella, el hook `context` vuelve a comprobar el árbol: si está limpio, inyecta la instrucción del paso; si no, inyecta una instrucción para que el modelo le pida el commit sin empezar. Así nunca se bloquea una petición (D12) y el paso no empieza con el árbol sucio.

### D12. Nunca bloquear OpenCode

Como en `session-bootstrap`, cada hook, tool y manejador RPC va dentro de `try/catch` y ninguna promesa queda sin capturar. Ante cualquier fallo de una operación de sesión o de git, el plugin:

- avisa en la TUI de qué no se ha podido hacer;
- deja la sesión actual como libre, sin tocar la petición en curso;
- si la anterior dueña ya era libre, deja el change sin dueña.

Así la siguiente sesión que abra el usuario toma el control sin preguntar y sigue por `openspec status`, que es la recuperación natural. Ninguna espera (diálogo, RPC, git, `openspec`) es indefinida: todas tienen límite de tiempo.

### D13. RPC entre servidor y TUI, con identificador y generación

Para los escuchadores duplicados tras cada recarga (lección 5):

- Cada `setup` toma una generación nueva en un registro de `globalThis` propio del plugin. Los hooks, tools y escuchadores de una generación anterior comprueban la generación y no hacen nada.
- La TUI se presenta al servidor con un método `hello` y recibe un identificador de instancia; las peticiones del servidor (`navigate`, `archive`, `select`, `toast`) van dirigidas a la última instancia presentada y llevan un identificador propio. Una TUI que no es la destinataria las ignora.
- El servidor acepta una sola respuesta por petición, la de la instancia destinataria.
- Si ninguna TUI se ha presentado, el servidor trata la sesión como sin TUI y no orquesta nada (`opencode run`, OpenCode Desktop).

### D14. Modo auto como opción del plugin

El modo se lee de `ctx.options.auto === true`. Cada usuario lo activa en su configuración de OpenCode con una entrada `{ "package": "<ruta a .opencode/plugins/openspec-autopilot>", "options": { "auto": true } }` (lección 4). El proyecto no declara el plugin en ningún `opencode.json` ni fija la opción. Un cambio de la opción recarga el plugin (D13), y el modo nuevo vale desde el siguiente traspaso.

### D15. Compactación

En el hook `compaction` (o los eventos `session.compaction.*`) de una dueña, el plugin no reinyecta nada. Avisa en la TUI del workflow en curso y de cómo retomarlo: el comando del paso, p. ej. `/openspec-apply-change exportar-datos`. La instrucción inicial del paso se pierde con la compactación, y reinyectarla en cada petición contradice D5.

### D16. Verificación con la suite: un host de OpenCode con varias sesiones

`opencode-host.mjs` pasa a cargar cualquier plugin local por su directorio y a simular, en memoria, lo que usa este plugin:

- **Sesiones**: `create`, `get`, `list`, `update` con metadata que se sustituye entera; `archived`, que solo aplica el cliente de la TUI y no `ctx.session` (lección 1).
- **Ejecución**: `prompt`, `command`, `time.busy` y `time.idle`, `experimental.idle`, interrupción, compactación y el hook `context`.
- **Tools**: con y sin `codemode`.
- **TUI**: `ui.router.navigate`, `ui.dialog.select` con respuestas guionizadas, toasts, y recargas que dejan vivos los escuchadores anteriores.
- **Fallos**: inyección de errores en operaciones concretas.

El modelo se sustituye por un guion por escenario: qué tool llama, con qué argumentos, o si pregunta. Los escenarios de `openspec-change-lifecycle` ejecutan `branch-change.mjs` sobre repositorios git temporales. El de Claude Code comprueba que en `.claude/` no hay hooks, skills ni comandos del plugin. La lógica pura (`lib/`) se prueba además con `node --test` en `acceptance-tests/core-tests/` para los casos que no están en las specs.

La simulación sigue el contrato comprobado con OpenCode 2.3.2, y el banco de la lección 9 sirve para volver a comprobarlo al subir de versión (inventario: `volver-a-comprobar-apis-de-sesion-al-subir-opencode`).

### D17. Una política de asimetrías entre agentes

Se registra como ADR una política general: una capacidad puede existir en un solo agente si cumple estas condiciones:

- el ciclo y lo que queda versionado son iguales con y sin ella;
- el otro agente lo hace a mano con los mismos workflows;
- no deja nada a medias en el otro agente;
- la suite verifica las dos cosas.

El plugin es su primer caso.

## Risks / Trade-offs

- [OpenCode cambia los comportamientos en que se apoya el plugin: archivar desde el servidor, `codemode`, escuchadores que sobreviven a la recarga] → La simulación no lo detectaría. El inventario del wiki obliga a repetir las pruebas con el banco al subir OpenCode, y D13 sigue siendo inocuo si los escuchadores ya se dan de baja.
- [El modelo no llama a la tool al terminar un artefacto o una task, o la llama antes] → D6 comprueba con `openspec status` y `tasks.md` que el paso hizo algo antes de encadenar; si no la llama, la sesión se queda esperando al usuario, que puede pedírselo.
- [El modelo cierra una revisión por su cuenta (lección 10)] → Confirmación obligatoria en la TUI (D8).
- [Dos TUIs toman el control a la vez] → Escribir y comprobar, con desempate determinista por antigüedad (D4); en el peor caso una sesión pasa a libre con un aviso.
- [Una recarga en caliente a mitad de un traspaso] → Traspaso idempotente por `phase` y `seq` (D7); si queda a medias, el change se queda sin dueña o con una dueña parada, y la siguiente sesión lo resuelve por D5.
- [El diálogo dentro del hook `context` retrasa la primera petición] → Límite de tiempo; al vencer, la sesión queda libre.
- [El lector mínimo de `x-main` no entiende una forma válida de YAML] → Solo admite listas de escalares simples, lo documenta y avisa en lugar de equivocarse en silencio.
- [Pedir un commit tras cada paso en modo normal se hace pesado] → Es lo que pide la spec para que cada revisión vea un estado con commit; el modo auto lo reduce a los cambios de zona.
- [La copia de `openspec-git-discipline` diverge del origen] → El ADR lo registra; al actualizar desde `intent-driven-template` no se sobrescribe sin revisarlo, y la discusión sigue abierta en el origen.
- [Los módulos de `lib/` pueden no recargarse en caliente por la caché de módulos ES] → Solo afecta al desarrollo del plugin; reiniciar OpenCode lo resuelve.
- [Mientras se desarrolla, esta rama tiene dos changes (`add-openspec-autopilot` y `fix-wiki-flow-operations`)] → El plugin se inhibe aquí, como pide la spec; se prueba con la suite y con el banco, no en esta rama.

## Migration Plan

1. El módulo `branch-change`, la nueva `openspec-git-discipline` y las indicaciones de archivado de `config.yaml` van primero, porque el ciclo nuevo vale ya para los dos agentes y para este mismo change.
2. Después, el host de la suite y el plugin, que solo actúa en OpenCode con TUI y en ramas con un solo change.
3. No hay datos que migrar: el plugin no tiene estado previo, y los changes en curso de otras ramas se adoptan solos con D5 la primera vez que se abre una sesión en ellas.
4. Este change se archiva en su rama temporal con el ciclo nuevo, antes de su única fusión.

Vuelta atrás:

- Para dejar de usar el plugin en un clon basta con no tenerlo: borrar `.opencode/plugins/openspec-autopilot/`. Las sesiones con la clave `openspec` siguen siendo sesiones normales.
- Para volver a las puertas heredadas hay que restaurar la copia original de `openspec-git-discipline` y las indicaciones de archivado.

Los proyectos derivados heredan las dos cosas con la plantilla.

## Open Questions

- **Leer el contenido de otra sesión** (D9): no se comprobó qué API da los mensajes de una sesión desde el plugin. La primera task del plugin lo comprueba con el banco; si no hay ninguna, `openspec_session` se retira y la spec del índice se revisa con `openspec-update-change`.
- **Revisión con el agente plan** (D6): no se comprobó que plan pueda llamar a una tool de plugin con `codemode: false`. Si no puede, la revisión va con build y la instrucción de no editar.
- **Esperar un diálogo dentro del hook `context`** (D5): no se comprobó con OpenCode real cuánto tolera la petición. Hay que fijar el límite con el banco.
- **Los hooks del servidor tras una recarga**: solo se comprobó que sobreviven los escuchadores RPC de la TUI. D13 protege también los del servidor, pero conviene comprobarlo con el banco.
- **Coordinación con `fix-wiki-flow-operations`**: los dos changes tocan las indicaciones de archivado y la forma de registrar las lecciones. Hay que decidir cuál se archiva antes y que el segundo parta de lo que dejó el primero.
- **ADRs en vigor**: ninguno pide sustitución.
  - ADR-0002 habla de las mismas garantías del arranque en los dos agentes y no se ve afectado: el plugin no es un adaptador del arranque, y la política de asimetrías (D17) es nueva.
  - ADR-0003 (una copia de las skills) se respeta: `openspec-git-discipline` se cambia en su única copia.
  - ADR-0004 se mantiene: la resincronización va en un commit posterior al del archivado, y las lecciones se registran con confirmación.

  El paso `adr` registra tres ADRs nuevos: la política de asimetrías, el plugin, y la sustitución de las puertas heredadas de `openspec-git-discipline`.
- **Discusiones abiertas de la proposal**, fuera de este design: que vuelva la fusión intermedia de la propuesta, que el usuario modifique a mano el código generado entre pasos, y las tasks concurrentes.
