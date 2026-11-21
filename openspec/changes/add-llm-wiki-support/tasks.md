`acceptance-tests/` ya existe, así que se omite la puesta en marcha de la suite. Se trabaja con el ciclo de `spec-as-source`: rojo → implementar → verde → commit. Un commit nunca mezcla `openspec/` con la zona de código (que incluye `adr/` y `.wiki/`), salvo este `tasks.md`.

## 1. Comprobaciones previas: confirman D1 y D3 antes de escribir código

- [ ] 1.1 En un proyecto desechable con Claude Code real y una configuración aislada (`CLAUDE_CONFIG_DIR`), comprobar con `claude -p --output-format stream-json --verbose`:
  - que el `additionalContext` de `SessionStart` y el de `UserPromptSubmit` llegan al modelo (pedirle que repita una palabra clave de cada uno);
  - que una variable exportada por `CLAUDE_ENV_FILE` (`CLAUDE_PLUGIN_ROOT`) llega a los comandos de Bash de un comando de `.claude/commands/wiki/` puesto por symlink;
  - que la skill `wiki-manager` y los comandos `/wiki:*` puestos por symlink desde una copia del tag v1.0.0 aparecen en la misma sesión (ya comprobado con copias en 2.1.330; repetir con symlinks).

  Anotar los resultados y la versión de Claude Code en este archivo
- [ ] 1.2 En un proyecto desechable con OpenCode 2 real (`opencode --standalone` en `tmux`), comprobar:
  - que el hook `context` de un plugin local añade texto que el modelo recibe, y que no se acumula entre peticiones;
  - que con `wiki-manager` en `.claude/skills/` y `wiki-query` en `.opencode/skills/` las dos aparecen una sola vez, y que el campo `tools:` del frontmatter de la skill de Claude Code no impide cargarla;
  - que una excepción dentro del hook `context` envuelta en `try/catch` no bloquea el mensaje.

  Comprobar primero si hace falta un proveedor de modelo para la prueba del contexto. Si no hay ninguno disponible aquí, comprobar al menos la carga y la precedencia, y dejar la recepción del contexto para 8.3. Anotar los resultados y la versión de OpenCode en este archivo
- [ ] 1.3 Si 1.1 o 1.2 descartan algo de D1 o D3, cambiar `design.md` (y, si afecta a la decisión, registrar un ADR que sustituya a ADR-0005) en un commit propio, antes de seguir

## 2. Suite: soporte del wiki (zona de código)

- [ ] 2.1 Añadir al soporte un motor falso: un repositorio git local con un tag, con la estructura de rutas de nvk/llm-wiki v1.0.0 que usa D1 (`claude-plugin/skills/wiki-manager/`, `claude-plugin/commands/`, `claude-plugin/bin/llm-wiki`, `plugins/llm-wiki-opencode/skills/wiki-query/`), y la forma de apuntar a él el `engine.json` de la copia temporal del proyecto. Añadir también un motor inaccesible (ruta inexistente) y un segundo tag
- [ ] 2.2 Ampliar `support/skills.js` con el descubrimiento de comandos de Claude Code (`.claude/commands/<ns>/<cmd>.md` → `/<ns>:<cmd>`) y añadir la forma de saber qué versión del motor ve cada agente
- [ ] 2.3 Ampliar los adaptadores simulados:
  - **Claude Code**: recoger el `additionalContext` de `SessionStart` y ejecutar el hook `UserPromptSubmit` con un mensaje;
  - **OpenCode** (`opencode-host.mjs`): llamar al hook `context` con un contexto falso y devolver lo añadido.

  Añadir una forma de hacer fallar la generación del recordatorio
- [ ] 2.4 Ejecutar la suite con los deltas del change y comprobar que los escenarios nuevos de `llm-wiki`, `wiki-first-knowledge` y `session-bootstrap` salen con pasos sin definir o en rojo, y que los existentes siguen en verde

## 3. Instalación del motor (zona de código): por escenario, rojo → implementar → verde → commit

- [ ] 3.1 "Clon recién creado" (Claude Code y OpenCode): crear `.agents/wiki/engine.json` y el paso del núcleo que clona el ref en `.agents/wiki-engine/` con sello, y los symlinks de D1; añadir las rutas a `.gitignore` (D8)
- [ ] 3.2 "El motor ya está en la versión fijada" y "El motor está instalado en otra versión": sello comparado con el ref y sustitución atómica
- [ ] 3.3 "Sin acceso al repositorio del motor" y "Reintento tras una instalación del motor fallida": aviso `session-start:` con la instalación manual, sin bloquear
- [ ] 3.4 "El agente dispone de las operaciones del wiki", "Los dos agentes usan la misma versión" y "Subir la versión del motor" (`llm-wiki`): exportar `CLAUDE_PLUGIN_ROOT` en los dos adaptadores
- [ ] 3.5 Caso de D8: si ya existe una skill o un comando con esos nombres y no es un symlink del motor, no se sobrescribe y se avisa (escenario de soporte o prueba del núcleo, sin cambiar la spec)

## 4. Guía y recordatorio (zona de código): por escenario, rojo → implementar → verde → commit

- [ ] 4.1 Escribir `.agents/wiki/guide.md` con una sección identificada por cada parte del flujo (D2), en menos de 6.000 caracteres, y los pasos de revisión de la guía: "La guía exige consultar antes de responder", "La guía distingue las peticiones que requieren conocimiento", "La guía ofrece las tres opciones ante un hueco", "La guía distingue los dos ámbitos", "La guía trata lo descubierto al trabajar como conocimiento", "La guía asigna una operación a cada tipo de descubrimiento" y "La guía trata los productos del proyecto como fuentes fijadas"
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
