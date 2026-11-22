---
title: "OpenCode 2.3.2: estrategias de worktree en plugins de servidor y cómo crea los worktrees"
source: "https://raw.githubusercontent.com/anomalyco/opencode/v2.3.2/services/site/src/docs/content/build/plugins/server.mdx"
type: articles
ingested: 2026-11-22
tags: [opencode, worktree, plugins, git, tui, web]
summary: "Sección Worktrees de la documentación de plugins de servidor de OpenCode 2.3.2 y extractos del código del mismo tag: la estrategia git por defecto crea el worktree con --detach sobre HEAD del checkout canónico; un plugin puede registrar su propia estrategia con ctx.worktree.transform, que usan la TUI y la web; y commands.start (startup script) se guarda en la base de datos del proyecto."
canonical_url: "https://github.com/anomalyco/opencode/blob/c0ad18b402eb2827fc1ee71c171b1177b3fc02d1/services/site/src/docs/content/build/plugins/server.mdx"
upstream_id: "anomalyco/opencode@c0ad18b402eb2827fc1ee71c171b1177b3fc02d1:services/site/src/docs/content/build/plugins/server.mdx"
upstream_type: git-file
revision: "c0ad18b402eb2827fc1ee71c171b1177b3fc02d1"
license: "MIT"
content_format: markdown
fetched: 2026-11-22
extraction_tool: "git clone --filter=blob:none y git fetch del tag v2.3.2 (última 2.* estable, 2026-11-18); git show de cada ruta; extracto literal"
---

# OpenCode 2.3.2: worktrees (extracto)

Revisión: `anomalyco/opencode@c0ad18b402eb2827fc1ee71c171b1177b3fc02d1` (tag `v2.3.2`). En npm, `opencode-ai` sigue en 1.19.6; la serie 2 solo está en los tags del repositorio.

## `services/site/src/docs/content/build/plugins/server.mdx`, sección "Worktrees"

> Register a local worktree strategy using the normal plugin lifecycle. The implementation module in this example owns option validation and the backend's `create`, `remove`, and `list` operations.

```ts
export default Plugin.define({
  id: "company.worktrees",
  async setup(ctx) {
    const strategy = makeStrategy(ctx.options)
    await ctx.worktree.transform((editor) => {
      editor.add(strategy)
    })
  },
})
```

```jsonc
{
  "worktree": { "directory": "../worktrees" },
  "plugins": [{ "package": "./plugins/worktrees", "options": {} }],
}
```

> - Adding a strategy selects it automatically. The last active registration wins; no strategy-selection config is needed.
> - Disposing its registration or unloading the plugin restores the previous implementation, ultimately the bundled Git strategy.
> - `reload()` replays transforms after captured inputs change; it does not rerun plugin setup.
> - Creation failures do not retry through Git. Existing worktrees retain their recorded owner even when the default changes.
> - Strategies manage local directories. Remote workspace provisioning is not part of this interface.

> Create loads configuration and plugins from the project's saved `canonical` directory and uses their selected strategy. It accepts an optional parent `directory`, source `from`, starting `branch`, and `name`. The source defaults to the canonical checkout, and a `from` override must belong to that project. Choosing a source does not change the configuration root. A supplied starting ref must be supported by the selected strategy.

> Remove loads the canonical configuration and activates its plugins, then uses the worktree's recorded strategy rather than the currently selected default. [...] Missing owners fail removal rather than falling back to Git. A strategy can throw `new Worktree.OperationError({ message: "Uncommitted changes", forceRequired: true })`, importing `Worktree` from `@opencode/plugin`, to request force confirmation without depending on Core or Git errors.

Carga (`build/plugins/index.mdx`): "Plugins under `.opencode/plugins/` load automatically".

## Extractos del código en el mismo tag

`packages/plugin/src/worktree.ts`:

```ts
export interface WorktreeCreateInput {
  readonly sourceDirectory: string
  /** Suggested destination after naming and collision handling. Strategies may return a different directory. */
  readonly directory: string
  /** Starting ref, not the name of a new branch. Reject unsupported refs rather than ignoring them. */
  readonly branch?: string
}
```

`packages/plugin/src/promise/worktree.ts`: `WorktreeDefinition { id, create(input, { signal }) => Promise<{ directory }>, remove(input, { signal }), list(sourceDirectory, { signal }) => Promise<{ directory, type: "root" | "worktree" }[]> }`.

`packages/core/src/git.ts:1416`, estrategia git por defecto, ejecutada con `cwd` en el checkout canónico:

```ts
["worktree", "add", "--detach", "--", input.directory, input.ref ?? "HEAD"],
```

`packages/core/src/worktree/strategies.ts`: directorio por defecto `path.join(global.data, "worktree", location.project.id.slice(0, 6))`; el nombre lo pone `Worktree.create` (`input.name ?? Slug.create()`, con sufijo `-2`… si existe).

`packages/core/src/worktree.ts`, tras crear el worktree:

```ts
const command = row.commands?.start?.trim()
if (command) {
  // bash -lc <command>, cwd = worktree, env OPENCODE_WORKTREE_BASE / OPENCODE_WORKTREE_PATH
}
```

`packages/schema/src/project.ts:26`: `Commands { start?: "Startup script to run when creating a new workspace (worktree)" }`, guardado en la columna `commands` de la tabla del proyecto (`packages/core/src/project/sql.ts:28`), editable en los ajustes del proyecto de la web (`packages/app/src/settings/workspaces/project.tsx:170`). No es el `commands` de `opencode.json` (`packages/schema/src/config.ts:94`), que son comandos de barra.

Llamadas al servidor: la TUI envía solo `{ projectID, name }` (`packages/tui/src/component/prompt/move.tsx:41`); la web puede enviar además `branch` (`packages/app/src/workspaces/create.ts:13`). Las dos usan `worktree.create`.
