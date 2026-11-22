---
name: openspec-git-discipline
description: Use when running OpenSpec propose, continue, apply, verify, archive, or worktree workflows where proposal artifacts, branches, merges, or archive timing affect git history.
license: MIT
compatibility: Requires git, Node.js and OpenSpec workflow artifacts.
---

# OpenSpec Git Discipline

<!-- Copia del origen (intent-driven-dev/intent-driven-template) reescrita a propósito con el ciclo de este proyecto: ADR-0012, que sustituye a ADR-0007. No la sobrescribas al actualizar desde el origen sin revisarlo. -->

## Regla central

<!-- lifecycle:core -->
Un change se hace entero en **una rama temporal**, que llega a la rama de origen en **una sola fusión**: propuesta, implementación, archive y resincronización del wiki van en esa rama, y el archive se hace en ella, antes de la fusión.

- Las ramas permanentes son las de `x-main` en `openspec/config.yaml` (por defecto, `main`); la última es la rama de origen, de la que salen las temporales. Cualquier otra rama local es temporal.
- El change de la rama no se apunta en ningún sitio: se lee de git. Lo calcula, igual para los dos agentes, `node .agents/openspec/branch-change.mjs --json`.
- Las puertas las decide `node .agents/openspec/branch-change.mjs check <propose|apply|archive> [<change>]`: imprime `{ ok, message }` y sale con 0 si se puede seguir y con 1 si no. Ejecútalo y obedécelo; no lo sustituyas por tu propia lectura de git.
- Las ramas temporales las manejas solo con `branch-change.mjs`, nunca con git a mano:
  - `node .agents/openspec/branch-change.mjs list` lista las ramas temporales con su change (`--json` para leerlo);
  - `node .agents/openspec/branch-change.mjs start <change>` crea la rama del change desde la rama de origen, con el nombre del change, y cambia a ella;
  - `node .agents/openspec/branch-change.mjs switch <rama>` cambia a una rama temporal que ya existe.

  Los dos últimos imprimen `{ ok, message }` y no hacen nada con el árbol de trabajo sucio.

## Puertas

<!-- lifecycle:propose -->
### Antes de proponer (`openspec-new-change`)

Ejecuta `node .agents/openspec/branch-change.mjs check propose`. Si sale con 0, sigue. Si no:

- si el clon está en una rama permanente, o en una rama temporal que ya tiene otro change, crea la rama del change nuevo con `node .agents/openspec/branch-change.mjs start <nombre-del-change>` y vuelve a comprobar la puerta;
- si `start` no sale con 0 (por ejemplo, porque el árbol tiene cambios sin commit), avisa al usuario con su `message` y espera: no hagas tú el commit ni guardes sus cambios.

Para seguir con un change que ya tiene rama, cambia a ella con `switch`; búscala con `list`.

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

Nunca hagas commits ni fusiones: los hace siempre el usuario. Las únicas operaciones de ramas que haces son las de `branch-change.mjs` (`start` y `switch`).

**En una sesión del autopilot de OpenCode** (su instrucción empieza por `[openspec-autopilot]`), no pidas commits ni pases nada al stage: al terminar el paso, el plugin pasa lo producido al stage, y el usuario lo revisa y hace el commit.

**En cualquier otro caso**, pide al usuario el commit en estos momentos, y espera a que lo haga o te diga que sigas sin él:

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
- Crear o cambiar de rama con git a mano, o una rama que no salga de la rama de origen.
- Más de un change en la misma rama.
- Hacer commits o fusiones, o pedir commits en una sesión del autopilot.

Ante cualquiera de ellas: detente, explica el límite y pide al usuario que deje explícito el estado de git.
