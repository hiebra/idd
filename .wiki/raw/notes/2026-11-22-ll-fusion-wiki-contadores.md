---
title: "Lessons Learned: los contadores del wiki al resolver una fusión"
type: notes
source: session
ingested: 2026-11-22
tags: [lessons-learned, wiki, git, merge, conflictos, indexes]
lesson_kind: lessons-learned
lesson_count: 1
category: notes
confidence: high
summary: "Al resolver una fusión con conflictos en el wiki, ninguno de los dos lados de los contadores de .wiki/_index.md e inventory/_index.md acertaba: se cuentan de nuevo sobre el disco. El lint del motor no revisa esos contadores."
---

# Lessons Learned: los contadores del wiki al resolver una fusión

> Extraído de la sesión del 2026-11-22: dos fusiones de `origin/main` en la rama de `windows-support` (commits de fusión `c083aae` y `a69158e`, PR hiebra/idd#9). [comprobado] contando los archivos y ejecutando `llm-wiki lint --local`. Complementa la [lección sobre lecciones equivalentes](2026-11-22-ll-fusion-wiki-lecciones-equivalentes.md).

## Lesson 1: en un conflicto de contadores del wiki, ningún lado suele acertar

**Category**: gotcha
**Context**: resolver los conflictos de las estadísticas de `.wiki/_index.md` e `inventory/_index.md` al fusionar `main` con la rama del change.
**Symptom**: en la primera fusión, esta rama decía 20 fuentes, 10 artículos y 4 registros, y `main` 40, 11 y 5; en disco había 44, 12 y 6. En la segunda, los lados decían 44/12/6 y 45/12/5, y en disco había 49, 13 y 6. `main` contaba además como activos los 5 registros del inventario cuando uno estaba cerrado (`status: archived`). Ya antes de fusionar, en `8df009d`, `.wiki/_index.md` decía 20 fuentes con 28 en `raw/`, y `llm-wiki lint --local` pasaba sin hallazgos.
**Root cause**: cada rama solo cuenta lo que añade, a veces a mano y sin recontar, y tras la fusión el total es la unión de las dos. El lint del motor no compara esos contadores con el disco, así que un contador desfasado no se detecta.
**Fix**: contar sobre el resultado de la fusión: `find raw -name '*.md' ! -name '_index.md' | wc -l` para las fuentes, lo mismo en `wiki/` para los artículos y en `inventory/` para los registros, y los activos por `status:` en su frontmatter.
**Rule**: al resolver un conflicto de contadores del wiki no elijas un lado: cuenta sobre el disco tras la fusión, también los activos del inventario por su `status:`, porque el lint no lo comprueba.
