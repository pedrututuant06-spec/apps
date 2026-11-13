#!/bin/bash
# Duplo clique neste arquivo para instalar o Jarvis Local.
cd "$(dirname "$0")" || exit 1
xattr -dr com.apple.quarantine . 2>/dev/null
bash scripts/install.sh
echo
read -r -p "Pressione Enter para fechar esta janela..." _
