# Publicar o lawyer na App Store e na Play Store

O app já está preparado. Algumas partes só o dono das contas pode fazer: pagar, confirmar identidade e
aceitar os termos das lojas. Este guia mostra tudo na ordem.

## 1. Criar as contas (só uma vez)

| Conta | Custo | Onde | Observação |
|---|---|---|---|
| Expo | grátis | https://expo.dev/signup | Monta o app na nuvem e entrega as atualizações |
| Apple Developer | US$ 99 por ano | https://developer.apple.com/programs/enroll/ | A aprovação leva de 1 a 2 dias |
| Google Play Console | US$ 25 uma vez | https://play.google.com/console/signup | A verificação de identidade leva alguns dias |

> **Atenção, Play Store:** conta **pessoal** criada recentemente precisa fazer um **teste fechado com pelo menos
> 12 pessoas por 14 dias** antes de publicar para todo mundo. Contas de **empresa** (com CNPJ/D-U-N-S) não têm
> essa exigência.

## 2. Gerar o app e enviar (no Mac)

No Terminal:

```bash
cd ~/Desktop/apps
git pull
cd lawyer
bash scripts/publicar-nas-lojas.sh
```

O script vai:
1. Pedir o login da conta **Expo**.
2. Pedir o login da conta **Apple** (com o código de 2 fatores). Responda **Y** ou Enter às perguntas. O
   próprio Expo cria os certificados e o app na App Store Connect.
3. Montar o app de iPhone na nuvem (uns 15 a 30 minutos) e enviá-lo para a **App Store Connect**.
4. Montar o app de Android e mostrar um link para baixar o arquivo **.aab**.

## 3. App Store (iPhone e iPad)

Em https://appstoreconnect.apple.com → **Apps** → **lawyer**:
1. Preencha os textos com o que está em `loja/textos.md`.
2. Envie as capturas de `loja/capturas/` (as `iphone-*` e as `ipad-*`).
3. Em **Privacidade do app**, escolha "Dados não coletados".
4. Em **Build**, escolha a versão que o script enviou.
5. Clique em **Enviar para revisão**. A Apple costuma responder em 1 a 3 dias.
6. Em **Informações do app**, anote o número **Apple ID** (ex.: 6741234567). Ele vai em `eas.json`, em
   `submit.production.ios.ascAppId`, para que as próximas versões sejam enviadas sozinhas pelo GitHub.

## 4. Play Store (Samsung e outros Android)

Em https://play.google.com/console:
1. **Criar app** → nome "lawyer", idioma Português (Brasil), App, Gratuito.
2. **Versão → Teste fechado** (ou **Produção**, se a conta for de empresa) → **Criar nova versão** → envie o
   arquivo **.aab** baixado no passo 2.
3. Preencha **Ficha da loja** com os textos e imagens de `loja/`, incluindo `icone-play-512.png` e
   `play-destaque.png`.
4. Preencha **Conteúdo do app**: política de privacidade (link em `loja/textos.md`), Segurança dos dados ("não
   coleta dados"), classificação de conteúdo (Livre), público-alvo (18+) e "sem anúncios".
5. Envie para revisão.

## 5. Atualizações automáticas (só uma vez)

Depois disso, toda alteração no app vira uma **atualização automática**: quem já instalou recebe a novidade
na próxima vez que abrir o app, sem passar pelas lojas.

1. Em https://expo.dev → seu avatar → **Account settings** → **Access tokens** → **Create token**. Copie o
   token.
2. Em https://github.com/pedrututuant06-spec/apps/settings/secrets/actions → **New repository secret**:
   - Name: `EXPO_TOKEN`
   - Secret: cole o token
   - **Add secret**

Pronto. O GitHub publica cada atualização sozinho (workflow `.github/workflows/lawyer-mobile.yml`).

### O que vai por atualização e o que precisa de nova versão na loja

- **Por atualização automática:** telas, campos, textos, cores, validações, correções. Ou seja, quase tudo.
- **Precisa de nova versão na loja:** trocar o ícone ou o nome do app, ou adicionar um recurso novo do
  celular (câmera, notificações etc.). Nesse caso:
  1. Aumente `"version"` em `app.json` (ex.: `1.0.0` para `1.1.0`).
  2. No GitHub, vá em **Actions** → **lawyer (iPhone e Android)** → **Run workflow**, marque **loja** e clique
     em Run.
  3. O iPhone é enviado sozinho para a App Store Connect. Para o Android enviar sozinho também, cadastre uma
     chave de conta de serviço do Google no Expo (`npx eas-cli credentials` → Android → Google Service
     Account). Sem ela, baixe o .aab em https://expo.dev e envie na Play Console como no passo 4.
