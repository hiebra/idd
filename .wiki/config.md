---
title: "Wiki del proyecto: plantilla intent-driven"
description: "Conocimiento de la plantilla intent-driven (OpenSpec + Claude Code + OpenCode 2): por qué es como es, qué se ha comprobado empíricamente sobre los agentes y sus APIs, y las fuentes del propio repositorio."
created: 2026-11-21
freshness_threshold: 70
---

# Wiki Configuration

## Scope

- El arranque de sesión neutral y sus adaptadores para Claude Code y OpenCode 2.
- El comportamiento real de los agentes soportados (hooks, plugins, descubrimiento de skills y comandos), comprobado en versiones concretas.
- La integración del motor del wiki (nvk/llm-wiki) y el flujo wiki-first.
- OpenSpec con el schema intent-driven y spec-as-source, y la suite de aceptación.
- Las specs, los ADRs y el código del repositorio, como fuentes fijadas a un commit.

Fuera de alcance: conocimiento general del usuario que no concierne al proyecto (va a su hub).

## Conventions

- Escrito en español.
- Lo comprobado empíricamente indica la versión de la herramienta y la fecha.
- Los productos del repositorio se citan por ruta y commit, sin copiar su contenido.
- `.wiki/` se versiona con el repositorio: nunca se añade a `.gitignore`.
