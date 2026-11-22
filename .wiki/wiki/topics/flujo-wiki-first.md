---
title: "El flujo wiki-first"
category: topic
sources:
  - raw/notes/2026-11-22-ll-fusion-wiki-contadores.md
  - raw/notes/2026-11-22-ll-fusion-wiki-lecciones-equivalentes.md
  - raw/notes/2026-11-22-ll-git-discipline-standard-with-exception.md
  - raw/repos/2026-11-22-idd-e9fced1-git-discipline-standard-with-exception.md
  - raw/repos/2026-11-22-idd-cac0041-allow-user-requested-merges.md
  - raw/repos/2026-11-22-idd-5d7f5b0-manage-git-discipline.md
  - raw/repos/2026-11-21-idd-1cf0792.md
  - raw/repos/2026-11-21-idd-f2be907-readme.md
  - raw/repos/2026-11-21-idd-b48392d-fix-wiki-flow-operations.md
  - raw/notes/2026-11-21-ll-archivado-fix-wiki-flow-operations.md
  - raw/repos/2026-11-21-idd-772d0f0-add-openspec-autopilot.md
  - raw/notes/2026-11-22-ll-guidance-de-archive-no-salta-preguntas.md
  - raw/articles/2026-11-22-openspec-docs-cli-archive.md
  - raw/articles/2026-11-22-openspec-docs-opsx-sync.md
  - raw/articles/2026-11-22-openspec-docs-commands-sync-archive.md
created: 2026-11-21
updated: 2026-11-22
verified: 2026-11-21
tags: [llm-wiki, wiki-first, adr, spec]
confidence: high
volatility: warm
summary: "Por qué la plantilla guarda su conocimiento en un wiki que el agente consulta primero, con dos ámbitos, la consulta en solo lectura separada de la escritura con confirmación, las lecciones propuestas en un punto de cierre, los productos del proyecto como fuentes fijadas y la resincronización al archivar. Sintetizado de ADR-0004, ADR-0005, ADR-0009, las specs llm-wiki y wiki-first-knowledge, la guía y las indicaciones de archivado."
---

# El flujo wiki-first

> El conocimiento que no cabe en specs ni ADRs vive en un wiki que el agente consulta antes de responder con su conocimiento interno. Todo lo de esta página sale de los archivos citados, fijados en `idd@1cf0792` (el README, en `idd@f2be907`; lo que cambió `fix-wiki-flow-operations`, en `idd@b48392d`).

## Por qué

`idd@1cf0792:adr/0004-wiki-first-project-knowledge.md`:

- El conocimiento de los proyectos (dominio, fuentes externas, comprobaciones, lecciones) se perdía entre sesiones o quedaba en la memoria del modelo, sin fuente ni revisión.
- El motor de referencia, nvk/llm-wiki, solo consulta el wiki si el modelo decide cargar su skill, y si no encuentra nada responde de memoria sin preguntar. Instalarlo sin más no basta.
- **El concepto es independiente del motor**: el motor aporta las operaciones y la plantilla define cómo se usan.

`idd@b48392d:adr/0009-wiki-read-and-write-operations.md` complementa a ADR-0004 sin sustituirlo: la guía no decía con qué operación consultar, y en Claude Code el agente acababa usando `wiki-manager`, que modifica el wiki; y el recordatorio proponía las lecciones aprendidas en cada hallazgo, aunque `ll` recorre la sesión entera y está pensada para pasarse una vez.

## Dos ámbitos

- **El wiki del proyecto**, en `.wiki/`, versionado. Git no debe ignorar ninguno de sus archivos, tampoco cuando el motor lo añade al `.gitignore` (`idd@1cf0792:openspec/specs/llm-wiki/spec.md`).
- **El hub del usuario**, opcional. Su ausencia, por ejemplo en la nube, no produce avisos. Del hub al proyecto se pasa incorporándolo o con un checkpoint, nunca copiando artículos a mano (ADR-0004 y `idd@1cf0792:openspec/specs/wiki-first-knowledge/spec.md`).

## El flujo

Lo fija la spec `wiki-first-knowledge` y lo entrega `idd@b48392d:.agents/wiki/guide.md`, que tiene una sección identificada por cada parte:

