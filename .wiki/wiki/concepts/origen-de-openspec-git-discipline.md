---
title: "openspec-git-discipline: una regla heredada sin justificación registrada"
category: concept
sources:
  - raw/repos/2026-11-22-idd-e9fced1-git-discipline-standard-with-exception.md
  - raw/notes/2026-11-22-usuario-por-que-la-spec-en-la-rama-de-origen.md
  - raw/notes/2026-11-22-ll-conflictos-entre-deltas-concurrentes.md
  - raw/repos/2026-11-22-idd-5d7f5b0-manage-git-discipline.md
  - raw/repos/2026-11-22-idd-6d6e79c-autopilot-sesion-operativa.md
  - raw/repos/2026-11-21-intent-driven-template-a8b8231-git-discipline.md
  - raw/repos/2026-11-21-skills-04cd70e-git-discipline.md
  - raw/repos/2026-11-21-idd-2e89fa3-git-discipline.md
  - raw/repos/2026-11-21-idd-c59392a-adr-0007.md
  - raw/articles/2026-11-21-issue-11-git-discipline-main-protegida.md
  - raw/notes/2026-11-21-ll-archivado-fix-wiki-flow-operations.md
  - raw/repos/2026-11-21-idd-772d0f0-add-openspec-autopilot.md
created: 2026-11-21
updated: 2026-11-22
verified: 2026-11-22
tags: [openspec, openspec-git-discipline, git, procedencia, skills]
confidence: high
volatility: warm
summary: "La skill openspec-git-discipline exige cruzar main dos veces por change (la propuesta antes de apply y la implementación antes de archive) y archivar desde main. Ni este proyecto ni su origen registran por qué; la única discusión es la issue 11 del origen, abierta y sin respuesta. ADR-0007 sustituye esas puertas en este proyecto, y la copia de la skill se reescribió con ellas en add-openspec-autopilot; ADR-0013, que sustituye a ADR-0007 en manage-git-discipline, vuelve a admitir la forma canónica junto a la recomendada. ADR-0020 la deja como regla, con la forma de una rama como única excepción cuando el acceso directo a las ramas permanentes está vetado (x-main-protected). El usuario propone, con confianza baja, que el motivo es que la spec no choca entre desarrollos concurrentes y el código sí, con objeciones abiertas."
---

# openspec-git-discipline: una regla heredada sin justificación registrada

> La disciplina de git de OpenSpec que hereda este proyecto es una copia literal de la del origen, y en ningún sitio consta por qué es así. La única discusión sobre ella es una crítica abierta y sin respuesta. ADR-0007 la sustituye aquí sin haber encontrado tampoco el motivo. Todo lo de esta página sale de las fuentes citadas, comprobado el 2026-11-21.

## Qué exige

`intent-driven-template@a8b8231:.agents/skills/openspec-git-discipline/SKILL.md`:

- **Regla central**: cada cambio de estado de OpenSpec cruza `main` antes de que la siguiente fase dependa de él.
- **Primer cruce**: la propuesta puede redactarse en una rama, pero se fusiona con `main` antes de empezar apply. Apply puede correr luego en `main`, en una rama o en un worktree.
- **Segundo cruce y archive**: archive solo corre desde `main`, después de fusionar la implementación. "Verify hace un change apto para fusionarse; no sustituye la fusión."
- **El agente no hace commits, ramas ni fusiones** sin que el usuario lo pida.

## De dónde viene

- **Nace sin justificación** en `intent-driven-template@a8b8231`, un commit de 43 archivos cuyo mensaje es solo "Add OpenSpec workflow commands and agent skills". El `AGENTS.md` del mismo commit la activa enunciando la regla, no su motivo ([manifiesto](../../raw/repos/2026-11-21-intent-driven-template-a8b8231-git-discipline.md)).
- **Se copia tal cual** a `skills@04cd70e`, "copied from intent-driven-template" según el mensaje del commit ([manifiesto](../../raw/repos/2026-11-21-skills-04cd70e-git-discipline.md)).
- **Llega igual a este proyecto**: el blob `835e065` es el mismo en los tres repositorios, y no ha cambiado en ninguno ([manifiesto](../../raw/repos/2026-11-21-idd-2e89fa3-git-discipline.md)).

