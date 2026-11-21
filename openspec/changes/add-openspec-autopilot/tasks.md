`acceptance-tests/` ya existe, así que se omite la puesta en marcha de la suite. Se trabaja con el ciclo de `spec-as-source`: rojo → implementar → verde → commit. Un commit nunca mezcla `openspec/` con la zona de código, salvo este `tasks.md`.

Las comprobaciones con OpenCode real usan el banco de la lección 9 de `.wiki/raw/notes/2026-11-21-ll-sesiones-opencode-autopilot.md` (OpenCode 2.3.2 en una carpeta aparte, proveedor falso, TUI `--standalone` en `tmux`), fuera del repositorio.

## 1. Comprobaciones previas: resuelven las Open Questions del design antes de escribir código

- [x] 1.1 Con el banco, comprobar qué API da desde el servidor del plugin los mensajes de otra sesión (para `openspec_session`, D9). Anotar en este archivo la llamada y la forma de lo que devuelve, o que no hay ninguna
  - Resultado (2026-11-21, OpenCode 2.3.2): `ctx.session.context({ sessionID })` devuelve desde el servidor del plugin los mensajes de otra sesión, también archivada, como un array: `{ type: "user", text }`, `{ type: "assistant", agent, content: [...] }` con partes `{ type: "text", text }` y `{ type: "tool", name, state: { status, input, content } }`, `{ type: "synthetic" }` y `{ type: "idle", outcome }`. `openspec_session` usa ese array y se queda con el texto de `user` y las partes `text` de `assistant`.
- [x] 1.2 Con el banco, comprobar si una sesión con el agente plan ve y llama a una tool de plugin declarada con `options: { codemode: false }` (D6). Anotar el resultado
  - Resultado: sí. Una sesión creada con `agent: "plan"` recibe la tool en la lista de la petición y la llama; `execute` recibe `agent: "plan"`. La revisión va con plan (D6).
- [x] 1.3 Con el banco, comprobar si el hook `context` puede esperar a que la TUI responda un `ui.dialog.select` pedido por RPC sin que falle la petición, con esperas de 10 s, 60 s y 300 s (D5). Anotar a partir de cuánto falla, si falla, y fijar el límite de tiempo del diálogo
  - Resultado: no falla con 10 s, 60 s ni 300 s: el hook espera la respuesta del diálogo (pedido por RPC a la TUI) y la petición sigue normal después. Se fija el límite del diálogo en 120 s.
- [x] 1.4 Con el banco, comprobar si tras una recarga en caliente siguen vivos los hooks del servidor anterior (`context`, `experimental.idle`, tools) y no solo los escuchadores RPC de la TUI. Anotar el resultado: confirma o no que D13 tiene que proteger también los del servidor
  - Resultado: no siguen vivos. Tras editar `server.js` (o `tui.js`, que también recarga el servidor), solo se ejecutan los hooks `context` y `experimental.idle`, la tool y el manejador RPC de la última generación del servidor. Los escuchadores de eventos de la TUI anterior sí siguen vivos (lección 5): un evento llega a cada generación de la TUI y el servidor recibe una respuesta por cada una. D13 se mantiene: las generaciones del servidor no hacen falta, pero son inocuas, y las peticiones con identificador y una sola respuesta siguen haciendo falta.
- [x] 1.5 Con el banco, comprobar que una sesión creada con `session.create` y sin `prompt` aparece en la TUI al navegar a ella, y que el primer mensaje que escribe en ella el usuario pasa por el hook `context` (D11, sesión en `waiting-commit`). Anotar el resultado
  - Resultado: sí. La sesión creada con `session.create({ title, agent, metadata })` y sin `prompt` se abre en una pestaña al navegar a ella; el primer mensaje del usuario pasa por `context` con su `sessionID`, y la sesión conserva el título y la metadata (OpenCode no genera un título nuevo).
- [x] 1.6 Si 1.1 a 1.5 descartan algo del design o de las specs, cambiarlos con `openspec-update-change` en un commit propio de `openspec/`, antes de seguir. Decidir también con el usuario el orden de archivado respecto a `fix-wiki-flow-operations`, que toca las mismas indicaciones de archivado, y anotarlo aquí
  - Resultado: 1.1 a 1.5 confirman el design y las specs; no hay nada que cambiar con `openspec-update-change`. Orden de archivado, decidido con el usuario: primero `add-openspec-autopilot`; `fix-wiki-flow-operations` parte después de las indicaciones de archivado que deja este change.