1. **Discernir**: requieren conocimiento las peticiones sobre el dominio, las decisiones técnicas, las herramientas o los hechos externos; no lo requieren las operaciones sobre el código que no dependen de él.
2. **Consultar primero**, en solo lectura: el wiki del proyecto y después el hub. Se consulta con la operación de lectura del motor de cada agente: `/wiki:query --local` en Claude Code y la skill `wiki-query` en OpenCode (`idd@b48392d:openspec/specs/wiki-first-knowledge/spec.md`).
3. **Ante un hueco, preguntar**: responder con conocimiento interno diciendo su origen, investigar y registrar, o nada más.
4. **Registrar en el ámbito correcto**, y preguntar si no está claro cuál toca.
5. **Modificar el wiki solo con su operación de escritura**: `wiki-manager` o `/wiki:*`, solo cuando el usuario confirma lo que el agente propone, y nunca para consultar.
6. **Proponer registrar lo descubierto** que servirá en otra ocasión. Lo comprobado se apunta en la conversación como lección candidata, sin escribir nada, y se propone registrar una sola vez, en dry-run, en un punto de cierre: el final de una tarea, antes de un commit, cuando el usuario da la sesión por terminada o el archive de un change. Lo encontrado en internet se propone ingerir en el momento, para conservar su procedencia.
7. **Los productos del proyecto son fuentes**: specs, ADRs y código, fijados a un commit sin copiar su contenido. Los artículos citan la versión exacta, y al crear el wiki se hace una ingesta inicial sin lo generado. Si el commit de una cita no está en el clon o en la rama de origen (por ejemplo, tras un squash), se toma el blob de esa ruta en el manifiesto citado y se resuelve con `git cat-file -p <blob>` o `git log --all --find-object=<blob>`; la cita no está rota (`idd@5d7f5b0:.agents/wiki/guide.md`).

La plantilla garantiza que el agente **recibe** el flujo, no que lo siga (ADR-0004): una guía por sesión, breve porque ocupa contexto, y un recordatorio por mensaje de 600 caracteres como máximo (`idd@1cf0792:openspec/specs/wiki-first-knowledge/spec.md`). El recordatorio nombra la consulta de solo lectura y la ingesta como se invocan en cada agente y recuerda apuntar las lecciones candidatas, pero no nombra las lecciones aprendidas, que se proponen en un punto de cierre (`idd@b48392d:.agents/wiki/reminder.md`). El arranque rellena los marcadores de operación de la guía y del recordatorio según el agente. La suite exige además que la guía entregada tenga menos de 6.000 caracteres (`idd@1cf0792:acceptance-tests/step-definitions/wiki.steps.js`). Los entrega el arranque de sesión (ver [[arranque-de-sesion|El arranque de sesión]] ([El arranque de sesión](arranque-de-sesion.md))).

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

Desde `add-openspec-autopilot` (`idd@772d0f0:openspec/config.yaml`):

- la resincronización se hace en la rama donde se archiva, después del commit del archivado: según la regla, la rama de origen; con la única excepción (`x-main-protected: true`), la rama temporal del change, antes de fusionarla (ADR-0020, que sustituye a ADR-0015 y ADR-0013; `idd@e9fced13c91f96140ab9058110551d9ea29db385:openspec/config.yaml`);
- las rutas que tocó el change salen del diff entre el merge-base de la rama con la rama de origen y el commit del archivado, más sus specs y sus ADRs; si se archiva en la rama de origen, del diff desde el primer padre del commit que trajo su `proposal.md` a esa rama hasta el commit del archivado;
- las lecciones del paso 4 parten de las lecciones candidatas que haya recibido la sesión de las sesiones del change (en OpenCode, de su metadata) y, si no hay, de la sesión en curso;
- desde `allow-user-requested-merges`, un paso 8: tras el commit del wiki, el agente propone fusionar la rama del change con cada rama de `x-main`, en el orden de la lista, solo con las que da `branch-change.mjs merge-targets`; el usuario puede saltarse cualquiera, y en un contenedor efímero la fusión con una rama permanente se hace por PR (ADR-0016; `idd@cac00417c033f58d9a3298d4c7ff7e16f563f570:openspec/config.yaml`).

