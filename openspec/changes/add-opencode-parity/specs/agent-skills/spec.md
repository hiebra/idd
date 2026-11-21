# agent-skills

## ADDED Requirements

### Requirement: Skills del schema disponibles en cada agente soportado
Cada skill de `.agents/skills/` DEBE estar disponible, exactamente una vez, en cada agente soportado (Claude Code y OpenCode 2 o superior), sin configurar nada tras clonar, y el nombre que declara DEBE coincidir con el de su directorio. Una skill está disponible en un agente cuando este la encuentra al buscar skills de proyecto en el clon, según las reglas de descubrimiento de ese agente.

#### Scenario Outline: El agente encuentra las skills del schema

```gherkin
Given un clon del proyecto
When <agente> busca las skills del proyecto
Then encuentra cada skill de `.agents/skills/`
And cada una aparece una sola vez
And el nombre que declara cada skill coincide con el de su directorio

Examples:
  | agente      |
  | Claude Code |
  | OpenCode    |
```

#### Scenario: Una skill del schema sin enlazar en Claude Code

```gherkin
Given un clon del proyecto con una skill en `.agents/skills/` que Claude Code no encuentra
When se comprueba la disponibilidad de las skills del proyecto
Then la comprobación falla
And indica qué skill falta y en qué agente
```

### Requirement: Workflows de OpenSpec disponibles en cada agente soportado
Los workflows de OpenSpec que ofrece el proyecto DEBEN estar disponibles como skills en cada agente soportado, sin configurar nada tras clonar y en el mismo sentido de "disponible" que las skills del schema, y los de todos los agentes DEBEN corresponder a la versión de OpenSpec fijada en el `package.json` del proyecto.

#### Scenario Outline: El agente encuentra los workflows de OpenSpec

```gherkin
Given un clon del proyecto
When <agente> busca las skills del proyecto
Then encuentra estas skills de OpenSpec:
  | skill                    |
  | openspec-explore         |
  | openspec-new-change      |
  | openspec-continue-change |
  | openspec-apply-change    |
  | openspec-update-change   |
  | openspec-verify-change   |
  | openspec-sync-specs      |
  | openspec-archive-change  |
And todas corresponden a la versión de OpenSpec fijada por el proyecto

Examples:
  | agente      |
  | Claude Code |
  | OpenCode    |
```
