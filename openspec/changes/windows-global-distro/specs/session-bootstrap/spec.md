# session-bootstrap

El núcleo del arranque deja de ser un script de bash, para que funcione en Windows, y el arranque se puede instalar de forma global en OpenCode, donde se ejecuta en cualquier proyecto que se abra.

## ADDED Requirements

### Requirement: El arranque no necesita bash
El arranque de sesión DEBE funcionar en una máquina con Node.js y npm aunque no tenga bash, en Linux, macOS y Windows, y NO DEBE depender de symlinks en Windows.

#### Scenario: Sesión de OpenCode en Windows sin bash

```gherkin
Given una máquina Windows con Node.js 22.12 o superior y npm y sin bash
And un clon del proyecto sin dependencias instaladas
When se abre una sesión de OpenCode en el proyecto
Then `openspec --version` en la sesión muestra la versión fijada por el proyecto
```

### Requirement: El arranque global solo actúa en proyectos intent-driven
Instalado de forma global, el arranque de sesión DEBE actuar solo en proyectos cuyo `openspec/config.yaml` declara `schema: intent-driven`. En cualquier otro proyecto NO DEBE instalar nada, cambiar el entorno de la sesión, entregar la guía, el recordatorio ni la regla de comentarios, ni mostrar avisos.

#### Scenario Outline: Proyectos en los que el arranque global no actúa

```gherkin
Given el arranque de sesión instalado de forma global
And un proyecto <situación>
When se abre una sesión de OpenCode en el proyecto
Then el arranque no instala nada ni cambia el entorno de la sesión
And la sesión no recibe la guía del wiki ni la regla de comentarios
And no se muestra ningún aviso del arranque

Examples:
  | situación                                           |
  | sin `openspec/config.yaml`                          |
  | con `schema: spec-driven` en `openspec/config.yaml` |
```

#### Scenario: Proyecto intent-driven

```gherkin
Given el arranque de sesión instalado de forma global
And un proyecto creado desde la variante adelgazada, sin dependencias instaladas
When se abre una sesión de OpenCode en el proyecto
Then `openspec --version` en la sesión muestra la versión fijada por el proyecto
```

### Requirement: El arranque global no instala el motor del wiki
Instalado de forma global, el arranque de sesión NO DEBE descargar el motor del wiki ni crear symlinks hacia él: DEBE usar el motor que instaló la instalación global y exponer su ruta a la sesión como hoy.

#### Scenario: La sesión usa el motor de la instalación global

```gherkin
Given una máquina Windows con la instalación global de una release
And un proyecto creado desde la variante adelgazada de esa release
When se abre una sesión de OpenCode en el proyecto
Then no se descarga ningún motor del wiki
And las operaciones del wiki usan el motor de la instalación global
```
