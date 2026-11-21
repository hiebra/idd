`acceptance-tests/` ya existe, así que se omite la puesta en marcha de la suite. Se trabaja con el ciclo de `spec-as-source`: rojo → implementar → verde → commit. Un commit nunca mezcla `openspec/` con la zona de código, salvo este `tasks.md`.

## 1. Comprobaciones previas: deciden D2 y D4 antes de escribir código

- [x] 1.1 Comprobar sin intervención humana si un hook `SessionStart` que imprime `{"systemMessage":"prueba"}` y termina con 0 hace llegar el mensaje al usuario. Se hace en un proyecto desechable con ese hook, y de dos formas:
  - **A, stream-json:** `claude -p --output-format stream-json --verbose --include-hook-events` y buscar `prueba` en los eventos que emite el CLI;
  - **B, tmux:** `claude` interactivo en una sesión oculta, `tmux capture-pane` y buscar `prueba` en el texto de la pantalla.

  Si `claude` no arranca aquí por falta de credenciales, escribir un script de un solo comando (`scripts/check-session-start-message.sh`, fuera de la suite) que haga A y B en la máquina del usuario y termine imprimiendo `OK` o `FALLO`. Lo ejecuta el usuario una vez desde el terminal de VS Code. Anotar el resultado y la versión de Claude Code en este archivo

  **Resultado (Claude Code 2.1.330, 2026-11-21): D2 se confirma.** `claude` arrancó aquí con credenciales, así que no hizo falta el script.
  - A: el evento `hook_response` de `SessionStart` trae el JSON en `stdout`, pero eso es la salida cruda del hook y no prueba que se muestre.
  - B: en la TUI, tras aceptar la confianza en la carpeta, la pantalla muestra `⎿  SessionStart:startup says: prueba`. Con el mismo hook escribiendo `aviso-stderr` por stderr y terminando con 0, ese texto no aparece en la pantalla.
- [x] 1.2 Instalar OpenCode 2 (`@opencode/cli`) en un proyecto desechable y comprobar con un plugin local de `.opencode/plugins/`, sin `package.json` ni `node_modules`, tres cosas:
  - que se carga un `server.js` que exporta un objeto literal `{ id, setup }`;
  - que su `ctx.shell.hook("create.before")` cambia el `PATH` de un comando;
  - que puede importar `@opencode/plugin/rpc`, y que un `tui.js` puede recibir su evento y mostrar un toast.

  El toast se comprueba con la TUI de OpenCode en una sesión de `tmux` y `tmux capture-pane`, buscando su texto. Comprobar primero si la TUI y los plugins cargan sin configurar un proveedor de modelo.

  Anotar los resultados y la versión de OpenCode en este archivo

  **Resultado (OpenCode 2.3.2, `@opencode/cli` y `@opencode/plugin` 2.3.2, 2026-11-21): D3 y D4 se confirman.** Se probó con `opencode --standalone <dir>` en una sesión de `tmux`, con un plugin `.opencode/plugins/probe/` con `server.js` y `tui.js`, sin `package.json` ni `node_modules`:
  - La TUI y los plugins cargan sin configurar ningún proveedor de modelo.
  - `server.js` con `export default { id, setup }` se carga. `ctx.location.directory` es el directorio del proyecto, `ctx.shell` es un objeto y `ctx.rpc` es una función con `register`.
  - `ctx.shell.hook("create.before", cb)`, con un `cb` asíncrono que espera 200 ms, cambia el `PATH`: `!probecmd` en la TUI ejecuta un binario que solo está en el directorio antepuesto y muestra su salida.
  - `import("@opencode/plugin/rpc")` funciona desde los dos archivos sin instalar nada. `ctx.rpc.register(def, { warnings })` y `registration.events.emit("warning", ...)` funcionan, y en `tui.js` tanto `context.client.rpc(def).warnings({})` al cargar como `.events.on("warning", ...)` reciben lo enviado.
  - `context.ui.toast.show({ message, variant: "warning" })` aparece en `tmux capture-pane`, tanto para el aviso recogido al cargar como para el que llega después por evento.
  - `Rpc.define` (de `@opencode/schema/rpc`) solo comprueba que ningún error empiece por `rpc.` y devuelve la definición tal cual, igual que `Plugin.define`.
- [x] 1.3 Si 1.1 o 1.2 descartan lo previsto en D2 o D4, cambiar `design.md` a la alternativa que ya documenta (código de salida 2 o archivo de avisos) en un commit propio de `openspec/`, antes de seguir

  **Resultado:** ni 1.1 ni 1.2 descartan D2 o D4, así que `design.md` no cambia.

## 2. Suite: World con un adaptador por agente (zona de código)

- [x] 2.1 Separar en `acceptance-tests/support/` la apertura de sesión en adaptadores de agente con una interfaz común: código de salida o excepción, llamadas a npm, cómo ejecutar un comando en la sesión y avisos mostrados al usuario (D6). Pasar la de Claude Code a ese adaptador sin cambiar su comportamiento y comprobar que la suite sigue en verde
- [x] 2.2 Cambiar el adaptador de Claude Code para que los avisos mostrados sean el `systemMessage` del stdout y para que falle si el stdout no está vacío o no es un único JSON válido. Comprobar que "La sesión no permite ajustar el PATH", "Máquina sin npm", "Versión de Node.js inferior a la requerida" y "Sin acceso al registro de paquetes" pasan a rojo, porque el hook actual avisa por stderr
- [x] 2.3 Ejecutar la suite con los deltas del change y comprobar que los escenarios nuevos de `session-bootstrap` y `agent-skills` salen con pasos sin definir o en rojo

