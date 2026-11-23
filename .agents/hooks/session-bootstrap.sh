#!/bin/bash
# Núcleo del arranque de sesión, neutral respecto al agente (ADR-0002, ADR-0005).
#
# Uso:
#   session-bootstrap.sh <directorio del proyecto>
#       Prepara el proyecto para la sesión:
#       - Prepara git (manage-git-discipline, design D5): completa el clon si
#         es superficial; en un contenedor efímero, trae las referencias de
#         origin con git fetch; pone al día con update-ref cada rama
#         permanente local (x-main) atrasada respecto a origin/<rama>, salvo
#         la rama en la que está el clon, y avisa de las que han divergido; y
#         en un contenedor efímero guarda la rama de la sesión en
#         git config idd.sessionBranch, si no hay una guardada. No toca el
#         árbol de trabajo. Fuera de un contenedor efímero solo usa la red para
#         completar un clon superficial.
#       - Con el wiki del proyecto habilitado, instala el motor del wiki en la
#         versión fijada en .agents/wiki/engine.json, en .agents/wiki-engine/
#         (ignorado por git), y lo expone a cada agente con symlinks; con el
#         wiki deshabilitado, retira esos symlinks. Con el wiki habilitado,
#         avisa si los pasos del wiki de openspec/config.yaml no coinciden con
#         su fuente; nunca reescribe config.yaml.
#       - Instala todas las dependencias del proyecto (npm install) en la raíz
#         y en acceptance-tests/ cuando faltan o han cambiado package.json,
#         package-lock.json o este script.
#       Por stdout, una línea "clave=valor" por dato que el adaptador necesita,
#       y nada más:
#         bin=<ruta absoluta a node_modules/.bin>, si hay un openspec del proyecto
#         wiki-engine=<ruta absoluta del paquete de Claude Code del motor>, el
#           valor de CLAUDE_PLUGIN_ROOT, si el motor está instalado
#   session-bootstrap.sh guide <agente> <directorio del proyecto>
#   session-bootstrap.sh reminder <agente> <directorio del proyecto>
#       Por stdout, la guía del wiki o el recordatorio por mensaje, ya
#       preparados para el agente (claude-code u opencode), o nada si el wiki
#       está deshabilitado o no se puede generar. Los dos textos son los del
#       modo del wiki (design D2 de add-wiki-lite-mode): lo que va entre
#       "<!-- wiki-mode:full -->" o "<!-- wiki-mode:lite -->" y
#       "<!-- wiki-mode:end -->", cada marca sola en su línea, es propio de ese
#       modo; se quitan las líneas del otro modo y todas las marcas, y lo
#       demás es común. Un bloque sin cerrar, una marca de un modo que no
#       existe o un bloque dentro de otro hacen que no se entregue el texto.
#       El recordatorio es un solo párrafo: sus líneas no vacías se juntan con
#       un espacio.
#   session-bootstrap.sh wiki <status|on|off> <directorio del proyecto>
#   session-bootstrap.sh wiki mode <full|lite> <directorio del proyecto>
#       La parte determinista de /toggle-wiki (design D3 de
#       add-project-wiki-toggle, D5 de add-wiki-lite-mode). Por stdout, líneas
#       "clave=valor":
#       - status: enabled=true|false, mode=full|lite (el modo efectivo; con
#         el wiki habilitado, avisa si "mode" no es un modo), wiki-dir=true|false (si existe .wiki/) y,
#         para la ingesta inicial, source=<ruta> por cada archivo versionado
#         que entraría y excluded=<ruta>|<motivo> por cada uno que no (lo
#         generado, informes, lockfiles, la copia del motor, enlaces, archivos
#         vacíos o de configuración trivial).
#       - on: pone "enabled": true, inserta los pasos del wiki de
#         archive-guidance.yaml en operations.archive.guidance de
#         openspec/config.yaml, entre "# wiki:archive-guidance:begin" y
#         "# wiki:archive-guidance:end" (crea las claves que falten, dentro de
#         las marcas), instala y expone el motor como el arranque y pasa al
#         stage engine.json y config.yaml. Imprime staged=, enabled= y, si el
#         motor está instalado, wiki-engine=.
#       - off: pone "enabled": false, quita lo que hay entre las marcas, marcas
#         incluidas (y guidance, si se queda vacía), retira los symlinks del
#         motor y pasa al stage los mismos dos archivos. No toca .wiki/.
#       - mode full|lite: escribe solo "mode" en engine.json (inserta la clave
#         si falta y crea el archivo si no existe o está vacío), sin tocar
#         "enabled", config.yaml, el motor ni .wiki/. No escribe si el modo
#         declarado ya es el pedido, o si falta y el pedido es full; un valor
#         que no es un modo sí se reescribe. Imprime changed=true|false,
#         mode=, enabled= y, si ha cambiado, staged=engine.json, que es lo
#         único que pasa al stage. Con otro valor no escribe nada y avisa.
#       on y off conservan "mode".
#       Ni on, ni off, ni mode hacen commit. Con las marcas mal formadas o repetidas no
#       cambian nada y avisan. La edición de config.yaml es de texto, línea a
#       línea: conserva byte a byte el resto del archivo.
#   session-bootstrap.sh comments-rule <agente> <directorio del proyecto>
#   session-bootstrap.sh comments-reminder <agente> <directorio del proyecto>
#       Por stdout, la regla de comentarios, o su recordatorio si el mensaje
#       del usuario, que se lee por stdin, la activa (es un comentario o
#       contiene una palabra de cierre: "p", "procesa", "procesar", "r",
#       "reformula" o "reformular"); nada si la regla está desactivada, el
#       mensaje no la activa o el texto no se puede generar.
#
# En todos los modos, avisos por stderr, uno por línea, con el prefijo
# "session-start:", y termina siempre con 0: nunca bloquea la sesión.
#
# El wiki del proyecto está habilitado solo si .agents/wiki/engine.json dice
# literalmente "enabled": true (design D1 de add-project-wiki-toggle, ADR-0021);
# vale para todo el proyecto y ninguna variable local lo cambia. Deshabilitado,
# no se instala el motor, se retiran sus symlinks y la guía y el recordatorio
# quedan vacíos. Del proyecto solo se leen engine.json, openspec/config.yaml y
# .wiki/; la guía, el recordatorio, opencode-note.md y archive-guidance.yaml se
# buscan en ../wiki/ respecto a este script (design D8).
# Con el wiki habilitado, su modo es "mode" de engine.json (design D1 de
# add-wiki-lite-mode): "full" o "lite", tal cual; si falta, full. Cualquier
# otro valor deja el wiki en full, y el modo principal avisa de ello; guide y
# reminder usan full sin avisar. Con el wiki deshabilitado no se lee el modo.
# La regla de comentarios se desactiva en local con PROJECT_COMMENTS=off.
#
# Cada agente tiene su adaptador, que lanza este script, ajusta el entorno de
# su sesión, entrega la guía y el recordatorio y muestra los avisos.

