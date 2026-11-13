#!/bin/bash
# Remove o Jarvis Local do Mac. Pergunta antes de apagar conversas e o modelo de IA.
U="gui/$(id -u)"
APP_SUPPORT="$HOME/Library/Application Support/Jarvis"
ask() { printf "  %s [s/N] " "$1"; read -r a </dev/tty; a="$(printf '%s' "$a" | tr '[:upper:]' '[:lower:]')"; [ "$a" = "s" ] || [ "$a" = "sim" ]; }

ask "Remover o Jarvis deste Mac?" || exit 0
launchctl bootout "$U/com.jarvis.server" 2>/dev/null
launchctl bootout "$U/com.jarvis.tunnel" 2>/dev/null
rm -f "$HOME/Library/LaunchAgents/com.jarvis.server.plist" "$HOME/Library/LaunchAgents/com.jarvis.tunnel.plist"
rm -rf /Applications/Jarvis.app "$HOME/Applications/Jarvis.app"
[ -L /usr/local/bin/jarvis ] && rm -f /usr/local/bin/jarvis
rm -rf "$APP_SUPPORT/app" "$APP_SUPPORT/bin" "$HOME/Library/Logs/Jarvis"
echo "  ✔ App e serviços removidos (tire o ícone do Dock arrastando-o para fora)."

if ask "Apagar também as conversas e configurações da família?"; then
  rm -rf "$APP_SUPPORT"; echo "  ✔ Conversas apagadas"
fi
OLL="$(command -v ollama || echo /Applications/Ollama.app/Contents/Resources/ollama)"
if [ -x "$OLL" ] && ask "Apagar os modelos de IA baixados (libera vários GB)?"; then
  for M in $("$OLL" list 2>/dev/null | awk 'NR>1 {print $1}'); do "$OLL" rm "$M" >/dev/null && echo "  ✔ $M removido"; done
fi
echo "  O app Ollama continua instalado (arraste-o para o Lixo se quiser removê-lo)."
