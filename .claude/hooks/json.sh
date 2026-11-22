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

# json_field NAME JSON: el valor de texto del campo NAME de JSON, sin las
# comillas y con los escapes JSON deshechos, solo con bash (design D3 de
# add-quote-comment-rule). Basta para un campo de texto de primer nivel, como
# el "prompt" que Claude Code pasa al hook UserPromptSubmit. Si no encuentra el
# campo o el JSON no se entiende, no imprime nada.
json_field() {
  local name="$1" json="$2" rest out="" c next hex ch
  [[ "$json" =~ (^|[^\\])\"$name\"[[:space:]]*:[[:space:]]*\" ]] || return 0
  rest="${json#*"${BASH_REMATCH[0]}"}"
  while [ -n "$rest" ]; do
    c="${rest:0:1}"
    rest="${rest:1}"
    if [ "$c" = '"' ]; then
      printf '%s' "$out"
      return 0
    fi
    if [ "$c" != '\' ]; then
      out+="$c"
      continue
    fi
    next="${rest:0:1}"
    rest="${rest:1}"
    case "$next" in
      '"' | '\' | /) out+="$next" ;;
      n) out+=$'\n' ;;
      t) out+=$'\t' ;;
      r) out+=$'\r' ;;
      b | f) out+=' ' ;;
      u)
        hex="${rest:0:4}"
        rest="${rest:4}"
        [[ "$hex" =~ ^[0-9a-fA-F]{4}$ ]] || return 0
        # printf solo convierte \u fuera de ASCII con una locale UTF-8, y bash
        # 3.2 (macOS) no lo entiende: en ese caso queda un espacio
        ch="$(LC_ALL=C.UTF-8 printf "\\u$hex" 2>/dev/null)"
        [[ "$ch" == '\u'* || -z "$ch" ]] && ch=' '
        out+="$ch"
        ;;
      *) return 0 ;;
    esac
  done
  # Sin la comilla de cierre: el JSON no se entiende
  return 0
}
