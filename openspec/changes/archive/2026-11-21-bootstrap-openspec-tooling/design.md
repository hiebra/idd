## Context

`hiebra/idd` es una plantilla para proyectos JavaScript con OpenSpec (`intent-driven`, `spec-as-source`, `stack: javascript`). Trae en el repositorio las skills de OpenSpec y las del schema, pero no el CLI `openspec` que esas skills ejecutan. Hoy cada sesión nueva exige instalarlo a mano.

Restricciones:

- La plantilla se usa en sesiones locales de Claude Code y en sesiones en la nube, donde el contenedor empieza sin dependencias instaladas.
- El `package.json` de la raíz es el que heredará cada proyecto derivado: con el tiempo contendrá también las dependencias de su aplicación.
- Con `spec-as-source`, la suite de aceptación (`acceptance-tests/`) es un proyecto Node independiente con su propio `package.json`, y ejecuta todos los `spec.md` de `openspec/specs/` y de los changes activos. Debe terminar sin pasos pendientes ni sin definir.
- Los proyectos derivados heredan las specs, los ADRs y la suite de la plantilla. Una spec heredada sin sus step definitions dejaría la suite del proyecto derivado en rojo desde el primer día.
- OpenSpec 1.17.0 exige Node.js `>=22.12.0`.
- No hay ADRs vigentes en `adr/` que condicionen este diseño.

Flujo previsto al abrir una sesión:

```
                    abrir sesion (local o nube)
                         |
                         v
                 hay node + npm? ---no---> aviso, fin (sesion sigue)
                         |si
                         v
              node >= engines.node? --no--> aviso, NO instala, fin
                         |si
                         v
   para la raiz y, si existe, acceptance-tests/:
     package.json / lock / hook sin cambios? ---si--> no reinstala ese proyecto
                         |no
                         v
               npm install (todas sus deps) ---falla--> aviso, sigue
                         |
                         v
           node_modules/.bin de la raiz por delante en el PATH
```

## Goals / Non-Goals

**Goals:**

- Que `openspec`, en la versión fijada por el proyecto, esté disponible en cualquier sesión de Claude Code sin pasos manuales.
- Que el proyecto y su suite de aceptación queden con todas sus dependencias instaladas al abrir sesión.
- Que el coste recurrente sea casi nulo: solo se instala cuando algo ha cambiado.
- Que ningún fallo del arranque impida trabajar.
- Que cada proyecto derivado nazca con una suite de aceptación funcionando y en verde, que cubra el comportamiento que hereda.

**Non-Goals:**

- Gestionar el perfil de workflows de OpenSpec o cualquier otra configuración global.
- Subir de versión OpenSpec: lo hace quien tenga OpenSpec bien configurado.
- Instalar Node.js o npm, o fijar una versión exacta de Node (`.nvmrc`): cada proyecto derivado decide la suya.
- Soportar Windows sin un intérprete bash.

## Decisions

### D1. Hook `SessionStart` versionado en el repositorio

Un script `.claude/hooks/session-start.sh`, registrado en `.claude/settings.json` y referenciado con `$CLAUDE_PROJECT_DIR`.

- *Alternativa: script de instalación del entorno de la nube.* Queda atado a ese entorno: no cubre sesiones locales ni otros entornos, y no viaja con la plantilla.
- *Alternativa: instrucciones en el README.* Dependen de que alguien se acuerde, que es justo el problema.

### D2. Corre en todas las sesiones, locales y en la nube

No se condiciona a `CLAUDE_CODE_REMOTE`. Un solo comportamiento es más simple de especificar, y en local mantiene las dependencias al día tras un `git pull` sin intervención. Con D4, el coste en local es casi nulo cuando nada ha cambiado.

### D3. `npm install` de todas las dependencias, en la raíz y en `acceptance-tests/`

- *Frente a instalar solo OpenSpec:* en un proyecto JavaScript quien abre una sesión casi siempre necesita sus dependencias; instalar solo el CLI dejaría la aplicación a medias.
- *Incluir `acceptance-tests/`:* es un proyecto Node aparte; si el hook no lo instala, la suite no corre en una sesión nueva hasta que alguien haga `npm install` dentro. Se instala solo si existe `acceptance-tests/package.json`.
- *Frente a `npm ci`:* `npm ci` borra `node_modules` entero en cada ejecución. En un proyecto derivado grande eso convierte cada reinstalación en una instalación completa. `npm install` respeta el lock y solo toca lo que difiere.

