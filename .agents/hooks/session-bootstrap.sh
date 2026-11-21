#!/bin/bash
# Núcleo del arranque de sesión, neutral respecto al agente (ADR-0002, ADR-0005).
#
# Uso:
#   session-bootstrap.sh <directorio del proyecto>
#       Prepara el proyecto para la sesión:
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
#
# En todos los modos, avisos por stderr, uno por línea, con el prefijo
# "session-start:", y termina siempre con 0: nunca bloquea la sesión.
#
# El wiki se desactiva en local con PROJECT_WIKI=off: no se instala el motor,
# se retiran sus symlinks y la guía y el recordatorio quedan vacíos.
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
      local tmp="$ENGINE_DIR.tmp.$$" old="$ENGINE_DIR.old.$$" log
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

main() {
  if [ -z "${1:-}" ] || ! cd "$1"; then
    warn "no se puede entrar en el directorio del proyecto ('${1:-}')"
    return
  fi
  # El motor no depende de Node, así que va antes y se instala aunque falte npm
  install_wiki_engine
  install_dependencies
}

case "${1:-}" in
  guide | reminder) ;;
  *) main "$@" ;;
esac
exit 0
