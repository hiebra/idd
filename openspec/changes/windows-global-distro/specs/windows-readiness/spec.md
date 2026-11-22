# windows-readiness

El diagnóstico de Windows conoce la instalación global: en un proyecto creado desde la variante adelgazada, el schema, las skills, los plugins y el motor del wiki no están en el proyecto sino en `<data>` y `<config>`.

## ADDED Requirements

### Requirement: La instalación global en un proyecto adelgazado
En un proyecto sin su propio schema `intent-driven` (`openspec/schemas/intent-driven/`), como uno creado desde la variante adelgazada, el diagnóstico DEBE comprobar la instalación global en `<data>` y `<config>`, con XDG o sin XDG. Comprueba:
- el schema;
- el motor del wiki;
- la skill `openspec-git-discipline` con su script;
- las skills del motor;
- los plugins `openspec-autopilot`, `session-bootstrap` y `response-comments`.

DEBE dar la instalación global en estado `OK`, con su versión, si está completa, y en estado `FALTA` si no está o le falta algo. En ese caso DEBE nombrar lo que falta y dar como alternativa global el `.bat` de la release. En ese proyecto, el motor del wiki DEBE darse como presente si está en la instalación global. En un proyecto con su propio schema, que es la plantilla completa, la instalación global no hace falta, y DEBE darse en estado `OK`.

#### Scenario: Proyecto adelgazado con la instalación global

```gherkin
Given una máquina Windows con todo lo que necesita el proyecto
But el proyecto es de la variante adelgazada
And la máquina tiene la instalación global completa de la versión `0.1.0`
When se ejecuta el diagnóstico en el proyecto
Then el informe da la instalación global en estado OK
And el detalle de la instalación global nombra la versión `0.1.0`
And el informe da el motor del wiki en estado OK
```

#### Scenario: Proyecto adelgazado sin la instalación global

```gherkin
Given una máquina Windows con todo lo que necesita el proyecto
But el proyecto es de la variante adelgazada
And la máquina no tiene la instalación global
When se ejecuta el diagnóstico en el proyecto
Then el informe da la instalación global en estado FALTA
And el informe da el `.bat` de la release como alternativa global
And el informe da el motor del wiki en estado FALTA
```

#### Scenario: Instalación global incompleta

```gherkin
Given una máquina Windows con todo lo que necesita el proyecto
But el proyecto es de la variante adelgazada
And la máquina tiene la instalación global sin el plugin `response-comments`
When se ejecuta el diagnóstico en el proyecto
Then el informe da la instalación global en estado FALTA
And el detalle de la instalación global nombra el plugin `response-comments`
```
