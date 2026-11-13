#!/bin/bash
# ============================================================================
#  Instalador do Jarvis Local (macOS com Apple Silicon)
#  Uso: bash scripts/install.sh            (ou duplo clique em "Instalar Jarvis.command")
#  Variáveis opcionais: JARVIS_MODEL=gemma3:12b (só o Jarvis 1.0)  JARVIS_LINK=sim|nao  JARVIS_SIM=1 (responde "sim" a tudo)
# ============================================================================
set -u

SRC="$(cd "$(dirname "$0")/.." && pwd)"
APP_SUPPORT="$HOME/Library/Application Support/Jarvis"
INSTALL_DIR="$APP_SUPPORT/app"
BIN_DIR="$APP_SUPPORT/bin"
LOG_DIR="$HOME/Library/Logs/Jarvis"
AGENTS="$HOME/Library/LaunchAgents"
UID_NUM="$(id -u)"

O=$'\033[38;5;208m'; G=$'\033[32m'; R=$'\033[31m'; Y=$'\033[33m'; B=$'\033[1m'; N=$'\033[0m'
step() { printf "\n${O}${B}▶ %s${N}\n" "$*"; }
ok()   { printf "  ${G}✔${N} %s\n" "$*"; }
warn() { printf "  ${Y}!${N} %s\n" "$*"; }
die()  { printf "\n  ${R}✖ %s${N}\n\n" "$*"; exit 1; }
ask()  { # ask "pergunta" padrão(s/n)
  local q="$1" def="${2:-s}" a
  if [ "${JARVIS_SIM:-}" = "1" ]; then return 0; fi
  if [ "$def" = "s" ]; then printf "  %s [S/n] " "$q"; else printf "  %s [s/N] " "$q"; fi
  read -r a </dev/tty || a=""
  a="$(printf '%s' "$a" | tr '[:upper:]' '[:lower:]')"
  [ -z "$a" ] && a="$def"
  [ "$a" = "s" ] || [ "$a" = "sim" ] || [ "$a" = "y" ]
}

clear 2>/dev/null || true
cat <<EOF
${O}${B}
        ██╗ █████╗ ██████╗ ██╗   ██╗██╗███████╗
        ██║██╔══██╗██╔══██╗██║   ██║██║██╔════╝
        ██║███████║██████╔╝██║   ██║██║███████╗
   ██   ██║██╔══██║██╔══██╗╚██╗ ██╔╝██║╚════██║
   ╚█████╔╝██║  ██║██║  ██║ ╚████╔╝ ██║███████║
    ╚════╝ ╚═╝  ╚═╝╚═╝  ╚═╝  ╚═══╝  ╚═╝╚══════╝${N}
   ${B}Jarvis Local${N} — IA da família, grátis, offline e sem limites
EOF

# --------------------------------------------------------------------------
step "1/9  Verificando o Mac"
mkdir -p "$LOG_DIR"
[ "$(uname -s)" = "Darwin" ] || die "Este instalador é para macOS."
ARCH="$(uname -m)"
[ "$ARCH" = "arm64" ] || warn "Este Mac não é Apple Silicon ($ARCH). Vai funcionar, mas mais devagar."
CHIP="$(sysctl -n machdep.cpu.brand_string 2>/dev/null || echo "?")"
RAM_GB=$(( $(sysctl -n hw.memsize) / 1073741824 ))
MACOS="$(sw_vers -productVersion)"
ok "Chip: $CHIP · Memória RAM: ${B}${RAM_GB} GB${N} · macOS $MACOS"

