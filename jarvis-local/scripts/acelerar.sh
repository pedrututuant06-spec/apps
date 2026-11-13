#!/bin/bash
# Deixa o Jarvis o mais rápido possível no Mac (Apple Silicon).
#  1. Libera mais memória para a GPU (o macOS reserva só ~2/3 da RAM para a GPU por padrão).
#  2. Liga otimizações do Ollama: Flash Attention e cache comprimido (q8_0), modelos sempre carregados.
#  3. Reinicia o Ollama e o Jarvis.
# Uso: bash scripts/acelerar.sh   (ou: jarvis acelerar)
O=$'\033[38;5;208m'; G=$'\033[32m'; Y=$'\033[33m'; B=$'\033[1m'; N=$'\033[0m'
ok()   { printf "  ${G}✔${N} %s\n" "$*"; }
warn() { printf "  ${Y}!${N} %s\n" "$*"; }
U="gui/$(id -u)"
AGENTS="$HOME/Library/LaunchAgents"
RAM_MB=$(( $(sysctl -n hw.memsize) / 1048576 ))
RAM_GB=$(( RAM_MB / 1024 ))

printf "\n${O}${B}⚡ Acelerando o Jarvis${N} (Mac com ${RAM_GB} GB)\n"

# 1) Variáveis do Ollama — aplicadas agora e a cada login -------------------------
ENV_CMDS="launchctl setenv OLLAMA_FLASH_ATTENTION 1; launchctl setenv OLLAMA_KV_CACHE_TYPE q8_0; launchctl setenv OLLAMA_KEEP_ALIVE -1"
# Sem fila: o Ollama responde várias pessoas ao mesmo tempo (NUM_PARALLEL)
if [ "$RAM_GB" -le 8 ]; then
  ENV_CMDS="$ENV_CMDS; launchctl setenv OLLAMA_MAX_LOADED_MODELS 1; launchctl setenv OLLAMA_NUM_PARALLEL 2"
elif [ "$RAM_GB" -le 16 ]; then
  ENV_CMDS="$ENV_CMDS; launchctl setenv OLLAMA_MAX_LOADED_MODELS 1; launchctl setenv OLLAMA_NUM_PARALLEL 4"
else
  ENV_CMDS="$ENV_CMDS; launchctl setenv OLLAMA_MAX_LOADED_MODELS 2; launchctl setenv OLLAMA_NUM_PARALLEL 4"
fi
mkdir -p "$AGENTS"
cat > "$AGENTS/com.jarvis.ollama-env.plist" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>com.jarvis.ollama-env</string>
  <key>ProgramArguments</key><array><string>/bin/sh</string><string>-c</string><string>$ENV_CMDS</string></array>
  <key>RunAtLoad</key><true/>
</dict></plist>
EOF
launchctl bootout "$U/com.jarvis.ollama-env" 2>/dev/null
launchctl bootstrap "$U" "$AGENTS/com.jarvis.ollama-env.plist" 2>/dev/null
/bin/sh -c "$ENV_CMDS"
ok "Ollama: Flash Attention, cache comprimido, modelo sempre carregado e várias respostas ao mesmo tempo"

# 2) Mais memória para a GPU (pede a senha do Mac) ---------------------------------
if [ "$RAM_GB" -ge 16 ]; then
  GPU_MB=$(( RAM_MB - 4096 ))          # deixa 4 GB para o macOS e os outros apps
  echo "  Liberando ${B}$((GPU_MB / 1024)) GB${N} de memória para a GPU (padrão do macOS: ~$((RAM_MB * 2 / 3 / 1024)) GB). Pode pedir sua senha:"
  if sudo sysctl iogpu.wired_limit_mb="$GPU_MB" >/dev/null 2>&1; then
    sudo tee /Library/LaunchDaemons/com.jarvis.gpumem.plist >/dev/null <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>com.jarvis.gpumem</string>
  <key>ProgramArguments</key><array><string>/usr/sbin/sysctl</string><string>iogpu.wired_limit_mb=$GPU_MB</string></array>
  <key>RunAtLoad</key><true/>
</dict></plist>
EOF
    sudo chown root:wheel /Library/LaunchDaemons/com.jarvis.gpumem.plist
    sudo launchctl bootstrap system /Library/LaunchDaemons/com.jarvis.gpumem.plist 2>/dev/null
    ok "GPU pode usar até $((GPU_MB / 1024)) GB (mantido após reiniciar o Mac)"
  else
    warn "Não consegui mudar a memória da GPU (precisa de macOS 14 ou mais novo)."
  fi
else
  ok "Mac de 8 GB: memória da GPU mantida no padrão (mais seguro)"
fi

# 3) Reinicia o Ollama e o Jarvis -------------------------------------------------
osascript -e 'quit app "Ollama"' >/dev/null 2>&1
pkill -x ollama 2>/dev/null
sleep 2
open -g -a Ollama 2>/dev/null
for _ in $(seq 1 30); do curl -fs http://127.0.0.1:11434/api/tags >/dev/null 2>&1 && break; sleep 1; done
launchctl kickstart -k "$U/com.jarvis.server" 2>/dev/null
ok "Ollama e Jarvis reiniciados com as otimizações"
echo
echo "  Dica: para coisas simples use ${B}⚡ Jarvis Turbo 1.0${N} (3x mais rápido)."
echo