- **Antes de mover el change**, revisa los enlaces relativos de sus artefactos que salen del change: el archive lo baja un nivel y necesitan un `../` más. Citar por la ruta desde la raíz del repositorio lo evita ([lecciones del archivado de fix-wiki-flow-operations](../../raw/notes/2026-11-21-ll-archivado-fix-wiki-flow-operations.md), lección 1).
- **Las rutas que tocó el change** salen de sus propios commits si la rama lleva más de un change; el diff de la rama contra `main` mezcla los de ambos. Con la excepción de ADR-0020 una rama temporal lleva un solo change, y el plugin no actúa en una rama con varios ([lecciones del archivado de fix-wiki-flow-operations](../../raw/notes/2026-11-21-ll-archivado-fix-wiki-flow-operations.md), lección 2).
- **La guidance de archivado solo añade pasos**: el workflow de archive no le deja saltarse su pregunta sobre el sync de specs ni cambiar sus flags, así que no puede forzar el sync (`idd@a62cf14:.claude/skills/openspec-archive-change/SKILL.md`). Con deltas aplicables se sincroniza siempre; archivar sin sincronizar es para changes sin cambios de comportamiento, mejor declarados con `skip_specs: true` en su `.openspec.yaml`, o para syncs bloqueados ([lecciones sobre la guidance de archivado](../../raw/notes/2026-11-22-ll-guidance-de-archive-no-salta-preguntas.md); [docs/cli.md de OpenSpec](../../raw/articles/2026-11-22-openspec-docs-cli-archive.md); si las specs ya se sincronizaron con `/opsx:sync`, el archive ofrece archivar sin más: [docs/opsx.md](../../raw/articles/2026-11-22-openspec-docs-opsx-sync.md), [docs/commands.md](../../raw/articles/2026-11-22-openspec-docs-commands-sync-archive.md)).
- **`openspec archive --yes` no avisa de tasks pendientes**: la advertencia la da el workflow, que cuenta las tasks con `openspec list --json`. Compruébalas antes de usar la CLI con `--yes` ([lecciones de git-discipline-standard-with-exception](../../raw/notes/2026-11-22-ll-git-discipline-standard-with-exception.md), lección 3).
- **Al resolver una fusión con conflictos en el wiki**, busca antes en el lado que llega lecciones equivalentes a las propias: dos changes concurrentes pueden registrar lo mismo. Conserva una sola viñeta, cita las dos notas y quédate con la versión mejor comprobada ([lecciones de la fusión en el wiki](../../raw/notes/2026-11-22-ll-fusion-wiki-lecciones-equivalentes.md), lección 1).
- **Los contadores del wiki en una fusión**: si chocan las estadísticas de `.wiki/_index.md` o `inventory/_index.md`, no elijas un lado: cuéntalas sobre el disco tras la fusión, y los activos del inventario por su `status:`. En las dos fusiones de `windows-support` con `main`, ningún lado acertaba, y el lint del motor no compara esos contadores con el disco ([lección de los contadores en una fusión](../../raw/notes/2026-11-22-ll-fusion-wiki-contadores.md), lección 1).

## El motor

`idd@1cf0792:adr/0005-wiki-engine-through-session-bootstrap.md`:

- **La versión** se fija en `.agents/wiki/engine.json`.
- **La copia** se descarga una sola vez en `.agents/wiki-engine/` y se expone por symlinks: `wiki-manager` en `.claude/skills/` para los dos agentes, `/wiki:*` en `.claude/commands/wiki/` para Claude Code y `wiki-query` en `.opencode/skills/` para OpenCode.
- **La desactivación en local** es `PROJECT_WIKI=off`.
- **Según el ADR**, Claude Code pedirá permiso la primera vez que se ejecute el helper del motor. En la prueba real no se vio, porque el helper estaba autorizado de antemano con `--allowedTools Bash` (`idd@1cf0792:openspec/changes/archive/2026-11-21-add-llm-wiki-support/tasks.md`, tarea 8.3).

## See Also

