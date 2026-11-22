---
title: "Lessons Learned: el cierre de la revisión pasa de la confirmación en la TUI a git (ADR-0013)"
type: notes
source: session
ingested: 2026-11-22
tags: [lessons-learned, opencode, openspec-autopilot, revision, git, autopilot-sesion-operativa]
lesson_kind: lessons-learned
lesson_count: 1
category: notes
confidence: high
summary: "La lección 10 de la nota del 2026-11-21 proponía confirmar en la TUI el cierre de una revisión que propone el modelo. ADR-0013, en autopilot-sesion-operativa, la sustituye: el cierre lo decide git cuando el usuario envía su siguiente mensaje (commit, satisfactoria; todo fuera del stage, no satisfactoria), y desaparece el diálogo."
---

# Lessons Learned: el cierre de la revisión pasa de la confirmación en la TUI a git (ADR-0013)

> Nota del 2026-11-22, al archivar `autopilot-sesion-operativa`. Corrige la vigencia de la regla de la lección 10 de [la nota del 2026-11-21](2026-11-21-ll-sesiones-opencode-autopilot.md), que como fuente no se modifica.

## Lección 1: La decisión del usuario sobre una revisión es su acción en git, no una frase del modelo ni un diálogo

**Category**: correction
**Context**: La lección 10 del 2026-11-21 (un modelo real cerró con `ok` una revisión ante "Gracias, lo miro luego.") llevó a ADR-0008 a que el modelo propusiera el cierre con la tool y el usuario lo confirmara en un diálogo de la TUI.
**Symptom**: Con `alibaba/qwen3.8-flash`, el modelo tampoco llamaba a la tool en el momento justo, o seguía escribiendo tras llamarla; y la UI web no carga la interfaz de los plugins, así que allí no hay diálogo posible.
**Root cause**: Tanto el cierre propuesto por el modelo como la confirmación dependían de algo ajeno al repositorio: la interpretación del modelo y la presencia de la TUI.
**Fix**: ADR-0013 (`idd@6d6e79c:adr/0013-autopilot-verifies-product-and-closes-reviews-with-git.md`): el plugin pasa el producto al stage, y la revisión se cierra en el hook `prompt` cuando, desde que empezó, HEAD ha avanzado y no queda nada en el stage (satisfactoria) o HEAD no ha cambiado y no queda nada en el stage (no satisfactoria, con el mensaje del usuario como conclusiones). Sin diálogo.
**Rule**: La regla de la lección 10 ("confirmar con el usuario fuera del modelo") sigue valiendo, pero la confirmación es su commit o sacar el stage, que funciona con cualquier cliente. El diálogo de confirmación en la TUI ya no existe.
