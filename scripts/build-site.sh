#!/bin/bash
# Monta o site Pedropixel completo numa pasta:
#   /           página inicial (site/)
#   /lawyer/    app lawyer (versão web do Expo)
#   /links/     página de links da bio (pedropixel/)
#
# Uso:  bash scripts/build-site.sh [pasta-de-saida]
# SITE_PREFIX: subcaminho onde o site fica. Vazio no Netlify; "/apps" no GitHub Pages.
set -euo pipefail

RAIZ="$(cd "$(dirname "$0")/.." && pwd)"
SAIDA="$(mkdir -p "${1:-dist-site}" && cd "${1:-dist-site}" && pwd)"
PREFIX="${SITE_PREFIX:-}"
APP="$PREFIX/lawyer"

rm -rf "${SAIDA:?}"/* "$SAIDA"/.nojekyll

echo "==> App lawyer em $APP/"
cd "$RAIZ/lawyer"
[ -d node_modules ] || npm ci
EXPO_WEB_BASE_URL="$APP" npx expo export --platform web --output-dir "$SAIDA/lawyer"

# Ícones e manifesto para "Adicionar à Tela de Início" (iPhone, iPad e Android).
ICONES=""
for n in 120 152 167 180; do ICONES+="<link rel=\"apple-touch-icon\" sizes=\"${n}x${n}\" href=\"$APP/icone-ios-$n.png\"/>"; done
ICONES+="<link rel=\"apple-touch-icon\" href=\"$APP/icone-ios-180.png\"/>"
sed -i -e 's#<html lang="en">#<html lang="pt-BR">#' \
  -e "s#</head>#$ICONES<link rel=\"manifest\" href=\"$APP/manifest.json?v=4\"/><meta name=\"apple-mobile-web-app-title\" content=\"lawyer\"/></head>#" \
  "$SAIDA/lawyer/index.html"
sed -i "s#__BASE__#$APP#g" "$SAIDA/lawyer/manifest.json"

echo "==> Página inicial e links"
cp -r "$RAIZ/site/." "$SAIDA/"
mkdir -p "$SAIDA/img"
cp "$RAIZ/lawyer/loja/capturas/iphone-1-lista.png" "$RAIZ/lawyer/loja/capturas/iphone-2-cadastro.png" \
   "$RAIZ/lawyer/loja/capturas/iphone-3-qualificacao.png" "$SAIDA/img/"
cp -r "$RAIZ/pedropixel" "$SAIDA/links"

# Links diretos do app (ex.: /lawyer/cliente/3) abrem o próprio app, que resolve a rota.
echo "$APP/*  $APP/index.html  200" > "$SAIDA/_redirects"   # Netlify
cp "$SAIDA/lawyer/index.html" "$SAIDA/404.html"            # GitHub Pages
touch "$SAIDA/.nojekyll"                                    # GitHub Pages: não ignorar a pasta _expo

echo "==> Pronto: $SAIDA"