## Nadie registra por qué

- **En el origen**: en todo el historial de los dos repositorios, la skill solo aparece en archivos que repiten la regla (`SKILL.md`, `AGENTS.md`, `README.md`, `INSTALL_TEMPLATE.md`, `openspec-bulk-apply-change`). Ningún mensaje de commit da el motivo.
- **En este proyecto**: hasta `idd@2e89fa3` ningún ADR la mencionaba (`adr/0001` a `adr/0005`), y el primer manifiesto del wiki la excluyó por ser copia de otro repositorio. El primer ADR que la trata, ADR-0007, constata la misma falta de motivo en su contexto; no la suple (ver abajo).
- **La única discusión** es [intent-driven-dev/intent-driven-template#11](https://github.com/intent-driven-dev/intent-driven-template/issues/11) ([fuente](../../raw/articles/2026-11-21-issue-11-git-discipline-main-protegida.md)). Su autor sostiene que, con un `main` protegido, la regla obliga a 13 pasos y tres PR por change (propuesta, implementación y archive), y que choca con gitflow y con el desarrollo por PR. La abrió el 2026-11-07 y el 2026-11-21 sigue sin comentarios ni PR enlazadas: no hay respuesta que dé el motivo.

## Qué hace este proyecto con ella

- **La propuesta** (`idd@2e89fa3:openspec/changes/add-openspec-autopilot/proposal.md`, del change ya archivado: `idd@772d0f0:openspec/changes/archive/2026-11-21-add-openspec-autopilot/proposal.md`, mismo blob) recoge la falta de justificación como parte del problema, cita la issue 11 y propone una rama y una sola fusión por change.
- **ADR-0007 lo decide** (`idd@c59392a:adr/0007-single-branch-change-lifecycle.md`, aceptado):
  - Un change, una rama temporal y una sola fusión: propuesta, implementación, archive y resincronización del wiki se hacen en la rama, y el archive nunca en una rama permanente.
  - Las ramas permanentes se configuran con `x-main` en `openspec/config.yaml` (por defecto `["main"]`), y el change de cada rama temporal se lee de git desde su merge-base.
  - En la práctica, la rama del archivado de `fix-wiki-flow-operations` llevaba también `add-openspec-autopilot`: leer el change desde el merge-base solo basta con un change por rama ([lecciones del archivado de fix-wiki-flow-operations](../../raw/notes/2026-11-21-ll-archivado-fix-wiki-flow-operations.md), lección 2).
  - Los commits y las fusiones los sigue haciendo el usuario.
  - Descarta mantener las puertas heredadas, añadir una skill propia junto a la heredada, retirarla sin sustituto y registrar el change de cada rama en un archivo.
  - Asume el riesgo de que la propuesta ya no se revise ni se fusione por separado, y deja abierta la vuelta de la fusión intermedia.
- **La copia de la skill está reescrita** con esas puertas, con el mismo nombre y la misma descripción de activación, divergiendo del origen a propósito (`idd@772d0f0:.agents/skills/openspec-git-discipline/SKILL.md`, blob `6cd1ad0`, ya distinto del `835e065` del origen). Las puertas ya no las decide el modelo leyendo git: la skill manda ejecutar `node .agents/openspec/branch-change.mjs check <propose|apply|archive>` y obedecer su salida, y enumera como señales de alarma exigir la propuesta en la rama de origen antes del apply y archivar en una rama permanente. Un comentario al principio avisa de que no se sobrescriba al actualizar desde `intent-driven-template` sin revisarla (ADR-0007). Ver [[ciclo-de-un-change-y-autopilot|El ciclo de un change y su automatización en OpenCode]] ([El ciclo de un change y su automatización en OpenCode](../topics/ciclo-de-un-change-y-autopilot.md)).

- **ADR-0013 sustituye a ADR-0007** (`idd@6d6e79c:adr/0012-model-creates-change-branches-plugin-stages.md`): mantiene el ciclo de una rama y una fusión, pero el modelo ya puede crear la rama del change (siempre desde la rama de origen y con su nombre) y cambiar de rama temporal con `branch-change.mjs list | start | switch`, y en el autopilot no pide commits porque el plugin prepara el stage. La copia de la skill se reescribió otra vez con esas reglas (`idd@6d6e79c:.agents/skills/openspec-git-discipline/SKILL.md`).
- **ADR-0015 sustituye a ADR-0007** (`idd@5d7f5b0:adr/0013-git-discipline-two-forms-and-ephemeral-commits.md`, en `manage-git-discipline`): la forma de una rama pasa a ser la recomendada, con `--no-ff`, y la forma canónica heredada vuelve a admitirse junto a ella, sin tratarla como una infracción. El motivo registrado es práctico: el agente conocía la canónica y cuestionaba la del proyecto. Sigue sin constar por qué el origen exige sus dos cruces de `main`. Al fusionar con `main` se renumeró a ADR-0015, porque `autopilot-sesion-operativa` ya había ocupado el 0013 y el 0014; en un contenedor efímero, el agente no usa las ramas que crea el modelo según ADR-0013 y trabaja solo en la rama de la sesión.

- **ADR-0020 sustituye a ADR-0015 y ADR-0013** (`idd@e9fced13c91f96140ab9058110551d9ea29db385:adr/0020-git-discipline-standard-rule-with-protected-main-exception.md`, en `git-discipline-standard-with-exception`): la regla vuelve a ser la de la skill estándar del origen, y nada de lo que permite se detiene ni lleva avisos. La forma de una rama pasa a ser la única excepción, con una causa: el acceso directo a las ramas permanentes está vetado, y la regla exige archivar en la rama de origen. Se declara con `x-main-protected: true` en `openspec/config.yaml`, y las puertas la leen de ahí (`idd@e9fced13c91f96140ab9058110551d9ea29db385:.agents/openspec/branch-change.mjs`). La copia de la skill se reescribió sobre el texto de la estándar traducido, con la excepción en una sección propia (`idd@e9fced13c91f96140ab9058110551d9ea29db385:.agents/skills/openspec-git-discipline/SKILL.md`). Este repositorio declara la clave, y los proyectos creados desde la plantilla la heredan.

## Lo que no se sabe

- **El motivo original.** Puede que exista fuera de los repositorios (conversaciones, otra documentación), pero no consta en ninguna fuente revisada.
  - **Una hipótesis del usuario, con confianza baja** ([opinión del usuario, 2026-11-22](../../raw/notes/2026-11-22-usuario-por-que-la-spec-en-la-rama-de-origen.md)). No viene del origen; el usuario pidió registrarla como autoridad, aunque sea de baja calidad. Sostiene esto:
    - La spec puede ir directamente a la rama de origen porque, salvo por los números de ADR, no choca entre desarrollos concurrentes.
    - El código sí choca, y por eso el apply va en rama cuando hay desarrollos en paralelo.
    - Eso solo vale con una única rama permanente o con ramas permanentes que se fusionan entre sí.
    - Los proyectos creados desde la plantilla no lo garantizan, así que la plantilla mantiene las dos formas del ciclo (ADR-0015).
  - **Objeciones abiertas, de la misma conversación:**
    - La spec también choca: dos deltas sobre la misma capability, y en un caso sin que nada lo detecte en la rama de origen ([[conflictos-entre-deltas-concurrentes|Conflictos entre deltas de changes concurrentes]] ([Conflictos entre deltas de changes concurrentes](conflictos-entre-deltas-concurrentes.md))).
    - Con los ADR pasa lo contrario: escribirlos en la rama de origen reserva su número.
    - Unas ramas permanentes que no se fusionan entre sí afectan igual a la forma recomendada, que también fusiona solo con la rama de origen. El usuario mantuvo su conclusión sin responder a esta objeción.
- **El estado de la issue después del 2026-11-21.** Es una fuente viva: puede recibir respuesta o cerrarse.

## See Also

- [[conflictos-entre-deltas-concurrentes|Conflictos entre deltas de changes concurrentes]] ([Conflictos entre deltas de changes concurrentes](conflictos-entre-deltas-concurrentes.md))
- [[una-sola-copia-de-las-skills|Una sola copia de las skills, vista por cada agente]] ([Una sola copia de las skills, vista por cada agente](una-sola-copia-de-las-skills.md))
- [[ciclo-de-un-change-y-autopilot|El ciclo de un change y su automatización en OpenCode]] ([El ciclo de un change y su automatización en OpenCode](../topics/ciclo-de-un-change-y-autopilot.md))

## Sources

- [Collection: archivado de git-discipline-standard-with-exception (idd@e9fced1)](../../raw/repos/2026-11-22-idd-e9fced1-git-discipline-standard-with-exception.md): `adr/0020-git-discipline-standard-rule-with-protected-main-exception.md`, `.agents/skills/openspec-git-discipline/SKILL.md`, `.agents/openspec/branch-change.mjs`.
- [Opinión del usuario: la spec en la rama de origen y las dos formas del ciclo](../../raw/notes/2026-11-22-usuario-por-que-la-spec-en-la-rama-de-origen.md): hipótesis sobre el motivo.
- [Lessons Learned: conflictos entre deltas de changes concurrentes](../../raw/notes/2026-11-22-ll-conflictos-entre-deltas-concurrentes.md): lecciones 2 y 3, en las objeciones.
- [Collection: archivado de autopilot-sesion-operativa (idd@6d6e79c)](../../raw/repos/2026-11-22-idd-6d6e79c-autopilot-sesion-operativa.md): `adr/0013-model-creates-change-branches-plugin-stages.md`, `.agents/skills/openspec-git-discipline/SKILL.md`, `.agents/openspec/branch-change.mjs`.

- [Collection: archivado de add-openspec-autopilot (idd@772d0f0)](../../raw/repos/2026-11-21-idd-772d0f0-add-openspec-autopilot.md): `.agents/skills/openspec-git-discipline/SKILL.md`, `.agents/openspec/branch-change.mjs`.
- [Lecciones del archivado de fix-wiki-flow-operations](../../raw/notes/2026-11-21-ll-archivado-fix-wiki-flow-operations.md): una rama con dos changes.
- [Collection: openspec-git-discipline en su origen (intent-driven-template@a8b8231)](../../raw/repos/2026-11-21-intent-driven-template-a8b8231-git-discipline.md): `.agents/skills/openspec-git-discipline/SKILL.md`, `AGENTS.md`.
- [Collection: openspec-git-discipline copiada a intent-driven-dev/skills@04cd70e](../../raw/repos/2026-11-21-skills-04cd70e-git-discipline.md): `.agents/skills/openspec-git-discipline/SKILL.md`.
- [Collection: openspec-git-discipline en este proyecto (idd@2e89fa3)](../../raw/repos/2026-11-21-idd-2e89fa3-git-discipline.md): `.agents/skills/openspec-git-discipline/SKILL.md`, `openspec/changes/add-openspec-autopilot/proposal.md`.
- [Collection: ADR-0007, el ciclo de un change en una rama (idd@c59392a)](../../raw/repos/2026-11-21-idd-c59392a-adr-0007.md): `adr/0007-single-branch-change-lifecycle.md`.
- [openspec-git-discipline behaves poorly when developing with a protected main branch](../../raw/articles/2026-11-21-issue-11-git-discipline-main-protegida.md): intent-driven-dev/intent-driven-template#11.
- [Collection: archivado de manage-git-discipline (idd@5d7f5b0)](../../raw/repos/2026-11-22-idd-5d7f5b0-manage-git-discipline.md): `adr/0013-git-discipline-two-forms-and-ephemeral-commits.md`, `.agents/skills/openspec-git-discipline/SKILL.md`.
