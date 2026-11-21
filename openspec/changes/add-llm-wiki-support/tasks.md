`acceptance-tests/` ya existe, así que se omite la puesta en marcha de la suite. Se trabaja con el ciclo de `spec-as-source`: rojo → implementar → verde → commit. Un commit nunca mezcla `openspec/` con la zona de código (que incluye `adr/` y `.wiki/`), salvo este `tasks.md`.

## 1. Comprobaciones previas: confirman D1 y D3 antes de escribir código

- [x] 1.1 En un proyecto desechable con Claude Code real y una configuración aislada (`CLAUDE_CONFIG_DIR`), comprobar con `claude -p --output-format stream-json --verbose`:
  - que el `additionalContext` de `SessionStart` y el de `UserPromptSubmit` llegan al modelo (pedirle que repita una palabra clave de cada uno);
  - que una variable exportada por `CLAUDE_ENV_FILE` (`CLAUDE_PLUGIN_ROOT`) llega a los comandos de Bash de un comando de `.claude/commands/wiki/` puesto por symlink;
  - que la skill `wiki-manager` y los comandos `/wiki:*` puestos por symlink desde una copia del tag v1.0.0 aparecen en la misma sesión (ya comprobado con copias en 2.1.330; repetir con symlinks).

  Anotar los resultados y la versión de Claude Code en este archivo

  **Resultado (Claude Code 2.1.330, 2026-11-21): D1 y D3 se confirman.** Proyecto desechable con `CLAUDE_CONFIG_DIR` vacío, `.claude/skills/wiki-manager` y `.claude/commands/wiki` como symlinks a una copia del tag v1.0.0, y dos hooks que solo imprimen `additionalContext` con una palabra clave cada uno:
  - Con `claude -p "Repite literalmente las dos palabras clave…" --output-format stream-json --verbose`, el resultado es `ALFAZULU7 BRAVOYANKEE3`: llegan al modelo el `additionalContext` de `SessionStart` y el de `UserPromptSubmit`.
  - En el evento `init` aparecen la skill `wiki-manager` y los 28 comandos `wiki:*` (más uno de prueba añadido a la copia), en la misma sesión.
  - Un comando `/wiki:probe` de la copia (por el symlink) que pide ejecutar con Bash `echo "BASH=$CLAUDE_PLUGIN_ROOT"` y `"${CLAUDE_PLUGIN_ROOT}/bin/llm-wiki" --help` devuelve la ruta exportada por `CLAUDE_ENV_FILE` y la ayuda del helper. Así es como lo usan los comandos del motor (instrucciones al modelo, no `` !`…` ``). Un `` !`…` `` con `${…}` en el comando lo rechaza la comprobación de permisos ("A variable in braces in this command can't be checked before it runs"); el motor no lo usa.
- [x] 1.2 En un proyecto desechable con OpenCode 2 real (`opencode --standalone` en `tmux`), comprobar:
  - que el hook `context` de un plugin local añade texto que el modelo recibe, y que no se acumula entre peticiones;
  - que con `wiki-manager` en `.claude/skills/` y `wiki-query` en `.opencode/skills/` las dos aparecen una sola vez, y que el campo `tools:` del frontmatter de la skill de Claude Code no impide cargarla;
  - que una excepción dentro del hook `context` envuelta en `try/catch` no bloquea el mensaje.

  Comprobar primero si hace falta un proveedor de modelo para la prueba del contexto. Si no hay ninguno disponible aquí, comprobar al menos la carga y la precedencia, y dejar la recepción del contexto para 8.3. Anotar los resultados y la versión de OpenCode en este archivo

  **Resultado (OpenCode 2.3.2, `@opencode/cli` 2.3.2, 2026-11-21): D1 y D3 se confirman.** Aquí no hay proveedor de modelo, así que se usó uno falso: un servidor local compatible con OpenAI (`@ai-sdk/openai-compatible` en el `opencode.json` del proyecto desechable) que registra el cuerpo de cada petición. Eso es exactamente lo que recibe el modelo. Se ejecutó `opencode run --standalone` con `XDG_*` aislados, `.claude/skills/wiki-manager` y `.opencode/skills/wiki-query` como symlinks al tag v1.0.0, y un plugin local `.opencode/plugins/wikiprobe/server.js` que registra `ctx.session.hook("context", cb)`. El hook añade `{type:"text", text}` a `input.system` e inserta `{role:"user", content:[{type:"text", text}]}` antes del último mensaje del usuario, como hace el modo Plan (`messages.splice(último user, 0, …)`). El plugin usa objetos planos, sin `@opencode/ai`.
  - La guía llega en el system y el recordatorio justo antes del mensaje del usuario. La petición de título no pasa por el hook `context`.
  - Con `-c` en el segundo y el tercer mensaje, cada petición lleva una sola copia del recordatorio, la del último mensaje, y una sola de la guía: no se acumulan.
  - En la herramienta de skills de la petición aparecen `wiki-manager` y `wiki-query`, una vez cada una. El `tools:` del frontmatter de `wiki-manager` no impide cargarla.
  - Si se lanza una excepción dentro del `try/catch` del hook, la petición sale sin guía ni recordatorio y el modelo responde. Si se lanza sin capturar, `opencode run` termina con 1 y no se hace la petición al modelo, como decía el design.
