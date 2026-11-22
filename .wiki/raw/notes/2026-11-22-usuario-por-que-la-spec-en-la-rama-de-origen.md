---
title: "Opinión del usuario: por qué intent-driven pide la spec en la rama de origen y por qué la plantilla mantiene las dos formas del ciclo"
source: MANUAL
type: notes
ingested: 2026-11-22
tags: [openspec-git-discipline, git, ramas-permanentes, forma-canonica, opinion-del-usuario]
author: usuario (mantenedor de la plantilla)
confidence: low
summary: "El usuario sostiene que la spec puede hacerse directamente en la rama de origen porque, salvo por los ADR, no choca entre desarrollos concurrentes, mientras que el apply debe ir en rama porque el código sí choca. Eso solo vale con una única rama permanente o con ramas permanentes que se fusionan entre sí; como los proyectos creados desde la plantilla no lo garantizan, hay que mantener las dos formas del ciclo. Lo propone como el motivo, no registrado en el origen, de la regla de intent-driven."
---

# Opinión del usuario: la spec en la rama de origen y las dos formas del ciclo

> Fuente: afirmaciones del usuario en una conversación del 2026-11-22, recogidas con su visto bueno. Es una opinión razonada, no un hecho comprobado ni una declaración del origen (`intent-driven-template`). El usuario pidió que constara como autoridad, aunque fuera de baja calidad.

## Lo que afirma el usuario

1. **El apply no debe ir en la rama permanente si hay desarrollos concurrentes**, porque, a diferencia de la spec, dos ramas pueden tocar los mismos ficheros de código.
2. **La spec no parece poder chocar**, salvo por los números de los ADR.
3. **Por tanto, hacer la spec en la rama permanente parece lo más apropiado** en el resto de casos, siempre que haya una única rama permanente o las que haya se fusionen entre ellas.
4. **En esta plantilla esa condición no se cumple**: los proyectos que se crean desde ella pueden tener varias ramas permanentes que no se fusionan entre sí (`x-main` en `openspec/config.yaml`). Por eso la plantilla no debe dar esa opción como la única.
5. **Hay que mantener las dos formas del ciclo** (la recomendada, de una rama y una fusión, y la canónica), porque se necesita la modificada.
6. **Esto da la causa de la forma modificada y, de paso, el motivo** por el que intent-driven pide que las specs se hagan en `main`, que el origen no registra.
7. **Sobre los conflictos entre deltas**: no está seguro de que trabajar en `main` ayude, pero le parece que el problema será más fácil de detectar allí que en dos ramas temporales. Pidió documentar el posible conflicto.

## Objeciones planteadas en la misma conversación, sin resolver

- **Al punto 2**: los deltas de dos changes sobre la misma capability pueden chocar. Lo comprobado está en [Lessons Learned: conflictos entre deltas de changes concurrentes](2026-11-22-ll-conflictos-entre-deltas-concurrentes.md).
- **Al punto 7**: en el único caso que nada detecta en la rama permanente (dos MODIFIED del mismo requirement con los mismos escenarios), la forma recomendada sí lo detecta, como conflicto de git al fusionar la segunda rama.
- **A los puntos 4 y 6**: si las ramas permanentes no se fusionan entre sí, eso afecta igual a las dos formas, porque la forma recomendada también fusiona solo con la rama de origen. El usuario no respondió a esta objeción y mantuvo su conclusión.
