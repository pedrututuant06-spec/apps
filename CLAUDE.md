# Regras deste repositório

## Site Pedropixel
- O site é montado por `scripts/build-site.sh` e publicado no **Netlify** (`netlify.toml`): página inicial `site/` em `/`,
  app lawyer em `/lawyer/`, links da bio `pedropixel/` em `/links/`. O GitHub Pages recebe uma cópia igual em
  https://pedrututuant06-spec.github.io/apps/ (workflow `.github/workflows/lawyer-web.yml`).
- Conteúdo novo (app, jogo, mod) entra na página inicial `site/index.html` **e** na página de links.

## Links do Pedropixel
- A página de links da bio fica em `pedropixel/index.html`, publicada em `/links/` do site (Netlify) e em
  **https://pedrututuant06-spec.github.io/apps/links/**.
- **Sempre** que algo novo for criado (app, jogo, mod de Minecraft, vídeo etc.), adicione o link na seção certa dessa
  página (Canal, Apps, Jogos ou Mods de Minecraft). Isso vale para todo conteúdo do canal, menos posts da comunidade e
  imagens do canal.
- Em descrições e comentários fixados de vídeos, inclua o link do conteúdo e o link da bio acima.
- Textos e vídeos de divulgação ficam em `divulgacao/` (YouTube em `divulgacao/youtube/`).
- TikTok e Instagram: ainda **não** mexer. Só criar contas novas quando o dono pedir, todas com o nome **Pedropixel**.

## Projetos
- `lawyer/` — app de cadastro de clientes para advocacia (Expo / React Native). Veja `lawyer/README.md` e `lawyer/LOJAS.md`.
