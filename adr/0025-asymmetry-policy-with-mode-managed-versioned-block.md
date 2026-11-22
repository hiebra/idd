# ADR-0025: Cuándo se acepta que una capacidad exista en un solo agente, con un bloque versionado que sigue al modo del plugin

- Status: accepted, supersedes ADR-0006
- Date: 2026-11-22
- Supersedes: ADR-0006

## Context

ADR-0006 deja que una capacidad exista en un solo agente si, entre otras condiciones, el ciclo y lo versionado son iguales con ella y sin ella. El autopilot de OpenCode (ADR-0014) cumplía esa condición: no escribe nada versionado más allá de lo que producen los workflows.

El change `apply-one-task-per-session-in-normal-mode` necesita que el workflow de apply haga una sola task por sesión, en la sesión interactiva, mientras el usuario usa el autopilot en modo normal. Y lo necesita también cuando el apply se lanza a mano, fuera del paso del plugin. El único sitio que el workflow lee siempre, en los dos agentes, es `operations.apply.guidance` de `openspec/config.yaml`, un archivo versionado. Y el modo es una preferencia de cada usuario, que solo conoce el plugin (`options.auto`). Para que el archivo siga al modo, el plugin tiene que escribirlo, y entonces lo versionado depende del plugin, que es justo lo que ADR-0006 prohíbe.

Alternativas consideradas:

- **Mantener ADR-0006 tal cual y no tocar `config.yaml`.** El plugin podría inyectar la guidance solo en el prompt de su paso `task`. Pero no cubre el apply lanzado a mano, que es el caso que motiva el change.
- **Dejar el bloque fijo en `config.yaml`, sin depender del modo.** Frenaría el modo auto, que existe para avanzar sin paradas.
- **Excepciones caso por caso, sin regla.** Es lo que ADR-0006 quiso evitar.

## Decision

Se mantienen todas las condiciones de ADR-0006 para que una capacidad exista en un solo agente:

- el ciclo y lo versionado son iguales con ella y sin ella;
- en el otro agente lo mismo se hace a mano;
- no deja nada a medias en el otro agente;
- la suite verifica las dos cosas;
- la asimetría se declara en la proposal y en un ADR.

Lo común al ciclo sigue yendo en una pieza neutral.

La primera condición tiene una excepción acotada. Un plugin de un solo agente puede añadir o quitar, en un archivo versionado, un bloque que dependa de una preferencia del usuario, si cumple todo esto:

- **El bloque está declarado y es literal**: su texto exacto está en una spec, y el plugin no escribe nada más del archivo, ni marcas ni comentarios.
- **Los dos agentes lo leen igual**: el archivo es de los que leen los workflows comunes, como `openspec/config.yaml`, y con el bloque o sin él el workflow es válido en los dos agentes.
- **El resultado del ciclo no cambia**: los artefactos, el código y el estado final del change son los mismos con el bloque y sin él. Solo cambian el ritmo y las pausas.
- **El cambio queda a la vista y lo confirma el usuario**: el plugin deja el archivo modificado en el árbol de trabajo, sin stage ni commit, y lo avisa. El commit lo hace el usuario, como el resto del producto del autopilot (ADR-0013).

El primer caso es el de `apply-one-task-per-session-in-normal-mode`: el autopilot mantiene en `operations.apply.guidance` las cuatro indicaciones de «una task por sesión», presentes en modo normal y ausentes en modo auto.

## Consequences

- El modo del autopilot llega también al apply lanzado a mano y a Claude Code. Claude Code lee el archivo tal como lo dejó la última carga del plugin en OpenCode.
- Lo versionado puede cambiar según el modo de quien hace el commit. Dos usuarios con modos distintos generan diffs de solo ese bloque, que tendrán que resolver al hacer commit o fusionar.
- Cada bloque nuevo de este tipo necesita su spec con el texto literal y sus escenarios con el bloque y sin él.
- Si un agente llega a permitir configurar los workflows en local sin tocar archivos versionados, hay que revisar esta excepción en un change nuevo.