Se ejecuta con `--no-audit --no-fund`. Su salida va a un log temporal y solo se muestra un extracto por stderr si falla, porque lo que un hook `SessionStart` escribe en stdout entra en el contexto de la sesión. Si falla la instalación de un proyecto, se intenta igualmente la del otro.

### D4. Reinstalación guiada por un sello de hashes por proyecto

Tras una instalación correcta, el hook guarda en `<proyecto>/node_modules/.session-start.sha256` los hashes de su `package.json`, su `package-lock.json` y el propio script. En cada sesión comprueba ese sello: si coincide, no instala ese proyecto. La raíz y `acceptance-tests/` tienen sellos independientes, así que un cambio en uno no reinstala el otro.

- El sello se borra **antes** de instalar: si la instalación falla, la siguiente sesión vuelve a intentarlo.
- Vive dentro de `node_modules/`, así que ya está ignorado por git y desaparece si alguien borra `node_modules`, lo que fuerza una instalación.
- Incluir el script en el sello hace que un cambio en el propio hook fuerce una reinstalación.
- *Alternativa: comparar fechas de modificación.* Un `git checkout` o un clon las cambia sin cambiar el contenido, y provocaría instalaciones innecesarias.

### D5. `PATH` mediante `CLAUDE_ENV_FILE`

El hook añade `export PATH="<proyecto>/node_modules/.bin:$PATH"` al archivo que indica `CLAUDE_ENV_FILE`, para que los comandos de la sesión usen el `openspec` del proyecto antes que cualquiera global.

- Si `CLAUDE_ENV_FILE` no existe (versiones de Claude Code que no lo ofrecen), el hook avisa de que el `PATH` no se ha podido ajustar y de que el CLI sigue disponible con `npx openspec`.
- *Alternativa: que las skills usen `npx openspec`.* Obligaría a modificar las skills generadas por OpenSpec, que `openspec update` sobrescribe.

### D6. Comprobación de la versión de Node a partir de `engines.node`

El `package.json` declara `engines.node: ">=22.12"`. El hook lee ese campo y, si tiene la forma `>=X`, `>=X.Y` o `>=X.Y.Z`, lo compara con la versión de `node`. Si es inferior, avisa con la versión requerida y la encontrada, y no instala.

- Leerlo de `engines` evita duplicar el requisito y respeta a un proyecto derivado que suba su mínimo.
- Si `engines.node` falta o tiene otra forma (rangos `^`, `||`…), el hook no puede comprobarlo, lo dice en un aviso y continúa con la instalación.
- *Alternativa: confiar en npm.* npm solo emite un aviso `EBADENGINE` que se pierde en la salida, y el fallo aparece después como un error confuso del CLI.

### D7. Nunca bloquear la sesión

El script termina siempre con código 0. Los avisos (sin npm, Node antiguo, instalación fallida, `PATH` sin ajustar) van a stderr con el prefijo `session-start:`. La comprobación de npm es lo primero, antes de leer nada.

### D8. Contenido del README

El `README.md` presenta la plantilla. Se da por terminado cuando cubre:

- **Qué ofrece:** schema `intent-driven`, `spec-as-source`, `stack: javascript`, los workflows incluidos, las skills del schema y la suite de aceptación.
- **Requisitos:** Node.js 22.12 o superior, npm y bash.
- **Qué ocurre al abrir sesión:** el hook instala las dependencias de la raíz y de `acceptance-tests/` y ajusta el `PATH`; la primera sesión de cada clon tarda más.
- **Cómo ejecutar la suite de aceptación.**
- **Cómo desactivar el hook** en local, para quien prefiera gestionar las dependencias a mano.
- **Instalación manual** donde el hook no corre (por ejemplo, Windows sin bash): `npm install` en la raíz y en `acceptance-tests/`, y `npx openspec`.
- **Qué heredan los proyectos derivados:** las specs de `openspec/specs/`, los ADRs de `adr/`, los changes archivados de la plantilla y la suite, que cubre el comportamiento heredado.
- **Aviso a los proyectos derivados:** deben reemplazar este README por el suyo.

El comportamiento y las decisiones de la plantilla viven en `openspec/specs/` y en `adr/`, como en cualquier proyecto; el README los presenta y remite a ellos.

