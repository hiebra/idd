# ADR Review Manifest

- Status: completed
- Review date: 2026-11-22

## Review Summary

ADR review completed for this change.

Antes de numerar se hizo `git fetch`. El número más alto en `origin/main` era el 0018, y en todas las ramas remotas, el 0021 (`claude/nifty-pascal-wkvbq0`), así que los ADRs nuevos se numeraron 0022 y 0023. Se fusionó `origin/main` en la rama antes de escribirlos. Después, la rama `claude/exciting-ramanujan-802ws8` subió su propio ADR-0022, que sustituye a ADR-0014, y los nuestros se renumeraron a 0023 y 0024.

## In-Force ADRs Reviewed

- ADR-0003: una sola copia de las skills. Sigue en vigor para la plantilla completa.
- ADR-0004: el wiki primero. Sigue en vigor.
- ADR-0005: el motor del wiki llega por el arranque. Sigue en vigor para la plantilla completa; ADR-0024 añade su instalación global.
- ADR-0006: asimetrías entre agentes. No aplica, porque Windows queda fuera de Claude Code como plataforma, no como capacidad.
- ADR-0009: operaciones de lectura y escritura del wiki. Sigue en vigor.
- ADR-0010: instrucciones por el arranque. Sigue en vigor.
- ADR-0011: los plugins liberan lo que registran. Lo cumplen también los plugins globales.
- ADR-0012: lint de specs con gplint. Sigue en vigor.
- ADR-0013: `branch-change.mjs` y la rama del change. Sigue en vigor; ADR-0024 mueve el script a la skill.
- ADR-0014: el autopilot. Sigue en vigor en `main`; ADR-0024 añade su instalación global. ADR-0022 de `claude/exciting-ramanujan-802ws8` (la sesión del autopilot es dueña de su rama y sus worktrees), aún no en `main`, lo sustituye. Cuando llegue, ADR-0024 lo tendrá en cuenta en lugar de ADR-0014.
- ADR-0015: dos formas del ciclo y commits en contenedores efímeros. Sigue en vigor.
- ADR-0018: en OpenCode, una instrucción opcional tiene su propio plugin. Sigue en vigor; `response-comments` se instala también de forma global.
- ADR-0002: núcleo del arranque en bash. Lo sustituye ADR-0023.
- ADR-0017 (change `windows-support`, ya en `main`): en Windows solo OpenCode 2, con LF en el repositorio y un diagnóstico en PowerShell. Se reescribió para no decidir nada del núcleo, así que ADR-0023 no lo sustituye: es compatible con él.
- ADR-0021 (rama `claude/nifty-pascal-wkvbq0`, change del ON/OFF del wiki, aún no en `main`): el wiki desactivado por defecto con un ajuste del proyecto. Se tiene en cuenta en ADR-0024.

## New Durable ADRs Created

- [ADR-0023: El núcleo del arranque de sesión es un script de Node](../../../adr/0023-session-bootstrap-core-in-node.md). Sustituye a ADR-0002.
- [ADR-0024: Instalación global para Windows y variante adelgazada como artefactos de cada release](../../../adr/0024-windows-global-install-and-slim-template.md).

## Coordination Before Archive

- ADR-0017 ya está fuera del `Supersedes` de ADR-0023 (2026-11-22), porque `windows-support` se redujo a lo que no depende del núcleo.
- ADR-0020, ya en `main`, sustituye a ADR-0013, al que cita ADR-0024 por la ubicación de `branch-change.mjs`. Al integrar la rama de origen (task 7.1), ADR-0024 tiene que citar ADR-0020 en su lugar.
- **Si `check archive` avisa de que el 0023 o el 0024 ya existen** en la rama de origen, se renumeran estos dos ADRs y sus referencias.
