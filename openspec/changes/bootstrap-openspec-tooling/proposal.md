## Why

`hiebra/idd` es una plantilla de proyectos JavaScript que usan OpenSpec con el schema `intent-driven`, pero no funciona recién clonada: las skills `openspec-*` que trae ejecutan el CLI `openspec`, y el CLI no viaja con el repositorio. Cada sesión nueva (sobre todo en la nube, donde el contenedor empieza vacío) exige instalarlo a mano y adivinar la versión correcta.

## What Changes

- Nuevo `package.json` en la raíz, con nombre genérico, que fija `@fission-ai/openspec` en `1.17.0` como dependencia de desarrollo y declara `engines.node: ">=22.12"`, el mínimo que exige ese CLI. Es el `package.json` que heredará cada proyecto creado desde la plantilla.
- Nuevo `package-lock.json` y `.gitignore` (excluye `node_modules/` y los generados de la suite de aceptación).
- Nuevo hook `SessionStart` de Claude Code (`.claude/settings.json` + script en `.claude/hooks/`) que corre en toda sesión, local o en la nube. Al abrirla, instala todas las dependencias del proyecto (no solo OpenSpec) y las del proyecto de tests de aceptación `acceptance-tests/`, cada una si faltan o han cambiado, y deja el `openspec` del repositorio por delante en el `PATH`.
- Si falta npm o la versión de Node es inferior a la requerida, el hook avisa y no instala. Ningún fallo del hook bloquea la sesión.
- Nueva suite de aceptación en `acceptance-tests/`, montada según la skill `acceptance-test-authoring` (cucumber-js), con los step definitions de `session-bootstrap`. Cada proyecto derivado nace con la suite funcionando y en verde.
- Nuevo ADR en `adr/` con la decisión de que los proyectos se preparen solos en cada sesión.
- Nuevo `README.md` que documenta qué ofrece la plantilla y cómo se usa.

## Capabilities

### New Capabilities

- `session-bootstrap`: al abrir una sesión de Claude Code en un clon del repositorio, el CLI de OpenSpec está disponible en la versión fijada por el repositorio y las dependencias del proyecto y de sus tests de aceptación están instaladas, sin pasos manuales.

### Modified Capabilities

<!-- Ninguna: no hay specs previas en openspec/specs/. -->

## Impact

- **Archivos nuevos:** `package.json`, `package-lock.json`, `.gitignore`, `.claude/settings.json`, `.claude/hooks/session-start.sh`, `acceptance-tests/`, `adr/0001-*.md`, `README.md`.
- **Dependencias:** `@fission-ai/openspec@1.17.0` (desarrollo) en la raíz; `@cucumber/cucumber`, `glob`, `cheerio` y `gherkin-lint` en `acceptance-tests/`. Requiere Node.js 22.12 o superior y npm en la máquina; si no se cumplen, el hook avisa, no instala y no bloquea la sesión.
- **Sesiones:** la primera sesión de cada clon ejecuta `npm install` en la raíz y en `acceptance-tests/`; en un proyecto derivado grande puede tardar bastante más que en la plantilla. Las siguientes lo omiten si nada ha cambiado. Esto aplica también en local.
- **Proyectos derivados:** heredan el `package.json`, el hook, la suite de aceptación, la spec `session-bootstrap` en `openspec/specs/`, el ADR en `adr/` y este change en `openspec/changes/archive/`. Su suite de aceptación ejecuta los escenarios de `session-bootstrap` junto a los suyos.
- **Ciclo de vida de este change:** se archiva con `openspec archive`, que lleva la spec a `openspec/specs/session-bootstrap/`.
- **Fuera de alcance:** el perfil de workflows de OpenSpec y la subida de versión del CLI (la hace quien tenga OpenSpec bien configurado).