# Escolha dos modelos pelo tamanho da RAM -------------------------------------
#   Jarvis 1.0       -> mais inteligente  (gemma3, Google: ótimo em português)
#   Jarvis Turbo 1.0 -> muito mais rápido (gemma3 menor)
#   Jarvis Code 1.0  -> programação       (qwen2.5-coder, Alibaba: excelente em código)
tier_small()  { M_JARVIS="gemma3:4b";  M_TURBO="gemma3:1b"; M_CODE="qwen2.5-coder:3b";  MODELS_GB=6;  NUM_CTX=4096; }
tier_medium() { M_JARVIS="gemma3:12b"; M_TURBO="gemma3:4b"; M_CODE="qwen2.5-coder:7b";  MODELS_GB=17; NUM_CTX=4096; }
tier_large()  { M_JARVIS="gemma3:12b"; M_TURBO="gemma3:4b"; M_CODE="qwen2.5-coder:14b"; MODELS_GB=21; NUM_CTX=8192; }
CONCURRENT=1
if [ "$RAM_GB" -le 8 ]; then
  tier_small;  WHY="8 GB de RAM: modelos leves que não travam o Mac."
elif [ "$RAM_GB" -le 18 ]; then
  tier_medium; WHY="16 GB de RAM: Jarvis 1.0 com 12 bilhões de parâmetros, bem mais inteligente."
else
  tier_large;  WHY="${RAM_GB} GB de RAM: modelos maiores e mais memória de conversa."
fi
[ -n "${JARVIS_MODEL:-}" ] && M_JARVIS="$JARVIS_MODEL"
ok "$WHY"
ok "Jarvis 1.0: ${B}$M_JARVIS${N} · Jarvis Turbo 1.0: ${B}$M_TURBO${N} · Jarvis Code 1.0: ${B}$M_CODE${N}"

# --------------------------------------------------------------------------
step "2/9  Verificando espaço em disco"
FREE_GB=$(df -g "$HOME" | awk 'NR==2 {print $4}')
NEED_GB=$(( MODELS_GB + 3 ))
ok "Livre: ${FREE_GB} GB · Necessário: ~${NEED_GB} GB"
if [ "$FREE_GB" -lt "$NEED_GB" ]; then
  warn "Pouco espaço livre."
  if ask "Quer abrir o assistente de limpeza para liberar espaço agora?" s; then
    bash "$SRC/scripts/liberar-espaco.sh"
    FREE_GB=$(df -g "$HOME" | awk 'NR==2 {print $4}')
  fi
  if [ "$FREE_GB" -lt "$NEED_GB" ] && [ "$M_TURBO" != "gemma3:1b" ]; then
    warn "Ainda falta espaço para os modelos maiores. Usando o conjunto leve."
    tier_small; NEED_GB=$(( MODELS_GB + 3 ))
  fi
  [ "$FREE_GB" -ge "$NEED_GB" ] || die "Libere pelo menos ${NEED_GB} GB e rode o instalador de novo."
fi

# --------------------------------------------------------------------------
step "3/9  Verificando Python e ferramentas da Apple"
if ! xcode-select -p >/dev/null 2>&1; then
  warn "As 'Ferramentas de Linha de Comando' da Apple não estão instaladas (necessárias para o Python)."
  xcode-select --install >/dev/null 2>&1 || true
  die "Uma janela da Apple abriu: clique em 'Instalar', espere terminar e rode este instalador de novo."
fi
PY="$(command -v python3 || echo /usr/bin/python3)"
"$PY" -c 'import sys; assert sys.version_info >= (3, 8)' 2>/dev/null || die "Python 3.8+ não encontrado."
ok "Python: $("$PY" --version 2>&1)"

# --------------------------------------------------------------------------
step "4/9  Instalando o Ollama (motor de IA)"
OLLAMA=""
find_ollama() {
  for c in "$(command -v ollama 2>/dev/null)" /usr/local/bin/ollama /opt/homebrew/bin/ollama \
           /Applications/Ollama.app/Contents/Resources/ollama "$HOME/Applications/Ollama.app/Contents/Resources/ollama"; do
    if [ -n "$c" ] && [ -x "$c" ]; then OLLAMA="$c"; return 0; fi
  done
  return 1
}
if ! find_ollama; then
  ok "Baixando o Ollama oficial (ollama.com)…"
  TMP="$(mktemp -d)"
  curl -fL --progress-bar -o "$TMP/Ollama.zip" "https://ollama.com/download/Ollama-darwin.zip" || die "Falha ao baixar o Ollama. Verifique a internet."
  ditto -x -k "$TMP/Ollama.zip" "$TMP" || die "Falha ao descompactar o Ollama."
  if [ -w /Applications ]; then DEST=/Applications; else DEST="$HOME/Applications"; mkdir -p "$DEST"; fi
  rm -rf "$DEST/Ollama.app"
  mv "$TMP/Ollama.app" "$DEST/" || die "Não consegui mover o Ollama para $DEST."
  xattr -dr com.apple.quarantine "$DEST/Ollama.app" 2>/dev/null || true
  rm -rf "$TMP"
  find_ollama || die "Ollama instalado, mas o comando não foi encontrado."
