---
title: "Sanear el nombre de la rama en las órdenes de las puertas"
kind: task
status: active
priority: p3
created: 2026-11-22
updated: 2026-11-22
last_checked: 2026-11-22
next_action: "Proponer un change para que las puertas de branch-change.mjs solo pongan en sus órdenes un nombre de rama que cumpla una gramática segura, o lo citen, igual que el título ya filtra los nombres de los changes."
sources:
  - raw/repos/2026-11-22-idd-4b8d2b3-name-change-in-merge-title.md
tags: [git, openspec, branch-change, seguridad, task]
confidence: high
summary: "El nombre de la rama entra sin sanear en las órdenes de shell que dan las puertas (el -m sin change y git push -u origin <rama>); una rama de otra persona podría colar una sustitución."
---

# Sanear el nombre de la rama en las órdenes de las puertas

## Why Track This

Las puertas de `branch-change.mjs` dan órdenes de shell que el agente ejecuta tal cual. El change `name-change-in-merge-title` filtra los nombres de los changes con la gramática kebab-case de OpenSpec (`^[a-z0-9]+(?:-[a-z0-9]+)*$`) antes de ponerlos en el título, porque un directorio `openspec/changes/$(…)/` se ejecutaría dentro de las comillas dobles del `-m`. El nombre de la rama no pasa por ese filtro: va al `-m "Merge <rama> into <destino>"` cuando la rama no lleva change, y a `git push -u origin <rama>` en `check commit`. Ya era así antes del change y afecta a todas las puertas; el design lo dejó fuera de alcance, sin dueño (`idd@4b8d2b3c29273a705c880c0a08ed5fbfb26f71e6:openspec/changes/archive/2026-11-22-name-change-in-merge-title/design.md`, Risks y Open Questions).

## Current State

Abierto. Git admite en un nombre de rama caracteres como `$`, `(` o el acento grave, así que el riesgo existe con ramas que vienen de otra persona.

## Next Action

Proponer un change: decidir entre una gramática para el nombre de la rama (y qué hacer si no la cumple) o citarlo en cada orden, y cubrirlo con escenarios en `openspec-change-lifecycle`.
