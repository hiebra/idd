# ADR-0028: Con x-main-protected, el plugin entra en la sesión de una rama de x-main aunque haya cambios sin commit

- Status: accepted
- Date: 2026-11-22
- Supersedes: -

## Context

ADR-0022 hizo que pasar a una sesión del mismo directorio sea pasar a su rama, y fijó que con cambios sin commit el plugin no cambia de rama: la TUI vuelve a la ventana anterior y avisa. ADR-0020 definió `x-main-protected: true` como la declaración de que el acceso directo a las ramas permanentes está vetado, y con ella las ramas permanentes no reciben commits directos.

Las dos reglas chocan en un punto. Con el veto, los cambios sin commit de una rama temporal no se pueden commitear en `main`, pero tampoco ponen en riesgo nada de `main`, y el usuario que solo quiere entrar en su sesión libre de `main` tiene que hacer un commit, guardar los cambios o salir a mano. Sin el veto, la regla de ADR-0022 sigue siendo la correcta.

Esto no cambia la decisión de ADR-0022, que es que cada sesión tiene su rama, ni sus consecuencias; añade una excepción a una de sus reglas, como ADR-0011 matizó ADR-0008, por eso no la sustituye.

Alternativas consideradas:

- **Cambiar siempre, con cambios sin commit.** Quitaría la protección de ADR-0022 a las ramas temporales, donde sí hay trabajo en curso que se mezclaría con otra rama.
- **Guardar los cambios en un stash al cambiar.** ADR-0022 lo descartó: cada salto guarda y recupera, y un fallo deja conflictos.
- **Un parámetro del cambio de rama del modelo.** Abriría en las reglas del modelo (ADR-0020) una puerta que no tiene que existir.

## Decision

- **Excepción de ADR-0022**: si `openspec/config.yaml` declara `x-main-protected: true` y la rama de la sesión en la que entra la TUI es una de las de `x-main`, el plugin hace el checkout aunque el directorio tenga cambios sin commit. Los cambios pasan a esa rama como en un `git checkout` normal, sin forzar ni stash, y el aviso lo dice.
- **Con la excepción cuentan todas las ramas de `x-main`**, no solo la rama de origen.
- **Sigue valiendo de ADR-0022**: sin la clave, o con otro valor, no hay excepción; con otra sesión trabajando en el directorio no hay checkout; las ramas temporales con cambios sin commit no se cambian; si git rechaza el checkout, el plugin no toca nada y la TUI vuelve atrás con el error.
- **La regla de la excepción vive en un solo cambio de rama del módulo neutral** `.agents/openspec/branch-change.mjs`, que comprueba el veto y las ramas permanentes. Las funciones del modelo (`switchBranch`, `originBranch`, `start`) no cambian.

El comportamiento está especificado en `openspec/specs/openspec-autopilot/spec.md`.

## Consequences

- Con el veto, entrar en la sesión de `main` desde una rama temporal con trabajo pendiente se lleva ese trabajo a `main`, donde no se puede commitear. El usuario lo ve en el aviso y puede volver a su rama temporal entrando en su sesión.
- Quien declara `x-main-protected: true` sin el veto real habilita la excepción. La clave la declara el proyecto, como en ADR-0020.
- El plugin tiene ahora dos formas de cambiar de rama, con y sin la excepción, y la suite tiene que cubrir las dos.
- En un contenedor efímero el plugin no cambia de rama (ADR-0016, vigente en lo que dejó ADR-0020).
