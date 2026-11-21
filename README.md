# Plantilla intent-driven

Plantilla para proyectos JavaScript que se desarrollan con [OpenSpec](https://github.com/Fission-AI/OpenSpec) y [Claude Code](https://claude.com/claude-code), siguiendo el schema `intent-driven`. Un proyecto creado desde aquí funciona nada más clonarlo: al abrir una sesión de Claude Code, el propio proyecto instala sus dependencias y deja OpenSpec disponible, y nace con una suite de aceptación funcionando y en verde.

> **Proyectos creados desde esta plantilla:** este README describe la plantilla. Sustitúyelo por el de tu proyecto.

## Qué ofrece

- **OpenSpec 1.17.0**, fijado en `package.json` como dependencia de desarrollo.
- **Schema `intent-driven`** en `openspec/schemas/intent-driven/`, copiado de [intent-driven-dev/openspec-schemas](https://github.com/intent-driven-dev/openspec-schemas). Cada change sigue `proposal -> (specs, design) -> adr -> tasks`, con specs en estilo Gherkin y ADRs duraderos en `adr/`.
- **`spec-as-source` activo** para specs y tasks (`openspec/config.yaml`): los `spec.md` son la fuente ejecutable de los tests de aceptación, las tasks empiezan por esos tests, y los cambios en `openspec/` y en el código nunca van en el mismo commit.
- **`stack: javascript`**: la suite de aceptación usa cucumber-js.
- **Suite de aceptación** en `acceptance-tests/`, montada según la skill `acceptance-test-authoring`, con los escenarios del arranque de sesión ya cubiertos.
- **Workflows de OpenSpec como skills** de Claude Code (sin comandos): `/openspec-explore`, `/openspec-new-change`, `/openspec-continue-change`, `/openspec-apply-change`, `/openspec-update-change`, `/openspec-verify-change`, `/openspec-sync-specs` y `/openspec-archive-change`.
- **Skills del schema** en `.agents/skills/`, enlazadas desde `.claude/skills/`: `acceptance-test-authoring`, `architectural-decision-records`, `c4-diagrams`, `gherkin-authoring`, `glossary`, `grill-me`, `openspec-git-discipline` y `spec-as-source`.
- **Hook de arranque de sesión** que prepara el proyecto (ver abajo).

## Requisitos

- Node.js 22.12 o superior (`engines.node` en `package.json`), con npm.
- bash, para el hook de arranque.

## Qué ocurre al abrir una sesión

Cada vez que se abre una sesión de Claude Code en el proyecto, local o en la nube, se ejecuta `.claude/hooks/session-start.sh`:

1. Si no hay npm, o la versión de Node.js es inferior a `engines.node`, avisa y no instala nada.
2. Para la raíz y para `acceptance-tests/`, por separado: si su `package.json`, su `package-lock.json` o el propio hook han cambiado desde la última instalación correcta (o nunca se instaló), ejecuta `npm install` con **todas** sus dependencias.
3. Pone `node_modules/.bin` de la raíz por delante en el `PATH` de la sesión, así que `openspec` es siempre la versión del proyecto.

La primera sesión de cada clon tarda más, porque instala las dependencias; las siguientes no instalan nada si nada ha cambiado. El hook nunca impide que la sesión arranque: si algo falla, avisa con el prefijo `session-start:` y lo reintenta en la siguiente sesión.

El comportamiento exacto está en la spec [`openspec/specs/session-bootstrap/spec.md`](openspec/specs/session-bootstrap/spec.md) y la decisión en [`adr/0001-session-bootstrap-hook.md`](adr/0001-session-bootstrap-hook.md).

## Ejecutar la suite de aceptación

```bash
cd acceptance-tests && npm test
```

El informe HTML queda en `acceptance-tests/reports/cucumber-report.html`. Los escenarios del arranque de sesión ejecutan `npm install` reales, así que necesitan acceso al registro de npm y tardan más de un minuto. Más detalles en [`acceptance-tests/README.md`](acceptance-tests/README.md).

## Desactivar el hook en local

Si prefieres gestionar las dependencias a mano, desactiva los hooks en tu configuración local, sin tocar la del repositorio. En `.claude/settings.local.json`:

```json
{
  "disableAllHooks": true
}
```

## Instalación manual

Donde el hook no se ejecuta (por ejemplo, en Windows sin bash), instala las dependencias de la raíz y de la suite, y usa el CLI del proyecto con npx:

```bash
npm install
```

```bash
cd acceptance-tests && npm install
```

```bash
npx openspec --version
```

## Qué heredan los proyectos creados desde la plantilla

Además de los archivos de arriba, un proyecto creado desde la plantilla hereda su registro de OpenSpec, como cualquier proyecto que ya se haya trabajado con él:

- **Specs** en `openspec/specs/`: describen el comportamiento que el proyecto hereda (por ejemplo, `session-bootstrap`). Un change del proyecto que lo altere las modifica como cualquier otra spec.
- **ADRs** en `adr/`: las decisiones duraderas de la plantilla, vigentes también para el proyecto mientras ningún ADR posterior las sustituya.
- **Changes archivados** en `openspec/changes/archive/`: la historia de la plantilla. La suite no los ejecuta nunca.
- **La suite de aceptación**, que ejecuta los escenarios heredados junto a los del proyecto y debe seguir en verde.

## Subir de versión OpenSpec

Hazlo desde una máquina con OpenSpec bien configurado (perfil `custom`, solo skills, con los workflows de la lista de arriba) y revisa el diff de `.claude/` antes del commit.
