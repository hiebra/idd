# ADR Review Manifest

- Status: completed
- Review date: 2026-11-21

## Review Summary

ADR review completed for this change.

El design contiene dos decisiones arquitectónicas duraderas, ninguna recogida en un ADR en vigor:

- **El conocimiento del proyecto vive en un wiki que el agente consulta primero**, como concepto independiente del motor. Tiene dos ámbitos (proyecto y hub), y los productos del proyecto entran como fuentes fijadas que se resincronizan al archivar (design: Context, D2, D6).
- **El motor del wiki, la guía y el recordatorio llegan a cada agente por el arranque de sesión.** El motor se descarga una vez por versión y se expone por las rutas de cada agente, y se desactiva en local. No se usan ni el plugin de Claude Code ni archivos de instrucciones que el agente cargue siempre (design D1, D3, D4, D5).

No se sustituye ningún ADR: las dos decisiones extienden ADR-0002 y ADR-0003 sin contradecirlas.

El resto del design no requiere ADR, porque son detalles de implementación:

- el formato de `engine.json`;
- los marcadores del recordatorio;
- los identificadores de sección de la guía;
- el nombre de la variable de desactivación;
- la forma de la simulación en la suite (D7);
- el tratamiento de los conflictos de nombres (D8).

## In-Force ADRs Reviewed

- `adr/0002-agent-neutral-session-bootstrap.md` - en vigor (sustituye a ADR-0001). Este change amplía el núcleo y sus adaptadores sin alterar la decisión.
- `adr/0003-single-source-for-schema-skills.md` - en vigor. El motor mantiene una sola copia vista por cada agente desde sus rutas, en coherencia con él.
- `adr/0001-session-bootstrap-hook.md` - sustituido por ADR-0002; solo contexto histórico.

## New Durable ADRs Created

- `adr/0004-wiki-first-project-knowledge.md` - el conocimiento del proyecto vive en un wiki que el agente consulta primero.
- `adr/0005-wiki-engine-through-session-bootstrap.md` - el motor del wiki y su guía llegan a cada agente por el arranque de sesión.