- [[arranque-de-sesion|El arranque de sesión]] ([El arranque de sesión](arranque-de-sesion.md))
- [[carga-en-la-misma-sesion-por-agente|Qué carga cada agente y cuándo]] ([Qué carga cada agente y cuándo](carga-en-la-misma-sesion-por-agente.md))
- [[una-sola-copia-de-las-skills|Una sola copia de las skills]] ([Una sola copia de las skills](../concepts/una-sola-copia-de-las-skills.md))
- [[ciclo-de-un-change-y-autopilot|El ciclo de un change y su automatización en OpenCode]] ([El ciclo de un change y su automatización en OpenCode](ciclo-de-un-change-y-autopilot.md))
- [[regla-de-comentarios|La regla de comentarios]] ([La regla de comentarios](../concepts/regla-de-comentarios.md))

## Sources

- [Lessons Learned: lecciones equivalentes al resolver una fusión en el wiki](../../raw/notes/2026-11-22-ll-fusion-wiki-lecciones-equivalentes.md): lección 1.
- [Lessons Learned: los contadores del wiki al resolver una fusión](../../raw/notes/2026-11-22-ll-fusion-wiki-contadores.md): lección 1.
- [Lessons Learned: git-discipline-standard-with-exception](../../raw/notes/2026-11-22-ll-git-discipline-standard-with-exception.md): lección 3.
- [Collection: archivado de git-discipline-standard-with-exception (idd@e9fced1)](../../raw/repos/2026-11-22-idd-e9fced1-git-discipline-standard-with-exception.md): `openspec/config.yaml`.
- [Collection: archivado de allow-user-requested-merges (idd@cac0041)](../../raw/repos/2026-11-22-idd-cac0041-allow-user-requested-merges.md): `openspec/config.yaml`.
- [Collection: repositorio de la plantilla intent-driven](../../raw/repos/2026-11-21-idd-1cf0792.md): `adr/0004-wiki-first-project-knowledge.md`, `adr/0005-wiki-engine-through-session-bootstrap.md`, `openspec/specs/llm-wiki/spec.md`, `openspec/specs/wiki-first-knowledge/spec.md`, `.agents/wiki/guide.md`, `.agents/wiki/reminder.md`, `openspec/config.yaml`, `acceptance-tests/step-definitions/wiki.steps.js`, `openspec/changes/archive/2026-11-21-add-llm-wiki-support/tasks.md`.
- [Lecciones del archivado de fix-wiki-flow-operations](../../raw/notes/2026-11-21-ll-archivado-fix-wiki-flow-operations.md): enlaces relativos al archivar y rutas que tocó un change.
- [Collection: README de la plantilla tras el archivado](../../raw/repos/2026-11-21-idd-f2be907-readme.md): `README.md`.
- [Collection: archivado de add-openspec-autopilot (idd@772d0f0)](../../raw/repos/2026-11-21-idd-772d0f0-add-openspec-autopilot.md): `openspec/config.yaml`.
- [Collection: archivado de fix-wiki-flow-operations](../../raw/repos/2026-11-21-idd-b48392d-fix-wiki-flow-operations.md): `adr/0009-wiki-read-and-write-operations.md`, `openspec/specs/wiki-first-knowledge/spec.md`, `.agents/wiki/guide.md`, `.agents/wiki/reminder.md`.
- [Collection: archivado de manage-git-discipline (idd@5d7f5b0)](../../raw/repos/2026-11-22-idd-5d7f5b0-manage-git-discipline.md): `.agents/wiki/guide.md`, `openspec/config.yaml`, `openspec/specs/wiki-first-knowledge/spec.md`.
- [Lecciones sobre la guidance de archivado](../../raw/notes/2026-11-22-ll-guidance-de-archive-no-salta-preguntas.md): la guidance no salta las preguntas del archive y cuándo archivar sin sincronizar.
- [OpenSpec docs/cli.md (2.1.1)](../../raw/articles/2026-11-22-openspec-docs-cli-archive.md): `--skip-specs` y `skip_specs: true`.
- [OpenSpec docs/opsx.md (2.1.1)](../../raw/articles/2026-11-22-openspec-docs-opsx-sync.md) y [docs/commands.md (2.1.1)](../../raw/articles/2026-11-22-openspec-docs-commands-sync-archive.md): `/opsx:sync` es opcional y el archive pregunta si sincronizar.