fi
ok "Ollama: $OLLAMA"

if ! curl -fs http://127.0.0.1:11434/api/tags >/dev/null 2>&1; then
  open -g -a Ollama 2>/dev/null || ("$OLLAMA" serve >"$LOG_DIR/ollama.log" 2>&1 &)
  printf "  Aguardando o Ollama iniciar"
  for _ in $(seq 1 60); do
    curl -fs http://127.0.0.1:11434/api/tags >/dev/null 2>&1 && break
    printf "."; sleep 1
  done
  echo
fi
curl -fs http://127.0.0.1:11434/api/tags >/dev/null 2>&1 || die "O Ollama não iniciou. Abra o app Ollama manualmente e rode de novo."
ok "Ollama funcionando"

# --------------------------------------------------------------------------
step "5/9  Baixando os modelos de IA (pode levar alguns minutos)"
pull() {
  if "$OLLAMA" list 2>/dev/null | awk '{print $1}' | grep -qx "$1"; then ok "$2 ($1) já estava baixado"
  else printf "  Baixando %s (%s)…\n" "$2" "$1"; "$OLLAMA" pull "$1" || die "Falha ao baixar $1."; ok "$2 pronto"; fi
}
pull "$M_JARVIS" "Jarvis 1.0"
pull "$M_TURBO"  "Jarvis Turbo 1.0"
pull "$M_CODE"   "Jarvis Code 1.0"

# Atalhos para usar também no Terminal: ollama run jarvis / jarvis-turbo / jarvis-code
make_alias() { # nome modelo variável-do-prompt
  local MF; MF="$(mktemp)"
  { echo "FROM $2"; echo "PARAMETER num_ctx $NUM_CTX"; echo 'SYSTEM """'
    "$PY" -c "import sys; sys.path.insert(0, '$SRC/server'); import jarvis_server as j; print(j.$3)"
    echo '"""'; } > "$MF"
  "$OLLAMA" create "$1" -f "$MF" >/dev/null 2>&1 && ok "Atalho de Terminal: ollama run $1"
  rm -f "$MF"
}
make_alias jarvis "$M_JARVIS" BASE_PROMPT
make_alias jarvis-turbo "$M_TURBO" BASE_PROMPT
make_alias jarvis-code "$M_CODE" CODE_PROMPT

# --------------------------------------------------------------------------
step "6/9  Instalando o servidor do Jarvis"
mkdir -p "$INSTALL_DIR" "$BIN_DIR" "$LOG_DIR" "$AGENTS"
rm -rf "$INSTALL_DIR/server"
cp -R "$SRC/server" "$INSTALL_DIR/server"
cp "$SRC/scripts/jarvis" "$BIN_DIR/jarvis"
cp "$SRC/scripts/liberar-espaco.sh" "$SRC/scripts/uninstall.sh" "$SRC/scripts/acelerar.sh" "$BIN_DIR/"
chmod +x "$BIN_DIR/"*

"$PY" - "$APP_SUPPORT/config.json" "$M_JARVIS" "$M_TURBO" "$M_CODE" "$NUM_CTX" "$CONCURRENT" "$LOG_DIR/tunnel.log" <<'PYEOF'
import json, os, sys
path, mj, mt, mc, ctx, conc, tlog = sys.argv[1:]
try:
    cfg = json.load(open(path))
except Exception:
    cfg = {}
cfg.pop("model", None)
cfg.update({"models": {"jarvis": mj, "turbo": mt, "code": mc}, "num_ctx": int(ctx),
            "num_ctx_code": max(8192, int(ctx)), "max_concurrent": int(conc), "tunnel_log": tlog})
