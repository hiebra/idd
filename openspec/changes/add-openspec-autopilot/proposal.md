## Why

Llevar un change de OpenSpec de principio a fin exige que el usuario lance a mano cada workflow (nuevo change, cada artefacto, cada task, verify, archive), en sesiones que acumulan contexto hasta degradarse, y que siga una disciplina de git heredada (`openspec-git-discipline`) que obliga a cruzar `main` dos veces y a archivar desde `main` sin que ni este proyecto ni su origen (`intent-driven-dev/intent-driven-template`) registren por qué. La crítica abierta en el origen ([intent-driven-dev/intent-driven-template#11](https://github.com/intent-driven-dev/intent-driven-template/issues/11)) cuenta 13 pasos y tres PR por change.

## What Changes

- **El ciclo de un change cabe en una rama y una sola fusión**, para los dos agentes: sin la fusión intermedia de la propuesta con `main`, y con el archive (y la resincronización del wiki) hechos en la rama, antes de esa única fusión. Los commits y la fusión los hace siempre el usuario. Sustituye las puertas correspondientes de `openspec-git-discipline`; se asume el riesgo y queda abierta la discusión de si debe volver la fusión intermedia.
- **Ramas permanentes configurables**: `x-main` en `openspec/config.yaml`, una lista ordenada de las ramas permanentes (por defecto `["main"]`), cuyo último elemento es la rama de la que salen todas las demás. Cualquier otra rama es temporal, y el change de una rama temporal se lee de git: lo que hay en `openspec/changes/` desde su merge-base con ese último elemento.
- **Un plugin de OpenCode 2 que automatiza el ciclo** en la TUI:
  - una sesión nueva por cada paso (cada artefacto, cada task, verify, archive, resincronización del wiki), con el workflow y el agente que tocan, elegidos por el plugin, y archivada al terminar;
  - una sola sesión con el control del change por rama, marcada en la metadata de las sesiones de OpenCode; puede haber además sesiones libres, que el plugin no orquesta;
  - al abrir una sesión: si la rama no tiene change o el change no tiene dueña, la sesión toma el control sin preguntar; si la dueña está trabajando, la nueva queda libre con un aviso; si está parada sin haber terminado, se pregunta al usuario si ir a ella o archivarla y seguir en la nueva;
  - en el modo normal, tras cada artefacto, cada task y el verify, una sesión de revisión humana guiada por el LLM, que termina con una tool del plugin: si la revisión es satisfactoria se pasa al paso siguiente; si no, a `openspec-update-change` y a una revisión del plan;
  - un modo auto, que elige cada usuario como opción del plugin (desactivado por defecto), sin sesiones de revisión, que solo se para cuando un workflow pregunta, en cada cambio entre la zona de specs y la de código (para el commit del usuario) y si el verify encuentra problemas críticos;
  - cada sesión comprueba al empezar que el árbol de trabajo está limpio, salvo en el modo auto dentro de una misma zona;
  - la sesión de `openspec-update-change` recibe, además de las conclusiones de la revisión, un índice de las sesiones del change (qué paso hizo cada una y cómo acabó cada revisión);
  - si en la rama hay más de un change, el plugin se inhibe y avisa.
- **El plugin solo existe para OpenCode**: es la primera asimetría deliberada entre agentes. En Claude Code los mismos workflows se siguen lanzando a mano, con el mismo ciclo y el mismo resultado versionado. Se registra una política general sobre cuándo se acepta una asimetría.

Fuera de alcance, como discusiones abiertas: la vuelta de la fusión intermedia de la propuesta; que el usuario modifique a mano el código generado; las tasks concurrentes. También queda fuera el automatismo sin TUI (`opencode run`, OpenCode Desktop), un tratamiento especial del agente plan o de `openspec-explore` (son acciones explícitas del usuario), y cualquier contrapartida en Claude Code.

## Capabilities

### New Capabilities
- `openspec-change-lifecycle`: el ciclo git de un change, igual en los dos agentes: ramas permanentes y temporales (`x-main`), cómo se lee de git el change de una rama, una sola fusión con el archive en la rama, y los commits a cargo del usuario.
- `openspec-autopilot`: la automatización del ciclo en OpenCode 2: control del change por rama, sesiones por paso, revisión humana guiada, modos normal y auto, y su comportamiento al abrir sesiones.

### Modified Capabilities

## Impact

- Un plugin local nuevo en `.opencode/plugins/` (servidor y TUI), con el patrón de `session-bootstrap`: sin dependencias, solo módulos `node:`, sin lanzar nunca una excepción hacia OpenCode.
- `openspec/config.yaml`: la clave `x-main`, y las indicaciones de archivado, que hoy dan por hecho que el archive se hace tras fusionar con `main`.
- `openspec-git-discipline` (`.agents/skills/`), una copia del origen sin cambios hasta ahora: sus puertas de la fusión intermedia y del archive desde `main` quedan sustituidas.
- Suite de aceptación: la simulación de OpenCode (`acceptance-tests/support/agents/opencode-host.mjs`) tiene que cubrir las APIs de sesión, TUI, herramientas y opciones que use el plugin, y comprobar que en Claude Code no queda nada a medias.
- ADRs: la política de asimetrías entre agentes, el plugin, y la sustitución de las puertas heredadas de `openspec-git-discipline`.
- Proyectos derivados: heredan el ciclo y el plugin.

### Pruebas con OpenCode real, hechas antes del design

Lo que el plugin usa de OpenCode 2.3.2 se comprobó en la TUI con un proveedor falso (2026-11-21; lecciones en `.wiki/raw/notes/2026-11-21-ll-sesiones-opencode-autopilot.md`). Lo que condiciona el design:

- **Archivar (P1):** `ctx.session.update({ archived: true })` desde el servidor del plugin no hace nada; desde la parte de TUI (`context.client.session.update`) sí archiva. `list()` incluye las archivadas salvo que se filtre, la TUI las oculta y una sesión archivada sigue aceptando mensajes.
- **Metadata (P2):** `update({ metadata })` la sustituye entera; persiste al reiniciar.
- **Encadenar (P3, P4):** desde `experimental.idle`, crear la sesión siguiente con su `agent` y su `metadata`, ponerla en marcha (`prompt`, `command`, o `prompt` con `skills`), llevar la TUI a ella (`ui.router.navigate`) y archivar la anterior funciona sin que nadie escriba. `ui.dialog.select` devuelve la opción elegida o `undefined`.
- **Varias TUIs (P5):** cada una es una instancia del plugin que solo ve los eventos de sus sesiones; la base de datos y `ctx.storage` se comparten, sin operaciones atómicas.
- **Interrupción y compactación (P6, P8):** tras Esc o `interrupt` no corre `idle` y la sesión queda con `outcome: "interrupted"`; la compactación se ve por su hook y por sus eventos. Si una sesión trabaja se sabe con `get` (`time.busy` frente a `time.idle`).
- **Abrir una sesión (P9):** la TUI crea la sesión con su primer mensaje, con el agente elegido en ese momento; al arrancar no retoma la última sesión y vuelve al agente build.
- **Tool del plugin (P11):** solo la ve el modelo si se declara con `options: { codemode: false }`. Que un modelo real la llame cuando se lo pide el prompt queda sin comprobar.
- **Opciones (P13):** un plugin local recibe `options` desde la configuración del usuario, y OpenCode lo recarga en caliente al cambiarlas o al cambiar sus archivos; cada recarga deja vivos los escuchadores RPC anteriores de la TUI.
