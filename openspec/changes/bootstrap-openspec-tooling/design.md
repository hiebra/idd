## Context

`hiebra/idd` es una plantilla para proyectos JavaScript con OpenSpec (`intent-driven`, `spec-as-source`, `stack: javascript`). Trae en el repositorio las skills de OpenSpec y las del schema, pero no el CLI `openspec` que esas skills ejecutan. Hoy cada sesión nueva exige instalarlo a mano.

Restricciones:

- La plantilla se usa en sesiones locales de Claude Code y en sesiones en la nube, donde el contenedor empieza sin dependencias instaladas.
- El `package.json` de la raíz es el que heredará cada proyecto derivado: con el tiempo contendrá también las dependencias de su aplicación.
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
     package.json / lock / hook sin cambios? ---si--> no reinstala
                         |no
                         v
               npm install (todas las deps) ---falla--> aviso, fin
                         |ok
                         v
           node_modules/.bin por delante en el PATH
```

## Goals / Non-Goals

**Goals:**

- Que `openspec`, en la versión fijada por el proyecto, esté disponible en cualquier sesión de Claude Code sin pasos manuales.
- Que el proyecto quede con todas sus dependencias instaladas al abrir sesión.
- Que el coste recurrente sea casi nulo: solo se instala cuando algo ha cambiado.
- Que ningún fallo del arranque impida trabajar.

**Non-Goals:**

- Gestionar el perfil de workflows de OpenSpec o cualquier otra configuración global.
- Subir de versión OpenSpec: lo hace quien tenga OpenSpec bien configurado.
- Instalar Node.js o npm, o fijar una versión exacta de Node (`.nvmrc`): cada proyecto derivado decide la suya.
- Soportar Windows sin un intérprete bash.
- Tests de aceptación permanentes: los escenarios de la spec se verifican durante el change y no quedan como suite.

## Decisions

### D1. Hook `SessionStart` versionado en el repositorio

Un script `.claude/hooks/session-start.sh`, registrado en `.claude/settings.json` y referenciado con `$CLAUDE_PROJECT_DIR`.

- *Alternativa: script de instalación del entorno de la nube.* Queda atado a ese entorno: no cubre sesiones locales ni otros entornos, y no viaja con la plantilla.
- *Alternativa: instrucciones en el README.* Dependen de que alguien se acuerde, que es justo el problema.

### D2. Corre en todas las sesiones, locales y en la nube

No se condiciona a `CLAUDE_CODE_REMOTE`. Un solo comportamiento es más simple de especificar, y en local mantiene las dependencias al día tras un `git pull` sin intervención. Con D4, el coste en local es casi nulo cuando nada ha cambiado.

### D3. `npm install` de todas las dependencias, no `npm ci`

- *Frente a instalar solo OpenSpec:* en un proyecto JavaScript quien abre una sesión casi siempre necesita sus dependencias; instalar solo el CLI dejaría la aplicación a medias.
- *Frente a `npm ci`:* `npm ci` borra `node_modules` entero en cada ejecución. En un proyecto derivado grande eso convierte cada reinstalación en una instalación completa. `npm install` respeta el lock y solo toca lo que difiere.

Se ejecuta con `--no-audit --no-fund` para acortar la salida.

### D4. Reinstalación guiada por un sello de hashes

Tras una instalación correcta, el hook guarda en `node_modules/.session-start.sha256` los hashes de `package.json`, `package-lock.json` y el propio script. En cada sesión comprueba ese sello: si coincide, no instala.

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

## Risks / Trade-offs

- [La primera sesión de un proyecto derivado grande tarda en arrancar] -> Es un coste único por clon; D4 evita repetirlo. Se documenta en el README.
- [`npm install` puede reescribir `package-lock.json` si no está alineado con `package.json`] -> Es el comportamiento estándar de npm y deja un cambio visible en git. El sello se calcula después de instalar, así que no provoca reinstalaciones en bucle.
- [Dos sesiones simultáneas sobre el mismo clon lanzan `npm install` a la vez] -> Poco frecuente. Si una falla, su sello no se escribe y la siguiente sesión reintenta.
- [El hook impone `npm install` en local a quien abra Claude Code en el proyecto] -> Es la decisión D2. Quien no lo quiera puede desactivar los hooks en su configuración local de Claude Code.
- [Windows sin bash no ejecuta el hook] -> Fuera de alcance. No está comprobado cómo reacciona Claude Code a un hook que no puede lanzar; el README indica que en ese caso hay que instalar a mano.

## Migration Plan

No hay nada que migrar: la plantilla no tiene todavía `package.json` ni hooks.

- Despliegue: los archivos llegan con el commit de código del change. La siguiente sesión de cualquier clon ejecuta el hook.
- Vuelta atrás: revertir ese commit. Las sesiones vuelven al comportamiento actual (CLI instalado a mano).
- Cierre del change: es un change de la plantilla, así que no se archiva. Se borra de `openspec/changes/` en un commit propio, separado del de código.

## Open Questions

- Ninguna bloqueante. Si en el futuro se quiere soportar Windows sin bash, haría falta un hook equivalente en otro intérprete; queda fuera de este change.
