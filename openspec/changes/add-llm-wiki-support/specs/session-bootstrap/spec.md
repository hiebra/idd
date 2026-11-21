# session-bootstrap

## ADDED Requirements

### Requirement: Motor del wiki instalado en Claude Code al abrir sesión
Al abrir una sesión de Claude Code en el proyecto, el arranque de sesión DEBE dejar instalado y habilitado el plugin del motor del wiki en la versión fijada por el proyecto: lo instala si falta, lo sustituye si hay otra versión y no hace nada si ya está la fijada.

#### Scenario: Clon recién creado

```gherkin
Given un clon del proyecto sin el plugin del motor del wiki instalado
When se abre una sesión de Claude Code en el proyecto
Then el plugin del motor del wiki queda instalado y habilitado en la versión fijada por el proyecto
```

#### Scenario: El plugin ya está en la versión fijada

```gherkin
Given el plugin del motor del wiki está instalado en la versión fijada por el proyecto
When se abre una sesión de Claude Code en el proyecto
Then no se lanza ninguna instalación del plugin
```

#### Scenario: El plugin está instalado en otra versión

```gherkin
Given el plugin del motor del wiki está instalado en una versión distinta de la fijada por el proyecto
When se abre una sesión de Claude Code en el proyecto
Then el plugin del motor del wiki queda instalado en la versión fijada por el proyecto
```

### Requirement: Un fallo al instalar el motor del wiki no bloquea la sesión
Si la instalación del plugin del motor del wiki falla, o la versión de Claude Code no permite instalar plugins desde el arranque, el arranque de sesión DEBE avisar del fallo indicando cómo instalarlo a mano, NO DEBE impedir que la sesión arranque y DEBE volver a intentarlo en la siguiente sesión.

#### Scenario: Sin acceso al repositorio del motor

```gherkin
Given un clon del proyecto sin el plugin del motor del wiki instalado
And la máquina no puede acceder al repositorio del motor del wiki
When se abre una sesión de Claude Code en el proyecto
Then la sesión arranca con normalidad
And se avisa de que la instalación del motor del wiki falló
And el aviso indica cómo instalarlo a mano
```

#### Scenario: Una versión de Claude Code que no permite instalar plugins

```gherkin
Given un clon del proyecto sin el plugin del motor del wiki instalado
And una versión de Claude Code que no permite instalar plugins desde el arranque de sesión
When se abre una sesión de Claude Code en el proyecto
Then la sesión arranca con normalidad
And se avisa de que el motor del wiki no se ha podido instalar
And el aviso indica cómo instalarlo a mano
```

#### Scenario: Reintento tras una instalación del motor fallida

```gherkin
Given la última instalación del plugin del motor del wiki falló
And la máquina vuelve a tener acceso al repositorio del motor del wiki
When se abre una sesión de Claude Code en el proyecto
Then el plugin del motor del wiki queda instalado en la versión fijada por el proyecto
```
