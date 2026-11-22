# ADR Review Manifest

- Status: completed
- Review date: 2026-11-22

## Review Summary

ADR review completed for this change. El design cambia de forma duradera el ciclo git que fijó ADR-0007:
- admite la forma canónica de intent-driven junto a la de una rama, que pasa a ser la recomendada con `--no-ff`;
- admite el squash;
- deja al agente hacer commit y push en la rama de la sesión en un contenedor efímero;
- numera los ADRs mirando todas las ramas remotas.

Como los ADRs aceptados no se editan, se recoge en un ADR nuevo que sustituye a ADR-0007 y conserva lo que sigue vigente de él. Con la regla nueva (`git fetch` y el número más alto de `adr/` en todas las ramas remotas, que entonces era 0010) se eligió el 0011. Antes del archive, `check archive` detectó que a `origin/main` habían llegado desde otras ramas un ADR-0011 y un ADR-0012, así que se renumeró a 0013. Al fusionar la rama con `main`, `autopilot-sesion-operativa` ya había ocupado el 0013 y el 0014, y quedó como 0015.

## In-Force ADRs Reviewed

- ADR-0002: arranque de sesión con un núcleo neutral y un adaptador por agente (sustituye a ADR-0001). La preparación de git y la rama de la sesión van en el núcleo, `session-bootstrap.sh`, sin cambiar los adaptadores.
- ADR-0003: una sola copia de las skills. La skill `openspec-git-discipline` sigue en `.agents/skills/`.
- ADR-0004: el conocimiento del proyecto vive en un wiki que el agente consulta primero. Se mantiene que el commit del wiki va aparte y después del commit del archive.
- ADR-0005: el motor del wiki llega por el arranque de sesión. No se toca el motor; las citas se resuelven por el blob que ya guardan sus manifiestos.
- ADR-0006: política de asimetrías entre agentes. `check commit` depende del entorno, no del agente: el ciclo y lo versionado son iguales en los dos, así que no es una asimetría.
- ADR-0007: un change, una rama temporal y una sola fusión. Sustituido por ADR-0015 (y, en lo que toca a las ramas, por ADR-0013 de autopilot-sesion-operativa).
- ADR-0008: plugin de autopilot para OpenCode 2. Sigue en vigor: el autopilot sigue la forma recomendada y pide los commits al usuario, porque OpenCode no corre en un contenedor efímero.
- ADR-0009: operaciones de lectura y escritura del wiki. No aplica.
- ADR-0010: las instrucciones del proyecto al agente llegan por el arranque de sesión. No aplica: las reglas de git van en la skill y en `openspec/config.yaml`, como hasta ahora.

ADR-0001 está sustituido por ADR-0002 y solo se ha leído como contexto histórico.

## New Durable ADRs Created

- [ADR-0015: Dos formas del ciclo de un change y commits del agente en contenedores efímeros](../../../../adr/0015-git-discipline-two-forms-and-ephemeral-commits.md), que sustituye a ADR-0007.
