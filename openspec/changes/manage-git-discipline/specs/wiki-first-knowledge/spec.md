# wiki-first-knowledge

Con la fusión con squash, el commit que citan los artículos puede no llegar nunca a la rama de origen. Los manifiestos del motor fijan cada archivo por su blob, así que la cita sigue siendo resoluble.

## ADDED Requirements

### Requirement: Citas cuyo commit no está en la rama de origen
La guía DEBE indicar cómo resolver una cita a un producto del proyecto cuyo commit no existe en el clon o no está en la rama de origen: se toma el blob de esa ruta en el manifiesto citado y se resuelve con git por su blob, sin tratar la cita como rota.

#### Scenario: La guía indica resolver la cita por el blob del manifiesto

```gherkin
Given la guía del wiki del proyecto
When se revisa qué indica sobre una cita cuyo commit no está en la rama de origen
Then indica tomar el blob de la ruta en el manifiesto citado
And indica resolverlo con git por su blob
And indica no tratar la cita como rota
```
