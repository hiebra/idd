---
title: "Lessons Learned: el archivado de autopilot-plan-explore y su banco con OpenCode real"
type: notes
source: session
ingested: 2026-11-22
tags: [lessons-learned, openspec, archive, opencode, testing, llm-wiki]
lesson_kind: lessons-learned
lesson_count: 4
category: notes
confidence: high
summary: "La task del archive no se puede marcar dentro del change que se archiva; el banco con OpenCode real se conecta a un opencode serve propio y cambia de agente con ESC [ Z; las referencias del motor del wiki están bajo claude-plugin/; las búsquedas por el repositorio deben excluir los informes generados."
---

# Lessons Learned: el archivado de autopilot-plan-explore y su banco con OpenCode real

> Extraído de la sesión del 2026-11-22 (archivado y resincronización del wiki) y de lo anotado en `idd@9eae630:openspec/changes/archive/2026-11-22-autopilot-plan-explore/tasks.md`, tasks 1.3, 1.4 y 7.2. 4 lecciones.

## Lesson 1: La task del archive no se puede marcar dentro del change que se archiva

**Category**: gotcha
**Context**: archivar `autopilot-plan-explore` con `openspec-archive-change`.
**Symptom**: `openspec list --json` da 32 de 33 tasks y el workflow avisa de tasks incompletas. La que falta es la 7.5, que es el propio archive más la resincronización del wiki.
**Root cause**: la task vive en el `tasks.md` que el archive mueve a `archive/`, y parte de su trabajo (la resincronización del wiki, que va en un commit aparte) ocurre después del commit del archivado. No hay momento en que marcarla sea a la vez cierto y esté dentro del change.
**Fix**: archivar confirmando el aviso y dejar la task sin marcar en el change archivado.
**Rule**: la última task de un change no debe ser un checkbox del archive ni de lo que viene después; o se deja fuera de `tasks.md` (ya la cubren las indicaciones del archive), o se marca en el commit del archivado limitada a lo que está hecho en ese commit.

## Lesson 2: El banco con OpenCode real, con un servidor propio y Shift+Tab como ESC [ Z

**Category**: discovery
**Context**: tasks 1.3, 1.4 y 7.2 de `autopilot-plan-explore`, con OpenCode 2.3.2 y el proveedor falso.
**Symptom**: en la 1.4, el Tab enviado al pseudoterminal no cambió el agente.
**Root cause**: en la TUI de OpenCode 2.3.2 el agente se cambia con Shift+Tab, que en el terminal es la secuencia `ESC [ Z`, no `\t`.
**Fix**: enviar `\x1b[Z`. Además, la TUI (`--standalone`) y `opencode run -s <sesión>` se conectan con `--server` a un `opencode serve` propio (un puerto fijo y `OPENCODE_SERVER_PASSWORD` en el entorno, con valor [REDACTED:password]), para no usar el servicio de fondo del usuario; la TUI corre en un pseudoterminal de Python en lugar de tmux. Para mensajes a mitad de turno, el proveedor falso tarda cuando el mensaje lo pide. La recarga en caliente se provoca editando `tui.js` de la copia.
**Rule**: para guionizar la TUI de OpenCode, manda las secuencias de terminal reales de cada atajo (Shift+Tab = `ESC [ Z`) y aísla el banco con un `opencode serve` propio al que se conectan la TUI y `opencode run` con `--server`.

## Lesson 3: Las referencias del motor del wiki están bajo `claude-plugin/`

**Category**: gotcha
**Context**: el scan del librarian manda leer `skills/wiki-manager/references/librarian.md`.
**Symptom**: `ls .agents/wiki-engine/skills/wiki-manager/references/librarian.md`: `No such file or directory`.
**Root cause**: en la copia del motor del proyecto, las skills están en `.agents/wiki-engine/claude-plugin/skills/wiki-manager/`.
**Fix**: `find .agents/wiki-engine -name librarian.md -path '*references*'`.
**Rule**: las rutas `skills/wiki-manager/references/…` de los comandos `/wiki:*` se resuelven en `.agents/wiki-engine/claude-plugin/skills/wiki-manager/references/…`.

## Lesson 4: Buscar por el repositorio sin los informes generados

**Category**: gotcha
**Context**: comprobar, tras sincronizar la spec, que nada nombraba ya el escenario quitado "Cambiar de agente no inyecta nada".
**Symptom**: un `grep -rn` desde la raíz devolvió 1,4 MB de salida.
**Root cause**: `acceptance-tests/reports/cucumber-report.html` lleva embebidas todas las specs en una sola línea, y `acceptance-tests/.extracted/` tiene una copia de cada spec; los dos son generados.
**Fix**: excluir `acceptance-tests/reports/`, `acceptance-tests/.extracted/`, `node_modules/` y `.wiki/` en estas búsquedas, o usar `git grep`, que no ve lo ignorado.
**Rule**: para buscar texto de specs por el repositorio, usa `git grep` o excluye los informes y extracciones generados de la suite, que duplican todas las specs.
