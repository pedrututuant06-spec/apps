#!/bin/bash
# Assistente para liberar espaço no Mac com segurança.
# Nada é apagado sem você confirmar cada item.
O=$'\033[38;5;208m'; G=$'\033[32m'; B=$'\033[1m'; N=$'\033[0m'

free_gb() { df -g "$HOME" | awk 'NR==2 {print $4}'; }
size_of() { du -sh "$@" 2>/dev/null | tail -1 | awk '{print $1}'; }
ask() { printf "  %s [s/N] " "$1"; read -r a </dev/tty; a="$(printf '%s' "$a" | tr '[:upper:]' '[:lower:]')"; [ "$a" = "s" ] || [ "$a" = "sim" ]; }

START=$(free_gb)
printf "\n${O}${B}Liberar espaço no Mac${N}\n"
echo "  Espaço livre agora: ${B}${START} GB${N}"
echo "  Cada item pergunta antes de apagar. Na dúvida, responda N."
echo

if [ -d "$HOME/.Trash" ]; then
  S=$(size_of "$HOME/.Trash")
  if [ -n "$S" ] && [ "$S" != "0B" ] && ask "Esvaziar a Lixeira ($S)?"; then
    rm -rf "$HOME/.Trash/"* "$HOME/.Trash/".[!.]* 2>/dev/null; echo "  ${G}✔${N} Lixeira esvaziada"
  fi
fi

S=$(size_of "$HOME/Library/Caches")
if ask "Apagar caches de aplicativos ($S)? (são recriados automaticamente)"; then
  find "$HOME/Library/Caches" -mindepth 1 -maxdepth 1 ! -name "com.apple.*" -exec rm -rf {} + 2>/dev/null
  echo "  ${G}✔${N} Caches apagados"
fi

if [ -d "$HOME/Library/Developer/Xcode/DerivedData" ]; then
  S=$(size_of "$HOME/Library/Developer/Xcode/DerivedData")
  ask "Apagar arquivos temporários do Xcode ($S)?" && rm -rf "$HOME/Library/Developer/Xcode/DerivedData/"* && echo "  ${G}✔${N} Xcode limpo"
fi
if command -v xcrun >/dev/null && [ -d "$HOME/Library/Developer/CoreSimulator" ]; then
  ask "Apagar simuladores de iPhone que não estão mais disponíveis?" && xcrun simctl delete unavailable 2>/dev/null && echo "  ${G}✔${N} Simuladores limpos"
fi

if command -v brew >/dev/null; then
  ask "Limpar downloads antigos do Homebrew?" && brew cleanup -s --prune=all >/dev/null 2>&1 && echo "  ${G}✔${N} Homebrew limpo"
fi

if command -v docker >/dev/null && docker info >/dev/null 2>&1; then
  ask "Apagar imagens e containers do Docker que não estão em uso?" && docker system prune -af && echo "  ${G}✔${N} Docker limpo"
fi

OLL="$(command -v ollama || echo /Applications/Ollama.app/Contents/Resources/ollama)"
if [ -x "$OLL" ]; then
  CUR=" $(/usr/bin/python3 -c "import json; print(' '.join(json.load(open('$HOME/Library/Application Support/Jarvis/config.json'))['models'].values()))" 2>/dev/null) jarvis:latest jarvis-turbo:latest jarvis-code:latest "
  for M in $("$OLL" list 2>/dev/null | awk 'NR>1 {print $1}'); do
    case "$CUR" in *" $M "*) continue ;; esac
    ask "Apagar o modelo de IA não usado '$M'?" && "$OLL" rm "$M" >/dev/null && echo "  ${G}✔${N} $M removido"
  done
fi

echo
echo "  ${B}Maiores arquivos em Downloads${N} (apague manualmente pelo Finder se não precisar):"
find "$HOME/Downloads" -type f -size +200M -exec du -h {} + 2>/dev/null | sort -rh | head -10 | sed 's/^/    /'
echo
echo "  Dica: Menu  › Sobre este Mac › Mais informações › Armazenamento mostra o que mais ocupa espaço."
END=$(free_gb)
printf "\n  Espaço livre: ${B}%s GB${N} (liberados ${G}%s GB${N})\n\n" "$END" "$((END - START))"
