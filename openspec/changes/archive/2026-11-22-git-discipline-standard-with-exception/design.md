## Context

La disciplina de git del proyecto la fijan dos ADR en vigor: ADR-0015 (dos formas del ciclo, la de una rama como recomendada, y los commits del agente en un contenedor efímero) y ADR-0013 (el modelo crea y cambia de rama temporal con `branch-change.mjs`). Los dos sustituyen a ADR-0007, que ya no está en vigor.

Hoy la regla la ponen tres piezas:
- **La skill `.agents/skills/openspec-git-discipline/SKILL.md`**: una reescritura completa de la del origen (`intent-driven-template`, blob `835e065`), en la que la forma de una rama es la recomendada y la estándar una forma admitida.
- **`.agents/openspec/branch-change.mjs`**: las puertas `check propose|apply|archive|commit`. En una rama permanente avisa al proponer y al aplicar, y rechaza un archive con tasks sin hacer. En una rama temporal aplica siempre la forma de una rama: un change por rama, el apply del change de la rama y el archive en ella.
- **Las indicaciones de archivado de `openspec/config.yaml`**, que recomiendan la forma de una rama.

El plugin `openspec-autopilot` (ADR-0014) lleva un change por rama temporal de principio a fin, archive incluido, así que da por hecha la forma de una rama.

La suite de aceptación comprueba la skill por secciones marcadas con `<!-- lifecycle:<id> -->` (`core`, `forms`, `propose`, `apply`, `archive`, `commits`, `agent-commits`, `merge`, `red-flags`) y con expresiones en español sobre su texto.

## Goals / Non-Goals

**Goals:**
- Que la regla del ciclo sea la de la skill estándar, y que nada de lo que permite se detenga ni lleve avisos.
- Que la forma de una rama sea una excepción con una sola causa, el veto del acceso directo a las ramas permanentes, declarada en la configuración y decidida por las puertas de forma determinista.
- Que la skill se lea como la estándar más una excepción, no como una disciplina distinta.

**Non-Goals:**
- Cambiar quién hace los commits: los commits y el push del agente en un contenedor efímero y `check commit` siguen como están.
- Detectar el veto por otros medios que la clave declarada, por ejemplo consultando la protección de la rama en GitHub.
- Cambiar la numeración de los ADR, el cálculo del merge-base o el squash admitido.
- Modificar el schema, la skill del origen, los workflows de OpenSpec o el motor del wiki.

## Decisions

### D1. El veto se declara con `x-main-protected: true` en `openspec/config.yaml`

`branch-change.mjs` lo lee con el mismo analizador mínimo de `x-main`: una línea `x-main-protected:` en la columna 0, con valor `true`. Cualquier otro valor, o la ausencia de la clave, es «sin veto». Se expone en el estado de `--json` como `protected`, para que la skill y el plugin lo lean de la misma fuente. OpenSpec 1.17.0 acepta claves `x-*` sin avisos, como ya pasa con `x-main`.

- *Alternativa: detectar el veto* (protección de la rama en GitHub, o el entorno de un contenedor efímero). Se descarta: necesita red o credenciales, no cubre un veto que solo existe como regla, y ata la causa a un entorno concreto en vez de a lo que la provoca.
- *Alternativa: inferirlo de `x-main` con más de una rama.* Se descarta: tener varias ramas permanentes no implica no poder escribir en ellas.

### D2. Las puertas siguen la regla y abren la excepción solo con el veto

| Situación | Sin veto | Con veto |
|---|---|---|
| `propose` en la rama de origen | deja seguir, sin aviso | igual |
| `propose` en una rama temporal | deja seguir y avisa de que la regla prefiere la rama de origen | deja seguir sin aviso si la rama no tiene change; si tiene otro, no deja |
| `propose` en una rama temporal con varios changes | deja seguir, con el mismo aviso | no deja seguir y dice cómo dejar uno |
| `apply` en la rama de origen, con el change en curso | deja seguir, sin aviso | igual |
| `apply` en una rama temporal o un worktree | deja seguir si `proposal.md` del change está en la rama de origen; si no, no deja y dice que la propuesta llegue antes a ella | además, deja seguir el change de la rama aunque su propuesta no esté en la rama de origen |
| `archive` en la rama de origen, con el change en curso | deja seguir, tenga o no tasks sin hacer, salvo choque de números de ADR | igual |
| `archive` en una rama temporal | no deja seguir y dice que se archiva en la rama de origen tras fusionar | deja seguir el change de la rama, salvo choque de números de ADR |