## 2. Suite: host de OpenCode con varias sesiones y repositorios git de prueba (zona de código)

- [ ] 2.1 Generalizar `acceptance-tests/support/agents/opencode-host.mjs` para que cargue cualquier plugin local por su directorio, y comprobar que los escenarios de `session-bootstrap` siguen en verde
- [ ] 2.2 Añadir al host la simulación de D16. La metadata que se sustituye entera y `archived`, que solo aplica el cliente de la TUI, salen de las lecciones 1 y 2. La simulación cubre:
  - sesiones en memoria: `create`, `get`, `list` con y sin filtro de archivadas, `update`;
  - `time.busy` y `time.idle`, `prompt`, `command` y el hook `context`;
  - `experimental.idle`, interrupción y compactación (hook y eventos);
  - tools con y sin `codemode` (solo las de `codemode: false` llegan al modelo);
  - una TUI falsa con `ui.router.navigate`, `ui.dialog.select` con respuestas guionizadas, toasts y `client.session.update`;
  - recargas en caliente que vuelven a ejecutar `setup` y dejan vivos los escuchadores anteriores;
  - fallos inyectables por operación;
  - reinicio (un proceso nuevo del host con la misma base de sesiones).
- [ ] 2.3 Añadir un modelo guionizado por escenario: para cada sesión, qué responde a cada petición (texto, una pregunta, o una llamada a tool con sus argumentos). Registrar qué recibe el modelo en cada petición (system, mensajes, skills inyectadas), para las aserciones
- [ ] 2.4 Añadir al World los repositorios git de prueba sobre la copia del proyecto:
  - una rama de origen, con `x-main` o sin él;
  - ramas temporales con changes en curso o archivados, con commit o sin él;
  - HEAD separado;
  - un `tasks.md` con tasks marcadas o sin marcar;
  - un `openspec status` real del proyecto copiado.
- [ ] 2.5 Ejecutar la suite con los deltas del change y comprobar que los escenarios nuevos de `openspec-change-lifecycle` y `openspec-autopilot` salen con pasos sin definir o en rojo

## 3. El ciclo de un change (zona de código): por escenario, rojo → implementar → verde → commit

- [ ] 3.1 "Sin x-main, la única rama permanente es main" y "La rama de origen es la última de x-main": crear `.agents/openspec/branch-change.mjs` sin dependencias (D1), con la lectura mínima de `x-main` y su CLI `--json`. Un `x-main` con otra forma se trata como ausente y avisa (cubrirlo en `core-tests`)
- [ ] 3.2 "Qué rama es temporal", con sus cuatro ejemplos
- [ ] 3.3 "Estado de la rama según lo que ha cambiado en openspec/changes/", con sus cinco ejemplos, y "Los changes de la rama de origen no cuentan". Cubrir en `core-tests` la rama de origen solo como `origin/<rama>` y su ausencia (`unknown`)
- [ ] 3.4 "OpenSpec acepta la clave x-main": `list`, `status`, `instructions` y `validate` reales sobre un proyecto de prueba con `x-main: [main, develop]`
- [ ] 3.5 "El apply empieza con la propuesta solo en la rama temporal", "El archive se hace en la rama temporal" y "El archive no se hace en una rama permanente". Reescribir `.agents/skills/openspec-git-discipline/SKILL.md` con las puertas de D2, con el mismo `name` y la misma descripción. Las puertas las decide un subcomando determinista de `branch-change.mjs` (`check apply|archive <change>`) que la skill manda ejecutar y obedecer; los pasos comprueban ese subcomando y que la skill lo usa y ya no exige la rama de origen
- [ ] 3.6 "Un artefacto terminado queda sin commit": la skill pide el commit tras cada artefacto, task, archive y resincronización del wiki, y no manda hacer commits, ramas ni fusiones
- [ ] 3.7 En un commit propio de `openspec/`, cambiar las indicaciones de archivado de `openspec/config.yaml` según D2 y D10:
  - las rutas que tocó el change salen del diff entre el merge-base de la rama con la rama de origen y el commit del archivado;
  - el archive se hace en la rama temporal;
  - las lecciones salen de las candidatas recibidas o, sin ellas, de la sesión.

  Comprobar que `openspec instructions` las sigue entregando

