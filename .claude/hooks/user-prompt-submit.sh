#!/bin/bash
# UserPromptSubmit hook de Claude Code: añade a cada mensaje del usuario el
# recordatorio del flujo del wiki que prepara el núcleo del arranque de sesión
# (.agents/hooks/session-bootstrap.sh reminder) y, si el mensaje la activa, el
# recordatorio de la regla de comentarios (comments-reminder), en un solo
# "additionalContext" (Claude Code no admite más de uno por salida).
#
# Nunca bloquea el mensaje: sale siempre con 0, y si el recordatorio no se
# puede generar no imprime nada.

set -u

main() {
  # Claude Code pasa por stdin un JSON con el mensaje en el campo "prompt"
  local input hooks project reminder comments prompt
  input="$(cat 2>/dev/null)"
  hooks="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)" || return
  project="${CLAUDE_PROJECT_DIR:-$(cd "$hooks/../.." && pwd)}"
  # shellcheck source=json.sh
  source "$hooks/json.sh" 2>/dev/null || return
  reminder="$(bash "$project/.agents/hooks/session-bootstrap.sh" reminder claude-code "$project" 2>/dev/null)"
  prompt="$(json_field prompt "$input")"
  if [ -n "$prompt" ]; then
    comments="$(printf '%s' "$prompt" | bash "$project/.agents/hooks/session-bootstrap.sh" comments-reminder claude-code "$project" 2>/dev/null)"
    [ -n "$comments" ] && reminder="${reminder:+$reminder$'\n\n'}$comments"
  fi
  [ -n "$reminder" ] || return
  printf '{"hookSpecificOutput":{"hookEventName":"UserPromptSubmit","additionalContext":%s}}\n' "$(json_string "$reminder")"
}

main
exit 0
