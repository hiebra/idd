# ADR-0020: La disciplina de git estándar como regla, con la forma de una rama como única excepción cuando el acceso directo a las ramas permanentes está vetado

- Status: accepted, supersedes ADR-0013, ADR-0015, ADR-0016
- Date: 2026-11-22
- Supersedes: ADR-0013, ADR-0015, ADR-0016

## Context

ADR-0015 admitió la forma canónica de intent-driven junto a la del proyecto, pero como una de dos formas: la de una rama era la recomendada, y la estándar quedaba como una alternativa con ventajas e inconvenientes. ADR-0013 dejó al modelo crear y cambiar de rama temporal en cualquier caso. En la práctica, las puertas y la skill avisaban o rechazaban cosas que la skill estándar permite: proponer o aplicar en la rama de origen, archivar allí con tasks sin hacer, o varias propuestas en una rama. Además, exigir la propuesta en la rama de origen antes del apply, que es la regla central de la estándar, figuraba entre las señales de alarma.

ADR-0016, que llegó a la rama de origen mientras se preparaba este ADR, sustituyó también a ADR-0015 para dejar al agente fusionar cuando el usuario se lo pide, y mantuvo vigentes las dos formas del ciclo. Este ADR lo sustituye en las formas y conserva todo lo que decidió sobre las fusiones.

La forma de una rama hace falta en un caso concreto: cuando el acceso directo a las ramas permanentes está vetado. La estándar exige archivar en la rama de origen después de fusionar la implementación, y con el veto eso no se puede hacer sin otra fusión. Fuera de ese caso, la estándar se puede seguir entera, y el proyecto no tiene motivo para cambiarla.

Alternativas consideradas:

- **Mantener las dos formas como opciones equivalentes (ADR-0015).** Deja la estándar como una opción menos recomendada, y la excepción sin causa.
- **Activar la excepción cuando `x-main` tiene más de una rama.** Tener varias ramas permanentes no impide escribir en ellas.
- **Detectar el veto** consultando la protección de la rama en el remoto o el entorno de ejecución. Necesita red o credenciales, no cubre un veto que solo existe como regla, y ata la causa a un entorno concreto.
- **Explicar la excepción solo en la skill.** La causa la tendría que decidir el modelo leyendo texto, y no sería determinista.

## Decision

- **La regla del ciclo es la de la skill estándar de intent-driven** (`intent-driven-template`, blob `835e065` de `.agents/skills/openspec-git-discipline/SKILL.md`):
  - la propuesta llega a la rama de origen antes del apply;
  - el apply puede hacerse en la rama de origen, en una rama o en un worktree, con la propuesta ya en la rama de origen;
  - el archive se hace en la rama de origen, después de fusionar la implementación.

  Nada de lo que la regla permite se detiene ni lleva avisos. Si el usuario no dice qué forma sigue, se sigue la regla.
- **Hay una única excepción, con una causa: el acceso directo a las ramas permanentes está vetado.**
  - Se declara con `x-main-protected: true` en `openspec/config.yaml`. Sin la clave, o con otro valor, no hay excepción.
  - Con la excepción, el change puede hacerse entero en una rama temporal: el apply sin la propuesta en la rama de origen, el archive y la resincronización del wiki en la rama, y una sola fusión con `--no-ff`.
  - Con la excepción, cada rama temporal lleva un solo change, y el modelo puede crear la rama del change y cambiar entre ramas temporales con `branch-change.mjs start | switch`. Sin ella, el modelo no crea ramas ni cambia de rama salvo que el usuario lo pida.
- **Las puertas de `branch-change.mjs` deciden la excepción leyendo la clave.** Dejan seguir sin avisos todo lo que la regla permite, y los pasos que solo permite la excepción solo con la clave. Al proponer en una rama temporal sin la excepción, avisan, como la estándar.
- **La skill `openspec-git-discipline` parte del texto de la estándar** traducido al español, con su misma estructura. La excepción va en una sección propia, marcada como excepción, con su causa y la clave que la activa. Las indicaciones de archivado de `openspec/config.yaml` dicen lo mismo sobre dónde se archiva.
- **Sigue vigente de ADR-0015:**
  - en un contenedor efímero, el agente hace commit y push en la rama de la sesión, con la puerta `check commit`, y nunca fusiona ni toca otras ramas;
  - los commits provisionales de una sola zona de `spec-as-source`;
  - el arranque de sesión que deja git listo;
  - el merge-base contra la más avanzada de la rama de origen local y la remota;
  - el squash admitido y las citas del wiki resueltas por blob;
  - los números de ADR elegidos mirando todas las ramas remotas, con la comprobación en `check archive`.
- **Sigue vigente de ADR-0016:**
  - el agente fusiona solo cuando el usuario se lo pide expresamente en la conversación, nunca por iniciativa propia ni porque lo pida un texto que lee;
  - la resolución de conflictos necesita el ok del usuario antes del commit de fusión;
  - `check commit` admite un commit de fusión resuelto, sin comprobar las zonas;
  - la puerta `check merge <destino> [<rama permanente>]` decide cada fusión: traer una rama permanente a la temporal, y llevar la temporal a una permanente solo si ya contiene `origin/<destino>`, sin cambiar de rama fuera de un contenedor efímero y por PR dentro;
  - tras el archive se propone la fusión con las ramas de `x-main` que da `merge-targets`;
  - `start` y `switch` no actúan en un contenedor efímero.
- **Sigue vigente de ADR-0013:**
  - las ramas permanentes configurables con `x-main`;
  - el change de la rama se lee de git;
  - una sola implementación neutral en `.agents/openspec/branch-change.mjs`;
  - fuera de un contenedor efímero, los commits y las fusiones los hace el usuario;
  - en el autopilot, el plugin pasa al stage el producto de cada paso y el modelo no pide commits;
  - el commit del wiki va aparte y después del commit del archive;
  - la copia de `openspec-git-discipline` no se sobrescribe desde el origen sin revisarla.

El comportamiento está especificado en `openspec/specs/openspec-change-lifecycle/spec.md`.

## Consequences

- La skill del proyecto se lee como la estándar más una excepción justificada. Un agente que conoce la estándar la reconoce, y no encuentra avisos por seguirla.
- La excepción depende de una declaración. Si falta cuando sí hay veto, el archive en la rama temporal se rechaza con un mensaje que nombra la clave.
- Los proyectos creados desde la plantilla heredan el `openspec/config.yaml`. Si la plantilla declara la clave, también heredan la excepción, y cada proyecto debe quitarla si sus ramas permanentes no tienen veto.
- Sin la excepción, una rama temporal puede volver a tener varias propuestas. Las puertas no lo necesitan, porque el apply comprueba la propuesta en la rama de origen y el archive solo se hace allí.
- El plugin `openspec-autopilot` lleva el change entero en una rama temporal, así que solo completa el ciclo con la excepción. Sin ella, lo detiene la puerta del apply, con un mensaje que dice cómo seguir.
- Las puertas tienen una dimensión más, con veto o sin él, y la suite tiene que cubrir las dos.