set -u

# Ruta de este script relativa al proyecto, para que el sello no dependa de dónde está el clon
CORE=".agents/hooks/session-bootstrap.sh"

# Lo que se lee del proyecto (design D8 de add-project-wiki-toggle): el ajuste
# y la versión del motor, config.yaml y .wiki/
WIKI_DIR=".agents/wiki"
ENGINE_JSON="$WIKI_DIR/engine.json"
CONFIG_YAML="openspec/config.yaml"
# Lo que viaja con la distribución se busca junto a este script, no en el
# proyecto (design D8): en este repositorio las dos rutas coinciden
SELF_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" 2>/dev/null && pwd)"
DIST_WIKI="${SELF_DIR%/*}/wiki"
GUIDE_MD="$DIST_WIKI/guide.md"
REMINDER_MD="$DIST_WIKI/reminder.md"
OPENCODE_NOTE="$DIST_WIKI/opencode-note.md"
ARCHIVE_GUIDANCE="$DIST_WIKI/archive-guidance.yaml"
BLOCK_BEGIN="# wiki:archive-guidance:begin"
BLOCK_END="# wiki:archive-guidance:end"
ENGINE_DIR=".agents/wiki-engine"
ENGINE_STAMP="$ENGINE_DIR/.wiki-engine-ref"
# Lo que se expone a cada agente (design D1): ruta del agente y destino relativo a ella
ENGINE_LINKS=(
  ".claude/skills/wiki-manager|../../$ENGINE_DIR/claude-plugin/skills/wiki-manager"
  ".claude/commands/wiki|../../$ENGINE_DIR/claude-plugin/commands"
  ".opencode/skills/wiki-query|../../$ENGINE_DIR/plugins/llm-wiki-opencode/skills/wiki-query"
)
REMINDER_MAX=600
COMMENTS_DIR=".agents/comments"
BRANCH_CHANGE=".agents/openspec/branch-change.mjs"
GIT_TIMEOUT=300

warn() {
  echo "session-start: $*" >&2
}


# engine_field NAME: el valor de texto NAME de engine.json, sin depender de Node
engine_field() {
  sed -n "s/.*\"$1\"[[:space:]]*:[[:space:]]*\"\([^\"]*\)\".*/\1/p" "$ENGINE_JSON" 2>/dev/null | head -n 1
}

# engine_url REPO: "owner/name" es un repositorio de GitHub; cualquier otra cosa, una URL de git
engine_url() {
  if [[ "$1" =~ ^[A-Za-z0-9_.-]+/[A-Za-z0-9_.-]+$ ]]; then
    echo "https://github.com/$1.git"
  else
    echo "$1"
  fi
}

# is_engine_link PATH: PATH es un symlink que puso este script
is_engine_link() {
  [ -L "$1" ] && [[ "$(readlink "$1")" == "../../$ENGINE_DIR/"* ]]
}

remove_engine_links() {
  local entry link
  for entry in "${ENGINE_LINKS[@]}"; do
    link="${entry%%|*}"
    if is_engine_link "$link"; then rm -f "$link"; fi
  done
}

# Expone el motor instalado a cada agente. Lo que ya exista con esos nombres
# y no sea un symlink del motor no se toca (design D8)
link_engine() {
  local entry link target
  for entry in "${ENGINE_LINKS[@]}"; do
    link="${entry%%|*}"
    target="${entry#*|}"
    if is_engine_link "$link"; then
      [ "$(readlink "$link")" = "$target" ] && continue
      rm -f "$link"
    elif [ -e "$link" ] || [ -L "$link" ]; then
      warn "ya existe '$link' y no es del motor del wiki; no se sustituye, así que el agente no verá esa parte del motor"
      continue
    fi
    mkdir -p "$(dirname "$link")" && ln -s "$target" "$link" ||
      warn "no se ha podido crear '$link', que expone el motor del wiki al agente"
  done
}

