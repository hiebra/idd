# Guía del wiki del proyecto

Este proyecto guarda su conocimiento en un *LLM wiki*: una base de conocimiento en Markdown que tú consultas, amplías y mantienes con el motor del wiki. Sigue este flujo en toda la sesión.

## Dos ámbitos

<!-- wiki-guide:ambito-proyecto -->
- **Wiki del proyecto**, en `.wiki/` (en la raíz, versionado con el repositorio): lo específico del proyecto y el conocimiento externo que le concierne. Opera sobre él con `--local`.
<!-- wiki-guide:ambito-hub -->
- **Hub del usuario**, fuera del repositorio y opcional: el conocimiento general del usuario, por topics. Si no existe (por ejemplo, en una sesión en la nube), sigue solo con el del proyecto, sin avisar.

## Cuándo consultar

<!-- wiki-guide:peticiones-con-conocimiento -->
Requieren conocimiento las peticiones sobre el dominio del proyecto, decisiones técnicas, herramientas o hechos externos.
<!-- wiki-guide:operaciones-sin-conocimiento -->
No lo requieren las operaciones sobre el código que no dependen de él: renombrar, reformatear, mover o aplicar un cambio ya decidido.
<!-- wiki-guide:discernir-peticiones -->
Tú disciernes en cada caso; ante la duda, consulta.

## Consultar antes de responder

<!-- wiki-guide:consultar-antes -->
Ante una petición que requiere conocimiento, consulta el wiki en modo de solo lectura antes de usar tu conocimiento interno.
<!-- wiki-guide:orden-de-consulta -->
Consulta primero el wiki del proyecto y, si no basta, el topic que corresponda del hub del usuario, si existe. Cita los artículos en los que te basas.
<!-- wiki-guide:consultar-con-lectura -->
Consulta con {{query}}, que no modifica el wiki.

## Si el wiki no responde

<!-- wiki-guide:preguntar-ante-hueco -->
No sigas por tu cuenta: pregunta al usuario y ofrécele estas opciones:
<!-- wiki-guide:hueco-conocimiento-interno -->
1. Responder con tu conocimiento interno, indicando que no viene del wiki.
<!-- wiki-guide:hueco-investigar -->
2. Investigar fuera y registrar lo encontrado en el wiki.
<!-- wiki-guide:hueco-nada -->
3. No hacer nada más.

## Dónde registrar

Registra lo específico del proyecto y lo externo que le concierne en el wiki del proyecto, y el conocimiento general del usuario en su hub.
<!-- wiki-guide:ambito-preguntar -->
Si no está claro qué ámbito corresponde, pregunta.
<!-- wiki-guide:hub-a-proyecto -->
El conocimiento del hub llega al proyecto incorporándolo directamente al wiki del proyecto o mediante un checkpoint del hub; nunca copies artículos a mano.

## Modificar el wiki

<!-- wiki-guide:modificar-wiki -->
Registrar lecciones, ingerir fuentes, compilar o corregir artículos modifica el wiki: se hace con la skill `wiki-manager` o sus comandos `/wiki:*`.
<!-- wiki-guide:modificar-con-confirmacion -->
Hazlo solo cuando el usuario confirma lo que le propones.
<!-- wiki-guide:modificar-no-consultar -->
No uses `wiki-manager` para consultar.

## Lo que descubres al trabajar

<!-- wiki-guide:descubrimientos -->
Lo que compruebas empíricamente (ejecutando, midiendo, leyendo código) y lo que encuentras en internet, también cuando buscas por tu cuenta en medio de una tarea, es conocimiento.
<!-- wiki-guide:proponer-registrar -->
Cuando servirá en otra ocasión, y no solo para la tarea en curso, propón al usuario registrarlo; no lo registres sin más.
<!-- wiki-guide:discernir-registro -->
Tú disciernes cuándo procede: lo trivial o lo que solo sirve para esta tarea no se registra.

Cada tipo se registra con su operación del motor:
<!-- wiki-guide:apuntar-candidatas -->
- **Lo comprobado al trabajar**: mientras trabajas, apúntalo en la conversación como lección candidata, sin escribir nada en el wiki.
<!-- wiki-guide:registrar-en-cierre -->
  En un punto de cierre, propón registrar las candidatas una sola vez, con las lecciones aprendidas en dry-run (`/wiki:ll --dry-run --local`), y escribe solo lo que confirme el usuario. Si no hay candidatas, no propongas nada.
<!-- wiki-guide:puntos-de-cierre -->
  Son puntos de cierre el final de una tarea, antes de un commit, cuando el usuario da la sesión por terminada y el archive de un change; en el archive, sigue sus indicaciones de archivado, que ya incluyen este paso.
<!-- wiki-guide:registrar-internet-ingesta -->
- **Lo encontrado en internet**, ingiriendo la fuente (`/wiki:ingest <url> --local`), para conservar su procedencia.

## Los productos del proyecto son fuentes

<!-- wiki-guide:fuentes-fijadas -->
Las specs, los ADRs y el código del proyecto entran en el wiki del proyecto como fuentes fijadas a un commit: por ruta e identificador de versión, sin copiar su contenido (`/wiki:ingest-collection . --adapter git --manifest-only --revision <commit> --local`).
<!-- wiki-guide:citar-version -->
Los artículos son el conocimiento extraído de esas fuentes y citan la versión exacta (ruta y commit) de la que sale cada afirmación.
<!-- wiki-guide:ingesta-inicial -->
Al crear el wiki del proyecto, haz una ingesta inicial del repositorio de esa forma.
<!-- wiki-guide:ingesta-inicial-exclusiones -->
Excluye de ella lo generado (`node_modules/`, informes, `.extracted/`, lockfiles) y lo que no aporta conocimiento (la copia del motor en `.agents/wiki-engine/`, archivos vacíos o de configuración trivial).

Al archivar un change de OpenSpec, sus indicaciones de archivado resincronizan el wiki con lo que tocó.

## `.wiki/` se versiona

<!-- wiki-guide:wiki-versionado -->
`.wiki/` se versiona con el repositorio: no lo añadas a `.gitignore`, aunque el motor lo haga al inicializarlo. El arranque de sesión lo retira y avisa.
