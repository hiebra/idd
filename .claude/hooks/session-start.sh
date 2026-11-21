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
# - Entrega la guía del wiki que prepara el núcleo como "additionalContext"
#   del mismo JSON.
# - Nunca bloquea la sesión: sale siempre con 0.

set -u

warnings=()

# shellcheck source=json.sh
source "$(dirname "${BASH_SOURCE[0]}")/json.sh"

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

  local guide fields=()
  guide="$(bash "$project/.agents/hooks/session-bootstrap.sh" guide claude-code "$project" 2>/dev/null)"
  if ((${#warnings[@]} > 0)); then
    local message
    printf -v message '%s\n' "${warnings[@]}"
    fields+=("\"systemMessage\":$(json_string "${message%$'\n'}")")
  fi
  if [ -n "$guide" ]; then
    fields+=("\"hookSpecificOutput\":{\"hookEventName\":\"SessionStart\",\"additionalContext\":$(json_string "$guide")}")
  fi
  if ((${#fields[@]} > 0)); then
    local IFS=,
    printf '{%s}\n' "${fields[*]}"
  fi
}

main
exit 0
