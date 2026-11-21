## Context

Hoy la plantilla solo se prepara sola en Claude Code: `.claude/hooks/session-start.sh`, registrado como hook `SessionStart` en `.claude/settings.json`, instala las dependencias de la raíz y de `acceptance-tests/` guiándose por un sello de hashes, pone `node_modules/.bin` en el `PATH` a través de `CLAUDE_ENV_FILE` y nunca bloquea la sesión. Las skills del schema viven en `.agents/skills/` y Claude Code las ve mediante symlinks en `.claude/skills/`, junto a los ocho workflows que genera OpenSpec 1.17.0.

Lo que dicen la documentación de OpenCode 2 y sus paquetes publicados (spike del change, noviembre de 2026):

- **Skills.** OpenCode 2 busca skills de proyecto en `.opencode/skills` y, por compatibilidad, en `.claude/skills` y `.agents/skills`, desde el directorio actual hasta la raíz del proyecto. Cada skill se identifica por su ruta (`<fuente>/<id>/SKILL.md`), y si un mismo ID aparece en varias fuentes carga solo la de mayor precedencia, por orden: `.claude/skills`, `.agents/skills`, `~/.config/opencode/skills`, `.opencode/skills`. No exige que el `name` coincida con el directorio.
- **Plugins.** OpenCode 2 carga solo los plugins de `.opencode/plugins/`. Un directorio local sin `package.json` aporta sus partes por el nombre del archivo: `server` (o `index`), `tui` y `rpc`. Un plugin es `{ id, setup(ctx) }`, y `Plugin.define` de `@opencode/plugin` 2.3.2 devuelve tal cual lo que recibe. `setup` se ejecuta al cargar el plugin. `ctx.location.directory` da el directorio donde se ha cargado. `ctx.shell.hook("create.before", cb)` permite cambiar `event.env` antes de cada comando de shell, y `cb` puede ser asíncrono.
- **Avisos.** La parte de servidor no tiene un canal documentado para hablar con el usuario: `console` va al log del servidor. La parte de TUI tiene `context.ui.toast.show({ message, variant })` y recibe los eventos del servidor con `context.data.on(...)`. Para hablar entre las dos partes hay RPC del plugin (`ctx.rpc.register(...)`, `registration.events.emit(...)`, `context.client.rpc(...)`), con `Rpc.define` importado de `@opencode/plugin/rpc`.
- **OpenCode 1 es incompatible**: otra API de plugins (`shell.env`) y otro paquete (`opencode-ai`). Queda fuera de alcance.

También se ha comprobado en la documentación de hooks de Claude Code que **lo que un hook `SessionStart` escribe por stderr al terminar con 0 no se muestra al usuario**. La forma documentada de mostrarle un aviso es imprimir por stdout un JSON con `systemMessage`. Los avisos actuales, por tanto, no los ve nadie, aunque la suite está en verde porque comprueba stderr.

ADRs vigentes: ADR-0001 (hook `SessionStart` de Claude Code). Este diseño lo contradice en parte; ver Open Questions.

```
                 abrir sesion de Claude Code          abrir OpenCode 2
                            |                                |
                            v                                v
            .claude/hooks/session-start.sh     .opencode/plugins/session-bootstrap/
            (adaptador, sincrono)               server.js setup() (adaptador)
                            |                                |  lanza en segundo plano
                            +---------------+----------------+
                                            v
                        .agents/hooks/session-bootstrap.sh  (nucleo)
                        npm? node? -> sello -> npm install -> avisos por stderr
                                            |
                 +--------------------------+--------------------------+
                 v                                                     v
     CLAUDE_ENV_FILE  <- PATH                       shell create.before <- PATH
     stdout {"systemMessage": avisos}               (espera al nucleo antes del
                                                     primer comando)
                                                    avisos -> tui.js -> toast
```

## Goals / Non-Goals

**Goals:**

- El mismo arranque de sesión, con las mismas garantías, en Claude Code y en OpenCode 2, sin configurar nada tras clonar.
- Una sola implementación de la lógica de instalación. Cada agente solo aporta lo que depende de él: cómo se dispara, cómo se expone el `PATH` y cómo se muestran los avisos.
- Avisos que el usuario ve de verdad en la interfaz de los dos agentes.
- Skills del schema y workflows de OpenSpec disponibles en los dos agentes desde una única copia en el repositorio.
- Una suite de aceptación que verifica cada adaptador simulando cómo lo invoca su agente, sin agentes reales.

**Non-Goals:**

