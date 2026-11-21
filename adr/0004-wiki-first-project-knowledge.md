# ADR-0004: El conocimiento del proyecto vive en un wiki que el agente consulta primero

- Status: accepted
- Date: 2026-11-21
- Supersedes: -

## Context

Los proyectos creados desde la plantilla acumulan conocimiento que no cabe en specs ni ADRs: investigación de dominio, fuentes externas, comprobaciones hechas durante el trabajo, lecciones aprendidas. Hoy se pierde entre sesiones o queda en la memoria del modelo, sin fuente ni revisión.

El concepto de LLM wiki (Markdown que el agente consulta, amplía y mantiene) resuelve esto si el agente lo usa de verdad. El motor de referencia, nvk/llm-wiki, solo consulta el wiki cuando el modelo decide cargar su skill y, si no encuentra nada, responde de memoria sin preguntar.

Alternativas consideradas:

- **Instalar el motor sin más.** El agente seguiría respondiendo de memoria y registrando a su criterio.
- **Solo el hub personal del usuario.** El conocimiento del proyecto no viajaría con el repositorio, no se revisaría en los PR y no existiría en las sesiones en la nube.
- **Solo el wiki del proyecto.** Se pierde la reutilización entre proyectos.
- **Copiar specs, ADRs y código al wiki.** Duplica y se desincroniza.

## Decision

- **El concepto es independiente del motor.** El motor (hoy nvk/llm-wiki) aporta las operaciones; la plantilla define cómo se usan. Cambiar de motor no cambia esta decisión.
- **Dos ámbitos:**
  - el wiki del proyecto, en `.wiki/` y versionado, para lo específico del proyecto y lo externo que le concierne;
  - el hub del usuario, opcional, para el conocimiento general. Del hub al proyecto se pasa incorporándolo o con un checkpoint.
- **Wiki primero.** Ante una petición que requiere conocimiento, el agente consulta el wiki (primero el del proyecto, luego el hub) antes de usar su conocimiento interno. Si no responde, pregunta: conocimiento interno indicando su origen, investigar y registrar, o nada.
- **Lo descubierto al trabajar se registra** cuando servirá en otra ocasión, a propuesta del agente: lo comprobado, con las lecciones aprendidas; lo encontrado en internet, ingiriendo la fuente.
- **Los productos del proyecto son fuentes del wiki.** Specs, ADRs y código entran como fuentes fijadas a un commit, sin copiar su contenido. Al archivar cada change, el wiki se resincroniza con lo que tocó ese change: se fijan las fuentes, se refresca y compila, se revisa, se aplica lo que confirma el usuario y se pasa el lint. Todo va en un commit posterior al del archivado.
- **La plantilla garantiza que el agente recibe el flujo** (una guía por sesión y un recordatorio por mensaje), no cómo razona el modelo.

El comportamiento está especificado en `openspec/specs/llm-wiki/spec.md` y `openspec/specs/wiki-first-knowledge/spec.md`.

## Consequences

- El conocimiento del proyecto queda versionado, revisable y con fuente, y sobrevive a las sesiones y a los cambios de agente.
- Cada archivado tiene un paso más: la resincronización del wiki, con su propio commit.
- La guía y el recordatorio ocupan contexto en cada sesión y en cada mensaje, así que tienen límites de tamaño.
- El cumplimiento depende del modelo: la suite verifica que recibe el flujo, no que lo siga.
- Sin hub, el conocimiento general se queda en el proyecto que lo investigó. Llevarlo a otro proyecto exige un checkpoint.
- Usar el hub en sesiones en la nube y vigilar el wiki en CI quedan para decisiones futuras.
