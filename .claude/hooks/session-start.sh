#!/bin/bash
# SessionStart hook de Claude Code: adaptador del núcleo del arranque de sesión
# (.agents/hooks/session-bootstrap.sh, ADR-0002).
#
# - Ejecuta el núcleo sobre el proyecto.
# - Pone el openspec del proyecto por delante en el PATH de la sesión y
#   exporta CLAUDE_PLUGIN_ROOT con el motor del wiki, para que sus comandos
#   encuentren su helper, a través de CLAUDE_ENV_FILE.
# - Muestra los avisos al usuario: Claude Code solo enseña el "systemMessage"
#   del JSON que el hook imprime por stdout (stderr no se ve, y el texto plano
#   en stdout entra en el contexto de Claude). Por eso stdout queda vacío o
#   lleva un único objeto JSON, construido sin Node.
# - Nunca bloquea la sesión: sale siempre con 0.

set -u

warnings=()

# json_string TEXT: TEXT como cadena JSON, con barras, comillas y caracteres
# de control escapados, solo con bash
json_string() {
  local s="$1" out="" c i code
  for ((i = 0; i < ${#s}; i++)); do
    c="${s:i:1}"
    case "$c" in
      '"') out+='\"' ;;
      '\') out+='\\' ;;
      $'\n') out+='\n' ;;
      $'\r') out+='\r' ;;
      $'\t') out+='\t' ;;
      *)
        printf -v code '%d' "'$c"
        if ((code >= 0 && code < 32)) || ((code == 127)); then
          printf -v c '\\u%04x' "$code"
        fi
        out+="$c"
        ;;
    esac
  done
  printf '"%s"' "$out"
}

main() {
  local project="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
  local out bin="" engine="" errors line
  errors="$(mktemp)"
  out="$(bash "$project/.agents/hooks/session-bootstrap.sh" "$project" 2>"$errors")"
  while IFS= read -r line; do
    case "$line" in
      bin=*) bin="${line#bin=}" ;;
      wiki-engine=*) engine="${line#wiki-engine=}" ;;
    esac
  done <<<"$out"
  # Los avisos del núcleo, uno por línea
  while IFS= read -r line || [ -n "$line" ]; do
    [ -n "$line" ] && warnings+=("$line")
  done <"$errors"
  rm -f "$errors"

  if [ -n "$bin" ]; then
    if [ -n "${CLAUDE_ENV_FILE:-}" ]; then
      echo "export PATH=\"$bin:\$PATH\"" >>"$CLAUDE_ENV_FILE"
    else
      warnings+=("session-start: no se ha podido ajustar el PATH de la sesión; ejecuta el CLI del proyecto con 'npx openspec'")
    fi
  fi
  if [ -n "$engine" ]; then
    if [ -n "${CLAUDE_ENV_FILE:-}" ]; then
      echo "export CLAUDE_PLUGIN_ROOT=\"$engine\"" >>"$CLAUDE_ENV_FILE"
    else
      warnings+=("session-start: no se ha podido exportar CLAUDE_PLUGIN_ROOT; los comandos /wiki:* que usan el helper del motor no lo encontrarán")
    fi
  fi

  if ((${#warnings[@]} > 0)); then
    local message
    printf -v message '%s\n' "${warnings[@]}"
    printf '{"systemMessage":%s}\n' "$(json_string "${message%$'\n'}")"
  fi
}

main
exit 0