- OpenCode 1, OpenCode Desktop (su parte de GUI solo carga plugins de la configuración global) y `opencode run` sin TUI. En esos casos el arranque funciona igual, pero el aviso solo queda en el log.
- Generar skills en `.opencode/skills/` o añadir OpenCode al perfil de OpenSpec.
- Cambiar qué se instala, cuándo o con qué sello: la lógica del núcleo sigue igual.
- Windows sin bash.

## Decisions

### D1. Núcleo neutral en `.agents/hooks/session-bootstrap.sh`

La lógica actual de `session-start.sh` (comprobar npm y Node, sellos, `npm install` en la raíz y en `acceptance-tests/`) pasa a un script bash fuera de `.claude/`. Ese script no sabe nada de ningún agente:

- **Entrada:** el directorio del proyecto, como primer argumento.
- **Salida:** los avisos por stderr, uno por línea con el prefijo `session-start:` (más el extracto del log de npm si falla). Por stdout imprime una única línea, `bin=<ruta absoluta a node_modules/.bin>`, cuando existe un `openspec` ejecutable que exponer, y nada más.
- Termina siempre con 0.

El sello de cada proyecto pasa a incluir el hash del núcleo en lugar del de `.claude/hooks/session-start.sh`. Los adaptadores no forman parte del sello: cambiarlos no cambia lo que se instala.

- *Por qué `.agents/`:* ya es el directorio neutral del repositorio (`.agents/skills/`). OpenCode solo busca skills en `.agents/skills`, así que `.agents/hooks/` no interfiere con nada.
- *Alternativa: dos implementaciones, una en bash para Claude Code y otra en JS para el plugin.* Duplica la lógica que tiene más casos (sello, requisitos, fallos) y la suite tendría que probarla dos veces.
- *Alternativa: núcleo en Node.* Rompería el caso de "máquina sin npm", que necesita ejecutarse sin Node o con un Node viejo.

### D2. Adaptador de Claude Code: el hook se queda y pasa a mostrar los avisos con `systemMessage`

`.claude/hooks/session-start.sh` sigue registrado igual en `.claude/settings.json`, pero se convierte en un adaptador fino:

1. Ejecuta el núcleo con `CLAUDE_PROJECT_DIR` y captura su stdout y su stderr.
2. Si el núcleo dio `bin=...` y existe `CLAUDE_ENV_FILE`, añade `export PATH=...`. Si existe `bin=` pero no `CLAUDE_ENV_FILE`, añade el aviso de `PATH` sin ajustar (con `npx openspec`).
3. Si hay avisos, imprime por stdout un único objeto JSON `{"systemMessage": "<avisos unidos por saltos de línea>"}`. Si no hay, no imprime nada. Nunca escribe en stdout texto plano, que acabaría en el contexto de Claude.
4. Termina siempre con 0.

El JSON se construye en bash, escapando barras, comillas y caracteres de control, porque el aviso de "sin npm" tiene que funcionar justo cuando no hay Node.

- *Alternativa: terminar con código 2* para que Claude Code muestre stderr como `hook error`. Presenta como error del hook lo que es un aviso esperado. Además mezcla la ruta de error con la normal y obliga a elegir entre ajustar el `PATH` o mostrar el aviso.
- *Pendiente de verificar:* la documentación no dice explícitamente que `SessionStart` muestre `systemMessage`; se deduce de que no figura entre los eventos que lo descartan. Es la primera tarea de implementación (ver Riesgos).

### D3. Adaptador de OpenCode 2: plugin local sin dependencias

Es el directorio `.opencode/plugins/session-bootstrap/`, con `server.js` y `tui.js` y sin `package.json`. Cada archivo exporta por defecto un objeto literal `{ id, setup }`, sin importar `@opencode/plugin`. `Plugin.define` no hace nada más que devolver lo que recibe, y así el plugin no depende de dependencias que el propio arranque tiene que instalar. Usa solo módulos `node:` (`node:child_process`, `node:fs`, `node:path`), que también existen en Bun.

**`server.js`, `setup(ctx)`:**

1. Lanza el núcleo en segundo plano con `ctx.location.directory` y guarda una promesa con su resultado (`bin` y los avisos). `setup` no espera a la instalación, así que no retrasa el arranque de OpenCode.
2. Registra `ctx.shell.hook("create.before", ...)`. El callback espera esa promesa y, si hay `bin`, lo antepone a `event.env.PATH` (o, si no viene, al `PATH` del proceso). Así ningún comando de la sesión se ejecuta antes de que el `openspec` del proyecto esté instalado.
3. Si `ctx.shell` falta o registrar el hook falla, lo trata como "la sesión no permite ajustar el `PATH`" y añade ese aviso.
4. Todo va dentro de `try/catch`. Un fallo del plugin se convierte en un aviso y en un log, nunca en una excepción que salga de `setup` o del hook. La documentación no dice qué hace OpenCode si un plugin lanza una excepción, así que no se depende de ello.

