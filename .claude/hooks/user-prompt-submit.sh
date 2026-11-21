#!/bin/bash
# UserPromptSubmit hook de Claude Code: añade a cada mensaje del usuario el
# recordatorio del flujo del wiki que prepara el núcleo del arranque de sesión
# (.agents/hooks/session-bootstrap.sh reminder), como "additionalContext".
#
# Nunca bloquea el mensaje: sale siempre con 0, y si el recordatorio no se
# puede generar no imprime nada.

set -u

main() {
  # Claude Code pasa el mensaje por stdin; el recordatorio no depende de él
  cat >/dev/null 2>&1
  local hooks project reminder
  hooks="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)" || return
  project="${CLAUDE_PROJECT_DIR:-$(cd "$hooks/../.." && pwd)}"
  # shellcheck source=json.sh
  source "$hooks/json.sh" 2>/dev/null || return
  reminder="$(bash "$project/.agents/hooks/session-bootstrap.sh" reminder claude-code "$project" 2>/dev/null)" || return
  [ -n "$reminder" ] || return
  printf '{"hookSpecificOutput":{"hookEventName":"UserPromptSubmit","additionalContext":%s}}\n' "$(json_string "$reminder")"
}

main
exit 0