# fetch_engine REPO REF: descarga el motor del wiki en ENGINE_DIR, o avisa.
# Es la única función que sabe de dónde sale el motor (design D8), para que
# una instalación global pueda cambiarlo sin tocar el resto
fetch_engine() {
  local repo="$1" ref="$2" url want
  url="$(engine_url "$repo")"
  want="$ref $repo"
  local manual="rm -rf $ENGINE_DIR && git clone --depth 1 --branch $ref $url $ENGINE_DIR && echo '$want' > $ENGINE_STAMP"
  if ! command -v git >/dev/null 2>&1; then
    warn "falló la instalación del motor del wiki ($repo $ref): hace falta git; se reintentará en la siguiente sesión. Para instalarlo a mano: $manual"
  else
    # Se descarga aparte y se sustituye al final, para no dejar nunca una copia a medias
    local tmp="$ENGINE_DIR.tmp.$$" old="$ENGINE_DIR.old.$$" log stale
    # Restos de un arranque que se interrumpió (su proceso ya no existe)
    for stale in "$ENGINE_DIR".tmp.* "$ENGINE_DIR".old.*; do
      [ -e "$stale" ] || continue
      kill -0 "${stale##*.}" 2>/dev/null || rm -rf "$stale"
    done
    log="$(mktemp)"
    rm -rf "$tmp"
    if GIT_TERMINAL_PROMPT=0 timeout 300 git -c advice.detachedHead=false clone --quiet --depth 1 --branch "$ref" "$url" "$tmp" >"$log" 2>&1 &&
      rm -rf "$tmp/.git" && echo "$want" >"$tmp/.wiki-engine-ref"; then
      if [ -e "$ENGINE_DIR" ]; then mv "$ENGINE_DIR" "$old"; fi
      if mv "$tmp" "$ENGINE_DIR"; then
        rm -rf "$old"
      else
        [ -e "$old" ] && mv "$old" "$ENGINE_DIR"
        warn "no se ha podido sustituir $ENGINE_DIR por el motor del wiki $ref; se reintentará en la siguiente sesión"
      fi
    else
      warn "falló la instalación del motor del wiki ($repo $ref, git clone); se reintentará en la siguiente sesión. Para instalarlo a mano: $manual"
      tail -n 3 "$log" | sed 's/^/session-start:   /' >&2
    fi
    rm -rf "$tmp" "$log"
  fi
}

# Instala el motor del wiki en la versión fijada, si falta o es otra (design D1)
install_wiki_engine() {
  [ -f "$ENGINE_JSON" ] || return
  if wiki_disabled; then
    remove_engine_links
    return
  fi
  local repo ref want
  repo="$(engine_field repo)"
  ref="$(engine_field ref)"
  if [ -z "$repo" ] || [ -z "$ref" ]; then
    warn "$ENGINE_JSON no declara \"repo\" y \"ref\"; no se instala el motor del wiki"
    return
  fi
  want="$ref $repo"
  if [ "$(cat "$ENGINE_STAMP" 2>/dev/null)" != "$want" ]; then
    fetch_engine "$repo" "$ref"
  fi
  [ -d "$ENGINE_DIR/claude-plugin" ] || return
  link_engine
  echo "wiki-engine=$PWD/$ENGINE_DIR/claude-plugin"
}

# .wiki/ se versiona siempre (design D5): el motor lo añade a .gitignore al
# inicializar un wiki en modo local. Las líneas exactas ".wiki" o ".wiki/" se
# retiran; si lo ignora otra regla, solo se avisa
keep_wiki_versioned() {
  [ -d .wiki ] || return
  git rev-parse --is-inside-work-tree >/dev/null 2>&1 || return
  wiki_ignored || return
  if [ -f .gitignore ] && grep -qxE '\.wiki/?' .gitignore; then
    local tmp
    tmp="$(mktemp)"
    # grep -v termina con 1 si no queda ninguna línea, y eso también vale
    grep -vxE '\.wiki/?' .gitignore >"$tmp"
    cat "$tmp" >.gitignore && warn "se ha quitado '.wiki/' de .gitignore: el wiki del proyecto se versiona con el repositorio"
    rm -f "$tmp"
  fi
  if wiki_ignored; then
    warn "git ignora archivos de .wiki/ por otra regla; el wiki del proyecto debe versionarse (compruébalo con 'git check-ignore -v .wiki/<archivo>')"
  fi
}

# El estado personal de Obsidian (.wiki/.obsidian/) se ignora a propósito
# en .gitignore, así que no cuenta
wiki_ignored() {
  git check-ignore -q .wiki 2>/dev/null ||
    [ -n "$(git ls-files --others --ignored --exclude-standard -- .wiki ':(exclude).wiki/.obsidian' 2>/dev/null | head -n 1)" ]
}

# install_project DIR: instala las dependencias del proyecto Node en DIR
# (relativo a la raíz) si faltan o han cambiado desde la última instalación correcta.
install_project() {
  local dir="$1"
  # Un sello por proyecto, con rutas relativas a la raíz
  local stamp="$dir/node_modules/.session-start.sha256"
  if sha256sum --check --status "$stamp" >/dev/null 2>&1; then
    return
  fi
  # Borrar el sello antes, para que un fallo se reintente en la siguiente sesión
  rm -f "$stamp"
  local log
  log="$(mktemp)"
  # npm install (no npm ci) de todas las dependencias
  if (cd "$dir" && npm install --no-audit --no-fund) >"$log" 2>&1; then
    sha256sum "$dir/package.json" "$dir/package-lock.json" "$CORE" >"$stamp" 2>/dev/null || rm -f "$stamp"
  else
    warn "falló la instalación de dependencias en '$dir' (npm install); se reintentará en la siguiente sesión"
    tail -n 5 "$log" | sed 's/^/session-start:   /' >&2
  fi
  rm -f "$log"
}

install_dependencies() {
  # Lo primero, comprobar npm
  if ! command -v npm >/dev/null 2>&1 || ! command -v node >/dev/null 2>&1; then
    warn "hace falta Node.js con npm para instalar las dependencias del proyecto; no se instala nada"
    return
  fi

  # Versión de Node frente a engines.node
  local current required
  current="$(node --version 2>/dev/null)"
  current="${current#v}"
  required="$(node -e 'try { process.stdout.write(String(require("./package.json").engines?.node ?? "")) } catch {}' 2>/dev/null)"
  if [[ "$required" =~ ^[[:space:]]*\>=[[:space:]]*v?([0-9]+)(\.([0-9]+))?(\.([0-9]+))?[[:space:]]*$ ]]; then
    local min="${BASH_REMATCH[1]}.${BASH_REMATCH[3]:-0}.${BASH_REMATCH[5]:-0}"
    if [ "$(printf '%s\n%s\n' "$min" "$current" | sort -V | head -n1)" != "$min" ]; then
      warn "el proyecto necesita Node.js $required y la versión encontrada es $current; no se instala nada"
      return
    fi
  else
    warn "no se puede comprobar la versión de Node.js (engines.node: '${required:-ausente}'); se continúa"
  fi

  # La raíz y, si existe, el proyecto de tests de aceptación; un fallo en uno no impide el otro
  install_project "."
  if [ -f acceptance-tests/package.json ]; then
    install_project "acceptance-tests"
  fi

  # El openspec del proyecto, para que el adaptador lo ponga por delante en el PATH
  if [ -x node_modules/.bin/openspec ]; then
    echo "bin=$PWD/node_modules/.bin"
  fi
}