**Avisos hacia la TUI (D4).** `tui.js`, al ejecutar `setup(context)`, muestra cada aviso con `context.ui.toast.show({ message, variant: "warning" })`.

- *Alternativa: generar el plugin o las skills con `openspec`.* OpenSpec no genera plugins, y para las skills ver D5.
- *Alternativa: plugin con `package.json` y `@opencode/plugin` como dependencia.* Obligaría a instalar `.opencode/` antes de que el plugin pueda cargarse: el problema del huevo y la gallina.

### D4. Cómo llegan los avisos del servidor a la TUI: RPC del plugin

La parte de servidor registra un RPC del plugin con un método `warnings()`, que devuelve los avisos acumulados, y un evento `warning`. La parte de TUI llama a `warnings()` al cargar, para recoger los que se produjeron antes de que se conectara, y después escucha el evento. Así funciona aunque la TUI se conecte cuando el núcleo ya ha terminado, y también contra un servidor remoto.

- *Riesgo:* `Rpc.define` sale de `@opencode/schema/rpc`, a través de `@opencode/plugin/rpc`, y no está comprobado que un plugin local pueda importarlo sin instalar nada. La documentación sí afirma que `@opencode/plugin/tui` se resuelve en tiempo de ejecución. Se comprueba al empezar la implementación.
- *Alternativa si el RPC no sirve:* el núcleo deja los avisos de la última ejecución en `node_modules/.session-start.warnings`, y `tui.js` los lee al cargar y vigila el archivo. No depende de nada, pero solo sirve cuando la TUI comparte disco con el servidor.

### D5. Skills: una sola copia, vista por los dos agentes sin configuración nueva

- Las skills del schema siguen en `.agents/skills/` con sus symlinks en `.claude/skills/`. OpenCode 2 las encuentra en `.agents/skills`, y Claude Code a través de los symlinks.
- Los workflows de OpenSpec siguen generándose solo en `.claude/skills/`, y OpenCode 2 los lee de ahí.
- Los duplicados (el mismo ID en `.claude/skills` y en `.agents/skills`) los resuelve OpenCode por precedencia y la skill aparece una sola vez.
- *Alternativa descartada: `openspec update` con la herramienta `opencode`*, que generaría `.opencode/skills/openspec-*`. Sería una segunda copia con mayor precedencia, que podría quedarse en otra versión de OpenSpec y que no aporta nada.

### D6. Suite: un World con un adaptador por agente

El World actual pasa a delegar la apertura de la sesión en un adaptador de agente, elegido por el texto del paso:

- `se abre una sesión de {agente} en el proyecto` usa el adaptador de ese agente.
- `se abre una sesión en el proyecto` (los escenarios del núcleo) usa Claude Code.

Los dos adaptadores dan el mismo resultado a los pasos: código de salida o excepción, llamadas a npm, cómo ejecutar un comando "en la sesión" y la lista de avisos mostrados al usuario.

- **Claude Code:** como hoy, pero los avisos se leen del `systemMessage` del stdout. Además se comprueba que stdout está vacío o es un único JSON válido, para que nada en texto plano se cuele en el contexto.
- **OpenCode 2:** importa `server.js` y `tui.js` con `import()` desde Node y llama a `setup` con contextos falsos.
  - El contexto del servidor registra los hooks y el RPC. Un comando "en la sesión" pasa por el callback `create.before`, igual que en OpenCode.
  - El contexto de la TUI recoge las llamadas a `ui.toast.show`, y esos son los avisos mostrados.
  - "Una versión de OpenCode que no permite ajustar el PATH" se simula con un contexto de servidor sin `shell`.
- **Máquina simulada:** se reutiliza tal cual (npm ausente, Node 20, `openspec` global, registro inaccesible).
- **`agent-skills`:** el soporte implementa las reglas de descubrimiento de cada agente sobre una copia del proyecto.
  - Claude Code: `.claude/skills/<id>/SKILL.md`, siguiendo symlinks.
  - OpenCode 2: las fuentes de proyecto en su orden de precedencia, sin duplicar IDs.
  - "Corresponde a la versión fijada" se comprueba comparando `metadata.generatedBy` con la versión de `@fission-ai/openspec` en `package.json`.
  - Si las reglas de un agente cambian, se actualiza este soporte, que es la única copia de esas reglas en el proyecto.

