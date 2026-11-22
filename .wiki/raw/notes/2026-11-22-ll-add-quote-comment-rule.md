---
title: "Lessons Learned: add-quote-comment-rule"
type: notes
source: session
ingested: 2026-11-22
tags: [lessons-learned, bash, acceptance-tests, adr, openspec, session-bootstrap]
lesson_kind: lessons-learned
lesson_count: 3
category: notes
confidence: high
summary: "El printf de bash solo convierte \\uXXXX fuera de ASCII con una locale UTF-8; un paso que exige un contexto vacío se rompe con la siguiente instrucción que entregue el arranque; y una propuesta debe contrastarse con los ADRs en vigor antes de escribir las specs."
---

# Lessons Learned: add-quote-comment-rule

> Extraído de la sesión del 2026-11-21 y 2026-11-22. 3 lecciones de proponer, implementar y archivar `add-quote-comment-rule`.

## Lesson 1: El printf de bash solo convierte \uXXXX fuera de ASCII con una locale UTF-8

**Category**: gotcha
**Context**: `json_field`, en `.claude/hooks/json.sh`, deshace los escapes JSON del `prompt` solo con bash, porque Node puede faltar.
**Symptom**: Con la locale POSIX del contenedor, `{"prompt":"camión"}` daba `cami n`: la prueba `\uXXXX escapes are undone` fallaba (`idd@16e4617:acceptance-tests/core-tests/json-field.test.js`).
**Root cause**: `printf 'ó'` de bash convierte el código a un carácter de la locale actual; en POSIX/C no hay forma de representar un carácter fuera de ASCII y no lo convierte. bash 3.2 (el de macOS) ni siquiera entiende `\u`.
**Fix**: Hacer la conversión con una locale UTF-8 explícita, `LC_ALL=C.UTF-8 printf "\\u$hex"`, y si el resultado sigue siendo `\u…` o vacío, dejar un espacio (`idd@16e4617:.claude/hooks/json.sh`).
**Rule**: En bash, no confíes en la locale heredada para convertir `\uXXXX`: fuérzala a UTF-8 en esa llamada y prevé una alternativa para bash 3.2. Prueba con un carácter fuera de ASCII, no solo con `'`.

## Lesson 2: Un paso que exige un contexto vacío se rompe con la siguiente instrucción del arranque

**Category**: gotcha
**Context**: Entregar la regla de comentarios al empezar la sesión, junto a la guía del wiki.
**Symptom**: Fallaron los escenarios en que el usuario desactiva el wiki: el paso `el agente no recibe la guía del wiki` comprobaba que el contexto de la sesión estaba vacío, y ahora llevaba la regla.
**Root cause**: El paso comprobaba más de lo que pide la spec, que solo exige que no llegue la guía; mientras el wiki era la única instrucción, las dos cosas coincidían.
**Fix**: Comprobar que ningún texto del contexto incluye la guía tal como se entrega (`idd@16e4617:acceptance-tests/step-definitions/wiki.steps.js`).
**Rule**: Un paso que afirma que algo no llega debe comprobar la ausencia de ese contenido concreto, no que no llegue nada: el arranque puede entregar otras instrucciones (ADR-0010).

## Lesson 3: Contrasta la propuesta con los ADRs en vigor antes de escribir las specs

**Category**: process
**Context**: La primera propuesta ponía la regla en `AGENTS.md`, con un `CLAUDE.md` que lo importaba.
**Symptom**: Al escribir las specs apareció que ADR-0005 había descartado esos archivos para la guía del wiki porque no se pueden desactivar en local, y que un paso de la suite comprobaba que no existieran. Hubo que rehacer la propuesta (`idd@16e4617:openspec/changes/archive/2026-11-21-add-quote-comment-rule/proposal.md`).
**Root cause**: El schema solo pide leer los ADRs en el paso `design`; la propuesta se escribió sin buscar decisiones previas sobre el mismo mecanismo.
**Fix**: Volver a la propuesta con la entrega por el arranque de sesión, y generalizar la decisión en ADR-0010 (`idd@16e4617:adr/0010-agent-instructions-through-session-bootstrap.md`).
**Rule**: Antes de redactar una propuesta, busca en `adr/` y en las specs las decisiones sobre el mecanismo que vas a usar (por ejemplo, `grep -rn AGENTS.md adr openspec/specs acceptance-tests`), aunque el schema solo pida leer los ADRs en el design.
