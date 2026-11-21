# ADR-0001: El proyecto se prepara solo al abrir cada sesión de Claude Code

- Status: accepted
- Date: 2026-11-21
- Supersedes: -

## Context

El proyecto se trabaja con OpenSpec y Claude Code, en local y en sesiones en la nube cuyo contenedor empieza sin dependencias instaladas. Las skills de OpenSpec que trae el repositorio ejecutan el CLI `openspec`, y la suite de aceptación (`acceptance-tests/`) es un proyecto Node aparte. Sin un paso de preparación, cada sesión nueva exige instalar a mano el CLI en la versión correcta, las dependencias del proyecto y las de la suite, y es fácil olvidarlo o instalar otra versión.

El repositorio es además una plantilla: lo que se decida aquí lo heredan todos los proyectos creados desde ella.

Alternativas consideradas: un script de instalación del entorno de la nube (no cubre sesiones locales ni viaja con el repositorio), instrucciones en el README (dependen de que alguien se acuerde) e instalar solo el CLI de OpenSpec (deja la aplicación y la suite sin dependencias).

## Decision

El repositorio versiona un hook `SessionStart` de Claude Code (`.claude/hooks/session-start.sh`, registrado en `.claude/settings.json`) que corre en todas las sesiones, locales y en la nube, y:

- instala con `npm install` todas las dependencias de la raíz y, si existe, de `acceptance-tests/`, solo cuando faltan o han cambiado;
- pone `node_modules/.bin` de la raíz por delante en el `PATH` de la sesión, para que `openspec` sea siempre la versión fijada en `package.json`;
- no instala nada si falta npm o la versión de Node.js es inferior a `engines.node`, y avisa;
- nunca bloquea la sesión: ante cualquier fallo avisa por stderr y termina con éxito.

El comportamiento exacto está especificado en `openspec/specs/session-bootstrap/spec.md` y lo verifica la suite de aceptación.

## Consequences

- Un clon recién creado funciona al abrir la primera sesión, sin pasos manuales, y todas las sesiones usan la misma versión del CLI de OpenSpec.
- La primera sesión de cada clon tarda más, porque instala todas las dependencias; las siguientes no instalan nada si nada ha cambiado.
- El hook también corre en local e impone `npm install` a quien abra Claude Code en el proyecto; quien no lo quiera debe desactivar los hooks en su configuración local.
- El proyecto queda ligado a Node.js con npm y a bash para la preparación automática; donde no hay bash (Windows sin un intérprete compatible) hay que instalar a mano.
- Cambiar qué se instala, cuándo o cómo se expone el CLI exige un change que modifique la spec `session-bootstrap` y, si cambia la decisión, un ADR que sustituya a este.
