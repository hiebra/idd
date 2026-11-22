---
description: Habilita o deshabilita el wiki del proyecto, para todo el proyecto
---

# /toggle-wiki

Cambia el wiki del proyecto al estado contrario. El ajuste es `"enabled"` en `.agents/wiki/engine.json`, va versionado y vale para todos los que usan el repositorio: no es una preferencia de este usuario (ADR-0021). Sigue estos pasos en orden, desde la raíz del proyecto. No hagas commits: deja los cambios en el stage para que el usuario haga el commit.

<!-- toggle-wiki:status -->
## 1. Comprueba el estado

```bash
bash .agents/hooks/session-bootstrap.sh wiki status .
```

Lee `enabled=` y `wiki-dir=` (si existe `.wiki/`). Las líneas `source=<ruta>` y `excluded=<ruta>|<motivo>` son lo que entraría y lo que no en la ingesta inicial. Los avisos salen por stderr, con el prefijo `session-start:`.

<!-- toggle-wiki:off -->
## 2. Si `enabled=true`: deshabilítalo

```bash
bash .agents/hooks/session-bootstrap.sh wiki off .
```

`.wiki/` se conserva. Si el modo avisa de que no ha tocado `openspec/config.yaml` (por ejemplo, porque sus marcas están mal formadas), no ha cambiado nada: explícaselo al usuario con el aviso y para. Si no, informa como dice el paso 5 para el wiki deshabilitado.

<!-- toggle-wiki:on -->
## 3. Si `enabled=false` y `wiki-dir=true`: habilítalo

```bash
bash .agents/hooks/session-bootstrap.sh wiki on .
```

El wiki ya existe, así que no propongas ninguna ingesta. Si el modo avisa de que no ha tocado `openspec/config.yaml`, no ha cambiado nada: explícaselo al usuario con el aviso y para. Si no, informa como dice el paso 5 para el wiki habilitado.

<!-- toggle-wiki:ingest -->
## 4. Si `enabled=false` y `wiki-dir=false`: propón la ingesta inicial y espera

Presenta al usuario la lista de `status`: qué entra como fuente (las líneas `source=`) y qué se excluye y por qué (las líneas `excluded=`). Pregúntale si quiere inicializar el wiki del proyecto y hacer la ingesta inicial del repositorio, fijada al commit actual. Espera su respuesta y no escribas nada antes.

- **Si no lo confirma**, no hagas nada más: el wiki sigue deshabilitado y ningún archivo del proyecto cambia. Díselo.
- **Si lo confirma**:
  1. Habilita el wiki, que instala y expone el motor:

     ```bash
     bash .agents/hooks/session-bootstrap.sh wiki on .
     ```

  2. Con las operaciones del motor. Puede que esta sesión aún no vea el motor recién instalado: lee sus instrucciones de `.agents/wiki-engine/claude-plugin/commands/wiki.md` (init) y `.agents/wiki-engine/claude-plugin/commands/ingest-collection.md`, y síguelas. Si `$CLAUDE_PLUGIN_ROOT` está vacía, usa `CLAUDE_PLUGIN_ROOT="$PWD/.agents/wiki-engine/claude-plugin"` para el helper del motor.
     - Inicializa el wiki del proyecto en modo local, en `.wiki/`.
     - Haz la ingesta inicial solo de manifiesto, fijada al commit actual (`git rev-parse HEAD`), sin copiar contenido: `/wiki:ingest-collection . --adapter git --manifest-only --revision <commit actual> --local`, con un `--exclude <ruta>` por cada línea `excluded=` de `status`.
  3. Vuelve a ejecutar `wiki on`, que quita `.wiki/` de `.gitignore` si el motor lo añadió, y pasa el wiki al stage:

     ```bash
     bash .agents/hooks/session-bootstrap.sh wiki on . && git add -- .wiki .gitignore
     ```

  4. Si el paso 2 o el 3 fallan, deshaz todo, para que el wiki quede deshabilitado y nada del proyecto cambie, y explícale al usuario qué falló:

     ```bash
     git reset -q -- .wiki .gitignore; rm -rf .wiki; git checkout -q HEAD -- .gitignore; bash .agents/hooks/session-bootstrap.sh wiki off .
     ```

  Si todo ha ido bien, informa como dice el paso 5 para el wiki habilitado, y añade que `.wiki/` también está en el stage.

<!-- toggle-wiki:report -->
## 5. Informa

Díselo al usuario con estas palabras, completando lo que falte:

- **Habilitado**: «El wiki del proyecto queda habilitado para todo el proyecto. `.agents/wiki/engine.json` y `openspec/config.yaml` están en el stage: haz el commit para que valga para todos. Ya en esta sesión puedes usar `/wiki:*` y la skill `wiki-manager`, y el recordatorio del wiki llega desde tu mensaje siguiente. Desde la sesión siguiente llegan también la guía del wiki y `CLAUDE_PLUGIN_ROOT`, la ruta del helper del motor.»
- **Deshabilitado**: «El wiki del proyecto queda deshabilitado para todo el proyecto, y `.wiki/` se conserva. Los cambios están en el stage: haz el commit para que valga para todos. El recordatorio del wiki deja de llegar desde tu mensaje siguiente; la guía de esta sesión y las operaciones `/wiki:*` desaparecen, a más tardar, en la sesión siguiente.»