- [x] 1.3 Si 1.1 o 1.2 descartan algo de D1 o D3, cambiar `design.md` (y, si afecta a la decisión, registrar un ADR que sustituya a ADR-0005) en un commit propio, antes de seguir

  **Resultado:** ni 1.1 ni 1.2 descartan nada de D1 o D3, así que `design.md` no cambia. Un detalle para la implementación: en OpenCode, el recordatorio se inserta como mensaje `user` (igual que el modo Plan), no como `system`.

## 2. Suite: soporte del wiki (zona de código)

- [x] 2.1 Añadir al soporte un motor falso: un repositorio git local con un tag, con la estructura de rutas de nvk/llm-wiki v1.0.0 que usa D1 (`claude-plugin/skills/wiki-manager/`, `claude-plugin/commands/`, `claude-plugin/bin/llm-wiki`, `plugins/llm-wiki-opencode/skills/wiki-query/`), y la forma de apuntar a él el `engine.json` de la copia temporal del proyecto. Añadir también un motor inaccesible (ruta inexistente) y un segundo tag
- [x] 2.2 Ampliar `support/skills.js` con el descubrimiento de comandos de Claude Code (`.claude/commands/<ns>/<cmd>.md` → `/<ns>:<cmd>`) y añadir la forma de saber qué versión del motor ve cada agente
- [x] 2.3 Ampliar los adaptadores simulados:
  - **Claude Code**: recoger el `additionalContext` de `SessionStart` y ejecutar el hook `UserPromptSubmit` con un mensaje;
  - **OpenCode** (`opencode-host.mjs`): llamar al hook `context` con un contexto falso y devolver lo añadido.

  Añadir una forma de hacer fallar la generación del recordatorio
- [x] 2.4 Ejecutar la suite con los deltas del change y comprobar que los escenarios nuevos de `llm-wiki`, `wiki-first-knowledge` y `session-bootstrap` salen con pasos sin definir o en rojo, y que los existentes siguen en verde

  **Resultado:** los 26 escenarios que ya existían siguen en verde. De los 33 nuevos, 32 salen en rojo y "Las indicaciones de archivado incluyen la resincronización del wiki" sale con pasos sin definir (los define 6.1). En la primera ejecución, "Los dos agentes usan la misma versión" y "El usuario desactiva el wiki" pasaban sin motor fijado; sus pasos exigen ahora `engine.json` y salen en rojo.

## 3. Instalación del motor (zona de código): por escenario, rojo → implementar → verde → commit

- [x] 3.1 "Clon recién creado" (Claude Code y OpenCode): crear `.agents/wiki/engine.json` y el paso del núcleo que clona el ref en `.agents/wiki-engine/` con sello, y los symlinks de D1; añadir las rutas a `.gitignore` (D8)
- [x] 3.2 "El motor ya está en la versión fijada" y "El motor está instalado en otra versión": sello comparado con el ref y sustitución atómica
- [x] 3.3 "Sin acceso al repositorio del motor" y "Reintento tras una instalación del motor fallida": aviso `session-start:` con la instalación manual, sin bloquear
- [x] 3.4 "El agente dispone de las operaciones del wiki", "Los dos agentes usan la misma versión" y "Subir la versión del motor" (`llm-wiki`): exportar `CLAUDE_PLUGIN_ROOT` en los dos adaptadores
- [x] 3.5 Caso de D8: si ya existe una skill o un comando con esos nombres y no es un symlink del motor, no se sobrescribe y se avisa (escenario de soporte o prueba del núcleo, sin cambiar la spec)

  **Resultado:** prueba del núcleo en `acceptance-tests/core-tests/engine-links.test.js` (`npm run test:core`, con `node --test`). Cubre una skill propia y un espacio de comandos propio con esos nombres (no se sobrescriben y se avisa) y un symlink del motor obsoleto (se sustituye). De paso:
  - el simulador de OpenCode espera ahora a los procesos hijo del plugin antes de informar. Sin `shell`, nada espera al núcleo, y con el clonado del motor el aviso llegaba tarde;
  - la máquina simulada busca sus herramientas primero en `/usr/bin` y `/bin`, porque el `PATH` de esta sesión tiene un envoltorio de `rm` que necesita el resto del `PATH`;
  - el plugin de OpenCode avisa también cuando no puede exportar `CLAUDE_PLUGIN_ROOT`, como el adaptador de Claude Code, y con los mismos avisos en las tres variantes.

