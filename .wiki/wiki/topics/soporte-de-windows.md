---
title: "El soporte de Windows: solo OpenCode 2, LF en el repositorio y un diagnóstico sin red"
category: topic
sources:
  - raw/repos/2026-11-22-idd-3d2d8fe-windows-support.md
  - raw/notes/2026-11-22-ll-windows-support.md
created: 2026-11-22
updated: 2026-11-22
verified: 2026-11-22
tags: [windows, opencode, powershell, git, npm, adr, spec, windows-support]
confidence: high
volatility: warm
summary: "Qué se soporta en Windows y por qué (ADR-0017): solo OpenCode 2, LF en todo el repositorio con .gitattributes, el CLI de OpenSpec ejecutado como node <bin> en el autopilot y el diagnóstico PowerShell Test-OfflineInstall.ps1 que la spec windows-readiness describe; sintetizado del archivado de windows-support (idd@3d2d8fe) y sus lecciones."
---

# El soporte de Windows: solo OpenCode 2, LF en el repositorio y un diagnóstico sin red

> En Windows el proyecto solo se soporta con OpenCode 2 o superior. El repositorio se extrae con LF en cualquier sistema, el autopilot ejecuta el CLI de OpenSpec sin pasar por `node_modules/.bin/`, y un diagnóstico PowerShell dice qué le falta a la máquina, también sin internet. Todo lo de esta página sale de los archivos citados, fijados en `idd@3d2d8fe` (el commit del archivado de `windows-support`), salvo donde se cita una lección.

## Por qué

Hasta `windows-support`, el proyecto solo funcionaba en Linux y macOS. En Windows 11 hay causas que no dependen de cómo se ejecute el arranque de sesión (`idd@3d2d8fe:adr/0017-windows-support-opencode-lf-diagnostic.md`, Context):

- Git for Windows extrae por defecto con `core.autocrlf=true`, así que los textos que el proyecto ejecuta o procesa salen con CRLF, y bash no ejecuta scripts con CRLF (`idd@3d2d8fe:.gitattributes`).
- El autopilot ejecutaba `node_modules/.bin/openspec`, que en Windows es un script de shell.
- Una máquina Windows puede no tener internet, y hace falta saber qué le falta antes de abrir una sesión. Lo único que trae siempre Windows 11 es Windows PowerShell 5.1.

**Lo que no decide**: cómo se ejecuta el núcleo del arranque en Windows. Lo fija ADR-0023, del change `windows-global-distro`, con un núcleo en Node. Una primera versión de ADR-0017 lo resolvía con Git Bash, y se reescribió antes de llegar a la rama de origen por decisión del usuario (ADR-0017, Context). Hasta que llegue ese change, en Windows las dependencias se instalan a mano (`idd@3d2d8fe:README.md`, «Windows»).

## Las decisiones (ADR-0017)

- **Solo OpenCode 2 o superior.** Claude Code en Windows no se soporta. No es una capacidad de un solo agente en el sentido de ADR-0006: en Linux y macOS los dos agentes siguen soportados igual. Se descartó soportar los dos agentes porque habría que adaptar y verificar Claude Code en Windows sin una necesidad que lo pida.
- **LF en todos los archivos de texto**, con `* text=auto eol=lf` en `.gitattributes`. Se descartó fijarlo solo en los scripts y los textos del arranque: cada texto nuevo obligaría a acordarse de añadirlo, y el fallo solo se vería en Windows.
- **Un único script PowerShell** para el diagnóstico, compatible con Windows PowerShell 5.1 y PowerShell 7, que separa la recogida de hechos de su evaluación. Se descartó un lanzador PowerShell con el diagnóstico en bash: seguiría habiendo PowerShell sin probar y la lógica quedaría en dos lenguajes.
- **La suite prueba la evaluación con `pwsh`** sobre máquinas simuladas, así que `pwsh` es requisito de la suite. La recogida de hechos se comprueba a mano en Windows real.

## Qué garantizan las specs

### El diagnóstico (`windows-readiness`)

`idd@3d2d8fe:openspec/specs/windows-readiness/spec.md`, ejecutado como `scripts\windows\Test-OfflineInstall.ps1` (`idd@3d2d8fe:scripts/windows/Test-OfflineInstall.ps1`):

