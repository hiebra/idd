---
name: openspec-git-discipline
description: Use when running OpenSpec propose, continue, apply, verify, archive, or worktree workflows where proposal artifacts, branches, merges, or archive timing affect git history.
license: MIT
compatibility: Requires git, Node.js and OpenSpec workflow artifacts.
---

# OpenSpec Git Discipline

<!-- Copia del origen (intent-driven-dev/intent-driven-template) reescrita a propósito con el ciclo de este proyecto: ADR-0007. No la sobrescribas al actualizar desde el origen sin revisarlo. -->

## Regla central

<!-- lifecycle:core -->
Un change se hace entero en **una rama temporal**, que llega a la rama de origen en **una sola fusión**: propuesta, implementación, archive y resincronización del wiki van en esa rama, y el archive se hace en ella, antes de la fusión.

- Las ramas permanentes son las de `x-main` en `openspec/config.yaml` (por defecto, `main`); la última es la rama de origen, de la que salen las temporales. Cualquier otra rama local es temporal.
- El change de la rama no se apunta en ningún sitio: se lee de git. Lo calcula, igual para los dos agentes, `node .agents/openspec/branch-change.mjs --json`.
- Las puertas las decide `node .agents/openspec/branch-change.mjs check <propose|apply|archive> [<change>]`: imprime `{ ok, message }` y sale con 0 si se puede seguir y con 1 si no. Ejecútalo y obedécelo; no lo sustituyas por tu propia lectura de git.

## Puertas

<!-- lifecycle:propose -->
### Antes de proponer (`openspec-new-change`)

Ejecuta `node .agents/openspec/branch-change.mjs check propose`. Si no sale con 0, avisa al usuario con su `message` (por ejemplo, que el clon está en una rama permanente y el change se hace en una rama temporal) y pregúntale cómo seguir. No crees la rama tú: díselo y espera.

<!-- lifecycle:apply -->
### Antes del apply (`openspec-apply-change`)

Ejecuta `node .agents/openspec/branch-change.mjs check apply <change>`. Si sale con 0, sigue: basta con que el change sea el de la rama temporal, tenga o no su propuesta en la rama de origen. Si no sale con 0, detente y explica al usuario su `message`.

El apply puede hacerse en la rama temporal del change o en un worktree de esa rama; en un worktree, ejecuta el comando dentro del worktree.

<!-- lifecycle:archive -->
### Antes del archive (`openspec-archive-change`)

Ejecuta `node .agents/openspec/branch-change.mjs check archive <change>`. Si no sale con 0, detente: no archives, y explica al usuario su `message`. El archive se hace en la rama temporal del change, antes de su única fusión con la rama de origen; nunca en una rama permanente ni después de fusionar.

Tras el archive, la resincronización del wiki de las indicaciones de archivado de `openspec/config.yaml` también se hace en la rama temporal, después del commit del archive.

<!-- lifecycle:commits -->
## Commits

Nunca hagas commits, ramas ni fusiones por tu cuenta: los hace siempre el usuario. Pide al usuario el commit en estos momentos, y espera a que lo haga o te diga que sigas sin él:

- tras cada artefacto del plan (proposal, specs, design, adr, tasks);
- tras cada task implementada;
- tras el archive;
- tras la resincronización del wiki, en un commit aparte y posterior al del archive.

Un commit no mezcla `openspec/` con el resto del repositorio, salvo el `tasks.md` del change (zonas de `spec-as-source`).

<!-- lifecycle:red-flags -->
## Señales de alarma

- Exigir que la propuesta esté en la rama de origen antes del apply.
- Archivar en una rama permanente o después de fusionar la rama temporal.
- Decidir una puerta leyendo git a mano en lugar de con `branch-change.mjs check`.
- Más de un change en la misma rama.
- Hacer commits, ramas o fusiones sin que el usuario lo pida.

Ante cualquiera de ellas: detente, explica el límite y pide al usuario que deje explícito el estado de git.
