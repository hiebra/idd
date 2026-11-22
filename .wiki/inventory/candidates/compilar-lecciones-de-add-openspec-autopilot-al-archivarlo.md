---
title: "Compilar las lecciones de las pruebas de add-openspec-autopilot al archivarlo"
kind: task
status: archived
priority: p2
created: 2026-11-21
updated: 2026-11-22
last_checked: 2026-11-22
next_action: "Ninguna: compilada en wiki/topics/ciclo-de-un-change-y-autopilot.md al archivar add-openspec-autopilot; cerrada el 2026-11-22."
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

Hecho el 2026-11-21: en la resincronización del archivado de `add-openspec-autopilot`, la nota se compiló en [El ciclo de un change y su automatización en OpenCode](../../wiki/topics/ciclo-de-un-change-y-autopilot.md), junto con el [manifiesto del commit del archivado](../../raw/repos/2026-11-21-idd-772d0f0-add-openspec-autopilot.md).

Antes, pendiente. La nota la cita únicamente el registro de vigilancia [volver-a-comprobar-apis-de-sesion-al-subir-opencode](volver-a-comprobar-apis-de-sesion-al-subir-opencode.md), que no cuenta como cobertura.

## Next Action

Al archivar `add-openspec-autopilot`, compilar la nota en el paso 2 de la resincronización, junto con los manifiestos del commit del archivado, para que los artículos citen a la vez las lecciones y el código que las aplica. Después, pasar `status: ingested` y comprobar que el lint deja de señalarla.