- **Sin efectos**: no instala nada, no cambia ningún archivo del proyecto ni de la máquina y no usa la red.
- **Un estado por componente**: `OK`, `OK (vendor)` (está en el directorio de vendor del repositorio, `vendor\windows\`), `AVISO` (está, pero algo impedirá que el proyecto funcione del todo) o `FALTA`. Los componentes son Node.js con npm (en la versión de `engines.node`), git, Python 3, los finales de línea del clon, el motor del wiki, las dependencias npm de la raíz y de `acceptance-tests/`, y el agente (`idd@3d2d8fe:README.md`, «Qué le falta a la máquina»).
- **Qué hacer con lo que falta**: por qué, qué incorporar al repositorio para no depender de la máquina, la alternativa global si existe (o que no la hay) y cómo conseguirlo en una máquina con internet.
- **Dependencias para la plataforma de la máquina**: solo cuenta los paquetes del `package-lock.json` que se instalan en su plataforma y arquitectura. Un `node_modules` instalado en Linux da `FALTA` y nombra `@esbuild/win32-x64`, no `@esbuild/linux-x64`. Un paquete cuenta como presente si está instalado en la versión del lockfile o si su contenido está en la caché de npm del vendor o en la global. Si solo está en la caché global y npm no está configurado para trabajar sin red, da `AVISO`, porque el arranque intentaría usar la red.
- **El motor del wiki sin red**: presente si está instalado en la versión de `.agents/wiki/engine.json` o si `engine.json` apunta a una fuente de git local con esa versión (`OK (vendor)`); `FALTA` si no está instalado y apunta a GitHub. Que un git bundle local sirve de fuente sin cambiar el núcleo está comprobado ([lecciones de windows-support](../../raw/notes/2026-11-22-ll-windows-support.md), lección 1).
- **Python 3 que se puede ejecutar**: el alias de la Microsoft Store no cuenta.
- **Finales de línea del clon**: un clon con archivos versionados en CRLF, como los deja un clon de Git for Windows anterior a `.gitattributes`, da `FALTA`, con cómo volver a extraerlos con LF.
- **El agente**: `FALTA` si no hay OpenCode 2 o superior, aunque esté Claude Code (y el detalle dice que en Windows solo se soporta OpenCode 2) o esté OpenCode 1.
- **Salida**: termina con 1 si algo está en `FALTA` y con 0 si no. Con `-Json` da el mismo informe, un objeto por componente.

El script tiene dos partes: `Get-ReadinessFacts` recoge los hechos de la máquina y `Get-ReadinessReport` los convierte en el informe; con `-FactsFile` evalúa unos hechos dados sin recogerlos (`idd@3d2d8fe:acceptance-tests/README.md`, «Escenarios de `windows-readiness`»).

### En el arranque y en el autopilot

- **`session-bootstrap`**: el repositorio fija LF en todos sus archivos de texto, entre ellos los scripts del arranque y los textos que entrega o procesa (la guía y el recordatorio del wiki, la regla de comentarios y su recordatorio), para que un clon con `core.autocrlf=true` los extraiga con LF. Con CRLF, la guía del wiki llegaría con sus identificadores de sección (`idd@3d2d8fe:openspec/specs/session-bootstrap/spec.md`).
- **`openspec-autopilot`**: el plugin ejecuta el CLI de OpenSpec del proyecto, en la versión de su `package.json`, aunque `node_modules/.bin/openspec` no sea un ejecutable; si el proyecto no tiene su CLI instalado, usa el `openspec` del `PATH` (`idd@3d2d8fe:openspec/specs/openspec-autopilot/spec.md`). `openspecCommand()` lo resuelve como `node <bin.openspec de node_modules/@fission-ai/openspec/package.json>` (`idd@3d2d8fe:.opencode/plugins/openspec-autopilot/lib/project.mjs`). Por qué no `node_modules/.bin/` ni `process.execPath` está en [[ciclo-de-un-change-y-autopilot|el ciclo de un change]] ([el ciclo de un change](ciclo-de-un-change-y-autopilot.md)).

## Lo que deja fuera

- **El núcleo del arranque en Windows**: Git Bash, symlinks, rutas y el bash que lanza OpenCode. Lo resuelve `windows-global-distro` con un núcleo en Node (`idd@3d2d8fe:openspec/changes/archive/2026-11-22-windows-support/proposal.md`, `idd@3d2d8fe:openspec/changes/archive/2026-11-22-windows-support/design.md`).
- **Una primera versión con Git Bash se implementó y se revirtió**: symlinks nativos con `MSYS=winsymlinks:nativestrict`, rutas relativas en la salida del núcleo y la búsqueda de Git Bash en el plugin de OpenCode (tasks 2.2 a 2.7 de esa versión, commits `052e567` a `9e5b7b8`). Se revirtió en la task 2.2 al decidir el núcleo en Node, para que los dos changes no se pisen (`idd@3d2d8fe:openspec/changes/archive/2026-11-22-windows-support/design.md`, `idd@3d2d8fe:openspec/changes/archive/2026-11-22-windows-support/tasks.md`).
- **Lo que el diagnóstico ya no comprueba**: Git Bash y sus utilidades, `MSYS`, qué bash va primero en el `PATH`, los symlinks, el Modo de desarrollador y el nombre `python3`, porque dependían del núcleo bash (design, D4).
- **La suite en Windows**: no se ejecuta allí, porque sus escenarios montan un `PATH` de prueba con symlinks a utilidades POSIX; los cambios se cubren con escenarios que se ejecutan en Linux (proposal).

## Consecuencias

- **Clones Windows anteriores a `.gitattributes`**: tienen que volver a extraer su árbol. El diagnóstico lo detecta y da los comandos (ADR-0017); el README los recoge, con el árbol limpio (`idd@3d2d8fe:README.md`, «Finales de línea»). Para ver los finales de línea del índice sin tocar nada, `git ls-files --eol`; `git add --renormalize` mete en el stage todo el árbol ([lecciones de windows-support](../../raw/notes/2026-11-22-ll-windows-support.md), lección 4).
- **Claude Code en Windows**: soportarlo exige un change y un ADR nuevos.
- **La suite necesita `pwsh`**, además de Node.js, npm, git y bash. En la sesión en la nube lo instala el script de configuración del entorno `idd` (`idd@3d2d8fe:acceptance-tests/README.md`).
- **El diagnóstico sigue al arranque de Windows**: el change que cambie ese arranque, por ejemplo con ADR-0023, adapta también el diagnóstico.
- **`vendor/windows/`**: el diagnóstico nombra qué incorporar ahí, pero mientras no haya otro change el arranque no usa ese directorio.
- **Las dependencias npm para Windows se preparan en Windows**: la caché para una instalación sin red se llena con `npm ci` en una máquina Windows ([lecciones de windows-support](../../raw/notes/2026-11-22-ll-windows-support.md), lección 2).
- **Un `.ps1` para Windows PowerShell 5.1 lleva un solo BOM UTF-8**: antes de añadirlo, se mira si ya lo tiene, y tras escribirlo se pasa por el parser de PowerShell ([lecciones de windows-support](../../raw/notes/2026-11-22-ll-windows-support.md), lección 5).

## See Also

- [[arranque-de-sesion|El arranque de sesión]] ([El arranque de sesión](arranque-de-sesion.md))
- [[ciclo-de-un-change-y-autopilot|El ciclo de un change y su automatización en OpenCode]] ([El ciclo de un change y su automatización en OpenCode](ciclo-de-un-change-y-autopilot.md))
- [[suite-de-aceptacion-y-spec-as-source|La suite de aceptación y spec-as-source]] ([La suite de aceptación y spec-as-source](suite-de-aceptacion-y-spec-as-source.md))
- [[una-sola-copia-de-las-skills|Una sola copia de las skills, vista por cada agente]] ([Una sola copia de las skills, vista por cada agente](../concepts/una-sola-copia-de-las-skills.md))

## Sources

- [Collection: archivado de windows-support (idd@3d2d8fe)](../../raw/repos/2026-11-22-idd-3d2d8fe-windows-support.md): `adr/0017-windows-support-opencode-lf-diagnostic.md`, `.gitattributes`, `openspec/specs/windows-readiness/spec.md`, `openspec/specs/session-bootstrap/spec.md`, `openspec/specs/openspec-autopilot/spec.md`, `scripts/windows/Test-OfflineInstall.ps1`, `.opencode/plugins/openspec-autopilot/lib/project.mjs`, `README.md`, `acceptance-tests/README.md`, `openspec/changes/archive/2026-11-22-windows-support/proposal.md`, `design.md` y `tasks.md`.
- [Lessons Learned: soporte de Windows (windows-support)](../../raw/notes/2026-11-22-ll-windows-support.md): lecciones 1, 2, 4 y 5.
