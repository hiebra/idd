---
title: "openspec-git-discipline: una regla heredada sin justificación registrada"
category: concept
sources:
  - raw/repos/2026-11-21-intent-driven-template-a8b8231-git-discipline.md
  - raw/repos/2026-11-21-skills-04cd70e-git-discipline.md
  - raw/repos/2026-11-21-idd-2e89fa3-git-discipline.md
  - raw/articles/2026-11-21-issue-11-git-discipline-main-protegida.md
created: 2026-11-21
updated: 2026-11-21
verified: 2026-11-21
tags: [openspec, openspec-git-discipline, git, procedencia, skills]
confidence: high
volatility: warm
summary: "La skill openspec-git-discipline exige cruzar main dos veces por change (la propuesta antes de apply y la implementación antes de archive) y archivar desde main. Ni este proyecto ni su origen registran por qué; la única discusión es la issue 11 del origen, abierta y sin respuesta."
---

# openspec-git-discipline: una regla heredada sin justificación registrada

> La disciplina de git de OpenSpec que usa este proyecto es una copia literal de la del origen, y en ningún sitio consta por qué es así. La única discusión sobre ella es una crítica abierta y sin respuesta. Todo lo de esta página sale de las fuentes citadas, comprobado el 2026-11-21.

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
- **En este proyecto**: ningún ADR la menciona (`adr/0001` a `adr/0005` en `idd@2e89fa3`). El primer manifiesto del wiki la excluyó por ser copia de otro repositorio.
- **La única discusión** es [intent-driven-dev/intent-driven-template#11](https://github.com/intent-driven-dev/intent-driven-template/issues/11) ([fuente](../../raw/articles/2026-11-21-issue-11-git-discipline-main-protegida.md)). Su autor sostiene que, con un `main` protegido, la regla obliga a 13 pasos y tres PR por change (propuesta, implementación y archive), y que choca con gitflow y con el desarrollo por PR. La abrió el 2026-11-07 y el 2026-11-21 sigue sin comentarios ni PR enlazadas: no hay respuesta que dé el motivo.

## Qué hace este proyecto con ella

`idd@2e89fa3:openspec/changes/add-openspec-autopilot/proposal.md`, de un change activo todavía sin archivar:

- **Recoge la falta de justificación** como parte del problema y cita la issue 11.
- **Propone una rama y una sola fusión** por change: sin la fusión intermedia de la propuesta y con el archive hecho en la rama. Sustituye esas puertas de la skill, asume el riesgo y deja abierta la discusión de si la fusión intermedia debe volver.
- **Anuncia un ADR** sobre esa sustitución. Cuando exista, será el primer registro de una decisión sobre esta disciplina.

## Lo que no se sabe

- **El motivo original.** Puede que exista fuera de los repositorios (conversaciones, otra documentación), pero no consta en ninguna fuente revisada.
- **El estado de la issue después del 2026-11-21.** Es una fuente viva: puede recibir respuesta o cerrarse.

## See Also

- [Una sola copia de las skills, vista por cada agente](una-sola-copia-de-las-skills.md)

## Sources

- [Collection: openspec-git-discipline en su origen (intent-driven-template@a8b8231)](../../raw/repos/2026-11-21-intent-driven-template-a8b8231-git-discipline.md): `.agents/skills/openspec-git-discipline/SKILL.md`, `AGENTS.md`.
- [Collection: openspec-git-discipline copiada a intent-driven-dev/skills@04cd70e](../../raw/repos/2026-11-21-skills-04cd70e-git-discipline.md): `.agents/skills/openspec-git-discipline/SKILL.md`.
- [Collection: openspec-git-discipline en este proyecto (idd@2e89fa3)](../../raw/repos/2026-11-21-idd-2e89fa3-git-discipline.md): `.agents/skills/openspec-git-discipline/SKILL.md`, `openspec/changes/add-openspec-autopilot/proposal.md`.
- [openspec-git-discipline behaves poorly when developing with a protected main branch](../../raw/articles/2026-11-21-issue-11-git-discipline-main-protegida.md): intent-driven-dev/intent-driven-template#11.
