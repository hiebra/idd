#!/bin/bash
# Funciones comunes de los hooks de Claude Code, sin Node (puede faltar).

# json_string TEXT: TEXT como cadena JSON, con barras, comillas y caracteres
# de control escapados, solo con bash. Sustituye por tipo de carácter en vez
# de recorrer el texto, porque la guía del wiki ocupa miles de caracteres.
json_string() {
  local s="$1" code c
  s="${s//\\/\\\\}"
  s="${s//\"/\\\"}"
  s="${s//$'\n'/\\n}"
  s="${s//$'\r'/\\r}"
  s="${s//$'\t'/\\t}"
  for code in {1..8} 11 12 {14..31} 127; do
    printf -v c "\\x$(printf '%02x' "$code")"
    [[ "$s" == *"$c"* ]] || continue
    local esc
    printf -v esc '\\u%04x' "$code"
    s="${s//"$c"/$esc}"
  done
  printf '"%s"' "$s"
}