cfg.setdefault("max_users", 4)
cfg.setdefault("port", 8080)
cfg.setdefault("external_port", 8081)
cfg.setdefault("lan", True)
os.makedirs(os.path.dirname(path), exist_ok=True)
json.dump(cfg, open(path, "w"), indent=2, ensure_ascii=False)
os.chmod(path, 0o600)
PYEOF

cat > "$AGENTS/com.jarvis.server.plist" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>com.jarvis.server</string>
  <key>ProgramArguments</key><array>
    <string>$PY</string><string>$INSTALL_DIR/server/jarvis_server.py</string>
  </array>
  <key>EnvironmentVariables</key><dict>
    <key>JARVIS_HOME</key><string>$APP_SUPPORT</string>
    <key>PYTHONUNBUFFERED</key><string>1</string>
  </dict>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>ThrottleInterval</key><integer>5</integer>
  <key>StandardOutPath</key><string>$LOG_DIR/server.log</string>
  <key>StandardErrorPath</key><string>$LOG_DIR/server.log</string>
</dict></plist>
EOF
launchctl bootout "gui/$UID_NUM/com.jarvis.server" 2>/dev/null || true
sleep 1
launchctl bootstrap "gui/$UID_NUM" "$AGENTS/com.jarvis.server.plist" || die "Não consegui iniciar o serviço do Jarvis."
printf "  Aguardando o Jarvis iniciar"
for _ in $(seq 1 30); do curl -fs http://localhost:8080/api/health >/dev/null 2>&1 && break; printf "."; sleep 1; done
echo
curl -fs http://localhost:8080/api/health >/dev/null 2>&1 || die "O servidor não respondeu. Veja: $LOG_DIR/server.log"
ok "Servidor do Jarvis rodando (inicia sozinho quando o Mac liga)"

# --------------------------------------------------------------------------
step "7/9  Link para usar fora de casa"
WANT_LINK="${JARVIS_LINK:-}"
if [ -z "$WANT_LINK" ]; then
  echo "  Cria um link seguro (https://….trycloudflare.com) para a família usar o Jarvis"
  echo "  no 4G ou na casa de outras pessoas. Protegido pelo código da família."
  if ask "Ativar o link externo?" s; then WANT_LINK=sim; else WANT_LINK=nao; fi
fi
if [ "$WANT_LINK" = "sim" ]; then
  if [ ! -x "$BIN_DIR/cloudflared" ]; then
    TMP="$(mktemp -d)"
    curl -fL --progress-bar -o "$TMP/cf.tgz" \
      "https://github.com/cloudflare/cloudflared/releases/latest/download/cloudflared-darwin-$( [ "$ARCH" = arm64 ] && echo arm64 || echo amd64 ).tgz" \
      && tar -xzf "$TMP/cf.tgz" -C "$TMP" && mv "$TMP/cloudflared" "$BIN_DIR/cloudflared" && chmod +x "$BIN_DIR/cloudflared" \
      && xattr -d com.apple.quarantine "$BIN_DIR/cloudflared" 2>/dev/null
    rm -rf "$TMP"
  fi
  if [ -x "$BIN_DIR/cloudflared" ]; then
    cat > "$AGENTS/com.jarvis.tunnel.plist" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>Label</key><string>com.jarvis.tunnel</string>
  <key>ProgramArguments</key><array>
    <string>$BIN_DIR/cloudflared</string><string>tunnel</string><string>--no-autoupdate</string>
    <string>--url</string><string>http://127.0.0.1:8081</string>
  </array>
  <key>RunAtLoad</key><true/>
  <key>KeepAlive</key><true/>
  <key>ThrottleInterval</key><integer>10</integer>
  <key>StandardOutPath</key><string>$LOG_DIR/tunnel.log</string>
  <key>StandardErrorPath</key><string>$LOG_DIR/tunnel.log</string>
