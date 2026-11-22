---
title: "Lessons Learned: worktrees de OpenCode desde origin/main"
type: notes
source: session
ingested: 2026-11-22
tags: [lessons-learned, opencode, worktree, git, push]
lesson_kind: lessons-learned
lesson_count: 3
category: notes
confidence: high
summary: "OpenCode 2 crea los worktrees con --detach sobre HEAD del checkout canónico, y falla con invalid reference: HEAD si HEAD no apunta a un commit; su startup script (commands.start) se guarda en la base de datos del proyecto, no en opencode.json; y una rama creada con --no-track desde origin/main queda publicable en origin/<rama> con push.autoSetupRemote."
---

# Lessons Learned: worktrees de OpenCode desde origin/main

> Extraído de la sesión del 2026-11-22. 3 lecciones de diagnosticar el error al crear un worktree desde la TUI de OpenCode y de buscar cómo hacer que nazca en una rama desde `origin/main`. Fuente: [OpenCode 2.3.2: worktrees](../articles/2026-11-22-opencode-2-worktrees.md).

## Lesson 1: OpenCode crea el worktree en HEAD separado, desde el HEAD del checkout canónico

**Category**: gotcha
**Context**: Crear un worktree desde la TUI o la web de OpenCode 2.3.2 sin plugin de worktree.
**Symptom**: `create worktree failed: fatal: referencia inválida: HEAD` (`invalid reference: HEAD`); cuando funciona, el worktree queda sin rama.
**Root cause**: La estrategia git por defecto ejecuta `git worktree add --detach -- <dir> <ref ?? "HEAD">` en el checkout canónico del proyecto (`packages/core/src/git.ts:1416`, tag `v2.3.2`). La TUI no envía ref. Si ese `HEAD` no apunta a un commit (repo sin commits), git da ese error; reproducido con `git init` y `git worktree add … HEAD`.
**Fix**: Registrar una estrategia propia con `ctx.worktree.transform((e) => e.add({ id, create, remove, list }))` en un plugin de `.opencode/plugins/`; la usan la TUI y la web.
**Rule**: Para controlar la rama de los worktrees de OpenCode, usa una estrategia de plugin; no esperes que el botón cree una rama.

## Lesson 2: El startup script de OpenCode no es configuración versionada

**Category**: gotcha
**Context**: Buscar una solución "solo de configuración del proyecto" para los worktrees de OpenCode.
**Symptom**: El `commands` de `opencode.json` no tiene `start`.
**Root cause**: El startup script es `commands.start` del proyecto, guardado en la base de datos de OpenCode (`packages/core/src/project/sql.ts:28`) y editable en los ajustes del proyecto de la web; se ejecuta con `bash -lc` dentro del worktree ya creado, con `OPENCODE_WORKTREE_PATH` y `OPENCODE_WORKTREE_BASE`. El `commands` de `opencode.json` son comandos de barra.
**Fix**: Sirve como alternativa por máquina (`git fetch origin main && git switch --no-track -c "$(basename "$OPENCODE_WORKTREE_PATH")" origin/main`), probada con git sobre un worktree `--detach`; pero no se versiona y no evita el `--detach` sobre `HEAD`.
**Rule**: Lo que deba viajar con el repositorio, ponlo en un plugin, no en el startup script.

## Lesson 3: Rama desde origin/main sin seguirla y publicable en origin/<rama>

**Category**: technique
**Context**: Querer que cada worktree tenga una rama nueva desde `main` del remoto, que nunca empuje a `main` y que se publique con su nombre.
**Symptom**: Con tracking a `origin/main`, un `git push` apunta a `main`; sin upstream, `git push` exige `-u origin <rama>`.
**Root cause**: `git worktree add -b` desde una rama remota configura el upstream a esa rama salvo `--no-track`.
**Fix**: `git fetch origin main`, `git worktree add --no-track -b <rama> <dir> origin/main` y `git config push.autoSetupRemote true`. Comprobado con git 2.43: el primer `git push` crea `origin/<rama>` y la fija como upstream.
**Rule**: Crea las ramas de trabajo con `--no-track` desde `origin/main` y deja `push.autoSetupRemote` activado para publicarlas.