# prepare_git: deja el clon listo para el ciclo de git del proyecto (design D5
# de manage-git-discipline). La detección del contenedor efímero y la lista
# x-main vienen de branch-change.mjs; sin Node, no es un contenedor efímero y
# la única rama permanente es main
prepare_git() {
  command -v git >/dev/null 2>&1 || return
  git rev-parse --is-inside-work-tree >/dev/null 2>&1 || return
  local ephemeral=false permanent="main" info line log fetched=false
  if command -v node >/dev/null 2>&1 && [ -f "$BRANCH_CHANGE" ]; then
    info="$(node "$BRANCH_CHANGE" env 2>/dev/null)"
    while IFS= read -r line; do
      case "$line" in
        ephemeral=*) ephemeral="${line#ephemeral=}" ;;
        permanent=?*) permanent="${line#permanent=}" ;;
      esac
    done <<<"$info"
  fi
  log="$(mktemp)"
  if [ "$(git rev-parse --is-shallow-repository 2>/dev/null)" = "true" ]; then
    if GIT_TERMINAL_PROMPT=0 timeout "$GIT_TIMEOUT" git fetch --unshallow --quiet >"$log" 2>&1; then
      fetched=true
    else
      warn "no se pudo completar el clon superficial (git fetch --unshallow); las puertas del ciclo usan las referencias que haya"
      tail -n 2 "$log" | sed 's/^/session-start:   /' >&2
    fi
  fi
  if [ "$ephemeral" = "true" ] && [ "$fetched" = "false" ]; then
    if ! GIT_TERMINAL_PROMPT=0 timeout "$GIT_TIMEOUT" git fetch --quiet origin >"$log" 2>&1; then
      warn "no se pudo actualizar las referencias de origin (git fetch origin); las puertas del ciclo usan las que haya"
      tail -n 2 "$log" | sed 's/^/session-start:   /' >&2
    fi
  fi
  rm -f "$log"
  local current name old new checked
  current="$(git symbolic-ref --short -q HEAD 2>/dev/null)"
  # Las ramas sacadas en cualquier directorio del clon (el principal o un
  # worktree): update-ref movería la referencia sin su árbol ni su índice
  # (design D11 de autopilot-rama-por-sesion)
  checked=" $current $(git worktree list --porcelain 2>/dev/null | sed -n 's|^branch refs/heads/||p' | tr '\n' ' ')"
  for name in $permanent; do
    case "$checked" in *" $name "*) continue ;; esac
    old="$(git rev-parse --verify -q "refs/heads/$name" 2>/dev/null)" || continue
    new="$(git rev-parse --verify -q "refs/remotes/origin/$name" 2>/dev/null)" || continue
    [ "$old" = "$new" ] && continue
    if git merge-base --is-ancestor "$old" "$new" 2>/dev/null; then
      git update-ref "refs/heads/$name" "$new" "$old" 2>/dev/null ||
        warn "no se pudo poner al día la rama permanente local '$name' con origin/$name"
    elif ! git merge-base --is-ancestor "$new" "$old" 2>/dev/null; then
      warn "la rama permanente local '$name' y origin/$name han divergido; no se toca"
    fi
  done
  if [ "$ephemeral" = "true" ] && [ -n "$current" ] && [ -z "$(git config --get idd.sessionBranch 2>/dev/null)" ]; then
    git config idd.sessionBranch "$current" 2>/dev/null ||
      warn "no se pudo guardar la rama de la sesión (git config idd.sessionBranch)"
  fi
}

# --- wiki: el ajuste del proyecto y /toggle-wiki (design D1-D3 de add-project-wiki-toggle) ---

# El wiki está habilitado solo si engine.json dice literalmente "enabled": true.
# Un archivo que falta, un error o cualquier otro valor lo dejan deshabilitado
wiki_enabled() {
  [ -f "$ENGINE_JSON" ] &&
    grep -qE '"enabled"[[:space:]]*:[[:space:]]*true([^A-Za-z0-9_."]|$)' "$ENGINE_JSON" 2>/dev/null
}

wiki_disabled() {
  ! wiki_enabled
}

# El valor de "mode" en engine.json tal como está escrito (con sus comillas), o
# nada si falta (design D1 de add-wiki-lite-mode)
wiki_declared_mode() {
  sed -nE 's/.*"mode"[[:space:]]*:[[:space:]]*("[^"]*"|[^,}[:space:]]*).*/\1/p' "$ENGINE_JSON" 2>/dev/null | head -n 1
}

# Éxito si engine.json tiene la clave "mode"
wiki_mode_declared() {
  grep -qE '"mode"[[:space:]]*:' "$ENGINE_JSON" 2>/dev/null
}

# wiki_current_mode: full o lite. Sin "mode", o con un valor que no es un modo, full
wiki_current_mode() {
  case "$(wiki_declared_mode)" in
    '"lite"') echo lite ;;
    *) echo full ;;
  esac
}

# Avisa si "mode" tiene un valor que no es un modo (design D1)
warn_invalid_mode() {
  wiki_mode_declared || return 0
  local value
  value="$(wiki_declared_mode)"
  case "$value" in '"full"' | '"lite"') return 0 ;; esac
  warn "el modo del wiki de $ENGINE_JSON ($value) no existe: los modos son full y lite, y se usa full; para corregirlo, ejecuta /toggle-wiki full o /toggle-wiki lite y haz el commit"
}

