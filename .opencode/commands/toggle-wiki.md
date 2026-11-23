---
description: Habilita o deshabilita el wiki del proyecto, o cambia su modo (lite o full), para todo el proyecto
---

# /toggle-wiki

Sin argumento, cambia el wiki del proyecto al estado contrario; con el argumento `lite` o `full`, cambia su modo y nada más. Los ajustes son `"enabled"` y `"mode"` en `.agents/wiki/engine.json`, van versionados y valen para todos los que usan el repositorio: no son una preferencia de este usuario (ADR-0021, ADR-0029). Sigue estos pasos en orden, desde la raíz del proyecto. No hagas commits: deja los cambios en el stage para que el usuario haga el commit.

<!-- toggle-wiki:mode -->
## 1. Mira el argumento

El argumento del comando es el texto entre estas comillas: «$ARGUMENTS». Compáralo tal cual, sin pasarlo a minúsculas ni quitarle nada:

- **Vacío**: sigue en el paso 2, que habilita o deshabilita el wiki.
- **`lite`**: cambia el modo a `lite` y no sigas con los pasos 2 a 5:

  ```bash
  bash .agents/hooks/session-bootstrap.sh wiki mode lite .
  ```

- **`full`**: cambia el modo a `full` y no sigas con los pasos 2 a 5:

  ```bash
  bash .agents/hooks/session-bootstrap.sh wiki mode full .
  ```

- **Cualquier otra cosa**, también `Lite` o varias palabras: no ejecutes nada e informa como dice el paso 6 para un modo que no existe.

`wiki mode` no toca `"enabled"` ni `openspec/config.yaml`. Lee `changed=`, `mode=` y `enabled=` e informa como dice el paso 6: si `changed=false`, para el modo sin cambio; si no, con `enabled=false`, para el modo con el wiki deshabilitado; si no, para el modo cambiado.

<!-- toggle-wiki:status -->
## 2. Comprueba el estado

```bash
bash .agents/hooks/session-bootstrap.sh wiki status .
```

Lee `enabled=`, `mode=` (el modo del wiki) y `wiki-dir=` (si existe `.wiki/`). Las líneas `source=<ruta>` y `excluded=<ruta>|<motivo>` son lo que entraría y lo que no en la ingesta inicial. Los avisos salen por stderr, con el prefijo `session-start:`.

<!-- toggle-wiki:off -->
## 3. Si `enabled=true`: deshabilítalo

```bash
bash .agents/hooks/session-bootstrap.sh wiki off .
```

`.wiki/` se conserva. Si el modo avisa de que no ha tocado `openspec/config.yaml` (por ejemplo, porque sus marcas están mal formadas), no ha cambiado nada: explícaselo al usuario con el aviso y para. Si no, informa como dice el paso 6 para el wiki deshabilitado.

<!-- toggle-wiki:on -->
## 4. Si `enabled=false` y `wiki-dir=true`: habilítalo

```bash
bash .agents/hooks/session-bootstrap.sh wiki on .
```

El wiki ya existe, así que no propongas ninguna ingesta. Si el modo avisa de que no ha tocado `openspec/config.yaml`, no ha cambiado nada: explícaselo al usuario con el aviso y para. Si no, informa como dice el paso 6 para el wiki habilitado.

<!-- toggle-wiki:ingest -->
## 5. Si `enabled=false` y `wiki-dir=false`: propón la ingesta inicial y espera

Presenta al usuario la lista de `status`: qué entra como fuente (las líneas `source=`) y qué se excluye y por qué (las líneas `excluded=`). Pregúntale si quiere inicializar el wiki del proyecto y hacer la ingesta inicial del repositorio, fijada al commit actual. Espera su respuesta y no escribas nada antes.

- **Si no lo confirma**, no hagas nada más: el wiki sigue deshabilitado y ningún archivo del proyecto cambia. Díselo.
- **Si lo confirma**:
  1. Habilita el wiki, que instala y expone el motor:

     ```bash
     bash .agents/hooks/session-bootstrap.sh wiki on .
     ```

  2. Con la skill `wiki-manager` del motor. En esta sesión aún no la verás: lee sus instrucciones de `.agents/wiki-engine/claude-plugin/skills/wiki-manager/SKILL.md` y síguelas. Si `$CLAUDE_PLUGIN_ROOT` está vacía, usa `CLAUDE_PLUGIN_ROOT="$PWD/.agents/wiki-engine/claude-plugin"` para el helper del motor.
     - Inicializa el wiki del proyecto en modo local, en `.wiki/`.
     - Haz la ingesta inicial solo de manifiesto, fijada al commit actual (`git rev-parse HEAD`), sin copiar contenido: la ingesta de colecciones de `wiki-manager`, con el adaptador `git`, `--manifest-only`, `--revision <commit actual>` y `--local`, con un `--exclude <ruta>` por cada línea `excluded=` de `status`.
  3. Vuelve a ejecutar `wiki on`, que quita `.wiki/` de `.gitignore` si el motor lo añadió, y pasa el wiki al stage:

     ```bash
     bash .agents/hooks/session-bootstrap.sh wiki on . && git add -- .wiki .gitignore
     ```

  4. Si el paso 2 o el 3 fallan, deshaz todo, para que el wiki quede deshabilitado y nada del proyecto cambie, y explícale al usuario qué falló:

     ```bash
     git reset -q -- .wiki .gitignore; rm -rf .wiki; git checkout -q HEAD -- .gitignore; bash .agents/hooks/session-bootstrap.sh wiki off .
     ```

  Si todo ha ido bien, informa como dice el paso 6 para el wiki habilitado, y añade que `.wiki/` también está en el stage.

<!-- toggle-wiki:report -->
## 6. Informa

Díselo al usuario con estas palabras, completando lo que falte (`<modo>` es el de `mode=`, y `<argumento>`, el del paso 1):

- **Habilitado**: «El wiki del proyecto queda habilitado para todo el proyecto. `.agents/wiki/engine.json` y `openspec/config.yaml` están en el stage: haz el commit para que valga para todos. Las skills `wiki-query` y `wiki-manager`, la guía y el recordatorio del wiki llegan desde la sesión siguiente, cuando vuelvas a abrir OpenCode.»
- **Deshabilitado**: «El wiki del proyecto queda deshabilitado para todo el proyecto, y `.wiki/` se conserva. Los cambios están en el stage: haz el commit para que valga para todos. La guía y el recordatorio del wiki siguen en esta sesión hasta que vuelvas a abrir OpenCode, y las skills del wiki desaparecen, a más tardar, en la sesión siguiente.»
- **Modo cambiado**: «El wiki del proyecto queda en el modo <modo> para todo el proyecto. `.agents/wiki/engine.json` está en el stage: haz el commit para que valga para todos. Esta sesión no cambia: desde tu mensaje siguiente sigue llegando el recordatorio del modo anterior, y la guía y el recordatorio de ese modo llegan desde la sesión siguiente, cuando vuelvas a abrir OpenCode.»
- **Modo sin cambio**: «El wiki del proyecto ya estaba en el modo <modo>; no he cambiado nada.»
- **Modo con el wiki deshabilitado**: «El modo del wiki queda declarado como <modo>, pero el wiki del proyecto sigue deshabilitado: el modo valdrá cuando se habilite, con `/toggle-wiki` sin argumento. `.agents/wiki/engine.json` está en el stage: haz el commit para que valga para todos.»
- **Modo inexistente**: «El modo del wiki `<argumento>` no existe: los modos son `full` y `lite`. No he cambiado nada.»
