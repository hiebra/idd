## Why

Los proyectos creados desde esta plantilla acumulan conocimiento que no cabe en specs ni ADRs (investigación de dominio, fuentes, comparativas, comprobaciones hechas durante el trabajo) y que hoy se pierde entre sesiones o queda en la memoria del modelo, sin fuente ni revisión. El concepto de *LLM wiki* (una base de conocimiento en Markdown que el propio agente consulta, amplía y mantiene) lo resuelve si el agente la usa de verdad: que consulte antes de responder con su conocimiento interno y registre lo que aprende. Ni Claude Code ni OpenCode lo hacen de serie, aun con el motor instalado: el motor de referencia, [nvk/llm-wiki](https://github.com/nvk/llm-wiki), solo consulta el wiki cuando el modelo decide cargar su skill y, si no encuentra nada, responde de memoria sin preguntar.

## What Changes

- **Dos ámbitos de conocimiento**, con papeles distintos:
  - **Wiki del proyecto** (`.wiki/` en la raíz, **versionado** con el repositorio): el conocimiento específico del proyecto y lo externo que le concierne.
  - **Hub del usuario** (fuera del repositorio): sus topics personales. Opcional; su ausencia, por ejemplo en sesiones en la nube, no es un error.
  - El conocimiento pasa del hub al proyecto incorporándolo directamente o mediante *checkpoint*, nunca copiando artículos a mano.
- **Consulta antes de responder.** Ante una petición que requiere conocimiento (dominio, decisiones técnicas, herramientas, hechos externos; no operaciones sobre el código, como renombrar o reformatear), el agente consulta primero el wiki del proyecto y, si no basta, el hub, en modo de solo lectura, antes de usar su conocimiento interno.
- **Preguntar ante un hueco.** Si el wiki no responde, el agente pregunta si responder con conocimiento interno (indicando que no viene del wiki), investigar fuera y registrar lo encontrado, o dejarlo.
- **Registro en el ámbito correcto**, preguntando cuando no está claro cuál toca.
- **Las comprobaciones empíricas son conocimiento.** Lo que el agente verifica ejecutando, midiendo o leyendo código o documentación externa se registra cuando procede (tiene valor más allá de la tarea en curso); el agente discierne cuándo procede y, en caso de duda, lo propone en lugar de registrarlo sin más.
- **Recordatorio en cada mensaje.** Cada agente recibe en cada mensaje del usuario un recordatorio de este flujo, para que no dependa de que el modelo recuerde una instrucción del principio de la sesión.
- **Motor disponible en los dos agentes nada más clonar**, en una versión fijada por el proyecto (hoy nvk/llm-wiki v1.0.0):
  - **Claude Code:** el arranque de sesión instala el plugin si falta o no es la versión fijada.
  - **OpenCode 2:** el diseño decide entre la vía canónica del motor (`instructions` con la URL del tag fijado) y una skill instalada por el arranque.
- **Regla del proyecto** en un `AGENTS.md` en la raíz (que Claude Code lee mediante un `CLAUDE.md` que lo importa), como fuente única del flujo para los dos agentes.
- **Desactivable en local**, sin tocar la configuración del repositorio.
- **Suite de aceptación** ampliada y **README** actualizado (qué ofrece, requisitos, cómo desactivarlo, cómo subir la versión del motor).

Fuera de alcance:
- Codex, DeepSeek Harness, Pi y otros runtimes del motor.
- Comandos `/wiki:*` en OpenCode.
- La captura automática de sesiones del motor (`.sessions/`).
- Vendorizar o modificar el motor.

## Capabilities

### New Capabilities
- `llm-wiki`: el wiki del proyecto y el hub del usuario están disponibles en cada agente soportado nada más clonar, con el motor en la versión fijada por el proyecto; el wiki del proyecto se versiona y el hub es opcional.
- `wiki-first-knowledge`: el agente consulta el wiki antes de usar su conocimiento interno, pregunta ante un hueco, registra en el ámbito correcto (incluidas las comprobaciones empíricas que procedan) y recibe un recordatorio del flujo en cada mensaje.

### Modified Capabilities
- `session-bootstrap`: el arranque de sesión instala también el motor del wiki en la versión fijada (al menos para Claude Code), con las mismas garantías: no bloquea la sesión, avisa si falla y lo reintenta en la siguiente.

## Impact

- **Configuración de agentes:** `.claude/settings.json` (hook de recordatorio por mensaje), `AGENTS.md` y `CLAUDE.md` nuevos, y la configuración de OpenCode que decida el diseño (`opencode.json` o `.opencode/skills/`), además del plugin `.opencode/plugins/session-bootstrap/` para el recordatorio.
- **Arranque de sesión:** `.agents/hooks/session-bootstrap.sh` y sus adaptadores.
- **Repositorio:** `.wiki/` versionado; la copia instalada del motor, si la hay, ignorada por git.
- **Dependencias externas:** GitHub (`nvk/llm-wiki` en un tag fijado), red en la primera sesión de cada clon y al subir de versión. Python 3 para los helpers deterministas del motor (no para los workflows agénticos).
- **Contexto del agente:** la regla de `AGENTS.md` y el recordatorio por mensaje consumen contexto en cada sesión y cada mensaje; deben ser breves. En OpenCode, la vía `instructions` añade ~30 KB por sesión.
- **ADRs:** uno nuevo sobre el wiki como fuente de conocimiento (concepto independiente del motor, dos ámbitos, consulta primero) y la integración del motor por agente con versión fijada.
- **Suite de aceptación:** escenarios nuevos y los de `session-bootstrap` ampliados.
- **README** de la plantilla.