# set_field NOMBRE VALOR: cambia el campo NOMBRE de engine.json a VALOR (texto
# JSON tal cual, con sus comillas si es una cadena) sin reescribir el resto; si
# falta, lo inserta tras la llave de apertura, y si engine.json no existe o está
# vacío, lo crea con solo ese campo (design D5 de add-wiki-lite-mode)
set_field() {
  local name="$1" value="$2" tmp
  if [ ! -f "$ENGINE_JSON" ] || ! grep -q '"' "$ENGINE_JSON" 2>/dev/null; then
    mkdir -p "$WIKI_DIR" && printf '{\n  "%s": %s\n}\n' "$name" "$value" >"$ENGINE_JSON"
    return
  fi
  tmp="$(mktemp)" || return 1
  if grep -qE "\"$name\"[[:space:]]*:" "$ENGINE_JSON"; then
    sed -E "s/(\"$name\"[[:space:]]*:[[:space:]]*)(\"[^\"]*\"|[A-Za-z0-9_.+-]+)/\1$value/" "$ENGINE_JSON" >"$tmp"
  elif grep -qE '^[[:space:]]*\{[[:space:]]*$' "$ENGINE_JSON"; then
    awk -v f="  \"$name\": $value," '!done && /^[[:space:]]*\{[[:space:]]*$/ { print; print f; done = 1; next } { print }' "$ENGINE_JSON" >"$tmp"
  else
    awk -v f="{ \"$name\": $value," '!done && sub(/\{/, f) { done = 1 } { print }' "$ENGINE_JSON" >"$tmp"
  fi
  cat "$tmp" >"$ENGINE_JSON"
  rm -f "$tmp"
}

# set_enabled true|false: cambia "enabled" en engine.json sin tocar el resto, "mode" incluido
set_enabled() {
  set_field enabled "$1"
}

