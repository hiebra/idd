#!/bin/bash
# SessionStart hook: deja el proyecto listo para trabajar con OpenSpec.
#
# - Instala todas las dependencias del proyecto (npm install) cuando faltan o
#   han cambiado package.json, package-lock.json o este script.
# - Pone node_modules/.bin por delante en el PATH de la sesión, para que se use
#   el openspec fijado por el proyecto.
# - Nunca bloquea la sesión: ante cualquier problema avisa por stderr y sale con 0.
#
# Lo escrito en stdout entra en el contexto de la sesión, así que este script
# no escribe nada en stdout.

set -u

warn() {
  echo "session-start: $*" >&2
}

main() {
  local script_path="${BASH_SOURCE[0]}"
  cd "${CLAUDE_PROJECT_DIR:-$(dirname "$script_path")/../..}" || {
    warn "no se puede entrar en el directorio del proyecto"
    return
  }
  # Ruta del script relativa al proyecto, para que el sello no dependa de dónde está el clon
  script_path=".claude/hooks/session-start.sh"

  # D7: lo primero, comprobar npm
  if ! command -v npm >/dev/null 2>&1 || ! command -v node >/dev/null 2>&1; then
    warn "hace falta Node.js con npm para instalar las dependencias del proyecto; no se instala nada"
    return
  fi

  # D6: versión de Node frente a engines.node
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

  # D4: solo instalar si algo cambió desde la última instalación correcta
  local stamp="node_modules/.session-start.sha256"
  if ! sha256sum --check --status "$stamp" >/dev/null 2>&1; then
    # D4: borrar el sello antes, para que un fallo se reintente en la siguiente sesión
    rm -f "$stamp"
    local log
    log="$(mktemp)"
    # D3: npm install (no npm ci) de todas las dependencias
    if npm install --no-audit --no-fund >"$log" 2>&1; then
      sha256sum package.json package-lock.json "$script_path" >"$stamp" 2>/dev/null || rm -f "$stamp"
    else
      warn "falló la instalación de dependencias (npm install); se reintentará en la siguiente sesión"
      tail -n 5 "$log" | sed 's/^/session-start:   /' >&2
    fi
    rm -f "$log"
  fi

  # D5: el openspec del proyecto por delante en el PATH
  if [ -x node_modules/.bin/openspec ]; then
    if [ -n "${CLAUDE_ENV_FILE:-}" ]; then
      echo "export PATH=\"$PWD/node_modules/.bin:\$PATH\"" >>"$CLAUDE_ENV_FILE"
    else
      warn "no se ha podido ajustar el PATH de la sesión; ejecuta el CLI del proyecto con 'npx openspec'"
    fi
  fi
}

main
exit 0
