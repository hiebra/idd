---
title: "Liberty: arrancar el servidor en modo debug (server debug, liberty:debug y liberty:dev)"
source: "https://raw.githubusercontent.com/OpenLiberty/open-liberty/release/dev/com.ibm.ws.kernel.boot.ws-server/publish/bin/server"
type: articles
ingested: 2026-11-22
tags: [liberty, wlp, open-liberty, java, depuracion, jdwp, maven, gradle]
summary: "Extracto del script server de Open Liberty y de la documentación de sus plugins de Maven y Gradle: server debug arranca la JVM con JDWP en el puerto WLP_DEBUG_ADDRESS (7777 por defecto) y, por defecto, la deja suspendida hasta que se adjunta un depurador (WLP_DEBUG_SUSPEND=y); el modo dev (mvn liberty:dev, gradle libertyDev) deja adjuntar un depurador en cualquier momento, también en el 7777 por defecto, y recarga los cambios de código."
canonical_url: "https://github.com/OpenLiberty/open-liberty/blob/62b67ffc1efa19ab9c02421f597a2cbd10165b9d/dev/com.ibm.ws.kernel.boot.ws-server/publish/bin/server"
upstream_id: "OpenLiberty/open-liberty@62b67ffc1efa19ab9c02421f597a2cbd10165b9d:dev/com.ibm.ws.kernel.boot.ws-server/publish/bin/server; OpenLiberty/ci.maven@edac96fe3fdae1b53e08551a452a5d21bec0f08a:docs/dev.md y docs/debug.md; OpenLiberty/ci.gradle@0f679c7c64d35552f0e8673d008b868e89b2cab8:docs/libertyDev.md; ibm.com/docs/en/was-liberty/base?topic=line-server-command-options"
upstream_type: git-file
revision: "62b67ffc1efa19ab9c02421f597a2cbd10165b9d"
license: "ci.maven: Apache-2.0; las demás, no comprobadas"
content_format: markdown
fetched: 2026-11-22
extraction_tool: "curl del raw (rama release de open-liberty; main de ci.maven y ci.gradle) y git ls-remote en la misma sesión; extracto literal. openliberty.io no respondió desde el contenedor (curl sin respuesta), así que se usaron los repositorios"
---

# Liberty: el servidor en modo debug (extracto)

El puerto, las variables de entorno y los plugins de esta ficha salen del código y la documentación de Open Liberty. Que WebSphere Liberty (WLP) use ese mismo script `server` no se ha contrastado en estas fuentes; es conocimiento interno. Lo que sí documenta IBM para WebSphere Liberty es la acción `debug` del comando `server`, que corre en primer plano.

## WebSphere Liberty: el comando `server` (extracto literal de la documentación de IBM)

De «Server command options», WebSphere Application Server Liberty base (`https://www.ibm.com/docs/en/was-liberty/base?topic=line-server-command-options`, consultada el 2026-11-22):

> The command syntax is as follows: `server action serverName [options]`

> The standard output and error from the server process is output to the foreground console when you use the run and debug actions and is redirected to the WLP_OUTPUT_DIR/serverName/logs/console.log file by default when you use the start action.

Esa página no dice el puerto de depuración ni nombra las variables `WLP_DEBUG_*`.

## El script `server`: variables de entorno (extracto literal de la cabecera)

```
# WLP_DEBUG_ADDRESS - The port to use when running the server in debug mode.
#              The default value is 7777.
#
# WLP_DEBUG_SUSPEND - Whether to suspend the jvm on startup or not. This can be
#              set to y to suspend the jvm on startup until a debugger attaches,
#              or set to n to startup without waiting for a debugger to attach.
#              The default value is y.
#
# WLP_DEBUG_REMOTE - Whether to allow remote debugging or not. This can be set
#              to y to allow remote debugging. By default, this value is not
#              defined, which does not allow remote debugging on newer JDK/JREs.
```

## La acción `debug` (extracto literal del script)

```sh
      if [ "${ACTION}" = "debug" ]
      then
        if [ -z "${WLP_DEBUG_ADDRESS}" ]
        then
          WLP_DEBUG_ADDRESS=7777
        fi
        if [ -z "${WLP_DEBUG_SUSPEND}" ]
        then
          WLP_DEBUG_SUSPEND=y
        fi
        if [ "${WLP_DEBUG_REMOTE}" = "y" ]
        then
          WLP_DEBUG_REMOTE_HOST="0.0.0.0:"
        else
          WLP_DEBUG_REMOTE_HOST=""
        fi
        JAVA_DEBUG="-Dwas.debug.mode=true -Dsun.reflect.noInflation=true -agentlib:jdwp=transport=dt_socket,server=y,suspend=${WLP_DEBUG_SUSPEND},address=${WLP_DEBUG_REMOTE_HOST}${WLP_DEBUG_ADDRESS}"
      fi
```

Es decir, `server debug <servidor>` deja la JVM escuchando JDWP (`dt_socket`, `server=y`) en el 7777 y, salvo `WLP_DEBUG_SUSPEND=n`, suspendida hasta que se adjunta un depurador.

## Plugin de Maven: `liberty:debug` (extracto literal de `docs/debug.md`)

> Start a Liberty server in debug mode. The server will listen on a specified debug port or `port 7777` by default.
>
> A nondefault debug port can be specified in the `server.env` file by adding the line `WLP_DEBUG_ADDRESS=<port #>`. The file can be created at `${basedir}/src/main/liberty/config/server.env` or at a location defined by the `serverEnvFile` common server parameter.

## Plugin de Maven: `liberty:dev` (extracto literal de `docs/dev.md`)

> Start a Liberty instance in dev mode. This goal also invokes the `create`, `install-feature`, and `deploy` goals before starting the runtime. **Note:** This goal is designed to be executed directly from the Maven command line.

> Dev mode provides three key features. Code changes are detected, recompiled, and picked up by your running server. Unit and integration tests are run on demand when you press Enter in the command terminal where dev mode is running, or optionally on every code change to give you instant feedback on the status of your code. Finally, it allows you to attach a debugger to the running server at any time to step through your code.

> Start dev mode and listen on a specific port for attaching a debugger (default is 7777).
>
> `$ mvn liberty:dev -DdebugPort=8787`
>
> Start dev mode without allowing to attach a debugger.
>
> `$ mvn liberty:dev -Ddebug=false`

> | debug | Whether to allow attaching a debugger to the running server. The default value is `true`. | No |
> | debugPort | The debug port that you can attach a debugger to. The default value is `7777`. | No |

De ese texto se deduce que el modo dev se queda en primer plano en su terminal, donde recibe órdenes por teclado (Enter para los tests). La misma página documenta `devc`, el modo dev en un contenedor.

## Plugin de Gradle: `libertyDev` (extracto literal de `docs/libertyDev.md`)

> `$ gradle libertyDev --libertyDebugPort=8787`
>
> `$ gradle libertyDev --libertyDebug=false`

> | libertyDebug | Whether to allow attaching a debugger to the running server. The default value is `true`. | No |
> | libertyDebugPort | The debug port that you can attach a debugger to. The default value is `7777`. | No |