# Edición de texto, línea a línea, del bloque de pasos del wiki en
# operations.archive.guidance de config.yaml (design D2). No reescribe el YAML:
# conserva comentarios, orden y formato del resto. Modos:
#   check   imprime none, one o bad según las marcas
#   remove  config.yaml sin el bloque (marcas incluidas); si guidance queda
#           vacía, también sin ella
#   insert  config.yaml con el bloque al final de guidance; crea guidance,
#           archive u operations, dentro del bloque, si faltan
#   extract las entradas que hay dentro del bloque, sin sangría
# Códigos de salida: 0 bien; 2 marcas mal formadas; 3 no hay dónde ponerlo
# (por ejemplo, "guidance: []"); 4 quitarlo dejaría líneas huérfanas
BLOCK_AWK='
function ind(s) { match(s, /^ */); return RLENGTH }
function blankish(s) { return s ~ /^[ \t]*$/ || s ~ /^[ \t]*#/ }
function keyonly(s) { return s ~ /^ *[A-Za-z_][A-Za-z0-9_-]*:[ \t]*(#.*)?$/ }
function keyname(s,   t) { t = s; sub(/^ */, "", t); sub(/:.*/, "", t); return t }
function ismarker(s, m,   t) { t = s; sub(/^[ \t]*/, "", t); sub(/[ \t]*$/, "", t); return t == m }
# Última línea que pertenece a la clave de la línea k, sin las finales en blanco o de comentario
function extent(k,   i, ki, last) {
  ki = ind(L[k]); last = k
  for (i = k + 1; i <= n; i++) {
    if (blankish(L[i])) continue
    if (ind(L[i]) > ki || (ind(L[i]) == ki && L[i] ~ /^ *-( |$)/)) { last = i; continue }
    break
  }
  return last
}
# La sangría de los hijos de la clave de la línea k, o -1 si no tiene
function childind(k,   e, i) {
  e = extent(k)
  for (i = k + 1; i <= e; i++) if (!blankish(L[i])) return ind(L[i])
  return -1
}
# La línea de la clave hija NAME de la línea k (0 si no está, -1 si tiene un valor en línea)
function child(k, name,   e, ci, i) {
  e = extent(k); ci = childind(k)
  for (i = k + 1; i <= e; i++) {
    if (blankish(L[i]) || ind(L[i]) != ci) continue
    if (keyname(L[i]) == name && L[i] ~ /^ *[A-Za-z_][A-Za-z0-9_-]*:/) return keyonly(L[i]) ? i : -1
  }
  return 0
}
function sp(k,   s) { s = ""; while (k-- > 0) s = s " "; return s }
function emit(i) { print L[i] }
BEGIN { b = 0; e = 0; nb = 0; ne = 0; bad = 0 }
{ L[++n] = $0
  if (ismarker($0, BEGIN_M)) { nb++; if (!b) b = n; if (e) bad = 1 }
  if (ismarker($0, END_M)) { ne++; if (!e) e = n; if (!b) bad = 1 } }
END {
  if (nb > 1 || ne > 1 || nb != ne || bad || (b && e < b)) state = "bad"
  else state = nb ? "one" : "none"
  if (mode == "check") { print state; exit 0 }
  if (state == "bad") exit 2
  if (mode == "extract") {
    if (state != "one") exit 0
    first = 0
    for (i = b + 1; i < e; i++) if (L[i] ~ /^ *-( |$)/) { first = i; break }
    if (!first) exit 0
    d = ind(L[first])
    for (i = first; i < e; i++) print substr(L[i], d + 1)
    exit 0
  }
  if (mode == "remove") {
    if (state == "none") { for (i = 1; i <= n; i++) emit(i); exit 0 }
    # Lo que va después del bloque no puede colgar de una clave que se quita con él
    keys = 0
    for (i = b + 1; i < e; i++) if (keyonly(L[i])) { keys = 1; top = ind(L[i]); break }
    if (keys) for (i = e + 1; i <= n; i++) { if (blankish(L[i])) continue; if (ind(L[i]) > top) exit 4; break }
    # La clave de la que cuelga el bloque, y si se queda sin hijos
    owner = 0
    for (i = b - 1; i >= 1; i--) if (keyonly(L[i]) && ind(L[i]) <= ind(L[b])) { owner = i; break }
    drop = 0
    if (owner && keyname(L[owner]) == "guidance") {
      empty = 1
      for (i = owner + 1; i <= n; i++) {
        if (i >= b && i <= e) continue
        if (blankish(L[i])) continue
        if (ind(L[i]) > ind(L[owner]) || (ind(L[i]) == ind(L[owner]) && L[i] ~ /^ *-( |$)/)) empty = 0
        break
      }
      if (empty) drop = owner
    }
    for (i = 1; i <= n; i++) if ((i < b || i > e) && i != drop) emit(i)
    exit 0
  }
  # insert
  if (state == "one") exit 2
  nsrc = 0
  while ((getline line < SRC) > 0) { if (!nsrc && (line ~ /^#/ || line ~ /^[ \t]*$/)) continue; S[++nsrc] = line }
  o = 0
  for (i = 1; i <= n; i++) if (L[i] ~ /^operations:/) { if (!keyonly(L[i])) exit 3; o = i; break }
  if (!o) {
    at = n; pre = "operations:\n  archive:\n    guidance:\n"; d = 6
  } else {
    ci = childind(o); if (ci < 0) ci = 2
    a = child(o, "archive"); if (a < 0) exit 3
    if (!a) { at = extent(o); pre = sp(ci) "archive:\n" sp(ci + 2) "guidance:\n"; d = ci + 4 }
    else {
      ai = childind(a); if (ai < 0) ai = ind(L[a]) + 2
      g = child(a, "guidance"); if (g < 0) exit 3
      if (!g) { at = extent(a); pre = sp(ai) "guidance:\n"; d = ai + 2 }
      else { at = extent(g); pre = ""; gi = childind(g); d = gi < 0 ? ind(L[g]) + 2 : gi }
    }
  }
  # Las claves que se crean van dentro del bloque, para que quitarlo las quite
  mi = pre == "" ? d : (o ? (a ? ai : ci) : 0)
  for (i = 1; i <= at; i++) emit(i)
  print sp(mi) BEGIN_M
  printf "%s", pre
  for (j = 1; j <= nsrc; j++) print (S[j] == "" ? "" : sp(d) S[j])
  print sp(mi) END_M
  for (i = at + 1; i <= n; i++) emit(i)
}'

# block_awk MODO [ARCHIVO]: ejecuta BLOCK_AWK sobre config.yaml
block_awk() {
  awk -v mode="$1" -v SRC="$ARCHIVE_GUIDANCE" -v BEGIN_M="$BLOCK_BEGIN" -v END_M="$BLOCK_END" "$BLOCK_AWK" "${2:-$CONFIG_YAML}"
}

# edit_block insert|remove: aplica el cambio a config.yaml, o avisa y no lo toca
edit_block() {
  local action="$1" tmp status
  if [ ! -f "$CONFIG_YAML" ]; then
    warn "no existe $CONFIG_YAML; no se cambian las indicaciones de archivado"
    return 0
  fi
  if [ "$(block_awk check)" = "bad" ]; then
    warn "las marcas '$BLOCK_BEGIN' y '$BLOCK_END' de $CONFIG_YAML están mal formadas o repetidas; no se toca el archivo. Deja como mucho un par, con la de inicio antes que la de fin, y vuelve a ejecutar /toggle-wiki"
    return 1
  fi
  if [ "$action" = "insert" ] && [ ! -f "$ARCHIVE_GUIDANCE" ]; then
    warn "no se encuentra $ARCHIVE_GUIDANCE, la fuente de los pasos del wiki; no se toca $CONFIG_YAML"
    return 1
  fi
  tmp="$(mktemp)" || return 1
  if [ "$action" = "insert" ] && [ "$(block_awk check)" = "one" ]; then
    # Se sustituye: primero se quita el bloque que hay
    block_awk remove >"$tmp" && block_awk insert "$tmp" >"$tmp.2" && mv "$tmp.2" "$tmp"
  else
    block_awk "$action" >"$tmp"
  fi
  status=$?
  case "$status" in
    0) cat "$tmp" >"$CONFIG_YAML" ;;
    3) warn "no se sabe dónde poner los pasos del wiki en $CONFIG_YAML (operations, archive o guidance tienen un valor en la misma línea); no se toca el archivo" ;;
    4) warn "quitar los pasos del wiki de $CONFIG_YAML dejaría líneas sin la clave de la que cuelgan; no se toca el archivo" ;;
    *) warn "no se ha podido editar $CONFIG_YAML; no se toca el archivo" ;;
  esac
  rm -f "$tmp" "$tmp.2"
  [ "$status" -eq 0 ]
}

# Con el wiki habilitado, avisa si los pasos de config.yaml no coinciden con su fuente (design D2)
warn_stale_block() {
  wiki_enabled || return 0
  [ -f "$CONFIG_YAML" ] && [ -f "$ARCHIVE_GUIDANCE" ] || return 0
  [ "$(block_awk check)" = "one" ] || return 0
  local current wanted
  current="$(block_awk extract)"
  wanted="$(awk 'started || !(/^#/ || /^[ \t]*$/) { started = 1; print }' "$ARCHIVE_GUIDANCE")"
  [ "$current" = "$wanted" ] && return 0
  warn "los pasos del wiki de $CONFIG_YAML no coinciden con su fuente ($ARCHIVE_GUIDANCE); para ponerlos al día, ejecuta /toggle-wiki dos veces y haz el commit"
}

# wiki_status: el ajuste, si existe .wiki/ y qué entraría en la ingesta inicial
wiki_status() {
  if wiki_enabled; then
    echo "enabled=true"
    warn_invalid_mode
  else
    echo "enabled=false"
  fi
  echo "mode=$(wiki_current_mode)"
  if [ -d .wiki ]; then echo "wiki-dir=true"; else echo "wiki-dir=false"; fi
  git rev-parse --is-inside-work-tree >/dev/null 2>&1 || return 0
  local mode file reason
  # Solo lo versionado; los symlinks son otra vía a lo que ya entra (ADR-0003)
  git ls-files -s -z 2>/dev/null | while IFS= read -r -d '' line; do
    mode="${line%% *}"
    file="${line#*$'\t'}"
    reason="$(ingest_exclusion "$file" "$mode")"
    if [ -n "$reason" ]; then
      echo "excluded=$file|$reason"
    else
      echo "source=$file"
    fi
  done
}

# ingest_exclusion RUTA MODO: por qué la ruta no entra en la ingesta inicial, o nada
# (la lista de exclusiones de la guía del wiki)
ingest_exclusion() {
  local file="$1" mode="$2" base="${1##*/}"
  case "/$file" in
    /.wiki/*) echo "el propio wiki"; return ;;
    /"$ENGINE_DIR"/* | /"$ENGINE_DIR".*) echo "la copia del motor"; return ;;
    */node_modules/*) echo "generado"; return ;;
    */.extracted/*) echo "generado"; return ;;
    */reports/*) echo "informe"; return ;;
  esac
  case "$base" in
    package-lock.json | npm-shrinkwrap.json | yarn.lock | pnpm-lock.yaml | bun.lockb | *.lock) echo "lockfile"; return ;;
    .gitignore | .gitattributes | .editorconfig | .npmrc | .nvmrc | .node-version | .prettierignore) echo "configuración trivial"; return ;;
  esac
  if [ "$mode" = "120000" ]; then echo "enlace"; return; fi
  if [ ! -s "$file" ]; then echo "vacío"; return; fi
}

# wiki_toggle on|off: la parte determinista de /toggle-wiki (design D3)
wiki_toggle() {
  local action="$1"
  if [ "$action" = "on" ]; then
    edit_block insert || return 0
    set_enabled true || warn "no se ha podido cambiar \"enabled\" en $ENGINE_JSON"
    install_wiki_engine
    keep_wiki_versioned
  else
    edit_block remove || return 0
    set_enabled false || warn "no se ha podido cambiar \"enabled\" en $ENGINE_JSON"
    remove_engine_links
  fi
  if git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    local files=("$ENGINE_JSON")
    [ -f "$CONFIG_YAML" ] && files+=("$CONFIG_YAML")
    git add -- "${files[@]}" 2>/dev/null || warn "no se han podido pasar al stage ${files[*]}"
    echo "staged=${files[*]}"
  fi
  if wiki_enabled; then echo "enabled=true"; else echo "enabled=false"; fi
}

# wiki_set_mode full|lite: declara el modo del wiki en engine.json (design D5 de
# add-wiki-lite-mode). Solo cambia "mode"; no escribe si ya es el pedido, o si
# falta y el pedido es full. Pasa al stage solo engine.json, sin commit
wiki_set_mode() {
  local wanted="$1" changed=true
  if [ "$(wiki_declared_mode)" = "\"$wanted\"" ] || { [ "$wanted" = full ] && ! wiki_mode_declared; }; then
    changed=false
  fi
  if [ "$changed" = true ]; then
    set_field mode "\"$wanted\"" || { warn "no se ha podido cambiar \"mode\" en $ENGINE_JSON"; changed=false; }
  fi
  echo "changed=$changed"
  echo "mode=$(wiki_current_mode)"
  if wiki_enabled; then echo "enabled=true"; else echo "enabled=false"; fi
  if [ "$changed" = true ] && git rev-parse --is-inside-work-tree >/dev/null 2>&1; then
    git add -- "$ENGINE_JSON" 2>/dev/null || warn "no se ha podido pasar al stage $ENGINE_JSON"
    echo "staged=$ENGINE_JSON"
  fi
}

# wiki_mode status|on|off DIRECTORIO, o wiki_mode mode full|lite DIRECTORIO
wiki_mode() {
  local action="${1:-}" value="" dir
  case "$action" in
    status | on | off) dir="${2:-}" ;;
    mode)
      value="${2:-}" dir="${3:-}"
      case "$value" in full | lite) ;; *)
        warn "el modo del wiki '$value' no existe: los modos son full y lite; no se cambia nada"
        return
        ;;
      esac
      ;;
    *)
      warn "uso: session-bootstrap.sh wiki <status|on|off|mode full|mode lite> <directorio del proyecto>"
      return
      ;;
  esac
  if [ -z "$dir" ] || ! cd "$dir" 2>/dev/null; then
    warn "no se puede entrar en el directorio del proyecto ('$dir')"
    return
  fi
  case "$action" in
    status) wiki_status ;;
    mode) wiki_set_mode "$value" ;;
    *) wiki_toggle "$action" ;;
  esac
}

main() {
  if [ -z "${1:-}" ] || ! cd "$1"; then
    warn "no se puede entrar en el directorio del proyecto ('${1:-}')"
    return
  fi
  prepare_git
  # El motor no depende de Node, así que va antes y se instala aunque falte npm
  install_wiki_engine
  wiki_disabled || { keep_wiki_versioned; warn_invalid_mode; }
  warn_stale_block
  install_dependencies
}

# wiki_text MODO AGENTE DIRECTORIO: la guía o el recordatorio para el agente
# (design D2, D3). Con el wiki desactivado, sin engine.json o si no se puede
# generar, no imprime nada.
wiki_text() {
  local mode="$1" agent="$2" dir="${3:-}"
  if [ -z "$dir" ] || ! cd "$dir" 2>/dev/null; then return; fi
  wiki_disabled && return
  case "$agent" in claude-code | opencode) ;; *) return ;; esac
  local text wmode
  wmode="$(wiki_current_mode)"
  if [ "$mode" = "guide" ]; then
    text="$(mode_blocks "$wmode" "$GUIDE_MD")" || return
    # Sin los identificadores de sección, que solo sirven para revisarla
    text="$(printf '%s\n' "$text" | sed '/^<!-- wiki-guide:[a-z0-9-]* -->$/d')" || return
    [ -n "$text" ] || return
    if [ "$agent" = "opencode" ]; then
      local note
      note="$(cat "$OPENCODE_NOTE" 2>/dev/null)" && [ -n "$note" ] && text="$note"$'\n\n'"$text"
    fi
  else
    text="$(mode_blocks "$wmode" "$REMINDER_MD")" || return
    # Un solo párrafo: las líneas no vacías, juntas con un espacio
    text="$(printf '%s\n' "$text" | awk 'NF { printf "%s%s", sep, $0; sep = " " }')" || return
  fi
  text="$(fill_markers "$agent" "$text")"
  # Un texto vacío o con marcadores desconocidos no se entrega
  [ -n "$text" ] || return
  [[ "$text" == *'{{'*'}}'* ]] && return
  if [ "$mode" = "reminder" ]; then
    [ "$(printf '%s' "$text" | wc -m)" -le "$REMINDER_MAX" ] || return
  fi
  printf '%s\n' "$text"
}

# mode_blocks MODO ARCHIVO: ARCHIVO sin las líneas de los bloques del otro modo
# ni las marcas de bloque (design D2 de add-wiki-lite-mode). Falla, sin
# imprimir nada útil, si el archivo no se puede leer o los bloques están mal
# formados: sin cerrar, de un modo que no existe, dentro de otro, o un cierre
# sin apertura
mode_blocks() {
  [ -r "$2" ] || return 1
  awk -v mode="$1" '
    index($0, "<!-- wiki-mode:") {
      if ($0 == "<!-- wiki-mode:end -->") {
        if (block == "") { bad = 1; exit }
        block = ""
        next
      }
      if ($0 == "<!-- wiki-mode:full -->" || $0 == "<!-- wiki-mode:lite -->") {
        if (block != "") { bad = 1; exit }
        block = substr($0, 16, 4)
        next
      }
      bad = 1
      exit
    }
    block == "" || block == mode { print }
    END { if (bad || block != "") exit 1 }
  ' "$2" 2>/dev/null
}

# fill_markers AGENTE TEXTO: TEXTO con cada marcador de operación del motor
# sustituido por cómo se invoca en el agente (design D1 de fix-wiki-flow-operations)
fill_markers() {
  local agent="$1" text="$2" marker value entry
  local -a table
  if [ "$agent" = "claude-code" ]; then
    table=(
      'query|`/wiki:query --local`'
      'ingest|`/wiki:ingest <url> --local`'
    )
  else
    table=(
      'query|la skill `wiki-query`'
      'ingest|ingiere la fuente'
    )
  fi
  for entry in "${table[@]}"; do
    marker="{{${entry%%|*}}}"
    value="${entry#*|}"
    text="${text//"$marker"/"$value"}"
  done
  printf '%s' "$text"
}

comments_disabled() {
  [ "${PROJECT_COMMENTS:-}" = "off" ]
}

# activates_comments MENSAJE: éxito si el mensaje activa la regla de comentarios
# (design D2 de add-quote-comment-rule; D1 y D2 de
# update-comment-closing-and-quotes; D1 y D1b de
# update-comment-phrase-and-opencode-marker). Es un comentario si, sin los
# espacios ni los comentarios HTML iniciales (la app de Claude antepone
# `<!-- attach -->` a las citas), empieza por una cadena no vacía entre
# comillas simples dobladas (''así'') o por una cita de Markdown (`>`), o si
# incluye una cita de la web de OpenCode. Si no lo es, la activa una palabra de cierre ("p",
# "procesa", "procesar", "r", "reformula" o "reformular") como palabra
# completa, sin distinguir mayúsculas. Dentro de un comentario las palabras de
# cierre no cambian nada: el mensaje ya la activa.
activates_comments() {
  local message="$1"
  while :; do
    message="${message#"${message%%[![:space:]]*}"}"
    [[ "$message" == '<!--'*'-->'* ]] || break
    message="${message#*-->}"
  done
  [[ "$message" =~ ^\'\'[^\']+\'\' ]] && return 0
  [[ "$message" == '>'* ]] && return 0
  # La cita de la web de OpenCode llega como texto en cualquier punto del
  # mensaje: una línea "The user quoted the following from <origen>:" seguida
  # de una línea que empieza por "> "
  printf '%s\n' "$message" | awk '
    quoted && /^> / { found = 1; exit }
    { quoted = /^The user quoted the following from .+:$/ }
    END { exit !found }' && return 0
  printf '%s\n' "$message" | LC_ALL=C.UTF-8 grep -qiwE '(p|procesa|procesar|r|reformula|reformular)' 2>/dev/null
}

# comments_text MODO AGENTE DIRECTORIO: la regla (rule) o su recordatorio
# (reminder, según el mensaje de stdin). Si no corresponde, no imprime nada.
comments_text() {
  local mode="$1" agent="$2" dir="${3:-}" text
  if [ -z "$dir" ] || ! cd "$dir" 2>/dev/null; then return; fi
  comments_disabled && return
  case "$agent" in claude-code | opencode) ;; *) return ;; esac
  if [ "$mode" = "rule" ]; then
    # Sin los identificadores de sección, que solo sirven para revisarla
    text="$(sed '/^<!-- comments-rule:[a-z0-9-]* -->$/d' "$COMMENTS_DIR/rule.md" 2>/dev/null)" || return
  else
    activates_comments "$(cat)" || return
    text="$(cat "$COMMENTS_DIR/reminder.md" 2>/dev/null)" || return
    [ "$(printf '%s' "$text" | wc -m)" -le "$REMINDER_MAX" ] || return
  fi
  [ -n "$text" ] || return
  printf '%s\n' "$text"
}

case "${1:-}" in
  guide | reminder) wiki_text "$@" ;;
  wiki) shift; wiki_mode "$@" ;;
  comments-rule) shift; comments_text rule "$@" ;;
  comments-reminder) shift; comments_text reminder "$@" ;;
  *) main "$@" ;;
esac
exit 0
