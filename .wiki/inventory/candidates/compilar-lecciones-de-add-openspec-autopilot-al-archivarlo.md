---
title: "Compilar las lecciones de las pruebas de add-openspec-autopilot al archivarlo"
kind: task
status: active
priority: p2
created: 2026-11-21
updated: 2026-11-21
last_checked: 2026-11-21
next_action: "Al archivar add-openspec-autopilot, en el paso 2 de la resincronización del wiki, compilar raw/notes/2026-11-21-ll-sesiones-opencode-autopilot.md con /wiki:compile junto con los manifiestos nuevos del change, y cerrar este registro."
sources:
  - raw/notes/2026-11-21-ll-sesiones-opencode-autopilot.md
tags: [opencode, task, compile, add-openspec-autopilot]
confidence: high
summary: "La nota con las 10 lecciones de las pruebas de add-openspec-autopilot no la cita ningún artículo; se compila al archivar el change, cuando su código y su design estén fijados."
---

# Compilar las lecciones de las pruebas de add-openspec-autopilot al archivarlo

## Why Track This

El lint del 2026-11-21 señala que ningún artículo compilado cita `raw/notes/2026-11-21-ll-sesiones-opencode-autopilot.md`. Por eso el lint del motor termina con "Result: FAIL". Se decidió no compilarla aún: sus lecciones sostienen el design de un change activo, y conviene sintetizarlas cuando el código del plugin esté fijado.

La resincronización del archivado (`openspec/config.yaml`) no la cubriría sola: su paso 2 compila "las fuentes nuevas", y esta nota ya existe. Sin este registro, solo la volvería a sacar el lint del paso 6.

## Current State

Pendiente. La nota la cita únicamente el registro de vigilancia [volver-a-comprobar-apis-de-sesion-al-subir-opencode](volver-a-comprobar-apis-de-sesion-al-subir-opencode.md), que no cuenta como cobertura.

## Next Action

Al archivar `add-openspec-autopilot`, compilar la nota en el paso 2 de la resincronización, junto con los manifiestos del commit del archivado, para que los artículos citen a la vez las lecciones y el código que las aplica. Después, pasar `status: ingested` y comprobar que el lint deja de señalarla.