### D7. README

Se actualizan estas secciones:

- **Qué ofrece:** los dos agentes.
- **Qué ocurre al abrir una sesión:** el núcleo y los dos adaptadores, y que los avisos aparecen en la interfaz.
- **Cómo desactivar el arranque en local:** en OpenCode, quitar el plugin con `"plugins": ["-session-bootstrap"]` en una configuración local.
- **Requisitos:** OpenCode 2 o superior.
- **Subir de versión OpenSpec:** no cambia. Solo se regeneran las skills de `.claude/`.

## Risks / Trade-offs

- [`systemMessage` podría no mostrarse en `SessionStart`] -> Primera tarea: un hook de prueba en una sesión real. Si no se muestra, la alternativa es terminar con código 2 solo cuando hay avisos, y D2 se revisa antes de seguir.
- [El RPC podría no poder importarse en un plugin sin dependencias] -> Se comprueba al principio. Si falla, se usa el archivo de avisos de D4.
- [En OpenCode, el primer comando de la primera sesión espera a `npm install`, que puede tardar minutos] -> Es el mismo coste que en Claude Code, donde el hook es síncrono, pero aparece en otro momento. Si la espera pasa de unos segundos, la TUI muestra un toast informativo de "instalando dependencias".
- [Una sesión de Claude Code y otra de OpenCode abiertas a la vez en el mismo clon lanzan dos `npm install`] -> Ahora es más probable que con un solo agente. Se mantiene la mitigación actual: si una instalación falla, su sello no se escribe y la siguiente sesión reintenta. Si se ve en la práctica, se añade un cerrojo en el núcleo.
- [Escapar el JSON en bash] -> El adaptador tiene escenarios con avisos que llevan comillas y saltos de línea (el extracto del log de npm), y la suite comprueba que el stdout es JSON válido.
- [La simulación de OpenCode puede alejarse del OpenCode real cuando cambie su API] -> La suite verifica el contrato documentado de OpenCode 2. Antes de cerrar el change se prueba a mano una vez en OpenCode 2 real, y el README declara la versión con la que se probó.
- [El escenario "una skill del schema sin enlazar" no se puede reproducir para OpenCode] -> OpenCode lee `.agents/skills` directamente, así que una skill de ahí no puede faltarle por no estar enlazada. Ver Open Questions.
- [Mover el núcleo cambia el hash del sello] -> La primera sesión tras el cambio reinstala una vez en cada clon. Es aceptable.

## Migration Plan

- **Despliegue:** los commits de código del change traen el núcleo, el adaptador de Claude Code reescrito, el plugin de OpenCode, la suite y el README. Un clon actualizado reinstala una vez en su siguiente sesión de cualquiera de los dos agentes (por el cambio de hash del sello). `.claude/settings.json` no cambia.
- **Proyectos derivados existentes:** no cambian hasta que incorporen estos archivos. No hace falta tocar su configuración local.
- **Vuelta atrás:** revertir los commits de código. Claude Code vuelve al hook actual y OpenCode deja de prepararse.
- **Cierre:**
  - Con la suite en verde y la prueba manual en OpenCode 2 hecha, `openspec archive` lleva las specs a `openspec/specs/`, en un commit propio.
  - El `Purpose` de `session-bootstrap` sigue diciendo "sesión de Claude Code" porque las delta specs no lo modifican. Se actualiza a mano en ese mismo commit para que hable de los agentes soportados.

## Open Questions

- **ADR-0001 deja de estar en vigor en su decisión.** Dice que el arranque es un hook `SessionStart` de Claude Code. El paso de ADR la sustituye con un ADR-0002: núcleo neutral más un adaptador por agente, avisos visibles en la interfaz. Por separado, un ADR-0003 deja escrito que `.agents/skills/` es la única fuente de las skills del schema y que cada agente la ve por sus propias rutas.
- **El caso de OpenCode en "Una skill del schema sin enlazar en un agente" (`agent-skills`).** Por D5 no se puede construir con un clon realista. Propuesta: actualizar la delta spec para que ese escenario sea solo de Claude Code. La garantía para OpenCode ya la da "El agente encuentra las skills del schema".
- **Cómo muestra el aviso Claude Code** (D2) y **cómo pasa el aviso a la TUI en OpenCode** (D4): las dos dependen de las comprobaciones con las que empieza la implementación.
