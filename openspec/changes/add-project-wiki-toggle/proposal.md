## Why

Hoy el wiki del proyecto viene encendido, y lo que se puede apagar es la excepción: `PROJECT_WIKI=off`, una preferencia de cada usuario. Pero el wiki es del proyecto, así que encenderlo o apagarlo debería valer para todos los que usan el repositorio. Además, ese apagado no lo apaga todo: las indicaciones de archivado de `openspec/config.yaml` siguen pidiendo la resincronización con operaciones `/wiki:*` que ya no existen, y el autopilot de OpenCode sigue lanzando el paso `wiki` y esperando su commit. Por último, el flujo del wiki nunca se ha probado con OpenCode real, solo con el simulado de la suite.

## What Changes

- **El wiki viene deshabilitado por defecto.** Un ajuste versionado, `"enabled"` en `.agents/wiki/engine.json`, decide si el wiki está encendido para todo el proyecto. La plantilla lo trae a `false`.
- **Un comando `/toggle-wiki`, en los dos agentes**, enciende o apaga el wiki del proyecto:
  - cambia `enabled`;
  - pone o quita, entre marcas, los pasos de resincronización del wiki en las indicaciones de archivado de `openspec/config.yaml`; con el wiki apagado, `config.yaml` no menciona el wiki;
  - al encender sin `.wiki/`, propone la ingesta inicial del repositorio y solo escribe lo que el usuario confirme;
  - deja los cambios en el stage para que el usuario haga el commit, y dice cómo queda el wiki y qué vale solo desde la sesión siguiente.
  Al apagar, `.wiki/` se conserva.
- **Todo lo que depende del wiki lee el ajuste**: el arranque de sesión no instala el motor ni entrega la guía ni el recordatorio si está apagado; el autopilot se salta el paso `wiki`; y el ciclo de un change (`openspec-git-discipline` y los prompts del autopilot) habla de la resincronización y del commit del wiki solo si el wiki está encendido.
- **BREAKING: se quita `PROJECT_WIKI`.** Nadie puede apagar para sí el wiki de un proyecto que lo tiene encendido: si alguien no lo cargara, su archive se saltaría la resincronización y el wiki quedaría desfasado para todos.
- **Compatible con la distribución compartida**: en la variante adelgazada que prepara el change del schema `intent-driven`, el `.bat` instala de forma global el motor (en la versión de su release), el arranque de sesión, la guía, el recordatorio y `/toggle-wiki`. En el proyecto solo quedan el ajuste, los pasos de `config.yaml` y `.wiki/`.
- **Pruebas con OpenCode real**, en la TUI, del flujo completo: apagado por defecto, `/toggle-wiki` en los dos sentidos, lo que recibe el modelo, consultar, modificar y el archive con el autopilot.

Fuera de alcance: el `.bat` y la variante adelgazada en sí, que son del change del schema `intent-driven`; el hub del usuario; borrar `.wiki/` al apagar.

## Capabilities

### New Capabilities

### Modified Capabilities
- `llm-wiki`: el ajuste versionado `enabled`, deshabilitado por defecto; `/toggle-wiki` y la ingesta inicial con confirmación. Sustituye a "Desactivable en local".
- `session-bootstrap`: el motor se instala y la guía y el recordatorio se entregan solo si el ajuste del proyecto está encendido, no según `PROJECT_WIKI`.
- `wiki-first-knowledge`: la resincronización al archivar solo existe con el wiki encendido, porque sus pasos están en `config.yaml` solo entonces.
- `openspec-autopilot`: con el wiki apagado, tras el archive no hay paso `wiki` ni espera de su commit.
- `openspec-change-lifecycle`: la resincronización y el commit del wiki forman parte del ciclo solo con el wiki encendido.

## Impact

- Núcleo del arranque (`.agents/hooks/session-bootstrap.sh`) y adaptadores de los dos agentes: leer `enabled` en vez de `PROJECT_WIKI`, y un modo nuevo para `/toggle-wiki`.
- `.agents/wiki/engine.json` (campo `enabled`), `openspec/config.yaml` (los pasos del wiki entre marcas, quitados por defecto) y un comando nuevo en `.claude/commands/` y en OpenCode, propio del proyecto, no del motor.
- Plugin `openspec-autopilot` (`lib/next-step.mjs`, `lib/prompts.mjs`) y skill `openspec-git-discipline` (en `.agents/skills/` y su copia en `.claude/skills/`).
- `openspec/config.yaml` pasa a ser neutro para las zonas de `spec-as-source`, como los `tasks.md`, para que el cambio de `/toggle-wiki` quepa en un solo commit: `zoneOf` en `.agents/openspec/branch-change.mjs` y las skills `spec-as-source` y `openspec-git-discipline`.
- Suite de aceptación: los escenarios de "el usuario desactiva el wiki" pasan a ser "el proyecto tiene el wiki deshabilitado" y "lo habilita"; `support/machine.js` deja de usar `PROJECT_WIKI`.
- README: las secciones del wiki y de cómo desactivarlo.
- ADRs: ADR-0005 decidió el apagado en local con `PROJECT_WIKI=off`, y ADR-0004 da por hecho que el wiki viene encendido; un ADR nuevo los sustituye en esa parte.
- Pruebas con OpenCode real: hay que instalar `@opencode/cli` (el modo auto ya lo bloqueó una vez) y un proveedor de modelo. Además, en Claude Code no está comprobado si lo que instala `/toggle-wiki` a mitad de sesión se carga en esa misma sesión.