## 4. Guía y recordatorio (zona de código): por escenario, rojo → implementar → verde → commit

- [x] 4.1 Escribir `.agents/wiki/guide.md` con una sección identificada por cada parte del flujo (D2), en menos de 6.000 caracteres, y los pasos de revisión de la guía: "La guía exige consultar antes de responder", "La guía distingue las peticiones que requieren conocimiento", "La guía ofrece las tres opciones ante un hueco", "La guía distingue los dos ámbitos", "La guía trata lo descubierto al trabajar como conocimiento", "La guía asigna una operación a cada tipo de descubrimiento" y "La guía trata los productos del proyecto como fuentes fijadas"
- [ ] 4.2 "El agente recibe la guía del wiki" y "La guía llega por el adaptador del arranque": el núcleo devuelve la guía; el hook `SessionStart` la añade como `additionalContext`, y el plugin de OpenCode, en el hook `context`, con la nota para OpenCode
- [ ] 4.3 "El agente recibe el recordatorio con cada mensaje": `.agents/wiki/reminder.md` con marcadores, el hook `UserPromptSubmit` nuevo (registrado en `.claude/settings.json`) y el recordatorio en el hook `context` de OpenCode, antes del último mensaje del usuario
- [ ] 4.4 "Un fallo del recordatorio no bloquea el mensaje" en los dos agentes

## 5. Ámbitos, `.wiki/` y desactivación (zona de código): por escenario, rojo → implementar → verde → commit

- [ ] 5.1 "Inicializar el wiki del proyecto": el núcleo detecta `.wiki/` ignorado, retira las líneas `.wiki` o `.wiki/` de `.gitignore` y avisa (D5)
- [ ] 5.2 "Máquina sin hub del usuario" en los dos agentes: ningún aviso sobre el hub
- [ ] 5.3 "El usuario desactiva el wiki" en los dos agentes: `PROJECT_WIKI=off` (D4)

## 6. Resincronización al archivar (`openspec/`, commit propio)

- [ ] 6.1 Paso de soporte que ejecuta `openspec instructions archive --change <change> --json` y revisa `operationGuidance`, y comprobar que "Las indicaciones de archivado incluyen la resincronización del wiki" está en rojo (zona de código: commit propio)
- [ ] 6.2 Añadir a `openspec/config.yaml` `operations.archive.guidance` con los siete pasos de D6, y comprobar que el escenario pasa a verde (zona de `openspec/`: commit propio)

## 7. Documentación (zona de código)

- [ ] 7.1 README de la plantilla: qué ofrece el wiki y su concepto, requisitos (git, acceso a GitHub en la primera sesión, Python 3 para el helper del motor, `OPENCODE_ENABLE_EXA` para buscar en la web desde OpenCode), cómo desactivarlo (`PROJECT_WIKI=off`), cómo subir la versión del motor y qué revisar al hacerlo, el permiso que pide Claude Code para el helper y qué heredan los proyectos creados desde la plantilla
- [ ] 7.2 `acceptance-tests/README.md`: cómo simula la suite el motor y la entrega de la guía y el recordatorio en cada agente

## 8. Cierre

- [ ] 8.1 Ejecutar la suite completa: todos los escenarios pasan, sin pasos pendientes ni sin definir, con el informe HTML generado
- [ ] 8.2 Ejecutar `openspec validate add-llm-wiki-support --type change --strict`
- [ ] 8.3 Comprobar con Claude Code y OpenCode 2 reales en este clon que, en una sesión nueva, el motor queda disponible en la misma sesión, la guía y el recordatorio llegan al modelo y `/wiki:query` (o `wiki-query`) responde sobre un `.wiki/` de prueba; anotar los resultados y las versiones en este archivo
