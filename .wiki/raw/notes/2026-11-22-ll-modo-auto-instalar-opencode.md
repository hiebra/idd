---
title: "Lessons Learned: el modo auto y la instalación de OpenCode para el banco"
type: notes
source: session
ingested: 2026-11-22
tags: [lessons-learned, opencode, claude-code, auto-mode, permissions]
lesson_kind: lessons-learned
lesson_count: 1
category: notes
confidence: medium
summary: "En una sesión de Claude Code en la nube, el modo auto bloqueó instalar @opencode/cli para el banco de la lección 9; la salida propuesta son reglas allow en .claude/settings.json, sin comprobar."
---

# Lessons Learned: el modo auto y la instalación de OpenCode para el banco

> Extraído de la sesión del 2026-11-22, al revisar una rama huérfana. 1 lección.

## Lesson 1: El modo auto puede bloquear el primer paso del banco de OpenCode

**Category**: gotcha
**Context**: Montar en una sesión de Claude Code en la nube el banco de pruebas de plugins de OpenCode (lección 9 de `raw/notes/2026-11-21-ll-sesiones-opencode-autopilot.md`), cuyo primer paso es `npm install @opencode/cli@2.3.2` en una carpeta aparte.
**Symptom**: El clasificador del modo auto bloqueó la instalación. Solo consta en el mensaje del commit `1655459` (sesión `session_01WfNGgKVc7Lh7iFRWErCF6B`, 2026-11-21), en la rama `claude/dreamy-johnson-pw56st`, que no llegó a `main` y se descarta. Una vez borrada la rama, ese commit puede dejar de estar disponible.
**Root cause**: [inferencia] El modo auto trata como arriesgado instalar un paquete de npm que ninguna regla del proyecto permite.
**Fix**: Ese commit añadía a `.claude/settings.json` un bloque `permissions.allow` con `Bash(npm install @opencode/cli)`, `Bash(npm install @opencode/cli@*)`, `Bash(npm view @opencode/cli)`, `Bash(npm view @opencode/cli *)` y `Bash(npm view @opencode/cli@*)`. **[sin comprobar]** No consta que con esas reglas la instalación pasara. Se decidió no incorporarlas a `main`.
**Rule**: Antes de repetir el banco de OpenCode en una sesión desatendida en la nube, cuenta con que el modo auto puede bloquear `npm install @opencode/cli`: aprueba la instalación a mano o añade antes reglas `allow` estrechas para ese paquete, y comprueba que bastan.
