## Why

`hiebra/idd` es una plantilla de proyectos JavaScript que usan OpenSpec con el schema `intent-driven`, pero no funciona recién clonada: las skills `openspec-*` que trae ejecutan el CLI `openspec`, y el CLI no viaja con el repositorio. Cada sesión nueva (sobre todo en la nube, donde el contenedor empieza vacío) exige instalarlo a mano y adivinar la versión correcta.

## What Changes

- Nuevo `package.json` en la raíz, con nombre genérico, que fija `@fission-ai/openspec` en `1.17.0` como dependencia de desarrollo. Es el `package.json` que heredará cada proyecto creado desde la plantilla.
- Nuevo `package-lock.json` y `.gitignore` (excluye `node_modules/`).
- Nuevo hook `SessionStart` de Claude Code (`.claude/settings.json` + script en `.claude/hooks/`) que, al abrir una sesión, instala las dependencias si faltan o han cambiado y deja el `openspec` del repositorio por delante en el `PATH`.
- El hook no lee ni escribe la configuración global de OpenSpec: el perfil de workflows queda fuera de su alcance.
- Nuevo `README.md` que documenta qué ofrece la plantilla y cómo se usa. Lo propio de la plantilla vive ahí, no en `openspec/`.

## Capabilities

### New Capabilities

- `session-bootstrap`: al abrir una sesión de Claude Code en un clon del repositorio, el CLI de OpenSpec está disponible en la versión fijada por el repositorio, sin pasos manuales.

### Modified Capabilities

<!-- Ninguna: no hay specs previas en openspec/specs/. -->

## Impact

- **Archivos nuevos:** `package.json`, `package-lock.json`, `.gitignore`, `.claude/settings.json`, `.claude/hooks/session-start.sh`, `README.md`.
- **Dependencias:** `@fission-ai/openspec@1.17.0` (desarrollo). Requiere Node.js y npm en la máquina; si faltan, el hook avisa y no bloquea la sesión.
- **Sesiones:** cada sesión nueva ejecuta `npm install` la primera vez (unos segundos); las siguientes lo omiten si nada ha cambiado.
- **Proyectos derivados:** heredan el `package.json`, el hook y el README; nacen con `openspec/specs/`, `openspec/changes/` y `adr/` vacíos.
- **Ciclo de vida de este change:** es un change de la plantilla, así que no se archiva. Al terminar se borra de `openspec/changes/` y queda solo en el historial de git.
- **Fuera de alcance:** el perfil de workflows de OpenSpec y la subida de versión del CLI (la hace quien tenga OpenSpec bien configurado); tests de aceptación permanentes.