## 3. Núcleo neutral y adaptador de Claude Code (zona de código): por escenario, rojo → implementar → verde → commit

- [x] 3.1 Mover la lógica de instalación a `.agents/hooks/session-bootstrap.sh` con el contrato de D1 (directorio como argumento, avisos por stderr, `bin=` por stdout, siempre 0, sello con el hash del núcleo). Dejar `.claude/hooks/session-start.sh` como adaptador que lo llama. Los escenarios en verde antes de 2.2 siguen en verde
- [x] 3.2 Paso "se abre una sesión en el proyecto", que usa Claude Code: los escenarios del núcleo con la frase neutral pasan a verde
- [x] 3.3 "La sesión no permite ajustar el PATH": el adaptador muestra el aviso con `systemMessage` y menciona `npx openspec`
- [x] 3.4 "Máquina sin npm" y "Versión de Node.js inferior a la requerida": `systemMessage` construido sin Node
- [x] 3.5 "Sin acceso al registro de paquetes": `systemMessage` con el extracto del log de npm. Añadir al soporte un caso con comillas y saltos de línea en el aviso, para comprobar que el JSON sigue siendo válido

## 4. Adaptador de OpenCode 2 (zona de código): por escenario, rojo → implementar → verde → commit

- [x] 4.1 Añadir al soporte el adaptador de OpenCode de D6, que importa `server.js` y `tui.js` con contextos falsos de servidor y de TUI, ejecuta los comandos de la sesión a través del callback `create.before` y recoge los toasts como avisos mostrados. Comprobar que "Clon recién creado en OpenCode" está en rojo porque el plugin no existe
- [x] 4.2 "Clon recién creado en OpenCode": crear `.opencode/plugins/session-bootstrap/server.js` sin dependencias. Lanza el núcleo en segundo plano y antepone `bin` al `PATH` de cada comando cuando termina (D3)
- [x] 4.3 "La máquina tiene otra versión de OpenSpec instalada globalmente en OpenCode"
- [x] 4.4 "Cambiar de agente no reinstala"
- [x] 4.5 "Máquina sin npm en OpenCode": crear `tui.js` y el transporte de avisos de D4 (o su alternativa si así lo decidió 1.3), con los avisos pendientes recogidos al cargar
- [x] 4.6 "Sin acceso al registro de paquetes en OpenCode"
- [x] 4.7 "La sesión no permite ajustar el PATH en OpenCode": contexto de servidor sin `shell`. Comprobar también que una excepción dentro del plugin no sale de `setup` ni del hook

## 5. Skills (zona de código): por escenario, rojo → implementar → verde → commit

- [x] 5.1 Añadir al soporte las reglas de descubrimiento de skills de proyecto de cada agente (D6):
  - Claude Code: `.claude/skills/<id>/SKILL.md`, siguiendo symlinks;
  - OpenCode 2: `.claude/skills`, `.agents/skills` y `.opencode/skills` por precedencia, sin duplicar IDs.

  Añadir también la lectura del frontmatter (`name`, `metadata.generatedBy`)
- [ ] 5.2 "El agente encuentra las skills del schema", con Claude Code y con OpenCode
- [ ] 5.3 "Una skill del schema sin enlazar en Claude Code": el fallo dice qué skill falta y en qué agente
- [ ] 5.4 "El agente encuentra los workflows de OpenSpec", con Claude Code y con OpenCode: los ocho workflows y `generatedBy` igual a la versión de `@fission-ai/openspec` del `package.json`

## 6. Documentación (zona de código)

- [ ] 6.1 Actualizar `README.md` según D7:
  - qué ofrece, con los dos agentes;
  - requisitos, con OpenCode 2 o superior;
  - qué ocurre al abrir sesión: núcleo, adaptadores y avisos en la interfaz;
  - cómo desactivarlo en local en cada agente;
  - que OpenCode Desktop y `opencode run` solo dejan los avisos en el log.
- [ ] 6.2 Actualizar `acceptance-tests/README.md`: cómo se simula cada agente y dónde están sus reglas de descubrimiento de skills

## 7. Cierre

- [ ] 7.1 Ejecutar la suite completa con los deltas del change: todos los escenarios pasan, cero pasos pendientes o sin definir, informe HTML generado
- [ ] 7.2 Probar con OpenCode 2 real, sin intervención humana, en un clon recién creado y con la TUI en una sesión de `tmux`:
  - `openspec --version` desde la sesión muestra la versión fijada;
  - aparecen las skills del schema y los workflows de OpenSpec;
  - un aviso (por ejemplo, con el registro inaccesible) aparece como toast en el texto de `tmux capture-pane`.

  Anotar la versión de OpenCode en el README
- [ ] 7.3 Ejecutar `openspec validate add-opencode-parity --type change --strict`: ningún error. Los avisos que queden tienen que ser los que ya dan las specs actuales (`openspec validate --specs --strict`)
- [ ] 7.4 Commit y push de la zona de código pendiente, sin archivos de `openspec/`
- [ ] 7.5 Archivar con `openspec archive add-opencode-parity` y, en ese mismo commit propio sin archivos de la zona de código, cambiar el `Purpose` de `openspec/specs/session-bootstrap/spec.md` para que hable de los agentes soportados. Push