</dict></plist>
EOF
    launchctl bootout "gui/$UID_NUM/com.jarvis.tunnel" 2>/dev/null || true
    sleep 1
    rm -f "$LOG_DIR/tunnel.log"
    launchctl bootstrap "gui/$UID_NUM" "$AGENTS/com.jarvis.tunnel.plist" && ok "Túnel iniciado"
    printf "  Gerando o link"
    LINK=""
    for _ in $(seq 1 30); do
      LINK="$(grep -aoE 'https://[a-z0-9-]+\.trycloudflare\.com' "$LOG_DIR/tunnel.log" 2>/dev/null | tail -1)"
      [ -n "$LINK" ] && break; printf "."; sleep 1
    done
    echo
    [ -n "$LINK" ] && ok "Link externo: ${B}$LINK${N}" || warn "O link ainda está sendo criado. Depois rode: jarvis link"
  else
    warn "Não consegui baixar o cloudflared. O Jarvis funciona normalmente em casa."
  fi
else
  launchctl bootout "gui/$UID_NUM/com.jarvis.tunnel" 2>/dev/null || true
  rm -f "$AGENTS/com.jarvis.tunnel.plist"
  ok "Link externo desativado (ative depois com: jarvis link ligar)"
fi

# --------------------------------------------------------------------------
step "8/9  Criando o app Jarvis no seu Mac"
if [ -w /Applications ]; then APPS=/Applications; else APPS="$HOME/Applications"; mkdir -p "$APPS"; fi
APP="$APPS/Jarvis.app"
rm -rf "$APP"
mkdir -p "$APP/Contents/MacOS" "$APP/Contents/Resources"
cp "$SRC/mac-app/Info.plist" "$APP/Contents/Info.plist"
cp "$SRC/assets/AppIcon.icns" "$APP/Contents/Resources/AppIcon.icns"
if command -v swiftc >/dev/null 2>&1 && swiftc -O "$SRC/mac-app/main.swift" -o "$APP/Contents/MacOS/Jarvis" 2>"$LOG_DIR/swift-build.log"; then
  ok "App nativo compilado (janela própria do Jarvis)"
else
  warn "Não deu para compilar o app nativo (detalhes em $LOG_DIR/swift-build.log). Usando a versão pelo navegador."
  cat > "$APP/Contents/MacOS/Jarvis" <<'EOF'
#!/bin/bash
open -g -a Ollama 2>/dev/null
launchctl kickstart "gui/$(id -u)/com.jarvis.server" 2>/dev/null
for _ in $(seq 1 30); do curl -fs http://localhost:8080/api/health >/dev/null && break; sleep 1; done
URL="http://localhost:8080"
for B in "Google Chrome" "Microsoft Edge" "Brave Browser"; do
  if [ -d "/Applications/$B.app" ]; then open -na "$B" --args --app="$URL"; exit 0; fi
done
open "$URL"
EOF
  chmod +x "$APP/Contents/MacOS/Jarvis"
fi
codesign --force --deep -s - "$APP" >/dev/null 2>&1 || true
touch "$APP"
/System/Library/Frameworks/CoreServices.framework/Frameworks/LaunchServices.framework/Support/lsregister -f "$APP" >/dev/null 2>&1 || true
ok "App instalado em: $APP"

if ! defaults read com.apple.dock persistent-apps 2>/dev/null | grep -q "Jarvis.app"; then
  defaults write com.apple.dock persistent-apps -array-add \
    "<dict><key>tile-data</key><dict><key>file-data</key><dict><key>_CFURLString</key><string>file://$APP/</string><key>_CFURLStringType</key><integer>15</integer></dict></dict></dict>"
  killall Dock 2>/dev/null || true
  ok "Ícone do Jarvis adicionado ao Dock"
fi

# otimizações de velocidade (Flash Attention, cache comprimido, mais memória para a GPU)
if ask "Aplicar as otimizações de velocidade do Jarvis? (pode pedir sua senha)" s; then
  bash "$SRC/scripts/acelerar.sh"
fi

# comando "jarvis" no Terminal
if [ -w /usr/local/bin ] 2>/dev/null; then
  ln -sf "$BIN_DIR/jarvis" /usr/local/bin/jarvis && ok "Comando 'jarvis' disponível no Terminal"
