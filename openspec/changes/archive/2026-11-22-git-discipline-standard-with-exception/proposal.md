## Why

La skill `openspec-git-discipline` del proyecto no amplía la estándar de intent-driven (`intent-driven-template`): la sustituye. Por eso hoy avisa o rechaza cosas que la estándar permitía:

- **Proponer en la rama de origen** deja seguir con un aviso, y la skill manda llevarse el change a una rama temporal si el usuario no dice nada.
- **Aplicar en la rama de origen** deja seguir con un aviso, y la skill dice que la implementación va en otra rama.
- **Archivar en la rama de origen** se rechaza si queda alguna task sin hacer.
- **Varias propuestas en una rama** se rechazan.
- **Exigir la propuesta en la rama de origen antes del apply**, que es la regla central de la estándar, figura entre las señales de alarma.

La forma de una rama y una sola fusión hace falta en un caso concreto: cuando el acceso directo a la rama permanente está vetado, la estándar no se puede completar, porque exige archivar en ella. Ese caso es una excepción a la regla, y debe verse así: con su causa, y solo cuando la causa se da.

## What Changes

- **La skill estándar vuelve a ser la regla.**
  - `openspec-git-discipline` parte del texto de la estándar: la propuesta llega a la rama de origen antes del apply; el apply puede hacerse en la rama de origen, en una rama o en un worktree; y el archive se hace en la rama de origen, después de fusionar la implementación.
  - Todo lo que la estándar permitía se puede hacer sin avisos ni rechazos.
  - Si no se da la causa de la excepción, solo vale la regla.
- **Una única excepción, con su causa: el acceso directo a la rama permanente está vetado.**
  - Se declara en `openspec/config.yaml` con una clave nueva, `x-main-protected: true`. Sin ella, o con `false`, no hay excepción.
  - Con la excepción, un change puede hacerse entero en una rama temporal: el apply sin que la propuesta haya llegado a la rama de origen, el archive y la resincronización del wiki en la rama temporal, y una sola fusión con `--no-ff`.
  - Solo con la excepción, el modelo crea la rama del change o cambia de rama temporal con `branch-change.mjs start | switch`, y cada rama temporal lleva un solo change.
  - La skill presenta la excepción en una sección propia, marcada como excepción a la regla y con su causa.
- **`branch-change.mjs` decide la excepción leyendo esa clave:**
  - deja de avisar al proponer o aplicar en la rama de origen;
  - deja de rechazar un archive en la rama de origen con tasks pendientes;
  - deja de rechazar varias propuestas en una rama sin la excepción;
  - sin la excepción, rechaza el apply de una propuesta que no está en la rama de origen y el archive fuera de ella, como la estándar;
  - con la excepción, admite el ciclo entero en la rama temporal, como hoy.
- **Un ADR nuevo sustituye a ADR-0015** en lo que toca a las formas del ciclo, y a ADR-0013 en la creación de ramas por el modelo.

Fuera de alcance:
- **Quién hace los commits**, incluidos los commits y el push del agente en un contenedor efímero y la puerta `check commit`: no cambian.
- **La numeración de los ADRs**, el merge-base contra la rama de origen más avanzada y el squash admitido: no cambian.
- **Detectar el veto por otros medios** que la clave declarada, por ejemplo consultando la protección de la rama en GitHub.
- **Modificar nada externo**: el schema `intent-driven`, la skill del origen, los workflows de OpenSpec y el motor del wiki.

## Capabilities

### New Capabilities

### Modified Capabilities
- `openspec-change-lifecycle`:
  - la regla estándar como forma por defecto, sin avisos ni rechazos para lo que permite;
  - la excepción por veto del acceso directo a la rama permanente, declarada con `x-main-protected`;
  - las puertas, que deciden la excepción con esa clave;
  - la creación de ramas por el modelo y un change por rama, solo con la excepción;
  - cuándo conviene cada forma, que pasa a ser cuándo se da la excepción.

## Impact

- **`.agents/skills/openspec-git-discipline/SKILL.md`**: reescrita sobre el texto de la estándar, con la excepción en una sección propia.
- **`.agents/openspec/branch-change.mjs`** y sus tests (`core-tests/branch-change.test.js`): la lectura de `x-main-protected` y las puertas `propose`, `apply` y `archive`.
- **`openspec/specs/openspec-change-lifecycle/spec.md`** y los pasos de la suite de aceptación que la ejecutan.
- **`openspec/config.yaml`**: la clave `x-main-protected` y las indicaciones de archivado, que hoy recomiendan la forma de una rama.
- **`adr/`**: el ADR nuevo.
- **README**: el ciclo de un change.
- **El plugin `openspec-autopilot`**: revisar si da por hecha la forma de una rama; si es así, solo funciona con la excepción.
- **El wiki del proyecto**: se resincroniza al archivar.
