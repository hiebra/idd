# wiki-first-knowledge

## MODIFIED Requirements

### Requirement: Resincronizar el wiki al archivar un change
Las indicaciones de archivado de OpenSpec del proyecto DEBEN incluir la resincronización del wiki del proyecto con lo que tocó el change, mediante las operaciones del motor. Tras fijar las fuentes, DEBEN evaluar sin escribir lo que cambia en el wiki (los artículos cuyas fuentes cambiaron, las lecciones aprendidas y los registros del inventario), presentarlo al usuario y escribir solo lo que confirme, compilando después de registrar las lecciones. DEBEN dejar el wiki sin errores de lint y hacer su commit después del commit del archivado. NO DEBEN incluir la revisión con el librarian, que no revisa el contenido de los artículos.

#### Scenario: Las indicaciones de archivado incluyen la resincronización del wiki

```gherkin
Given un change del proyecto listo para archivar
When se consultan las indicaciones de archivado de OpenSpec para ese change
Then incluyen resincronizar el wiki del proyecto con estos pasos, en este orden:
  | paso                                                                                          |
  | fijar como fuentes, en el commit del archivado, el código, specs y ADRs que tocó              |
  | refrescar sin escribir los artículos que citan lo que tocó el change                          |
  | extraer las lecciones aprendidas sin escribir                                                 |
  | revisar sin escribir los registros del inventario que el change completa o deja obsoletos     |
  | presentarlo al usuario y escribir solo lo que confirme: refresco, lecciones, compile, inventario |
  | pasar el lint del wiki hasta dejarlo sin errores                                              |
  | hacer el commit del wiki después del commit del archivado                                     |
And no incluyen la revisión con el librarian
```
