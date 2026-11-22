# slim-template

La variante adelgazada es la plantilla para quien usa la instalación global en Windows. No es otro repositorio ni una rama: es un artefacto de cada release, generado desde la plantilla completa de la misma versión.

## ADDED Requirements

### Requirement: La variante adelgazada es un artefacto de cada release
Cada release DEBE publicar, junto al `.bat`, la variante adelgazada de la plantilla de su misma versión, generada desde la plantilla completa del tag de la release.

#### Scenario: La release trae la variante adelgazada de su versión

```gherkin
Given una release de la plantilla con el tag `v1.2.0`
When se genera su variante adelgazada
Then sale de la plantilla completa del tag `v1.2.0`
And se publica en la release `v1.2.0` junto al `.bat`
```

### Requirement: Solo contiene lo que es de cada proyecto
La variante adelgazada NO DEBE contener nada de lo que aporta la instalación global ni de Claude Code: ni `openspec/schemas/`, ni `.agents/`, ni `.opencode/`, ni `.claude/`. Tampoco DEBE heredar las specs de la plantilla ni su suite de aceptación, que describen y prueban la plantilla completa, ni sus herramientas de release. DEBE contener:
- `openspec/config.yaml` con `schema: intent-driven`;
- el ajuste del wiki del proyecto y `.wiki/`;
- `package.json` con el OpenSpec fijado;
- `adr/`;
- `openspec/specs/` sin ninguna spec;
- una suite de aceptación sin escenarios ni steps, lista para las specs del proyecto, que pasa en verde.

#### Scenario: Qué no contiene

```gherkin
Given la variante adelgazada de una release
When se buscan en ella `openspec/schemas/`, `.agents/`, `.opencode/` y `.claude/`
Then no está ninguno
```

#### Scenario: No hereda las specs ni la suite de la plantilla

```gherkin
Given la variante adelgazada de una release
When se buscan en ella las specs, los steps y las herramientas de release de la plantilla
Then no hay ninguna spec en `openspec/specs/`
And la suite de aceptación no tiene steps ni soporte
And no tiene el workflow ni los scripts de release de la plantilla
```

#### Scenario: La suite de un proyecto adelgazado empieza en verde

```gherkin
Given la variante adelgazada de una release
When se pasan en ella la suite de aceptación y el lint de las specs
Then los dos terminan con éxito, sin ningún escenario
```

#### Scenario: Qué contiene

```gherkin
Given la variante adelgazada de una release
When se lee su `openspec/config.yaml`
Then declara `schema: intent-driven`
And el proyecto tiene un `package.json` con la versión de OpenSpec de la release
```

### Requirement: Un proyecto adelgazado funciona con la instalación global
Un proyecto creado desde la variante adelgazada de una release DEBE funcionar en OpenCode, sin configurar nada tras clonar, en una máquina Windows con la instalación global de la misma release: el schema, las skills, los plugins y el motor del wiki los aporta la instalación global.

#### Scenario: Ciclo de un change en un proyecto adelgazado

```gherkin
Given una máquina Windows con la instalación global de una release
And un proyecto creado desde la variante adelgazada de esa release
When se abre una sesión de OpenCode en el proyecto
Then `openspec --version` en la sesión muestra la versión fijada por el proyecto
And la puerta `check propose` de `branch-change.mjs` responde sobre el proyecto
```
