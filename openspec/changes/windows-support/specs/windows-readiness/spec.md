# windows-readiness

## Purpose
Diagnóstico de lo que le falta a una máquina Windows para que el proyecto funcione en ella, también sin acceso a internet: `scripts/windows/Test-OfflineInstall.ps1`. La máquina con todo lo necesario es la que tiene OpenCode 2, Node.js con npm, Git for Windows con Git Bash, Python 3, symlinks y, ya instalados, el motor del wiki y las dependencias npm del proyecto (en el proyecto o en una caché de npm que se pueda usar sin red).

## ADDED Requirements

### Requirement: Diagnóstico sin efectos
El diagnóstico NO DEBE instalar nada, NO DEBE cambiar ningún archivo del proyecto ni de la máquina y NO DEBE usar la red. Al terminar, DEBE informar de cada componente que necesita el proyecto con uno de estos estados: `OK` (está en la máquina), `OK (vendor)` (está en el directorio de vendor del repositorio), `AVISO` (está, pero algo impedirá que el proyecto funcione del todo) o `FALTA`.

#### Scenario: Máquina con todo lo necesario

```gherkin
Given una máquina Windows con todo lo que necesita el proyecto
When se ejecuta el diagnóstico en el proyecto
Then todos los componentes del informe están en estado OK
And el árbol de trabajo del proyecto no ha cambiado
```

### Requirement: Qué hacer con lo que falta
Para cada componente en estado `FALTA` o `AVISO`, el diagnóstico DEBE decir por qué, qué habría que incorporar al repositorio para no depender de la máquina, la alternativa de instalarlo globalmente en la máquina, si existe, y cómo conseguirlo en una máquina con internet. Si no hay alternativa global, DEBE decirlo.

#### Scenario: Falta Node.js

```gherkin
Given una máquina Windows sin Node.js
When se ejecuta el diagnóstico en el proyecto
Then el informe da Node.js en estado FALTA
And el informe dice qué incorporar al repositorio para Node.js
And el informe da la instalación global de Node.js como alternativa
And el informe dice cómo conseguir Node.js en una máquina con internet
```

#### Scenario: Node.js de una versión inferior a la requerida

```gherkin
Given una máquina Windows con Node.js 20
When se ejecuta el diagnóstico en el proyecto
Then el informe da Node.js en estado FALTA
And el detalle de Node.js nombra la versión 20 encontrada y la que exige el proyecto
```

#### Scenario: Lo que está en el vendor del repositorio cuenta como presente

```gherkin
Given una máquina Windows sin Node.js
And el directorio de vendor del repositorio tiene un Node.js de la versión requerida
When se ejecuta el diagnóstico en el proyecto
Then el informe da Node.js en estado OK (vendor)
```

### Requirement: Dependencias npm para la plataforma de la máquina
El diagnóstico DEBE comprobar, para la raíz y para `acceptance-tests/`, cada paquete de su `package-lock.json` que se instala en la plataforma y la arquitectura de la máquina, y solo esos. Un paquete cuenta como presente si está instalado en la versión del lockfile o si su contenido está en la caché de npm del vendor o en la global. Si alguno falta, DEBE nombrarlo.

#### Scenario: Dependencias instaladas en otro sistema operativo

```gherkin
Given una máquina Windows x64 con todo lo que necesita el proyecto
But las dependencias de `acceptance-tests/` se instalaron en Linux y se copiaron
When se ejecuta el diagnóstico en el proyecto
Then el informe da las dependencias npm de `acceptance-tests` en estado FALTA
And el detalle nombra el paquete `@esbuild/win32-x64`
And el detalle no nombra el paquete `@esbuild/linux-x64`
```

### Requirement: Dependencias que solo están en la caché global
Si las dependencias que faltan en el proyecto solo están en la caché global de npm y npm no está configurado para trabajar sin red, el diagnóstico DEBE dar un `AVISO`, porque el arranque de sesión intentaría usar la red.

#### Scenario: Dependencias solo en la caché global sin modo offline

```gherkin
Given una máquina Windows con todo lo que necesita el proyecto
But las dependencias de la raíz no están instaladas en el proyecto
And la caché global de npm tiene todos sus paquetes
And npm no está configurado para trabajar sin red
When se ejecuta el diagnóstico en el proyecto
Then el informe da las dependencias npm de la raíz en estado AVISO
And el informe da como alternativa global configurar npm para trabajar sin red
```

### Requirement: Motor del wiki disponible sin red
El diagnóstico DEBE dar el motor del wiki como presente si está instalado en la versión de `.agents/wiki/engine.json`, o si `engine.json` apunta a una fuente de git local que tiene esa versión. Si no está instalado y `engine.json` apunta a GitHub, DEBE darlo en estado `FALTA`.