- El aviso de `propose` en una rama temporal sin veto es el de la estándar («Prefer `main`; if not, warn and ask whether to continue intentionally»). No impide nada.
- La comprobación de «la propuesta está en la rama de origen» es la de la estándar, hecha contra `originRef` (la más avanzada de la rama de origen local y `origin/<rama>`), como ya hace el apply canónico.
- Sin veto, la regla de un change por rama no se aplica: esa regla existe porque el change de la rama se lee desde el merge-base, y eso solo importa cuando el archive se hace en la rama.
- *Alternativa: no tocar las puertas y explicar la excepción solo en la skill.* Se descarta: la causa tiene que decidirla algo determinista, no la lectura que el modelo haga del texto.

### D3. La skill se reescribe sobre el texto de la estándar

- **La base es la skill del origen traducida al español**, con su misma estructura: regla central, puertas, comprobaciones obligatorias y señales de alarma. Las comprobaciones que la estándar hace con `git status`, `git branch` y la búsqueda de la propuesta en `main` las hace `branch-change.mjs check`, que la skill manda ejecutar y obedecer, como hoy.
- **La excepción va en una sección propia**, marcada como excepción a la regla, con su causa (el veto, que impide archivar en la rama de origen) y la clave que la activa. Recoge el ciclo en una rama, la fusión con `--no-ff`, un change por rama y el uso de `start | switch` por el modelo.
- **Lo que no toca la excepción no cambia**: los momentos de commit, los commits del agente en un contenedor efímero, el squash y la numeración de los ADR.
- **Se mantienen los identificadores de sección** que usa la suite (`lifecycle:<id>`). Así los pasos solo cambian donde cambia el comportamiento. `lifecycle:forms` pasa a contener la regla y la excepción.
- *Alternativa: dejar el texto del origen en inglés, tal cual, y añadir la excepción.* Se descarta: el resto de la skill y los pasos de la suite están en español, y mezclar los dos idiomas en una skill que el modelo sigue literalmente da lugar a lecturas inconsistentes.

### D4. Las indicaciones de archivado y el README siguen a la skill

Las indicaciones de archivado de `openspec/config.yaml` dicen que la regla es archivar en la rama de origen tras fusionar la implementación, y que, con el veto declarado, se archiva en la rama temporal antes de fusionarla. Las dos resincronizaciones del wiki que ya describen (en la rama temporal y en la rama de origen) no cambian. El README describe el ciclo de la misma forma.

### D5. El plugin `openspec-autopilot` no cambia

El autopilot lleva el change entero en la rama temporal, que es la excepción. Sin el veto, la puerta `check apply` lo detiene en el primer apply, con un mensaje que dice cómo seguir. No se añade lógica nueva al plugin: la decisión sigue siendo de las puertas.

## Risks / Trade-offs

- **[El autopilot deja de servir sin el veto declarado]** → Su mensaje de puerta lo explica, y el README dice que el autopilot necesita la excepción. Hacer que el plugin siga la regla, con sus fusiones intermedias, queda fuera de alcance.
- **[Sin veto, una rama temporal con varias propuestas vuelve a ser posible, y el change de la rama deja de estar bien definido]** → Sin veto, las puertas no lo usan: el apply comprueba la propuesta en la rama de origen, y el archive solo se hace allí.
- **[La clave se declara mal, o no se declara cuando sí hay veto]** → Sin la clave, el archive en la rama temporal se rechaza con un mensaje que nombra `x-main-protected`. El usuario lo ve en el primer archive.
- **[La traducción de la estándar se aparta de su texto]** → La skill cita el blob del origen (`835e065`), y el ADR registra qué se ha añadido.

## Migration Plan

1. Se añade la lectura de `x-main-protected` y las puertas nuevas a `branch-change.mjs`, con sus tests de núcleo.
2. Se reescriben la skill, las indicaciones de archivado y el README.
3. Se actualizan los pasos de la suite de aceptación para los escenarios nuevos y modificados.
4. Se declara (o no) la clave en el `openspec/config.yaml` de este repositorio, según la pregunta abierta 1.
5. Vuelta atrás: revertir el commit de la fusión. Los changes en curso no guardan ningún estado que dependa de la clave.

## Open Questions

1. **¿Declara este repositorio `x-main-protected: true`?** El veto existe en este repositorio, pero los proyectos que se crean desde la plantilla heredan su `openspec/config.yaml`. Con la clave puesta, todos nacerían con la excepción activa aunque sus ramas permanentes no tengan veto. Las alternativas son ponerla y que cada proyecto la quite si no le corresponde, o no ponerla en la plantilla y declararla aparte en este repositorio, con el mismo efecto.
2. **ADR-0015 y ADR-0013 en vigor.** Este diseño sustituye a ADR-0015 en las formas del ciclo y a ADR-0013 en la creación de ramas por el modelo. Lo que mantienen de ellos (los commits del agente en un contenedor efímero, `check commit`, `--no-ff`, el squash y los números de ADR) debe pasar al ADR nuevo para que siga en vigor.
