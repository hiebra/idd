# Plantilla intent-driven

Plantilla para proyectos JavaScript que se desarrollan con [OpenSpec](https://github.com/Fission-AI/OpenSpec) y un agente de código, [Claude Code](https://claude.com/claude-code) u [OpenCode](https://opencode.ai) 2, siguiendo el schema `intent-driven`. Un proyecto creado desde aquí funciona nada más clonarlo: al abrir una sesión de cualquiera de los dos agentes, el propio proyecto instala sus dependencias y deja OpenSpec disponible, y nace con una suite de aceptación funcionando y en verde. El mismo clon sirve para los dos agentes, sin configurar nada.

> **Proyectos creados desde esta plantilla:** este README describe la plantilla. Sustitúyelo por el de tu proyecto.

## Qué ofrece

- **OpenSpec 1.17.0**, fijado en `package.json` como dependencia de desarrollo.
- **Schema `intent-driven`** en `openspec/schemas/intent-driven/`, copiado de [intent-driven-dev/openspec-schemas](https://github.com/intent-driven-dev/openspec-schemas). Cada change sigue `proposal -> (specs, design) -> adr -> tasks`, con specs en estilo Gherkin y ADRs duraderos en `adr/`.
- **`spec-as-source` activo** para specs y tasks (`openspec/config.yaml`): los `spec.md` son la fuente ejecutable de los tests de aceptación, las tasks empiezan por esos tests, y los cambios en `openspec/` y en el código nunca van en el mismo commit.
- **`stack: javascript`**: la suite de aceptación usa cucumber-js.
- **Suite de aceptación** en `acceptance-tests/`, montada según la skill `acceptance-test-authoring`, con los escenarios del arranque de sesión y de las skills en cada agente ya cubiertos.
- **Workflows de OpenSpec como skills** (sin comandos), en `.claude/skills/`: `openspec-explore`, `openspec-new-change`, `openspec-continue-change`, `openspec-apply-change`, `openspec-update-change`, `openspec-verify-change`, `openspec-sync-specs` y `openspec-archive-change`. Claude Code los ofrece como `/openspec-explore`, etc., y OpenCode 2 los lee de la misma carpeta.
- **Skills del schema** en `.agents/skills/`, su única copia: `acceptance-test-authoring`, `architectural-decision-records`, `c4-diagrams`, `gherkin-authoring`, `glossary`, `grill-me`, `openspec-git-discipline` y `spec-as-source`. Claude Code las ve a través de sus enlaces en `.claude/skills/` y OpenCode 2 las lee directamente de `.agents/skills/` ([ADR-0003](adr/0003-single-source-for-schema-skills.md)).
- **Arranque de sesión** que prepara el proyecto en los dos agentes (ver abajo).

## Requisitos

- Node.js 22.12 o superior (`engines.node` en `package.json`), con npm.
- bash, para el arranque de sesión.
- Claude Code, u OpenCode 2 o superior. OpenCode 1 no está soportado: su API de plugins es otra.

## Qué ocurre al abrir una sesión

Cada vez que se abre una sesión de Claude Code o de OpenCode en el proyecto, local o en la nube, el adaptador de ese agente ejecuta el núcleo del arranque de sesión, `.agents/hooks/session-bootstrap.sh`, que no depende de ningún agente:

1. Si no hay npm, o la versión de Node.js es inferior a `engines.node`, avisa y no instala nada.
2. Para la raíz y para `acceptance-tests/`, por separado: si su `package.json`, su `package-lock.json` o el propio núcleo han cambiado desde la última instalación correcta (o nunca se instaló), ejecuta `npm install` con **todas** sus dependencias.
3. Devuelve al adaptador la ruta de `node_modules/.bin` de la raíz, y el adaptador la pone por delante en el `PATH` de la sesión, así que `openspec` es siempre la versión del proyecto.

Lo que cambia según el agente es cómo se dispara, cómo se ajusta el `PATH` y dónde aparecen los avisos:

| | Claude Code | OpenCode 2 |
|---|---|---|
| Adaptador | hook `SessionStart`, `.claude/hooks/session-start.sh` (registrado en `.claude/settings.json`) | plugin local `.opencode/plugins/session-bootstrap/` (`server.js` y `tui.js`, sin dependencias) |
| Cuándo instala | al abrir la sesión, antes de empezar | en segundo plano al cargar el plugin; los comandos de la sesión esperan a que termine |
| `PATH` | a través de `CLAUDE_ENV_FILE` | en cada comando de shell, con el hook `create.before` |
| Avisos | en la interfaz, como `systemMessage` del hook | como toasts en la interfaz de terminal |

La primera sesión de cada clon tarda más, porque instala las dependencias; las siguientes no instalan nada si nada ha cambiado, sea cual sea el agente que hizo la instalación. El arranque nunca impide que la sesión arranque: si algo falla, avisa con el prefijo `session-start:` y lo reintenta en la siguiente sesión.

En OpenCode Desktop y en `opencode run` (sin interfaz de terminal) el arranque funciona igual, pero los avisos solo quedan en el log de OpenCode. El plugin se ha probado con OpenCode 2.3.2.

El comportamiento exacto está en las specs [`openspec/specs/session-bootstrap/spec.md`](openspec/specs/session-bootstrap/spec.md) y [`openspec/specs/agent-skills/spec.md`](openspec/specs/agent-skills/spec.md), y la decisión en [`adr/0002-agent-neutral-session-bootstrap.md`](adr/0002-agent-neutral-session-bootstrap.md).

## Ejecutar la suite de aceptación

```bash
cd acceptance-tests && npm test
```

El informe HTML queda en `acceptance-tests/reports/cucumber-report.html`. Los escenarios del arranque de sesión ejecutan `npm install` reales, así que necesitan acceso al registro de npm y tardan más de un minuto. Más detalles en [`acceptance-tests/README.md`](acceptance-tests/README.md).

## Desactivar el arranque en local

Si prefieres gestionar las dependencias a mano, desactiva el arranque en tu configuración local, sin tocar la del repositorio.

En Claude Code, desactiva los hooks en `.claude/settings.local.json`:

```json
{
  "disableAllHooks": true
}
```

En OpenCode, quita el plugin en tu configuración global, `~/.config/opencode/opencode.json`:

```json
{
  "plugins": ["-session-bootstrap"]
}
```

Así no se carga la parte de servidor del plugin, que es la que instala y ajusta el `PATH`. La parte de TUI se sigue cargando, pero sin servidor no muestra nada.

## Instalación manual

Donde el arranque de sesión no se ejecuta (por ejemplo, en Windows sin bash, o con OpenCode 1), instala las dependencias de la raíz y de la suite, y usa el CLI del proyecto con npx:

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

Hazlo desde una máquina con OpenSpec bien configurado (perfil `custom`, solo skills, con los workflows de la lista de arriba, solo para Claude Code) y revisa el diff de `.claude/` antes del commit. Solo se regeneran las skills de `.claude/`; OpenCode 2 las lee de ahí, así que no hace falta generarlas para OpenCode.
