# response-comments

## MODIFIED Requirements

### Requirement: En OpenCode, la regla llega por un plugin propio
En OpenCode, la regla de comentarios y su recordatorio DEBEN llegar por un plugin local propio del proyecto, separado del plugin del arranque de sesión. El plugin del arranque de sesión NO DEBE entregar nada de la regla de comentarios, y DEBE seguir funcionando igual sin el plugin de comentarios.

#### Scenario: Sin el plugin de comentarios, OpenCode arranca sin la regla

```gherkin
Given un clon del proyecto con el wiki habilitado
And un clon del proyecto sin el plugin de comentarios de OpenCode
When se abre una sesión de OpenCode en el proyecto
And el usuario envía el mensaje ''el segundo punto'' no lo entiendo
Then el agente no recibe la regla de comentarios
And el agente no recibe el recordatorio de la regla de comentarios con los mensajes
And el contexto de la sesión incluye la guía del wiki
```
