#!/bin/bash
# Primeira publicação do app na App Store e na Play Store.
# Rode no Mac, dentro da pasta lawyer:   bash scripts/publicar-nas-lojas.sh
# Passo a passo completo em LOJAS.md.
set -e
cd "$(dirname "$0")/.."

echo "==> Instalando dependências"
npm install

echo "==> Entrar na conta Expo (crie grátis em https://expo.dev/signup se ainda não tiver)"
npx eas-cli@latest whoami >/dev/null 2>&1 || npx eas-cli@latest login

echo "==> Criando o projeto no Expo"
npx eas-cli@latest init --force
npx eas-cli@latest update:configure

echo "==> iPhone/iPad: gerando o app e enviando para a App Store Connect"
echo "    (vai pedir o login da sua conta Apple Developer; responda Y/Enter para as perguntas)"
npx eas-cli@latest build --platform ios --profile production --auto-submit

echo "==> Android: gerando o app (.aab)"
npx eas-cli@latest build --platform android --profile production

echo
echo "Pronto! Agora siga a parte final de LOJAS.md (enviar o .aab na Play Console e"
echo "enviar o app para revisão na App Store Connect)."
