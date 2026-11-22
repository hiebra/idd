# ADR Review Manifest

- Status: completed
- Review date: 2026-11-22

## Review Summary

ADR review completed for this change.

Antes de numerar se hizo `git fetch`. El número más alto en `origin/main` era el 0018, y en todas las ramas remotas, el 0021 (`claude/nifty-pascal-wkvbq0`), así que los ADRs nuevos son el 0022 y el 0023. Se fusionó `origin/main` en la rama antes de escribirlos.

## In-Force ADRs Reviewed

- ADR-0003: una sola copia de las skills. Sigue en vigor para la plantilla completa.
- ADR-0004: el wiki primero. Sigue en vigor.
- ADR-0005: el motor del wiki llega por el arranque. Sigue en vigor para la plantilla completa; ADR-0023 añade su instalación global.
- ADR-0006: asimetrías entre agentes. No aplica, porque Windows queda fuera de Claude Code como plataforma, no como capacidad.
- ADR-0009: operaciones de lectura y escritura del wiki. Sigue en vigor.
- ADR-0010: instrucciones por el arranque. Sigue en vigor.
- ADR-0011: los plugins liberan lo que registran. Lo cumplen también los plugins globales.
- ADR-0012: lint de specs con gplint. Sigue en vigor.
- ADR-0013: `branch-change.mjs` y la rama del change. Sigue en vigor; ADR-0023 mueve el script a la skill.
- ADR-0014: el autopilot. Sigue en vigor; ADR-0023 añade su instalación global.
- ADR-0015: dos formas del ciclo y commits en contenedores efímeros. Sigue en vigor.
- ADR-0018: en OpenCode, una instrucción opcional tiene su propio plugin. Sigue en vigor; `response-comments` se instala también de forma global.
- ADR-0002: núcleo del arranque en bash. Lo sustituye ADR-0022.
- ADR-0017 (rama `claude/vigilant-cori-oo4t14`, change `windows-support`, aún no en `main`): Windows con Git Bash. Lo sustituye ADR-0022 en lo del núcleo, por decisión del usuario.
- ADR-0021 (rama `claude/nifty-pascal-wkvbq0`, change del ON/OFF del wiki, aún no en `main`): el wiki desactivado por defecto con un ajuste del proyecto. Se tiene en cuenta en ADR-0023.

## New Durable ADRs Created

- [ADR-0022: El núcleo del arranque de sesión es un script de Node](../../../adr/0022-session-bootstrap-core-in-node.md). Sustituye a ADR-0002 y a ADR-0017.
- [ADR-0023: Instalación global para Windows y variante adelgazada como artefactos de cada release](../../../adr/0023-windows-global-install-and-slim-template.md).

## Coordination Before Archive

- **Si `windows-support` se abandona sin fusionarse**, se quita ADR-0017 del `Supersedes` de ADR-0022 antes de que llegue a `main`.
- **Si `check archive` avisa de que el 0022 o el 0023 ya existen** en la rama de origen, se renumeran estos dos ADRs y sus referencias.
