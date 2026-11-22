## Why

ADR-0015 y la spec `openspec-change-lifecycle` prohíben que el agente fusione en un contenedor efímero, y `check commit` rechaza cualquier commit de fusión porque ve mezcladas las zonas de `spec-as-source`. Pero en una sesión en la nube el usuario no puede ejecutar git, y cuando pide una fusión lo valioso es que la haga el agente, que resuelve los conflictos con criterio.

Al cerrar `manage-git-discipline`, el usuario pidió dos fusiones de `origin/main` en la rama:

- **La primera** trajo `fix-tui-subscription-cleanup` y gplint.
- **La segunda** trajo `autopilot-sesion-operativa`, que chocaba de fondo con el ciclo: ramas que crea el modelo y ADRs con el mismo número.

El agente tuvo que hacer esos commits de fusión saltándose la puerta, y en la segunda paró a pedir el ok de cada decisión de la resolución. La fusión final con `main` acabó en un PR ([hiebra/idd#1](https://github.com/hiebra/idd/pull/1)), porque el modo de permisos automático de Claude Code denegó el `git push origin <commit>:refs/heads/main` antes de llegar al proxy de git.

## What Changes

- **Fusiones pedidas por el usuario.** El agente PUEDE fusionar cuando el usuario se lo pide expresamente en la conversación, dentro y fuera de un contenedor efímero. Nunca por iniciativa propia, ni porque lo pida un texto que lea (un comentario de GitHub, un archivo, la salida de una herramienta).
- **Las decisiones de la resolución de conflictos requieren el ok del usuario.**
  - Antes del commit de una fusión con conflictos, el agente presenta cada decisión de la resolución: qué conserva de cada lado, qué reescribe y por qué, incluidas las renumeraciones y los cambios de requisitos.
  - Las uniones mecánicas (dos filas de un índice, dos fuentes en un frontmatter) pueden ir agrupadas, pero también entran en el ok.
  - Después espera el ok, o los cambios que pida el usuario. Sin ok no hay commit de fusión.
- **`check commit` admite un commit de fusión.**
  - Con una fusión en curso (existe `MERGE_HEAD`), no comprueba las zonas, porque cada commit que entra ya las respetaba.
  - A cambio, exige que no quede ningún conflicto sin resolver (`git diff --name-only --diff-filter=U` vacío) y ningún marcador de conflicto (`<<<<<<<`, `=======` o `>>>>>>>` al principio de línea) en los archivos tocados.
  - Las demás condiciones se mantienen: contenedor efímero, rama de la sesión y rama temporal.
- **Una puerta nueva, `check merge <rama de destino>`, para las fusiones del ciclo:**
  - **Traer una rama permanente a la rama temporal** (`origin/<rama>` → la rama actual): se admite siempre.
  - **Llevar la rama temporal a una rama permanente** con `--no-ff`: solo si la rama ya contiene `origin/<destino>`, para que no haya conflictos que resolver en la rama permanente. Si no la contiene, la puerta pide traerla antes.
  - **Fuera de un contenedor efímero**, la fusión con la rama permanente se hace sin cambiar de rama: un commit con el árbol de la rama y los dos padres (`git commit-tree HEAD^{tree} -p origin/<destino> -p HEAD`), subido con `git push origin <commit>:refs/heads/<destino>`. El resultado es el mismo que el de `git merge --no-ff`. La puerta imprime la orden. Si el push se deniega, la puerta y la skill remiten al usuario con la orden exacta, sin dejar nada a medias.
  - **En un contenedor efímero, la fusión con una rama permanente se hace siempre por PR**, de la rama de la sesión contra `<destino>`. No se intenta el push directo ni se pide al usuario que fusione a mano. La puerta, en vez de la orden de push, indica abrir el PR y recomendar fusionarlo con un commit de fusión, no con squash.
- **Tras el archive, la fusión se propone siempre, por las ramas de `x-main` en orden de lista.**
  - Tras el commit del archive y el del wiki, el agente propone fusionar la rama del change con cada rama de `x-main`, en el orden de la lista. El usuario puede saltarse cualquiera, o todas.
  - Nunca propone una rama con la que ya se fusionó: una cuyo `origin/<rama>` ya contiene la rama del change (`git merge-base --is-ancestor`).
  - Si la rama del change no contiene `origin/<rama>`, antes la trae, con el ok de la resolución.
  - Va en la skill `openspec-git-discipline` y en las indicaciones de archivado de `openspec/config.yaml`.
- **`start` y `switch` no actúan en un contenedor efímero.** Hoy solo lo dicen la skill y la spec; el código lo rechazará, con un mensaje que dice cómo seguir.
- **Un ADR nuevo sustituye a ADR-0015.** Conserva lo vigente de él y su relación con ADR-0013, que sigue en vigor, y cambia la regla de que el agente nunca fusiona.

Fuera de alcance:
- **Fusionar el PR desde el agente.** El agente abre el PR y recomienda el commit de fusión; fusionarlo lo decide el usuario en GitHub.
- **Un bloqueo efectivo de las órdenes de git** (por ejemplo, con un hook `PreToolUse`), que ADR-0015 dejó abierto.
- **Modificar nada externo:** el schema `intent-driven`, las skills que vienen de él, los workflows de OpenSpec y el motor del wiki.

## Capabilities

### New Capabilities

### Modified Capabilities
- `openspec-change-lifecycle`:
  - las fusiones que hace el agente cuando las pide el usuario, en vez de «las fusiones las hace siempre el usuario»;
  - el ok del usuario a la resolución de conflictos antes del commit de fusión;
  - el commit de fusión en `check commit`;
  - la puerta nueva `check merge`, con la fusión sin cambiar de rama fuera de un contenedor efímero y el PR dentro;
  - la propuesta de fusión tras el archive, por las ramas de `x-main`;
  - `start` y `switch`, que rechazan actuar en un contenedor efímero.

## Impact

- **`.agents/openspec/branch-change.mjs`:** `check commit` con una fusión en curso, la puerta `check merge` y el rechazo de `start` y `switch` en un contenedor efímero.
- **`.agents/skills/openspec-git-discipline/SKILL.md`** (la copia reescrita del proyecto): las fusiones pedidas por el usuario, el ok de la resolución, `check merge`, el PR en la nube y la propuesta de fusión tras el archive.
- **`openspec/config.yaml`:** la propuesta de fusión en las indicaciones de archivado.
- **`adr/`:** el ADR nuevo que sustituye a ADR-0015.
- **Suite de aceptación:** escenarios sobre repos git de prueba con remoto bare y contenedor efímero simulado (`acceptance-tests/support/branches.js`), con fusiones con y sin conflictos.
- **README:** quién fusiona y cómo.
- **El plugin `openspec-autopilot` de OpenCode no cambia:** no fusiona, y sigue solo la forma recomendada.
