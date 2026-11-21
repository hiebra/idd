---
title: "Una sola copia de las skills, vista por cada agente"
category: concept
sources:
  - raw/repos/2026-11-21-idd-1cf0792.md
  - raw/repos/2026-11-21-idd-f2be907-readme.md
created: 2026-11-21
updated: 2026-11-21
verified: 2026-11-21
tags: [skills, claude-code, opencode, openspec, adr, spec]
confidence: high
volatility: warm
summary: "Las skills del schema viven solo en .agents/skills/ y los workflows de OpenSpec solo en .claude/skills/; cada agente los ve por sus rutas, sin copias por agente. Sintetizado de ADR-0003, ADR-0005 y la spec agent-skills."
---

# Una sola copia de las skills, vista por cada agente

> Una skill se añade o se cambia en un único sitio, y cada agente la encuentra por sus propias reglas de descubrimiento. Todo lo de esta página sale de los archivos citados, fijados en `idd@1cf0792` (el README, en `idd@f2be907`).

## La decisión

`idd@1cf0792:adr/0003-single-source-for-schema-skills.md`:

- **Las skills del schema** tienen su única copia en `.agents/skills/`. Claude Code las ve por symlinks en `.claude/skills/`, y OpenCode 2 las lee directamente de `.agents/skills`.
- **Los workflows de OpenSpec** se generan una sola vez, donde los deja el CLI del proyecto (hoy `.claude/skills/`). OpenCode los lee de ahí.
- **Nada de copias por agente.** Se descartaron porque pueden divergir o quedarse en otra versión de OpenSpec, y porque en OpenCode taparían a las originales por precedencia.
- **El motor del wiki sigue la misma línea**: una copia descargada en `.agents/wiki-engine/`, expuesta por symlinks ignorados por git (`idd@1cf0792:adr/0005-wiki-engine-through-session-bootstrap.md`).

## Qué garantiza la spec

`idd@1cf0792:openspec/specs/agent-skills/spec.md`:

- Cada skill de `.agents/skills/` está disponible exactamente una vez en cada agente soportado, sin configurar nada, y el nombre que declara coincide con el de su directorio.
- Los workflows de OpenSpec están disponibles en cada agente y corresponden a la versión de OpenSpec fijada en `package.json`.
- "Disponible" significa que el agente la encuentra al buscar skills de proyecto en el clon, según sus reglas. Esas reglas están en un solo sitio, `idd@1cf0792:acceptance-tests/support/skills.js`.

## Riesgos que recoge el ADR

- La disponibilidad en OpenCode depende de que siga leyendo `.claude/skills` y `.agents/skills` por compatibilidad, y de su precedencia. Esa precedencia la recogen ADR-0003 y `skills.js` como lectura del código de OpenCode; no se ha comprobado en ejecución con un ID repetido (ver [Qué carga cada agente y cuándo](../topics/carga-en-la-misma-sesion-por-agente.md)).
- Los symlinks no funcionan en entornos sin soporte de symlinks, como Windows sin modo desarrollador (ADR-0003).
- Para subir de versión OpenSpec se regenera solo `.claude/skills/`, y se revisa su diff (`idd@f2be907:README.md`).

## See Also

- [Qué carga cada agente y cuándo](../topics/carga-en-la-misma-sesion-por-agente.md)
- [El arranque de sesión](../topics/arranque-de-sesion.md)
- [El flujo wiki-first](../topics/flujo-wiki-first.md)
- [openspec-git-discipline: una regla heredada sin justificación registrada](origen-de-openspec-git-discipline.md)

## Sources

- [Collection: repositorio de la plantilla intent-driven](../../raw/repos/2026-11-21-idd-1cf0792.md): `adr/0003-single-source-for-schema-skills.md`, `adr/0005-wiki-engine-through-session-bootstrap.md`, `openspec/specs/agent-skills/spec.md`, `acceptance-tests/support/skills.js`.
- [Collection: README de la plantilla tras el archivado](../../raw/repos/2026-11-21-idd-f2be907-readme.md): `README.md`.
