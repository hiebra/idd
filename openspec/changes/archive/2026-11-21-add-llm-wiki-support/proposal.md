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
- **Lo descubierto al trabajar es conocimiento.** Lo que el agente comprueba empíricamente (ejecutando, midiendo, leyendo código) y lo que encuentra en internet, también cuando busca por su cuenta en medio de una tarea, se registra cuando servirá en otra ocasión y no solo para la tarea en curso. El agente discierne cuándo procede y lo propone en lugar de registrarlo sin más: lo comprobado, con las lecciones aprendidas del motor; lo encontrado en internet, ingiriendo la fuente.
- **Recordatorio en cada mensaje.** Cada agente recibe en cada mensaje del usuario un recordatorio breve de este flujo (consultar primero, preguntar ante un hueco, proponer registrar lo que servirá en otra ocasión con la operación que corresponde), para que no dependa de que el modelo recuerde una instrucción del principio de la sesión.
- **Los productos del proyecto son fuentes del wiki.** Specs, ADRs y código entran en el wiki del proyecto como fuentes fijadas a un commit (ruta e identificador de versión, sin copiar su contenido), y los artículos son el conocimiento extraído de ellas, con la cita exacta de la versión de la que sale. Al crear el wiki del proyecto se hace una ingesta inicial del repositorio, excluyendo lo generado y lo que no aporta conocimiento.
- **Resincronización del wiki al archivar un change**, mediante las indicaciones de archivado de OpenSpec del proyecto (`operations.archive.guidance` en `openspec/config.yaml`) y con las operaciones del motor, sobre lo que tocó el change:
  1. fijar como fuentes, en el commit del archivado, el código, las specs y los ADRs que tocó el change;
  2. refrescar los artículos cuyas fuentes cambiaron y compilar las nuevas;
  3. revisar con el librarian, sin modificar, lo que quedó obsoleto o contradicho;
  4. extraer las lecciones aprendidas sin escribir;
  5. escribir solo lo que confirme el usuario;
  6. pasar el lint del wiki hasta dejarlo limpio;
  7. hacer el commit del wiki después del commit del archivado.
- **Motor disponible en los dos agentes nada más clonar**, en una versión fijada por el proyecto (hoy nvk/llm-wiki v1.0.0), instalado por el arranque de sesión si falta o no es la versión fijada:
  - **Claude Code:** la skill y los comandos `/wiki:*` del motor, en las carpetas de skills y comandos del proyecto, ignorados por git. No se usa el plugin del motor: instalado desde el arranque, solo se carga en la sesión siguiente, y en la nube cada sesión empieza de cero.
  - **OpenCode 2:** las skills del motor para OpenCode, en una carpeta de skills del proyecto ignorada por git. No se usa la vía `instructions` del motor, porque un usuario no puede desactivarla en local.
- **Guía del wiki en un único archivo**, que entregan al agente los adaptadores del arranque de sesión de cada agente (al empezar la sesión) junto con el recordatorio (en cada mensaje). No hay `AGENTS.md` ni `CLAUDE.md`: OpenCode los cargaría siempre, sin que el usuario pueda desactivarlos.
- **Desactivable en local**, sin tocar la configuración del repositorio: con el wiki desactivado, el arranque no instala el motor ni entrega la guía ni el recordatorio.
- **Suite de aceptación** ampliada y **README** actualizado (qué ofrece, requisitos, cómo desactivarlo, cómo subir la versión del motor).

Fuera de alcance:
- Codex, DeepSeek Harness, Pi y otros runtimes del motor.
- Comandos `/wiki:*` en OpenCode.
- La captura automática de sesiones del motor (`.sessions/`).
- Vendorizar o modificar el motor.
- Un control continuo del wiki en CI (lint determinista del motor): solo se pasa al archivar.

## Capabilities

### New Capabilities
- `llm-wiki`: el wiki del proyecto y el hub del usuario están disponibles en cada agente soportado nada más clonar, con el motor en la versión fijada por el proyecto; el wiki del proyecto se versiona y el hub es opcional.
- `wiki-first-knowledge`: el agente consulta el wiki antes de usar su conocimiento interno, pregunta ante un hueco, registra en el ámbito correcto (incluidas las comprobaciones empíricas que procedan) y recibe un recordatorio del flujo en cada mensaje.

### Modified Capabilities
- `session-bootstrap`: el arranque de sesión instala también el motor del wiki en la versión fijada, en los dos agentes, con las mismas garantías (no bloquea la sesión, avisa si falla y lo reintenta en la siguiente), y sus adaptadores entregan la guía del wiki y el recordatorio por mensaje.

## Impact

- **Configuración de agentes:** `.claude/settings.json` (hook de recordatorio por mensaje), el hook de arranque de Claude Code (entrega de la guía), el plugin `.opencode/plugins/session-bootstrap/` (guía y recordatorio en OpenCode) y la carpeta de skills de OpenCode donde se instala el motor.
- **Guía del wiki:** un archivo nuevo, única fuente del flujo para los dos agentes.
- **Arranque de sesión:** `.agents/hooks/session-bootstrap.sh` y sus adaptadores.
- **OpenSpec:** `openspec/config.yaml` (indicaciones de archivado).
- **Repositorio:** `.wiki/` versionado; la copia instalada del motor, si la hay, ignorada por git.
- **Dependencias externas:** GitHub (`nvk/llm-wiki` en un tag fijado), red en la primera sesión de cada clon y al subir de versión. Python 3 para los helpers deterministas del motor (no para los workflows agénticos).
- **Contexto del agente:** la guía y el recordatorio por mensaje consumen contexto en cada sesión y cada mensaje; deben ser breves. Las skills del motor solo ocupan contexto cuando se usan.
- **ADRs:** uno nuevo sobre el wiki como fuente de conocimiento (concepto independiente del motor, dos ámbitos, consulta primero) y la integración del motor por agente con versión fijada.
- **Suite de aceptación:** escenarios nuevos y los de `session-bootstrap` ampliados.
- **README** de la plantilla.
