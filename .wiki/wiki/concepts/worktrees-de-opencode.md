---
title: "Cómo crea OpenCode 2 los worktrees y cómo hacer que nazcan desde origin/main"
category: concept
sources:
  - raw/articles/2026-11-22-opencode-2-worktrees.md
  - raw/notes/2026-11-22-ll-worktrees-opencode-desde-main.md
created: 2026-11-22
updated: 2026-11-22
verified: 2026-11-22
tags: [opencode, worktree, plugins, git, push]
confidence: high
volatility: warm
summary: "En OpenCode 2.3.2, la estrategia git por defecto crea los worktrees con --detach sobre el HEAD del checkout canónico, sin rama, y falla con invalid reference: HEAD si ese HEAD no apunta a un commit. Para que cada worktree nazca en una rama desde origin/main, con --no-track y publicable en origin/<rama>, hace falta una estrategia de worktree en un plugin, que usan la TUI y la web; el startup script commands.start es una alternativa por máquina, no versionada. Sintetizado de la documentación y el código de OpenCode v2.3.2 y de pruebas con git 2.43."
---

# Cómo crea OpenCode 2 los worktrees y cómo hacer que nazcan desde origin/main

> En OpenCode 2.3.2 el botón de crear worktree no crea ninguna rama: deja el worktree en HEAD separado. La forma de cambiarlo que viaja con el repositorio es un plugin que registre su propia estrategia de worktree.

## Lo que hace OpenCode por defecto

- La TUI y la web piden el worktree a la misma operación del servidor, `worktree.create`. La TUI envía solo el nombre; la web puede enviar además `branch`, que es la ref de partida y no el nombre de una rama nueva ([OpenCode 2.3.2: worktrees](../../raw/articles/2026-11-22-opencode-2-worktrees.md)).
- La estrategia git incluida ejecuta, en el checkout canónico del proyecto, `git worktree add --detach -- <dir> <ref ?? "HEAD">` (`packages/core/src/git.ts:1416`). El resultado no tiene rama.
- Si el `HEAD` de ese checkout no apunta a un commit, git falla con `fatal: invalid reference: HEAD` (en español, `referencia inválida: HEAD`). Se reproduce con un `git init` sin commits ([lecciones](../../raw/notes/2026-11-22-ll-worktrees-opencode-desde-main.md), lección 1).
- El directorio por defecto es `<datos de OpenCode>/worktree/<6 primeros caracteres del id del proyecto>/<nombre>`, y se cambia con `"worktree": { "directory": "…" }` en `opencode.json`.

## La vía versionada: una estrategia de worktree en un plugin

- Un plugin de servidor registra `{ id, create, remove, list }` con `ctx.worktree.transform((editor) => editor.add(...))`. La última registración activa queda seleccionada y, al descargar el plugin, se vuelve a la estrategia git ([fuente](../../raw/articles/2026-11-22-opencode-2-worktrees.md)).
- Los plugins de `.opencode/plugins/` se cargan solos, así que la estrategia vale para la TUI y para la web sin más configuración.
- `create` recibe `sourceDirectory`, el `directory` sugerido y el `branch` opcional, y devuelve el directorio real. `remove` puede pedir confirmación para forzar lanzando `Worktree.OperationError` con `forceRequired: true`. El worktree recuerda su estrategia, y su borrado no vuelve a git si esa estrategia no está disponible.

## La rama que se busca: desde origin/main, sin seguirla y publicable

La técnica, comprobada con git 2.43 ([lecciones](../../raw/notes/2026-11-22-ll-worktrees-opencode-desde-main.md), lección 3):

1. `git fetch origin main`.
2. `git worktree add --no-track -b <rama> <dir> origin/main`. Con `--no-track`, la rama no sigue a `origin/main` y un `git push` nunca va a `main`.
3. `git config push.autoSetupRemote true`. El primer `git push` crea `origin/<rama>` y la fija como upstream.

Esto es lo que haría el `create` de la estrategia. Su diseño se trabaja en la sesión "Autopilot rama automática con notificación", que ya probó con OpenCode 2.3.2 real una estrategia en la que el nombre del worktree es el nombre de la rama.

## La alternativa sin código y sus límites

El startup script del proyecto, `commands.start`, se ejecuta con `bash -lc` dentro del worktree ya creado, con `OPENCODE_WORKTREE_PATH` y `OPENCODE_WORKTREE_BASE`. Un script como `git fetch origin main && git switch --no-track -c "$(basename "$OPENCODE_WORKTREE_PATH")" origin/main` deja la rama como se busca ([lecciones](../../raw/notes/2026-11-22-ll-worktrees-opencode-desde-main.md), lección 2). Sus límites:

- Se guarda en la base de datos de OpenCode (`packages/core/src/project/sql.ts:28`) y se edita en los ajustes del proyecto de la web. No es el `commands` de `opencode.json`, que son comandos de barra, así que no se versiona.
- Se ejecuta después del `--detach` sobre `HEAD`, así que no evita el error de `HEAD` inválido.
- Si falla, el worktree ya existe y queda registrado en HEAD separado.

## See Also

- [[ciclo-de-un-change-y-autopilot|El ciclo de un change y su automatización en OpenCode]] ([El ciclo de un change y su automatización en OpenCode](../topics/ciclo-de-un-change-y-autopilot.md))
- [[hook-context-opencode|El hook context de OpenCode]] ([El hook context de OpenCode](hook-context-opencode.md))

## Sources

- [OpenCode 2.3.2: worktrees](../../raw/articles/2026-11-22-opencode-2-worktrees.md): `services/site/src/docs/content/build/plugins/server.mdx` y código del tag `v2.3.2` (`anomalyco/opencode@c0ad18b`).
- [Lecciones: worktrees de OpenCode desde origin/main](../../raw/notes/2026-11-22-ll-worktrees-opencode-desde-main.md): lecciones 1-3.