#### Scenario: Motor sin instalar que solo está en GitHub

```gherkin
Given una máquina Windows con todo lo que necesita el proyecto
But el motor del wiki no está instalado en el proyecto
And `engine.json` apunta al repositorio del motor en GitHub
When se ejecuta el diagnóstico en el proyecto
Then el informe da el motor del wiki en estado FALTA
```

#### Scenario: Motor sin instalar con una fuente local

```gherkin
Given una máquina Windows con todo lo que necesita el proyecto
But el motor del wiki no está instalado en el proyecto
And `engine.json` apunta a un bundle de git local con la versión fijada
When se ejecuta el diagnóstico en el proyecto
Then el informe da el motor del wiki en estado OK (vendor)
```

### Requirement: Python 3 con el nombre que usa el motor
El diagnóstico DEBE comprobar que hay un Python 3 que se puede ejecutar, sin contar el alias de la Microsoft Store, que no es un intérprete. Si no hay ninguno llamado `python3`, que es el que invoca el helper del motor del wiki, DEBE dar un `AVISO`.

#### Scenario: Solo el alias de la Microsoft Store

```gherkin
Given una máquina Windows con todo lo que necesita el proyecto
But el único Python de la máquina es el alias de la Microsoft Store
When se ejecuta el diagnóstico en el proyecto
Then el informe da Python 3 en estado FALTA
```

#### Scenario: Python instalado sin `python3`

```gherkin
Given una máquina Windows con todo lo que necesita el proyecto
But Python 3 solo se puede ejecutar como `python`
When se ejecuta el diagnóstico en el proyecto
Then el informe da el nombre `python3` en estado AVISO
```

### Requirement: El clon tiene los symlinks y los finales de línea del repositorio
El diagnóstico DEBE dar en estado `FALTA` un clon cuyos symlinks versionados se extrajeron como archivos de texto, o cuyos scripts del arranque de sesión tienen finales de línea CRLF, y DEBE decir cómo volver a extraerlos. Para los symlinks NO DEBE ofrecer una alternativa en el repositorio, porque no la hay.

#### Scenario: Clon extraído sin symlinks

```gherkin
Given una máquina Windows con todo lo que necesita el proyecto
But el clon se extrajo sin symlinks
When se ejecuta el diagnóstico en el proyecto
Then el informe da los symlinks del clon en estado FALTA
And el informe dice cómo volver a extraer los symlinks
```

#### Scenario: Clon extraído con CRLF antes de fijar los finales de línea

```gherkin
Given una máquina Windows con todo lo que necesita el proyecto
But los scripts del arranque de sesión del clon tienen finales de línea CRLF
When se ejecuta el diagnóstico en el proyecto
Then el informe da los finales de línea del clon en estado FALTA
And el informe dice cómo volver a extraer los archivos con LF
```

### Requirement: OpenCode 2 es el agente de Windows
En Windows solo se soporta OpenCode 2 o superior. El diagnóstico DEBE dar el agente en estado `FALTA` si no hay un OpenCode 2 o superior, aunque esté Claude Code, y DEBE decir en el detalle que Claude Code no se soporta en Windows.

#### Scenario: Solo Claude Code

```gherkin
Given una máquina Windows con todo lo que necesita el proyecto
But el único agente de la máquina es Claude Code
When se ejecuta el diagnóstico en el proyecto
Then el informe da el agente en estado FALTA
And el detalle del agente dice que en Windows solo se soporta OpenCode 2
```

#### Scenario: OpenCode 1

```gherkin
Given una máquina Windows con todo lo que necesita el proyecto
But el único agente de la máquina es OpenCode 1
When se ejecuta el diagnóstico en el proyecto
Then el informe da el agente en estado FALTA
```

### Requirement: Código de salida y salida para máquinas
El diagnóstico DEBE terminar con 1 si algún componente está en estado `FALTA` y con 0 si no. Con `-Json`, DEBE dar el mismo informe como JSON, con un objeto por componente.

#### Scenario: Falta algo

```gherkin
Given una máquina Windows sin Node.js
When se ejecuta el diagnóstico en el proyecto
Then el diagnóstico termina con 1
```

#### Scenario: No falta nada

```gherkin
Given una máquina Windows con todo lo que necesita el proyecto
When se ejecuta el diagnóstico en el proyecto
Then el diagnóstico termina con 0
```

#### Scenario: Informe en JSON

```gherkin
Given una máquina Windows sin Node.js
When se ejecuta el diagnóstico en el proyecto pidiendo JSON
Then la salida es un JSON con un objeto por componente
And el objeto de Node.js tiene el estado FALTA
```