## 4. Plugin: dónde actúa (zona de código): por escenario, rojo → implementar → verde → commit

- [ ] 4.1 Crear `.opencode/plugins/openspec-autopilot/` con `server.js`, `tui.js` y `lib/`, sin dependencias, y el RPC de D13 (generación, `hello`, peticiones con identificador y una sola respuesta por petición). Cubrir en `core-tests`, con el host, que una recarga no duplica navegaciones, diálogos ni archivados, y que sin `hello` el servidor no orquesta nada (sin TUI)
- [ ] 4.2 "El plugin no actúa", con sus dos ejemplos: el plugin usa `branch-change.mjs` y se inhibe con `permanent` y `unknown`
- [ ] 4.3 "Varios changes en la misma rama": aviso en la TUI con los nombres de los changes
- [ ] 4.4 "Claude Code no tiene nada del plugin": en `.claude/` no hay hooks, skills ni comandos que nombren el plugin, sus tools o su RPC

## 5. Plugin: el control del change y la apertura de sesiones (zona de código): por escenario, rojo → implementar → verde → commit

- [ ] 5.1 "El control sobrevive a reiniciar OpenCode": `lib/state.mjs` con la clave `openspec` de D4, escritura por lectura, combinación, escritura y relectura, y la dueña como sesión no archivada con `role: "owner"` de ese `worktree` y esa `branch`. El repositorio no cambia
- [ ] 5.2 "Sesión nueva según el estado de la rama", con sus cuatro ejemplos: la decisión de D5 en la primera petición de una sesión sin la clave, e inyección de la instrucción del paso una sola vez
- [ ] 5.3 "La dueña está parada sin haber terminado", con sus tres ejemplos: diálogo con el límite fijado en 1.3, navegar, archivar desde la TUI y comprobarlo con `get`
- [ ] 5.4 "El agente con el que se abre la sesión no cuenta"
- [ ] 5.5 Cubrir en `core-tests` el desempate entre dos sesiones que toman el control a la vez (D4): gana la de `time.created` más antiguo y la otra queda libre con un aviso

## 6. Plugin: una sesión por paso (zona de código): por escenario, rojo → implementar → verde → commit

- [ ] 6.1 Cubrir en `core-tests` la función pura `lib/next-step.mjs` (D6): artefactos según `openspec status`, tasks según `tasks.md`, verify, archive, wiki y fin del ciclo, en los dos modos, con los cambios de zona de D11
- [ ] 6.2 "El siguiente paso en una sesión nueva": la tool `openspec_handoff` con `codemode: false` y el traspaso desde `experimental.idle` de D7:
  - crea la sesión con su agente y su metadata, y la arranca con `prompt` y `skills` según la tabla de D6;
  - navega a ella y archiva la anterior desde la TUI;
  - es idempotente por `phase` y `seq`;
  - comprueba antes que el paso hizo algo.
- [ ] 6.3 "Cambiar de agente no inyecta nada"
- [ ] 6.4 "Tras la última task viene el verify"
- [ ] 6.5 Cubrir en `core-tests` que, si el modelo llama a la tool sin que el paso haya hecho nada (artefacto no `done`, task sin marcar), no se encadena y se avisa

## 7. Plugin: revisión humana guiada (zona de código): por escenario, rojo → implementar → verde → commit

- [ ] 7.1 "Resultado de una revisión", con sus cuatro ejemplos: la sesión de revisión con la instrucción de `lib/prompts.mjs` y el agente que fijó 1.2, y la confirmación en la TUI dentro de la tool (D8)
- [ ] 7.2 "El usuario no confirma el cierre de la revisión": la tool devuelve al modelo que la revisión sigue y no se guarda `handoff`
- [ ] 7.3 "Tras un update-change viene una revisión del plan"
- [ ] 7.4 "update-change recibe el índice del change": el índice de D9, sin transcripciones, y la tool `openspec_session` según lo que dio 1.1, que se niega con sesiones de fuera del change