### D9. Suite de aceptación que ejecuta el hook en copias desechables

`acceptance-tests/` se monta según `acceptance-test-authoring`: los cuatro archivos de referencia copiados tal cual (`extract-gherkin.cjs`, `cucumber.cjs`, `openspec-effective-paths.cjs`, `.gherkin-lintrc`), un `package.json` propio con `@cucumber/cucumber`, `glob`, `cheerio` y `gherkin-lint`, informe HTML en `reports/` y el lint de specs.

No hay aplicación que levantar: lo que se prueba es el arranque de sesión. Por eso:

- El World de cucumber prepara, por escenario, una copia desechable del proyecto en un directorio temporal (sin `node_modules`, `.git` ni `acceptance-tests/`, que el escenario de tests de aceptación crea a propósito) y ejecuta el hook como lo haría Claude Code: con `CLAUDE_PROJECT_DIR` apuntando a la copia y `CLAUDE_ENV_FILE` a un archivo temporal.
- Las condiciones de la máquina se simulan con el `PATH` del hook: un directorio de herramientas sin npm, un `node` falso que informa de la versión 20 y delega el resto en el real, un `openspec` global falso y un envoltorio de npm que registra cada llamada. Un registro inaccesible se simula con `npm_config_registry` apuntando a un puerto cerrado y una caché vacía.
- "En la sesión" significa cargar el `CLAUDE_ENV_FILE` resultante y ejecutar con el mismo `PATH`.
- Los hooks de cucumber (`Before`/`After`) crean y borran esos directorios temporales; el tiempo máximo por paso se amplía, porque los pasos ejecutan `npm install` reales.
- El soporte vive en `acceptance-tests/support/` y los pasos en `acceptance-tests/step-definitions/`. Los pasos solo llaman a métodos de intención del World (`openSession()`, `projectInstalls()`…) y hacen aserciones; el detalle de procesos y rutas queda en el soporte, como pide el modelo de page objects de la skill.

- *Alternativa: verificación manual sin suite.* Era la opción inicial, pero con specs heredadas los proyectos derivados recibirían escenarios sin step definitions y su suite nacería en rojo.

## Risks / Trade-offs

- [La primera sesión de un proyecto derivado grande tarda en arrancar] -> Es un coste único por clon; D4 evita repetirlo. Se documenta en el README.
- [`npm install` puede reescribir `package-lock.json` si no está alineado con `package.json`] -> Es el comportamiento estándar de npm y deja un cambio visible en git. El sello se calcula después de instalar, así que no provoca reinstalaciones en bucle.
- [Dos sesiones simultáneas sobre el mismo clon lanzan `npm install` a la vez] -> Poco frecuente. Si una falla, su sello no se escribe y la siguiente sesión reintenta.
- [El hook impone `npm install` en local a quien abra Claude Code en el proyecto] -> Es la decisión D2. Quien no lo quiera puede desactivar los hooks en su configuración local de Claude Code.
- [Windows sin bash no ejecuta el hook] -> Fuera de alcance. No está comprobado cómo reacciona Claude Code a un hook que no puede lanzar; el README indica que en ese caso hay que instalar a mano.
- [La suite de `session-bootstrap` necesita red y ejecuta `npm install` reales, así que tarda más de un minuto] -> Usa la caché de npm de la máquina, que hace rápidas las instalaciones repetidas. Los proyectos derivados la ejecutan junto a sus propios escenarios.
- [Los escenarios de "sin npm" dependen de qué herramientas del sistema necesita el hook] -> El directorio de herramientas simulado enlaza explícitamente las que el hook usa; si el hook empieza a usar otra, el escenario lo detecta al fallar.

## Migration Plan

No hay nada que migrar: la plantilla no tiene todavía `package.json`, hooks ni suite.

- Despliegue: los archivos llegan con los commits de código del change. La siguiente sesión de cualquier clon ejecuta el hook.
- Vuelta atrás: revertir esos commits. Las sesiones vuelven al comportamiento actual (CLI instalado a mano).
- Cierre del change: con la suite en verde, `openspec archive` lleva la spec a `openspec/specs/session-bootstrap/` y el change a `openspec/changes/archive/`, en un commit propio separado de los de código.

## Open Questions

- Ninguna bloqueante. Si en el futuro se quiere soportar Windows sin bash, haría falta un hook equivalente en otro intérprete; queda fuera de este change.
