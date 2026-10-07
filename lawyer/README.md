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

O app faz parte do site Pedropixel, montado por `scripts/build-site.sh` (na raiz do repositório):
- **Netlify** (endereço principal): https://sparkling-cheesecake-3589bd.netlify.app/lawyer/ — configuração em `netlify.toml`.
- **GitHub Pages** (cópia): https://pedrututuant06-spec.github.io/apps/lawyer/

No navegador, os cadastros ficam salvos **no próprio navegador** (localStorage). Cada aparelho e cada endereço tem
os seus dados, e limpar os dados do navegador apaga os cadastros.

## App Store e Play Store

Veja **[LOJAS.md](LOJAS.md)**. Ali estão as contas necessárias, a primeira publicação (`scripts/publicar-nas-lojas.sh`)
e as atualizações automáticas pelo EAS Update. Os textos e as imagens das lojas ficam em `loja/`.

## Trocar o nome do app

Altere `name` em `app.json` e o título da tela inicial em `src/app/_layout.tsx`. O nome aparece no celular depois de
uma nova versão nas lojas. **Não altere** `ios.bundleIdentifier`, `android.package` nem `slug` depois de publicar:
as lojas tratariam como outro app.

O ícone é gerado a partir de `assets/icone.svg`.
