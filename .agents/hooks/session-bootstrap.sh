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
#       - Instala el motor del wiki en la versión fijada en
#         .agents/wiki/engine.json, en .agents/wiki-engine/ (ignorado por git),
#         y lo expone a cada agente con symlinks.
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
#       está desactivado o no se puede generar.
#   session-bootstrap.sh comments-rule <agente> <directorio del proyecto>
#   session-bootstrap.sh comments-reminder <agente> <directorio del proyecto>
#       Por stdout, la regla de comentarios, o su recordatorio si el mensaje
#       del usuario, que se lee por stdin, la activa (es un comentario o
#       contiene "ya" o "reformula"); nada si la regla está desactivada, el
#       mensaje no la activa o el texto no se puede generar.
#
# En todos los modos, avisos por stderr, uno por línea, con el prefijo
# "session-start:", y termina siempre con 0: nunca bloquea la sesión.
#
# El wiki se desactiva en local con PROJECT_WIKI=off: no se instala el motor,
# se retiran sus symlinks y la guía y el recordatorio quedan vacíos.
# La regla de comentarios se desactiva en local con PROJECT_COMMENTS=off.
#
# Cada agente tiene su adaptador, que lanza este script, ajusta el entorno de
# su sesión, entrega la guía y el recordatorio y muestra los avisos.

set -u

# Ruta de este script relativa al proyecto, para que el sello no dependa de dónde está el clon
CORE=".agents/hooks/session-bootstrap.sh"

WIKI_DIR=".agents/wiki"
ENGINE_JSON="$WIKI_DIR/engine.json"
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

wiki_disabled() {
  [ "${PROJECT_WIKI:-}" = "off" ]
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

# Instala el motor del wiki en la versión fijada, si falta o es otra (design D1)
install_wiki_engine() {
  [ -f "$ENGINE_JSON" ] || return
  if wiki_disabled; then
    remove_engine_links
    return
  fi
  local repo ref url want
  repo="$(engine_field repo)"
  ref="$(engine_field ref)"
  if [ -z "$repo" ] || [ -z "$ref" ]; then
    warn "$ENGINE_JSON no declara \"repo\" y \"ref\"; no se instala el motor del wiki"
    return
  fi
  url="$(engine_url "$repo")"
  want="$ref $repo"
  if [ "$(cat "$ENGINE_STAMP" 2>/dev/null)" != "$want" ]; then
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

main() {
  if [ -z "${1:-}" ] || ! cd "$1"; then
    warn "no se puede entrar en el directorio del proyecto ('${1:-}')"
    return
  fi
  prepare_git
  # El motor no depende de Node, así que va antes y se instala aunque falte npm
  install_wiki_engine
  wiki_disabled || keep_wiki_versioned
  install_dependencies
}

# wiki_text MODO AGENTE DIRECTORIO: la guía o el recordatorio para el agente
# (design D2, D3). Con el wiki desactivado, sin engine.json o si no se puede
# generar, no imprime nada.
wiki_text() {
  local mode="$1" agent="$2" dir="${3:-}"
  if [ -z "$dir" ] || ! cd "$dir" 2>/dev/null; then return; fi
  wiki_disabled && return
  [ -f "$ENGINE_JSON" ] || return
  case "$agent" in claude-code | opencode) ;; *) return ;; esac
  local text
  if [ "$mode" = "guide" ]; then
    # Sin los identificadores de sección, que solo sirven para revisarla
    text="$(sed '/^<!-- wiki-guide:[a-z0-9-]* -->$/d' "$WIKI_DIR/guide.md" 2>/dev/null)" || return
    [ -n "$text" ] || return
    if [ "$agent" = "opencode" ]; then
      local note
      note="$(cat "$WIKI_DIR/opencode-note.md" 2>/dev/null)" && [ -n "$note" ] && text="$note"$'\n\n'"$text"
    fi
  else
    text="$(cat "$WIKI_DIR/reminder.md" 2>/dev/null)" || return
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
# (design D2 de add-quote-comment-rule). Es un comentario si, sin los espacios
# iniciales, empieza por una cadena no vacía entre comillas simples; si no lo
# es, la activa "ya" o "reformula" como palabra completa, sin distinguir
# mayúsculas. Dentro de un comentario las palabras de cierre no cambian nada:
# el mensaje ya la activa.
activates_comments() {
  local message="$1"
  message="${message#"${message%%[![:space:]]*}"}"
  [[ "$message" =~ ^\'[^\']+\' ]] && return 0
  printf '%s\n' "$message" | LC_ALL=C.UTF-8 grep -qiwE '(ya|reformula)' 2>/dev/null
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
  comments-rule) shift; comments_text rule "$@" ;;
  comments-reminder) shift; comments_text reminder "$@" ;;
  *) main "$@" ;;
esac
exit 0