else
  for RC in "$HOME/.zshrc" "$HOME/.bash_profile"; do
    touch "$RC"
    grep -q "Application Support/Jarvis/bin" "$RC" || echo 'export PATH="$PATH:$HOME/Library/Application Support/Jarvis/bin"' >> "$RC"
  done
  ok "Comando 'jarvis' disponível no Terminal (abra uma nova janela do Terminal)"
fi

# Mac acordado para a família usar a qualquer hora
echo
echo "  Para a família usar o Jarvis a qualquer hora, o Mac não pode dormir (quando estiver na tomada)."
if ask "Impedir que o Mac durma quando estiver na tomada? (pede sua senha)" s; then
  sudo pmset -c sleep 0 disksleep 0 && sudo pmset -c womp 1 && ok "Mac não dorme mais na tomada (a tela ainda apaga normalmente)" \
    || warn "Não foi possível alterar. Ajuste em Ajustes do Sistema › Bateria/Energia."
fi

# --------------------------------------------------------------------------
step "9/9  Testando o Jarvis"
KEY="$("$PY" -c "import json; print(json.load(open('$APP_SUPPORT/config.json'))['api_key'])")"
CODE="$("$PY" -c "import json; print(json.load(open('$APP_SUPPORT/config.json'))['family_code'])")"
printf "  Perguntando ao Jarvis: \"Apresente-se em uma frase.\"\n"
ANSWER="$(curl -fs --max-time 300 http://localhost:8080/v1/chat/completions \
  -H "Authorization: Bearer $KEY" -H "Content-Type: application/json" \
  -d '{"model":"jarvis","messages":[{"role":"user","content":"Apresente-se em uma frase curta."}]}' \
  | "$PY" -c "import json,sys; print(json.load(sys.stdin)['choices'][0]['message']['content'].strip())" 2>/dev/null)"
if [ -n "$ANSWER" ]; then
  printf "  ${O}Jarvis:${N} %s\n" "$ANSWER"
  ok "Teste concluído com sucesso!"
else
  warn "O teste não respondeu a tempo (normal na primeira vez, o modelo ainda está carregando)."
fi

LAN="$(ipconfig getifaddr en0 2>/dev/null || ipconfig getifaddr en1 2>/dev/null || true)"
HOSTN="$(scutil --get LocalHostName 2>/dev/null || hostname -s)"
LINK="$(grep -aoE 'https://[a-z0-9-]+\.trycloudflare\.com' "$LOG_DIR/tunnel.log" 2>/dev/null | tail -1)"

cat <<EOF

${O}${B}════════════════════════════════════════════════════════════════${N}
${B}  ✅ O Jarvis está pronto!${N}
${O}${B}════════════════════════════════════════════════════════════════${N}
  ${B}No Mac:${N}          abra o app ${B}Jarvis${N} (Dock, Launchpad ou Aplicativos)
  ${B}No Wi-Fi de casa:${N} http://$HOSTN.local:8080 $( [ -n "$LAN" ] && echo "  ou  http://$LAN:8080")
  ${B}Fora de casa:${N}     ${LINK:-(desativado — ative com: jarvis link ligar)}
  ${B}Código da família:${N} ${O}${B}$CODE${N}   (pedido uma vez em cada celular/computador novo)

  ${B}Modos:${N} 🧠 Jarvis 1.0 ($M_JARVIS) · ⚡ Jarvis Turbo 1.0 ($M_TURBO) · </> Jarvis Code 1.0 ($M_CODE)

  ${B}Projeto Jarvis (no lugar do Gemini/Claude):${N}
    URL base:  http://localhost:8080/v1   $( [ -n "$LINK" ] && echo "ou  $LINK/v1")
    Chave API: $KEY
    Modelos:   jarvis · jarvis-turbo · jarvis-code

  Comandos úteis no Terminal:  ${B}jarvis status${N} · ${B}jarvis link${N} · ${B}jarvis codigo${N} · ${B}jarvis ajuda${N}
  Primeiro passo: abra o app, toque em "Pessoa 1", crie sua senha e, em ⚙️, coloque os nomes da família.

EOF
open "$APP" 2>/dev/null || open http://localhost:8080
