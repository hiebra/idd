# Plantilla intent-driven

Plantilla para proyectos JavaScript que se desarrollan con [OpenSpec](https://github.com/Fission-AI/OpenSpec) y [Claude Code](https://claude.com/claude-code), siguiendo el schema `intent-driven`. Un proyecto creado desde aquí funciona nada más clonarlo: al abrir una sesión de Claude Code, el propio proyecto instala sus dependencias y deja OpenSpec disponible.

> **Proyectos creados desde esta plantilla:** este README describe la plantilla. Sustitúyelo por el de tu proyecto.

## Qué ofrece

- **OpenSpec 1.17.0**, fijado en `package.json` como dependencia de desarrollo.
- **Schema `intent-driven`** en `openspec/schemas/intent-driven/`, copiado de [intent-driven-dev/openspec-schemas](https://github.com/intent-driven-dev/openspec-schemas). Cada change sigue `proposal -> (specs, design) -> adr -> tasks`, con specs en estilo Gherkin y ADRs duraderos en `adr/`.
- **`spec-as-source` activo** para specs y tasks (`openspec/config.yaml`): los `spec.md` son la fuente ejecutable de los tests de aceptación, las tasks empiezan por esos tests, y los cambios en `openspec/` y en el código nunca van en el mismo commit.
- **`stack: javascript`**: los tests de aceptación usan cucumber-js.
- **Workflows de OpenSpec como skills** de Claude Code (sin comandos): `/openspec-explore`, `/openspec-new-change`, `/openspec-continue-change`, `/openspec-apply-change`, `/openspec-update-change`, `/openspec-verify-change`, `/openspec-sync-specs` y `/openspec-archive-change`.
- **Skills del schema** en `.agents/skills/`, enlazadas desde `.claude/skills/`: `acceptance-test-authoring`, `architectural-decision-records`, `c4-diagrams`, `gherkin-authoring`, `glossary`, `grill-me`, `openspec-git-discipline` y `spec-as-source`.
- **Hook de arranque de sesión** que prepara el proyecto (ver abajo).

## Requisitos

- Node.js 22.12 o superior (`engines.node` en `package.json`), con npm.
- bash, para el hook de arranque.

## Qué ocurre al abrir una sesión

Cada vez que se abre una sesión de Claude Code en el proyecto, local o en la nube, se ejecuta `.claude/hooks/session-start.sh`:

1. Si no hay npm, o la versión de Node.js es inferior a `engines.node`, avisa y no instala nada.
2. Si `package.json`, `package-lock.json` o el propio hook han cambiado desde la última instalación correcta (o nunca se instaló), ejecuta `npm install` con **todas** las dependencias del proyecto.
3. Pone `node_modules/.bin` por delante en el `PATH` de la sesión, así que `openspec` es siempre la versión del proyecto.

La primera sesión de cada clon tarda más, porque instala las dependencias; las siguientes no instalan nada si nada ha cambiado. El hook nunca impide que la sesión arranque: si algo falla, avisa con el prefijo `session-start:` y lo reintenta en la siguiente sesión.

## Desactivar el hook en local

Si prefieres gestionar las dependencias a mano, desactiva los hooks en tu configuración local, sin tocar la del repositorio. En `.claude/settings.local.json`:

```json
{
  "disableAllHooks": true
}
```

## Instalación manual

Donde el hook no se ejecuta (por ejemplo, en Windows sin bash), instala las dependencias y usa el CLI del proyecto con npx:

```bash
npm install
```

```bash
npx openspec --version
```

## Trabajar en la plantilla

Los proyectos creados desde la plantilla deben nacer con `openspec/specs/`, `openspec/changes/` y `adr/` vacíos. Por eso los cambios de la propia plantilla se hacen con **changes efímeros**:

1. Se trabaja con un change normal de OpenSpec en `openspec/changes/`.
2. Al terminar, el código se sube en un commit propio.
3. En lugar de archivar el change, se borra en otro commit. Queda solo en el historial de git, que "Use this template" no copia.

Lo que la plantilla ofrece y decide se documenta en este README, no en `openspec/specs/` ni en `adr/`. Entre esas decisiones: el proyecto se prepara solo en cada sesión mediante un hook versionado que instala todas sus dependencias.

Para subir la versión de OpenSpec, hazlo desde una máquina con OpenSpec bien configurado (perfil `custom`, solo skills, con los workflows de la lista de arriba) y revisa el diff de `.claude/` antes del commit.
