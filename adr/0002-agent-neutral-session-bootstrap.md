# ADR-0002: Arranque de sesión con un núcleo neutral y un adaptador por agente

- Status: accepted, supersedes ADR-0001
- Date: 2026-11-21
- Supersedes: ADR-0001

## Context

ADR-0001 decidió que el proyecto se prepara solo al abrir cada sesión de Claude Code, mediante un hook `SessionStart` versionado en `.claude/`. El proyecto pasa ahora a trabajarse también con OpenCode 2, y el mismo clon tiene que servir para los dos agentes con las mismas garantías: instalar todas las dependencias solo cuando algo cambia, dejar el `openspec` del proyecto en el `PATH`, avisar sin instalar si el entorno no cumple los requisitos y no bloquear nunca la sesión.

Los dos agentes disparan el arranque de forma distinta:

- **Claude Code** ejecuta un comando en `SessionStart`.
- **OpenCode 2** carga los plugins de `.opencode/plugins/`, y un plugin puede cambiar el entorno de cada comando de shell.

También exponen el `PATH` y los avisos de forma distinta. Además, se ha comprobado que los avisos de ADR-0001 no los ve el usuario: Claude Code no muestra lo que un hook `SessionStart` escribe por stderr cuando termina con éxito.

Alternativas consideradas:

- **Reimplementar el arranque dentro del plugin de OpenCode.** Duplica la lógica con más casos (sello, requisitos de Node y npm, fallos) y su verificación.
- **Escribir el núcleo en Node.** No podría avisar cuando falta Node o cuando la versión es inferior a la requerida.
- **Dejar los avisos en un log.** Mantiene el defecto actual.

## Decision

El arranque de sesión se divide en un núcleo neutral y un adaptador fino por agente soportado (Claude Code y OpenCode 2 o superior).

- **El núcleo**, un script bash fuera de la configuración de cualquier agente (`.agents/hooks/`), contiene toda la lógica de instalación. Recibe el directorio del proyecto, devuelve los avisos y la ruta a exponer en el `PATH`, y termina siempre con éxito. El sello de reinstalación depende del núcleo, no de los adaptadores.
- **Cada adaptador** solo aporta lo que depende de su agente: cómo se dispara el arranque, cómo se expone el `PATH` en la sesión y cómo se muestran los avisos.
  - En Claude Code es el hook `SessionStart` de `.claude/`, que escribe el `PATH` en `CLAUDE_ENV_FILE` y muestra los avisos con `systemMessage`.
  - En OpenCode 2 es un plugin local sin dependencias en `.opencode/plugins/`, que lanza el núcleo sin bloquear, antepone el `PATH` a cada comando de shell y muestra los avisos en la TUI.
- **Los avisos se muestran al usuario en la interfaz del agente.** Dejarlos en un log no cuenta como aviso.
- **La suite de aceptación verifica cada adaptador simulando cómo lo invoca su agente.** El comportamiento común del núcleo se verifica una vez, y lo que depende del adaptador se verifica por agente. No se arrancan los agentes reales.

El comportamiento está especificado en `openspec/specs/session-bootstrap/spec.md`.

## Consequences

- El mismo clon queda listo al abrir Claude Code o OpenCode 2, sin configurar nada, y una instalación hecha desde un agente vale para el otro.
- La lógica de instalación tiene una sola implementación. Añadir otro agente es escribir un adaptador y su simulación en la suite, no otra instalación.
- Los avisos (requisitos incumplidos, fallo de instalación, `PATH` sin ajustar) se ven por fin en la interfaz.
- Siguen vigentes las consecuencias de ADR-0001 que no dependían del agente:
  - la primera sesión de cada clon tarda más;
  - el arranque impone `npm install` en local (se desactiva en la configuración local de cada agente);
  - el proyecto queda ligado a Node.js con npm y a bash.
- En OpenCode, el primer comando de la primera sesión espera a que termine la instalación, en lugar de esperar al abrir la sesión.
- En OpenCode Desktop y en `opencode run`, sin TUI, el arranque funciona pero los avisos solo quedan en el log.
- La suite depende de que la simulación de cada agente siga su contrato documentado. Cuando un agente cambie su API de hooks o de plugins, hay que actualizar el adaptador y su simulación.
- Soportar otra versión de un agente con una API incompatible (por ejemplo, OpenCode 1) exige un adaptador propio y un nuevo ADR.
