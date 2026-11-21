#!/bin/bash
# SessionStart hook de Claude Code: adaptador del núcleo del arranque de sesión
# (.agents/hooks/session-bootstrap.sh, ADR-0002).
#
# - Ejecuta el núcleo sobre el proyecto.
# - Pone el openspec del proyecto por delante en el PATH de la sesión a través
#   de CLAUDE_ENV_FILE.
# - Nunca bloquea la sesión: sale siempre con 0.

set -u

main() {
  local project="${CLAUDE_PROJECT_DIR:-$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)}"
  local out bin=""
  out="$(bash "$project/.agents/hooks/session-bootstrap.sh" "$project")"
  [[ "$out" == bin=* ]] && bin="${out#bin=}"

  if [ -n "$bin" ]; then
    if [ -n "${CLAUDE_ENV_FILE:-}" ]; then
      echo "export PATH=\"$bin:\$PATH\"" >>"$CLAUDE_ENV_FILE"
    else
      echo "session-start: no se ha podido ajustar el PATH de la sesión; ejecuta el CLI del proyecto con 'npx openspec'" >&2
    fi
  fi
}

main
exit 0
