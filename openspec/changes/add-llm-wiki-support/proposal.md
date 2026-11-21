## Why

Los proyectos creados desde esta plantilla acumulan conocimiento que no cabe en specs ni en ADRs: investigación de dominio, fuentes consultadas, comparativas, lecciones aprendidas en sesiones con el agente. Hoy ese conocimiento se pierde entre sesiones o queda disperso. [nvk/llm-wiki](https://github.com/nvk/llm-wiki) (v1.0.0, MIT) resuelve justo eso: un wiki en Markdown que el propio agente investiga, ingiere, compila, consulta y revisa, con soporte para Claude Code y OpenCode, los dos agentes que soporta la plantilla. Integrarlo en la plantilla hace que cada proyecto nazca con ese wiki disponible en los dos agentes sin configurar nada, igual que ya ocurre con OpenSpec y las skills del schema.

## What Changes

- **llm-wiki disponible en Claude Code nada más clonar.** El proyecto declara en su configuración compartida el marketplace `nvk/llm-wiki` y el plugin `wiki@llm-wiki`, de modo que Claude Code ofrece instalarlo al confiar en la carpeta y quedan disponibles `/wiki` y sus subcomandos (`/wiki:research`, `/wiki:ingest`, `/wiki:query`, `/wiki:lint`…).
- **llm-wiki disponible en OpenCode 2 nada más clonar**, con el paquete que el proyecto publica para OpenCode (`plugins/llm-wiki-opencode/`), cargado desde la configuración de proyecto.
- **Versión fijada.** Los dos agentes usan la misma versión de llm-wiki, fijada por el proyecto (hoy v1.0.0), no la rama `master`. Subirla es una acción explícita y documentada, como subir OpenSpec.
- **Wiki del proyecto dentro del repositorio.** El proyecto usa el modo local de llm-wiki (`.wiki/` en la raíz), que no necesita permisos sobre directorios externos ni configuración del usuario. El hub personal del usuario (`~/wiki` o el de `~/.config/llm-wiki/config.json`) sigue funcionando como siempre y no es requisito.
- **Política de versionado del wiki.** Se decide y se documenta si `.wiki/` se versiona con el proyecto (llm-wiki lo añade a `.gitignore` por defecto al inicializarlo en modo local).
- **Desactivable en local**, sin tocar la configuración del repositorio, igual que el arranque de sesión.
- **Suite de aceptación** ampliada con los escenarios de disponibilidad de llm-wiki en cada agente y de versión fijada.
- **Documentación**: README de la plantilla (qué ofrece, requisitos, cómo desactivarlo, cómo subir de versión) y lo que heredan los proyectos creados desde ella.

Fuera de alcance:
- Codex, DeepSeek Harness, Pi y otros runtimes que llm-wiki también soporta: la plantilla solo soporta Claude Code y OpenCode 2.
- La captura automática de sesiones de llm-wiki (`.sessions/`): sigue siendo opcional y a elección de cada usuario.
- Vendorizar o modificar el código de llm-wiki.

## Capabilities

### New Capabilities
- `llm-wiki-integration`: llm-wiki está disponible en cada agente soportado nada más clonar, en la versión fijada por el proyecto, con el wiki del proyecto en el propio repositorio y la posibilidad de desactivarlo en local.

### Modified Capabilities
<!-- Ninguna en principio. Si design.md decide exponer la skill de llm-wiki a OpenCode a través de `.agents/skills/`, cambiaría `agent-skills` (y habría que revisar ADR-0003). -->

## Impact

- **Configuración de agentes:** `.claude/settings.json` (marketplace y plugin habilitado) y una configuración de proyecto para OpenCode (`opencode.json` u otra vía que decida el diseño).
- **Repositorio:** nuevo `.wiki/` (o su reserva en `.gitignore`, según la política que se decida).
- **Dependencias externas:** el repositorio `nvk/llm-wiki` en GitHub, en un tag fijado. La instalación en Claude Code necesita red y la aprobación del usuario al confiar en la carpeta. Los helpers deterministas de llm-wiki (`llm-wiki lint`, etc.) requieren Python 3; los workflows agénticos no.
- **Contexto del agente:** la skill completa de OpenCode ocupa ~30 KB. Si se carga como instrucción permanente, consume contexto en cada sesión; el diseño debe valorar cargarla bajo demanda o usar el preset de solo lectura `wiki-query` (~2,8 KB).
- **ADRs:** probablemente uno nuevo sobre cómo se integran herramientas de terceros por agente (plugin frente a skill frente a instrucción) y sobre fijar su versión. Puede afectar a ADR-0003 si la skill de llm-wiki pasa por `.agents/skills/`.
- **Suite de aceptación:** nuevos escenarios en `acceptance-tests/`.
- **README** de la plantilla.
