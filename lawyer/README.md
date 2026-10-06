# lawyer

App de cadastro de clientes para escritório de advocacia (iOS e Android), feito com Expo / React Native.
O nome "lawyer" é provisório.

## Funcionalidades

- Lista de cadastros com busca (nome, CPF, celular, e-mail, cidade) e filtro por tipo
- Cadastro, edição e exclusão com os campos:
  - **Identificação:** nome, tratamento (Senhor, Senhora, Doutor…), tipo (Cliente, Contrário, Testemunha, Outro…), grupo (Escritório…)
  - **Documentos:** CPF (com validação), RG, órgão emissor, data de nascimento
  - **Contato:** telefone, celular, telefone comercial, fax, e-mail
  - **Qualificação:** nacionalidade, estado civil, profissão, local de trabalho, qualificação — complemento
  - **Endereço:** CEP (preenche endereço, bairro, cidade e UF pelo ViaCEP), UF, endereço, bairro, cidade
  - **Anotações**
- Campos de seleção aceitam um valor digitado quando a opção não está na lista
- Dados salvos localmente no aparelho (SQLite), funciona sem internet

## Como rodar

```bash
cd lawyer
npm install
npx expo start
```

Escaneie o QR code com o app **Expo Go** (iPhone: câmera; Android/Samsung: app Expo Go).

## Versão web

Endereço: **https://pedrututuant06-spec.github.io/apps/**

Cada push em `lawyer/` gera o site automaticamente (`.github/workflows/lawyer-web.yml`) e publica no branch
`gh-pages`. Na primeira vez é preciso ativar em GitHub → Settings → Pages → Branch: `gh-pages` / `(root)` → Save.

No navegador os cadastros ficam salvos **no próprio navegador** (localStorage): cada computador/navegador tem
os seus dados, e limpar os dados do navegador apaga os cadastros.

## Gerar o app para instalar / publicar

```bash
npx eas-cli@latest build --platform android   # .aab / .apk
npx eas-cli@latest build --platform ios       # requer conta Apple Developer
```

Para trocar o nome do app depois, altere `name`, `slug`, `scheme`, `ios.bundleIdentifier` e
`android.package` em `app.json`, e o título da tela inicial em `src/app/_layout.tsx`.