## 8. Plugin: lecciones candidatas (zona de código): por escenario, rojo → implementar → verde → commit

- [ ] 8.1 "Las candidatas no tocan el repositorio": `lessons` de la tool en `openspec.lessons`, y el árbol de trabajo sin cambios
- [ ] 8.2 "La resincronización del wiki recibe las candidatas del change": la sesión `wiki` recibe todas las candidatas del índice y la instrucción de registrar solo las confirmadas

## 9. Plugin: árbol limpio y modo auto (zona de código): por escenario, rojo → implementar → verde → commit

- [ ] 9.1 "Comprobación del árbol al empezar un paso", con sus tres ejemplos: `git status --porcelain` antes de arrancar el paso; con el árbol sucio, la sesión queda en `waiting-commit` sin `prompt`, con el toast y el título, y el hook `context` vuelve a comprobarlo en el mensaje siguiente (D11)
- [ ] 9.2 "Sin la opción, el modo es normal": el modo sale de `ctx.options.auto` (D14), y el proyecto no declara el plugin en ningún `opencode.json` ni fija la opción
- [ ] 9.3 "Veredicto del verify en modo auto", con sus dos ejemplos: sin problemas críticos se pasa al archive sin confirmación; con problemas críticos la sesión queda parada como una revisión del verify

## 10. Plugin: compactación y fallos (zona de código): por escenario, rojo → implementar → verde → commit

- [ ] 10.1 "La sesión dueña se compacta": aviso con el workflow en curso y el comando para retomarlo, sin reinyectar nada (D15)
- [ ] 10.2 "Falla una operación de sesión": aviso en la TUI, la sesión actual libre y la petición en curso sin tocar (D12). Cubrir en `core-tests` que ninguna excepción sale de `setup`, de los hooks, de las tools ni de los manejadores RPC, y que todas las esperas tienen límite

## 11. Documentación (zona de código)

- [ ] 11.1 Actualizar `README.md`:
  - el ciclo de una rama y una fusión, y `x-main`;
  - qué hace el plugin en OpenCode y que en Claude Code los workflows se lanzan a mano (ADR-0006);
  - cómo activar el modo auto en la configuración del usuario;
  - cómo desactivar el plugin en local;
  - que sin TUI no actúa.
- [ ] 11.2 Actualizar `acceptance-tests/README.md`: el host de OpenCode con varias sesiones, el modelo guionizado y los repositorios git de prueba

## 12. Cierre

- [ ] 12.1 Ejecutar la suite completa con los deltas del change, y `npm run test:core`: todos los escenarios pasan, cero pasos pendientes o sin definir, informe HTML generado
- [ ] 12.2 Probar con OpenCode 2 real en el banco, sin intervención humana. Usar un proyecto de prueba creado desde un clon de la rama, con una rama temporal con un solo change, un proveedor falso que llama a `openspec_handoff` y la TUI en `tmux`. Comprobar, en modo normal y en modo auto:
  - que un paso termina, aparece una sesión nueva con el control y la anterior queda archivada (`get`);
  - que la confirmación de una revisión aparece como diálogo en `tmux capture-pane` y que rechazarla no encadena nada;
  - que con el árbol sucio el paso no empieza.

  Anotar el resultado y la versión de OpenCode en este archivo, y actualizar la ficha de inventario `volver-a-comprobar-apis-de-sesion-al-subir-opencode` del wiki si cambia algo
- [ ] 12.3 Ejecutar `openspec validate add-openspec-autopilot --type change --strict`: ningún error. Los avisos que queden tienen que ser los mismos tipos que ya da `openspec validate --specs --strict` (requisitos con "DEBE" y pasos en bloques `gherkin`)
- [ ] 12.4 Commit y push de la zona de código pendiente, sin archivos de `openspec/`
- [ ] 12.5 Archivar `add-openspec-autopilot` en su rama temporal, con el ciclo nuevo y en el orden fijado en 1.6, en un commit propio sin archivos de la zona de código. Después, resincronizar el wiki en un commit aparte. Push
