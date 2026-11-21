---
title: "El flujo wiki-first"
category: topic
sources:
  - raw/repos/2026-11-21-idd-1cf0792.md
  - raw/repos/2026-11-21-idd-f2be907-readme.md
created: 2026-11-21
updated: 2026-11-21
verified: 2026-11-21
tags: [llm-wiki, wiki-first, adr, spec]
confidence: high
volatility: warm
summary: "Por qué la plantilla guarda su conocimiento en un wiki que el agente consulta primero, con dos ámbitos, los productos del proyecto como fuentes fijadas y la resincronización al archivar. Sintetizado de ADR-0004, ADR-0005, las specs llm-wiki y wiki-first-knowledge, la guía y las indicaciones de archivado."
---

# El flujo wiki-first

> El conocimiento que no cabe en specs ni ADRs vive en un wiki que el agente consulta antes de responder con su conocimiento interno. Todo lo de esta página sale de los archivos citados, fijados en `idd@1cf0792` (el README, en `idd@f2be907`).

## Por qué

`idd@1cf0792:adr/0004-wiki-first-project-knowledge.md`:

- El conocimiento de los proyectos (dominio, fuentes externas, comprobaciones, lecciones) se perdía entre sesiones o quedaba en la memoria del modelo, sin fuente ni revisión.
- El motor de referencia, nvk/llm-wiki, solo consulta el wiki si el modelo decide cargar su skill, y si no encuentra nada responde de memoria sin preguntar. Instalarlo sin más no basta.
- **El concepto es independiente del motor**: el motor aporta las operaciones y la plantilla define cómo se usan.

## Dos ámbitos

- **El wiki del proyecto**, en `.wiki/`, versionado. Git no debe ignorar ninguno de sus archivos, tampoco cuando el motor lo añade al `.gitignore` (`idd@1cf0792:openspec/specs/llm-wiki/spec.md`).
- **El hub del usuario**, opcional. Su ausencia, por ejemplo en la nube, no produce avisos. Del hub al proyecto se pasa incorporándolo o con un checkpoint, nunca copiando artículos a mano (ADR-0004 y `idd@1cf0792:openspec/specs/wiki-first-knowledge/spec.md`).

## El flujo

Lo fija la spec `wiki-first-knowledge` y lo entrega `idd@1cf0792:.agents/wiki/guide.md`, que tiene una sección identificada por cada parte:

1. **Discernir**: requieren conocimiento las peticiones sobre el dominio, las decisiones técnicas, las herramientas o los hechos externos; no lo requieren las operaciones sobre el código que no dependen de él.
2. **Consultar primero**, en solo lectura: el wiki del proyecto y después el hub.
3. **Ante un hueco, preguntar**: responder con conocimiento interno diciendo su origen, investigar y registrar, o nada más.
4. **Registrar en el ámbito correcto**, y preguntar si no está claro cuál toca.
5. **Proponer registrar lo descubierto** que servirá en otra ocasión: lo comprobado, con las lecciones aprendidas; lo encontrado en internet, ingiriendo la fuente.
6. **Los productos del proyecto son fuentes**: specs, ADRs y código, fijados a un commit sin copiar su contenido. Los artículos citan la versión exacta, y al crear el wiki se hace una ingesta inicial sin lo generado.

La plantilla garantiza que el agente **recibe** el flujo, no que lo siga (ADR-0004): una guía por sesión, breve porque ocupa contexto, y un recordatorio por mensaje de 600 caracteres como máximo (`idd@1cf0792:openspec/specs/wiki-first-knowledge/spec.md`). La suite exige además que la guía entregada tenga menos de 6.000 caracteres (`idd@1cf0792:acceptance-tests/step-definitions/wiki.steps.js`). Los entrega el arranque de sesión (ver [El arranque de sesión](arranque-de-sesion.md)).

## Al archivar un change

Las indicaciones de archivado (`idd@1cf0792:openspec/config.yaml`, `operations.archive.guidance`) resincronizan el wiki con lo que tocó el change, en siete pasos:

1. fijar sus fuentes en el commit del archivado (`/wiki:ingest-collection … --manifest-only`);
2. refrescar y compilar;
3. revisar con el librarian sin modificar;
4. extraer lecciones sin escribir;
5. escribir solo lo que confirme el usuario;
6. pasar el lint hasta dejarlo limpio;
7. hacer un commit aparte, posterior al del archivado.

Lo que cambia fuera de un change no lo recoge este paso.

## El motor

`idd@1cf0792:adr/0005-wiki-engine-through-session-bootstrap.md`:

- **La versión** se fija en `.agents/wiki/engine.json`.
- **La copia** se descarga una sola vez en `.agents/wiki-engine/` y se expone por symlinks: `wiki-manager` en `.claude/skills/` para los dos agentes, `/wiki:*` en `.claude/commands/wiki/` para Claude Code y `wiki-query` en `.opencode/skills/` para OpenCode.
- **La desactivación en local** es `PROJECT_WIKI=off`.
- **Según el ADR**, Claude Code pedirá permiso la primera vez que se ejecute el helper del motor. En la prueba real no se vio, porque el helper estaba autorizado de antemano con `--allowedTools Bash` (`idd@1cf0792:openspec/changes/archive/2026-11-21-add-llm-wiki-support/tasks.md`, tarea 8.3).

## See Also

- [El arranque de sesión](arranque-de-sesion.md)
- [Qué carga cada agente y cuándo](carga-en-la-misma-sesion-por-agente.md)
- [Una sola copia de las skills](../concepts/una-sola-copia-de-las-skills.md)

## Sources

- [Collection: repositorio de la plantilla intent-driven](../../raw/repos/2026-11-21-idd-1cf0792.md): `adr/0004-wiki-first-project-knowledge.md`, `adr/0005-wiki-engine-through-session-bootstrap.md`, `openspec/specs/llm-wiki/spec.md`, `openspec/specs/wiki-first-knowledge/spec.md`, `.agents/wiki/guide.md`, `.agents/wiki/reminder.md`, `openspec/config.yaml`, `acceptance-tests/step-definitions/wiki.steps.js`, `openspec/changes/archive/2026-11-21-add-llm-wiki-support/tasks.md`.
- [Collection: README de la plantilla tras el archivado](../../raw/repos/2026-11-21-idd-f2be907-readme.md): `README.md`.
