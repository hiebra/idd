#!/bin/bash
# Núcleo del arranque de sesión, neutral respecto al agente (ADR-0002).
#
# Uso: session-bootstrap.sh <directorio del proyecto>
#
# - Instala todas las dependencias del proyecto (npm install) en la raíz y en
#   acceptance-tests/ cuando faltan o han cambiado package.json,
#   package-lock.json o este script.
# - Avisos por stderr, uno por línea, con el prefijo "session-start:".
# - Por stdout, una única línea "bin=<ruta absoluta a node_modules/.bin>"
#   cuando hay un openspec del proyecto que exponer, y nada más.
# - Termina siempre con 0: nunca bloquea la sesión.
#
# Cada agente tiene su adaptador, que lanza este script, ajusta el PATH de su
# sesión y muestra los avisos en su interfaz.

set -u

# Ruta de este script relativa al proyecto, para que el sello no dependa de dónde está el clon
CORE=".agents/hooks/session-bootstrap.sh"

warn() {
  echo "session-start: $*" >&2
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

main() {
  if [ -z "${1:-}" ] || ! cd "$1"; then
    warn "no se puede entrar en el directorio del proyecto ('${1:-}')"
    return
  fi

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

main "$@"
exit 0
